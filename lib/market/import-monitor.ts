// Import monitor (owner, 30.10.2026): every live import that fails, and every link to a store Atlas does not
// read, is told to the owner's Telegram at once, with the customer's name and contact so the owner can call back.
// A store is marked down after 2 failures in a row (🔴) and up again on its next success (🟢); the gateway is
// probed every 10 minutes by a separate cron worker (workers/import-monitor). A summary goes out at 10:00 Tashkent.
// No Cloudflare imports here: the route passes the database and the sender (lib/market/import-monitor-server.ts).

export type MonitorStatement = {
  bind(...values: unknown[]): MonitorStatement;
  run(): Promise<unknown>;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{results?: T[]}>;
};
export type MonitorDb = {prepare(sql: string): MonitorStatement};

/** How to reach the customer: what the account has (name, phone, email, Telegram). */
export type MonitorCustomer = {userId: string; name: string; phone?: string; email?: string; telegramId?: string};

export type MonitorDeps = {
  db: MonitorDb;
  /** One Telegram message (HTML) to the owner; never throws. */
  send: (html: string) => Promise<void>;
  now: number;
};

/** ok — the store answered; failed — a supported store did not; link — the link is not a product page;
 * unsupported — a store Atlas does not read. */
export type ImportOutcomeKind = 'ok' | 'failed' | 'link' | 'unsupported';

export type ImportEvent = {
  host: string;
  url: string;
  kind: ImportOutcomeKind;
  reason?: string;
  /** Plain words for the owner: what happened, with the store's answer when there is one. */
  detail?: string;
  customer?: MonitorCustomer;
  /** Counted, but nobody is told about this customer: the clipboard warm-up and the operator's own imports. */
  quiet?: boolean;
  /** The same failure answered again from the last few seconds (no new attempt): told, never counted. */
  replay?: boolean;
};

const day = 24 * 60 * 60_000;
const keepMs = 30 * day;
const tashkentOffsetMs = 5 * 60 * 60_000;
const downKey = (host: string) => `import-monitor:down:${host}`;
export const gatewayHost = 'gateway';
const digestKey = 'import-monitor:digest';

/** What each importer reason means, in the owner's words. */
const reasonWords: Record<string, string> = {
  blocked: 'магазин заблокировал загрузку (защита от ботов)',
  network: 'не удалось связаться с магазином или со шлюзом',
  upstream: 'магазин ответил ошибкой',
  response: 'магазин отдал страницу, но без данных товара',
  redirect: 'магазин перенаправил на другую страницу',
  timeout: 'магазин или шлюз не ответил вовремя',
  incomplete: 'загрузилось не всё: нет цены, фото или вариантов',
  unknown: 'неизвестная ошибка загрузки',
};

/** Errors that are the link's fault (a removed or missing product), not the store's or Atlas's. */
const linkProblem = /не найдена|убрал карточку|Проверьте ссылку|Укажите другую ссылку|Ссылки на товары не найдены/i;

/**
 * Sorts an importer error: `pending` (Walmart still collecting) and `manual` (a store Atlas never reads) are not
 * failures and give undefined. `diagnostic` is describeImportDiagnostic's line (HTTP status, protection, attempts).
 */
