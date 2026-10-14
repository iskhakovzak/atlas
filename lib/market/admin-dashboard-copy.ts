// The admin overview's funnel stages and "needs attention" list in the screen language. The server keeps writing
// Russian labels and details (lib/market/admin-dashboard.ts); the browser translates by the stable keys it also
// sends — the funnel `status` and the attention `kind` with its `at` — and keeps the server text where it has no key.
import {attentionKindLabels,type AttentionItem,type AttentionKind,type FunnelStage} from './admin-dashboard.ts';
import {localizedStatuses,type Locale} from './i18n.ts';
import {pickLocale} from './uz-cyrl.ts';

const dayMs = 86_400_000;

const kindLabels: {uz: Record<AttentionKind, string>; en: Record<AttentionKind, string>} = {
  uz: {
    'pending-payment': 'To‘lov kutilmoqda',
    'paid-not-bought': 'To‘langan, xarid qilinmagan',
    'warehouse-stale': 'Omborda qolib ketgan',
    'topup-unanswered': 'Javobsiz qo‘shimcha to‘lovlar',
    'ticket-open': 'Ochiq murojaatlar',
    'cart-price-change': 'Do‘kon savatdagi narxni o‘zgartirdi',
    'fx-stale': 'Valyuta kursi yangilanmagan',
    'catalog-error': 'Katalog tekshiruvi xatolari',
    'staff-invited': 'Faollashtirilmagan xodimlar',
  },
  en: {
    'pending-payment': 'Awaiting payment',
    'paid-not-bought': 'Paid, not purchased',
    'warehouse-stale': 'Stuck at the warehouse',
    'topup-unanswered': 'Extra payments without an answer',
    'ticket-open': 'Open requests',
    'cart-price-change': 'Store changed a price in a cart',
    'fx-stale': 'Exchange rate is out of date',
    'catalog-error': 'Catalog check errors',
    'staff-invited': 'Staff not activated',
  },
};

/** The attention group heading: the server's Russian label, or its Uzbek / English name by `kind`. */
export function attentionKindLabel(kind: AttentionKind, locale: string): string {
  if (locale === 'ru') return attentionKindLabels[kind];
  return pickLocale({ru: attentionKindLabels, uz: kindLabels.uz, en: kindLabels.en}, locale)[kind] ?? attentionKindLabels[kind];
}

/** A funnel stage by its `status`: the order status in the screen language, or "cancelled". */
export function funnelStageLabel(stage: Pick<FunnelStage, 'status' | 'label'>, locale: Locale): string {
  if (stage.status === 'cancelled') return pickLocale({ru: 'Отменён', uz: 'Bekor qilingan', en: 'Cancelled'}, locale);
  return localizedStatuses(locale)[stage.status] ?? stage.label;
}

const enDays = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
// Day counts are passed as numbers: Uzbek Cyrillic transliterates the whole line, numbers and suffixes alike.
const detailCopy = {
  uz: {
    pendingPayment: (n: number) => `${n} kundan beri to‘lov kutilmoqda`,
    paidNotBought: (n: number) => `${n} kun oldin to‘langan deb belgilangan, xarid belgilanmagan`,
    warehouseStale: (stage: string, n: number) => `${stage}: ${n} kundan beri`,
    ticketOpen: (n: number) => `${n} kundan beri javobsiz`,
  },
  en: {
    pendingPayment: (n: number) => `Awaiting payment for ${enDays(n)}`,
    paidNotBought: (n: number) => `Marked paid ${enDays(n)} ago, purchase not marked`,
    warehouseStale: (stage: string, n: number) => `${stage} for ${enDays(n)}`,
    ticketOpen: (n: number) => `No reply for ${enDays(n)}`,
  },
};

/**
 * One attention line's detail in the screen language. Rebuilt from `kind` and `at` (the same whole days the server
 * counts) where those say everything; `orderStatus` names the stage of a "stuck at the warehouse" order. Lines with
 * customer or store data (top-ups, cart prices, catalog errors, invitations, the rate) keep the server text.
 */
export function attentionDetail(item: Pick<AttentionItem, 'kind' | 'detail' | 'at'>, locale: Locale, now: number, orderStatus?: number): string {
  if (locale === 'ru') return item.detail;
  const words = pickLocale({ru: detailCopy.en, uz: detailCopy.uz, en: detailCopy.en}, locale);
  const days = Math.max(0, Math.floor((now - item.at) / dayMs));
  switch (item.kind) {
    case 'pending-payment': return words.pendingPayment(days);
    case 'paid-not-bought': return words.paidNotBought(days);
    case 'ticket-open': return words.ticketOpen(days);
    case 'warehouse-stale': {
      const stage = orderStatus === undefined ? undefined : localizedStatuses(locale)[orderStatus];
      return stage ? words.warehouseStale(stage, days) : item.detail;
    }
    default: return item.detail;
  }
}
