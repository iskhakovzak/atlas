// Runs real API route handlers in node:test: `cloudflare:workers` and `next/headers` are stubbed, `@/` imports and
// extensionless TypeScript imports resolve like the bundler, and TypeScript is transformed (parameter properties
// included). The database is in-memory SQLite with every migration in drizzle/ applied, behind a D1-shaped adapter.
import {registerHooks, stripTypeScriptTypes} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {createHash, randomBytes} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const stub = (name) => pathToFileURL(path.join(root, 'tests', 'support', name)).href;
const stubs = {'cloudflare:workers': stub('cloudflare-workers.mjs'), 'next/headers': stub('next-headers.mjs')};

function withExtension(base) {
  for (const candidate of [base, base + '.ts', base + '.tsx', base + '.mjs', base + '.js', path.join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

let hooked = false;
function hook() {
  if (hooked) return;
  hooked = true;
  registerHooks({
    resolve(specifier, context, next) {
      if (stubs[specifier]) return {url: stubs[specifier], shortCircuit: true};
      let file = null;
      if (specifier.startsWith('@/')) file = withExtension(path.join(root, specifier.slice(2)));
      else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
        const parent = fileURLToPath(context.parentURL);
        if (/\.tsx?$/.test(parent)) file = withExtension(path.resolve(path.dirname(parent), specifier));
      }
      if (file) return {url: pathToFileURL(file).href, shortCircuit: true};
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith('file:') && /\.ts$/.test(url) && !url.includes('/node_modules/')) {
        const source = readFileSync(fileURLToPath(url), 'utf8');
        return {format: 'module', source: stripTypeScriptTypes(source, {mode: 'transform', sourceUrl: url}), shortCircuit: true};
      }
      return next(url, context);
    },
  });
}

const value = (item) => (item === undefined ? null : typeof item === 'boolean' ? Number(item) : item);

/** In-memory SQLite with the real schema, shaped like a D1 binding. */
export function memoryD1() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync(path.join(root, 'drizzle')).filter((name) => name.endsWith('.sql')).sort()) {
    for (const part of readFileSync(path.join(root, 'drizzle', file), 'utf8').split('--> statement-breakpoint')) {
      if (part.trim()) sqlite.exec(part);
    }
  }
  const statement = (sql, args = []) => ({
    sql, args,
    bind: (...values) => statement(sql, values.map(value)),
    first: async (column) => {
      const row = sqlite.prepare(sql).get(...args) ?? null;
      return column && row ? row[column] : row;
    },
    run: async () => {
      const result = sqlite.prepare(sql).run(...args);
      return {success: true, meta: {changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid)}};
    },
    all: async () => ({success: true, results: sqlite.prepare(sql).all(...args)}),
    raw: async () => sqlite.prepare(sql).all(...args).map((row) => Object.values(row)),
  });
  return {
    sqlite,
    prepare: (sql) => statement(sql),
    batch: async (list) => {
      sqlite.exec('BEGIN');
      try {
        const results = list.map((item) => {
          const prepared = sqlite.prepare(item.sql);
          if (/\bRETURNING\b|^\s*SELECT/i.test(item.sql)) return {success: true, results: prepared.all(...item.args)};
          const result = prepared.run(...item.args);
          return {success: true, meta: {changes: Number(result.changes)}, results: []};
        });
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

export const origin = 'http://localhost';

/**
 * A fresh database and environment. `overrides` go on top of the defaults (operator email, auth secret,
 * on-screen sign-in codes for localhost, no Telegram). Every call replaces the previous harness's database.
 */
export function routeHarness(overrides = {}) {
  hook();
  const db = memoryD1();
  const env = (globalThis.__atlasTestEnv ??= {});
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    DB: db,
    ATLAS_OPERATOR_EMAIL: 'owner@atlas.test',
    ATLAS_AUTH_SECRET: 'test-secret-'.padEnd(48, 'x'),
    ATLAS_AUTH_DEV_CODES: 'true',
    ATLAS_TELEGRAM_NOTICES: 'off',
    ATLAS_IMPORT_MONITOR: 'off',
  }, overrides);
  globalThis.__atlasTestBackground = [];

  return {
    db, env,
    /** Imports a route module, e.g. route('app/api/operations/route.ts'). */
    route: (file) => import(pathToFileURL(path.join(root, file)).href),
    /** A session for this user (email:… / phone:… / tg:…); returns the Cookie header value. */
    signIn(user) {
      const token = randomBytes(32).toString('base64url');
      const now = Date.now();
      const method = user.method ?? (user.userId.startsWith('phone:') ? 'phone' : user.userId.startsWith('tg:') ? 'telegram' : 'email');
      db.sqlite.prepare('INSERT INTO market_auth_sessions (id,user_id,method,email,display_name,contact,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(createHash('sha256').update(token).digest('hex'), user.userId, method, user.email ?? null, user.displayName ?? 'Test', user.contact ?? user.email ?? user.userId, now, now + 86_400_000);
      return `__Host-atlas_session=${token}`;
    },
    /** Calls `handler` with a same-origin request (unless `origin` is given) and returns the Response. */
    async call(handler, {method = 'GET', url = '/', cookie, body, headers = {}, origin: from = origin} = {}) {
      const init = {method, headers: new Headers(headers)};
      if (cookie) init.headers.set('cookie', cookie);
      if (from && method !== 'GET') init.headers.set('origin', from);
      if (!init.headers.has('cf-connecting-ip')) init.headers.set('cf-connecting-ip', '203.0.113.7');
      if (body !== undefined) {
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
        init.headers.set('content-type', 'application/json');
      }
      const request = new Request(new URL(url, origin), init);
      globalThis.__atlasTestRequest = request;
      try {
        return await handler(request);
      } finally {
        globalThis.__atlasTestRequest = undefined;
      }
    },
    /** Waits for work the routes handed to waitUntil (Telegram, projections). */
    async settle() {
      while (globalThis.__atlasTestBackground.length) await globalThis.__atlasTestBackground.shift();
    },
  };
}