export function classifyImportError(error: unknown, diagnostic = ''): Pick<ImportEvent, 'kind' | 'reason' | 'detail'> | undefined {
  const value = error as {name?: string; message?: string; reason?: string} | undefined;
  const message = String(value?.message ?? error ?? '').slice(0, 300);
  if (value?.name === 'ManualEntryFallbackError') {
    const reason = value.reason ?? 'unknown';
    if (reason === 'pending' || reason === 'manual') return undefined;
    const words = reasonWords[reason] ?? reasonWords.unknown;
    return {kind: 'failed', reason, detail: capitalize(words) + (diagnostic ? ` (${diagnostic})` : '') + '.'};
  }
  if (value?.name === 'AbortError') return {kind: 'failed', reason: 'timeout', detail: capitalize(reasonWords.timeout) + '.'};
  if (linkProblem.test(message)) return {kind: 'link', reason: 'link', detail: message};
  return {kind: 'failed', reason: 'error', detail: message || capitalize(reasonWords.unknown) + '.'};
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const storeName = (host: string) => host.replace(/^(?:www2?|shop|m)\./, '');

function minutesText(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

/** The customer block: name and every way to reach them; a guest is said to be one. */
export function customerLines(customer?: MonitorCustomer) {
  if (!customer) return 'Покупатель: не вошёл в аккаунт';
  const ways = [
    customer.phone ? `📞 ${escapeHtml(customer.phone)}` : '',
    customer.email ? `✉️ ${escapeHtml(customer.email)}` : '',
    customer.telegramId ? `<a href="tg://user?id=${customer.telegramId}">написать в Telegram</a>` : '',
  ].filter(Boolean);
  return `Покупатель: ${escapeHtml(customer.name || customer.userId)}` + (ways.length ? `\n${ways.join(' · ')}` : '\nКонтакта нет');
}

/** The message about one customer's attempt; firstToday marks a store nobody asked for earlier today. */
export function eventMessage(event: ImportEvent, firstToday = false) {
  const store = escapeHtml(storeName(event.host));
  const link = `Ссылка: ${escapeHtml(event.url)}`;
  const customer = customerLines(event.customer);
  if (event.kind === 'unsupported') {
    return [`${firstToday ? '🆕' : '🛍'} Хотели магазин, которого у нас нет: <b>${store}</b>${firstToday ? ' (сегодня впервые)' : ''}`,
      link, customer, 'Можно предложить выкуп вручную. Покупателю открылась ручная форма.'].join('\n');
  }
  const title = event.kind === 'link' ? `ℹ️ Ссылка не на товар — <b>${store}</b>` : `⚠️ Импорт не удался — <b>${store}</b>`;
  return [title, `Что случилось: ${escapeHtml(event.detail ?? '')}`, link, customer, 'Покупателю открылась ручная форма.'].join('\n');
}

async function setting(db: MonitorDb, key: string) {
  return (await db.prepare('SELECT value FROM market_settings WHERE key=?').bind(key).first<{value: string}>())?.value;
}

/** Marks a store (or the gateway) down; true only for the request that marked it, so 🔴 goes out once. */
async function markDown(db: MonitorDb, host: string, now: number) {
  const row = await db.prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO NOTHING RETURNING key')
    .bind(downKey(host), String(now), now, 'import-monitor').first<{key: string}>();
  return Boolean(row);
}

/** Marks it up again; the time it went down, only for the request that cleared it (🟢 goes out once). */
async function markUp(db: MonitorDb, host: string) {
  const row = await db.prepare('DELETE FROM market_settings WHERE key=? RETURNING value').bind(downKey(host)).first<{value: string}>();
  return row ? Number(row.value) : undefined;
}

/** Records one live import and tells the owner what needs telling. Never throws. */
export async function recordImport(deps: MonitorDeps, event: ImportEvent) {
  const {db, send, now} = deps;
  try {
    if (event.replay) {
      if (!event.quiet && event.kind !== 'ok') await send(eventMessage(event));
      return;
    }
    const firstToday = event.kind === 'unsupported'
      && !(await db.prepare('SELECT 1 AS found FROM market_import_outcomes WHERE host=? AND kind=? AND created_at>=?')
        .bind(event.host, 'unsupported', tashkentDayStart(now)).first());
    await db.prepare('INSERT INTO market_import_outcomes (id,host,kind,reason,detail,url,user_id,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID(), event.host, event.kind, event.reason ?? null, event.detail?.slice(0, 500) ?? null, event.url.slice(0, 2000), event.customer?.userId ?? null, now).run();
    if (Math.random() < 0.01) await db.prepare('DELETE FROM market_import_outcomes WHERE created_at<?').bind(now - keepMs).run();

    if (event.kind === 'ok') {
      const since = await markUp(db, event.host);
      if (since !== undefined) await send(`🟢 <b>${escapeHtml(storeName(event.host))}</b> снова импортируется. Не работал ${minutesText(now - since)}.`);
      return;
    }
    if (!event.quiet) await send(eventMessage(event, firstToday));
    if (event.kind !== 'failed') return;
    // Two failures in a row (no success between them) mark the store down.
    const last = await db.prepare("SELECT kind FROM market_import_outcomes WHERE host=? AND kind IN ('ok','failed') ORDER BY created_at DESC LIMIT 2")
      .bind(event.host).all<{kind: string}>();
    const rows = last.results ?? [];
    if (rows.length === 2 && rows.every(row => row.kind === 'failed') && await markDown(db, event.host, now)) {
      await send(`🔴 <b>${escapeHtml(storeName(event.host))}</b> не импортируется: 2 неудачи подряд.\nПоследняя: ${escapeHtml(event.detail ?? '')}\nПокупатели пока видят ручную форму.`);
    }
  } catch (error) {
    console.error('Import monitor failed', String(error).slice(0, 200));
  }
}

/** What the gateway probe saw: an HTTP answer from the gateway itself, or none (status 0). */
export type GatewayProbe = {configured: boolean; status: number; ms: number};

/** The gateway answers when it gives any status below 500: it refuses a bare POST with 415 by design. */
export const gatewayAlive = (probe: GatewayProbe) => probe.status > 0 && probe.status < 500;

/** The 10-minute gateway check: 🔴 at once when it does not answer, 🟢 when it answers again. */
export async function recordGatewayProbe(deps: MonitorDeps, probe: GatewayProbe) {
  const {db, send, now} = deps;
  if (!probe.configured) return 'not-configured';
  if (gatewayAlive(probe)) {
    const since = await markUp(db, gatewayHost);
    if (since !== undefined) await send(`🟢 Шлюз импорта снова отвечает. Не работал ${minutesText(now - since)}.`);
    return 'up';
  }
  if (await markDown(db, gatewayHost, now)) {
    const seen = probe.status ? `ответ HTTP ${probe.status}` : `нет ответа за ${Math.round(probe.ms / 1000)} с`;
    await send(`🔴 Шлюз импорта не отвечает (${seen}).\nМагазины, которые читает только шлюз (Walmart и другие браузерные), сейчас уходят в ручную форму. Проверьте ПК, туннель или хост шлюза.`);
  }
  return 'down';
}

/** Midnight in Tashkent (UTC+5, no daylight saving) of the day `now` falls on. */
export function tashkentDayStart(now: number) {
  return Math.floor((now + tashkentOffsetMs) / day) * day - tashkentOffsetMs;
}

const tashkentDate = (now: number) => new Date(now + tashkentOffsetMs).toISOString().slice(0, 10);

/** The 10:00 summary of yesterday (Tashkent), once a day: demand for missing stores and what failed. */
export async function sendDailyDigest(deps: MonitorDeps) {
  const {db, send, now} = deps;
  const today = tashkentDayStart(now);
  if (now - today < 10 * 60 * 60_000) return 'early';
  const date = tashkentDate(now);
  if (await setting(db, digestKey) === date) return 'sent';
  const claimed = await db.prepare('INSERT INTO market_settings (key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at WHERE market_settings.value<>excluded.value RETURNING key')
    .bind(digestKey, date, now, 'import-monitor').first<{key: string}>();
  if (!claimed) return 'sent';
  const rows = (await db.prepare('SELECT host,kind,COUNT(*) AS count FROM market_import_outcomes WHERE created_at>=? AND created_at<? GROUP BY host,kind')
    .bind(today - day, today).all<{host: string; kind: ImportOutcomeKind; count: number}>()).results ?? [];
  const down = (await db.prepare("SELECT key,value FROM market_settings WHERE key LIKE 'import-monitor:down:%'").all<{key: string; value: string}>()).results ?? [];
  await send(digestMessage(tashkentDate(today - day), rows, down.map(row => ({host: row.key.slice('import-monitor:down:'.length), since: Number(row.value)})), now));
  return 'sent-now';
}

export function digestMessage(date: string, rows: {host: string; kind: ImportOutcomeKind; count: number}[], down: {host: string; since: number}[], now: number) {
  const total = (kind: ImportOutcomeKind) => rows.filter(row => row.kind === kind).reduce((sum, row) => sum + row.count, 0);
  const top = (kind: ImportOutcomeKind) => rows.filter(row => row.kind === kind).sort((a, b) => b.count - a.count)
    .slice(0, 10).map(row => `${escapeHtml(storeName(row.host))} ×${row.count}`).join(', ');
  const lines = [`📊 Импорт за ${date}`, `Загружено: ${total('ok')} · не удалось: ${total('failed')} · не та ссылка: ${total('link')}`];
  if (total('unsupported')) lines.push(`Хотели магазины, которых нет: ${top('unsupported')}`);
  if (total('failed')) lines.push(`Сбои: ${top('failed')}`);
  if (down.length) lines.push(`Сейчас не работает: ${down.map(item => `${item.host === gatewayHost ? 'шлюз' : escapeHtml(storeName(item.host))} (${minutesText(now - item.since)})`).join(', ')}`);
  else lines.push('Сейчас всё работает.');
  return lines.join('\n');
}
