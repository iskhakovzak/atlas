import {env} from 'cloudflare:workers';
import {database, deferBackground, operator} from './server';
import {recordImport, type ImportEvent, type MonitorCustomer, type MonitorDeps} from './import-monitor';
import {sendTelegram, telegramNoticesLive} from '@/lib/auth/server';
import type {AuthUser} from '@/lib/auth/core';

// The import monitor's runtime side (lib/market/import-monitor.ts): who gets the messages and how to reach the customer.

const bindings = () => env as unknown as {ATLAS_MONITOR_TELEGRAM?: string; ATLAS_IMPORT_MONITOR?: string; ATLAS_OPERATOR_EMAIL?: string};

/** Only the live site sends (like order notices): ATLAS_IMPORT_MONITOR=on/off overrides, so staging never does. */
export function importMonitorLive(request?: Request) {
  const flag = bindings().ATLAS_IMPORT_MONITOR?.trim().toLowerCase();
  if (flag === 'on') return true;
  if (flag === 'off') return false;
  return telegramNoticesLive(request);
}

/**
 * The owner's Telegram ("tg:<id>"): ATLAS_MONITOR_TELEGRAM when set (the numeric id), otherwise the Telegram
 * attached to the operator's account (ATLAS_OPERATOR_EMAIL), or that account itself when it was made with Telegram.
 */
export async function ownerTelegram(): Promise<string | undefined> {
  const set = bindings().ATLAS_MONITOR_TELEGRAM?.trim().replace(/^tg:/, '');
  if (set && /^\d{1,20}$/.test(set)) return 'tg:' + set;
  const email = bindings().ATLAS_OPERATOR_EMAIL?.trim().toLowerCase();
  if (!email) return undefined;
  const db = database();
  const account = (await db.prepare('SELECT user_id FROM market_auth_links WHERE subject=?').bind('email:' + email).first<{user_id: string}>())?.user_id ?? 'email:' + email;
  if (account.startsWith('tg:')) return account;
  const link = await db.prepare("SELECT subject FROM market_auth_links WHERE user_id=? AND subject LIKE 'tg:%' ORDER BY created_at DESC LIMIT 1").bind(account).first<{subject: string}>();
  return link?.subject;
}

/** The customer's name and every attached way to reach them (phone, email, Telegram). */
export async function monitorCustomer(user: AuthUser | null): Promise<MonitorCustomer | undefined> {
  if (!user) return undefined;
  const subjects = new Set([user.userId]);
  try {
    const links = await database().prepare('SELECT subject FROM market_auth_links WHERE user_id=?').bind(user.userId).all<{subject: string}>();
    for (const row of links.results ?? []) subjects.add(row.subject);
  } catch (error) {
    console.error('Import monitor contact lookup failed', String(error).slice(0, 200));
  }
  const pick = (prefix: string) => [...subjects].find(subject => subject.startsWith(prefix))?.slice(prefix.length);
  return {
    userId: user.userId,
    name: user.displayName,
    phone: pick('phone:'),
    email: user.email || pick('email:'),
    telegramId: pick('tg:'),
  };
}

/** Deps for one run: the owner is looked up once, and nothing is sent when no owner Telegram is known. */
export function monitorDeps(): MonitorDeps {
  let owner: Promise<string | undefined> | undefined;
  return {
    db: database(),
    now: Date.now(),
    send: async (html) => {
      owner ??= ownerTelegram().catch(() => undefined);
      const subject = await owner;
      if (!subject) {
        console.error('Import monitor: no owner Telegram (set ATLAS_MONITOR_TELEGRAM or attach Telegram to the operator account)');
        return;
      }
      const sent = await sendTelegram(subject, {text: html.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true});
      if (!sent.ok) console.error('Import monitor message failed', sent.failure.kind);
    },
  };
}

/** Records a live import after the answer is sent; the customer never waits for it. */
export function monitorImport(request: Request, user: AuthUser | null, event: Omit<ImportEvent, 'customer'>) {
  if (!importMonitorLive(request)) return;
  // The owner's own imports (catalog batches, tests) count for the store but are not reported as a customer.
  const quiet = event.quiet || Boolean(user && operator(user.email));
  deferBackground((async () => {
    const customer = event.kind === 'ok' || quiet ? undefined : await monitorCustomer(user);
    await recordImport(monitorDeps(), {...event, quiet, customer});
  })(), 'Import monitor');
}
