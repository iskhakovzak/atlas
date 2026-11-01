import type { Notification, Order } from './domain.ts';
import type { Locale } from './i18n.ts';
import { renderNoticeRow, renderNotification } from './history-copy.ts';
import { noticeTarget } from './notice-panel.ts';
import { base64UrlDecode, isP256Point, type PushSubscriptionKeys } from './web-push.ts';

/** What the service worker (public/push-sw.js) shows for one notice: the same words as the bell, and where a tap leads. */
export type PushMessage = { title: string; body: string; url: string; tag: string; icon?: string };

/**
 * The browser notifications for the notices one Atlas write added: one per notice, newest last, at most three
 * (a batch of status steps should not ring the phone ten times; the bell keeps them all). Each carries its
 * order's photo when there is one and opens the order, the document or the notice itself.
 */
export function pushMessages(notices: Notification[], orders: Pick<Order, 'id' | 'product'>[], locale: Locale): PushMessage[] {
  return notices.slice(-3).map((notice) => {
    const order = notice.orderId ? orders.find((item) => item.id === notice.orderId) : undefined;
    const text = renderNoticeRow(notice, locale, order?.product.name);
    const image = order?.product.image;
    return {
      // A new stage leads with the parcel ("Посылка: Таможня"), the product's name under it: a bare "Таможня" on a
      // lock screen says nothing about what it is (review, 1 November 2026).
      title: notice.code === 'parcel-stage' ? renderNotification(notice, locale).title : text.title,
      body: text.message,
      url: noticeTarget(notice)?.href ?? '/notifications?id=' + encodeURIComponent(notice.id),
      // One notification per notice on the device: a retry replaces it instead of ringing twice.
      tag: 'atlas-' + notice.id,
      ...(image && /^https:\/\//.test(image) ? { icon: image } : {}),
    };
  });
}

/** Push services browsers use. The server posts only there, never to an address a client made up (no SSRF). */
const pushHosts = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function validPushSubscription(value: unknown): PushSubscriptionKeys | null {
  if (!value || typeof value !== 'object') return null;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || typeof keys?.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  let url: URL;
  try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== 'https:' || !pushHosts.some((host) => host.test(url.hostname))) return null;
  try {
    if (!isP256Point(base64UrlDecode(keys.p256dh)) || base64UrlDecode(keys.auth).length < 16) return null;
  } catch { return null; }
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

