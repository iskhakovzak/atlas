import { env } from 'cloudflare:workers';
import { database } from './server';
import type { State } from './domain';
import type { Locale } from './i18n';
import { newNotices } from './telegram-state';
import { pushMessages } from './push-notices';
export { validPushSubscription } from './push-notices';
import { sendWebPush, type PushSubscriptionKeys, type VapidKeys } from './web-push';

/**
 * Browser notifications (Web Push) for the notices Atlas adds to an account: an extra payment, a change to answer,
 * a status step. Off until the hosting has the VAPID pair (ATLAS_VAPID_PUBLIC_KEY, ATLAS_VAPID_PRIVATE_KEY; see
 * AUTH_SETUP.md); without it the bell button does not appear and nothing is stored or sent. A failure never fails
 * the write that caused it: the bell always has the notice.
 */
export function pushKeys(): VapidKeys | null {
  const vars = env as unknown as Record<string, string | undefined>;
  const publicKey = vars.ATLAS_VAPID_PUBLIC_KEY?.trim(), privateKey = vars.ATLAS_VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: vars.ATLAS_VAPID_SUBJECT?.trim() || 'mailto:support@atlasmarket.uz' };
}

const perAccount = 10;
export async function savePushSubscription(userId: string, subscription: PushSubscriptionKeys, now = Date.now()) {
  const db = database();
  // One browser, one row: a browser that moves to another account follows the account it signed in to last.
  await db.prepare('INSERT INTO market_push_subscriptions (endpoint,user_id,p256dh,auth,created_at) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,created_at=excluded.created_at')
    .bind(subscription.endpoint, userId, subscription.p256dh, subscription.auth, now).run();
  // At most ten devices per account: the oldest give way.
  await db.prepare(`DELETE FROM market_push_subscriptions WHERE user_id=? AND endpoint NOT IN (SELECT endpoint FROM market_push_subscriptions WHERE user_id=? ORDER BY created_at DESC LIMIT ${perAccount})`).bind(userId, userId).run();
}
export async function deletePushSubscription(userId: string, endpoint: string) {
  await database().prepare('DELETE FROM market_push_subscriptions WHERE user_id=? AND endpoint=?').bind(userId, endpoint).run();
}

/** Sends the notices this write added to every browser of the account; dropped subscriptions are removed. */
export async function deliverPushNotices(userId: string, previous: State, next: State, now = Date.now()) {
  const keys = pushKeys();
  if (!keys) return;
  const messages = pushMessages(newNotices(previous, next, now), next.orders, next.communication.language as Locale);
  if (!messages.length) return;
  const rows = await database().prepare('SELECT endpoint,p256dh,auth FROM market_push_subscriptions WHERE user_id=?').bind(userId).all<PushSubscriptionKeys>()
    .then((result) => result.results ?? [], () => [] as PushSubscriptionKeys[]); // no table yet (migration 0015): send nothing
  for (const row of rows) {
    for (const message of messages) {
      const sent = await sendWebPush(row, message, keys, { urgency: 'high' }).catch(() => ({ ok: false as const, gone: false, status: 0 }));
      if (!sent.ok && sent.gone) { await deletePushSubscription(userId, row.endpoint).catch(() => undefined); break; }
      // Only the push service's status, never the address or the text: enough to see a key or service problem in the logs.
      if (!sent.ok) console.warn('Push not delivered', new URL(row.endpoint).hostname, sent.status);
    }
  }
}
