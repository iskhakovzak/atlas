import { needsPassport, type Order, type State } from './domain.ts';
import type { Locale } from './i18n.ts';
import { orderAttention } from './notice-panel.ts';
import { withCyrillic } from './uz-cyrl.ts';

/**
 * The one thing waiting for the buyer, for the header (the dot on "Профиль" and the mint strip under the header,
 * 1 November 2026). Loaded on every page, so it stays small: no grouping and no profile copy. The profile hub lists the
 * same reasons in the same order (lib/market/parcels.ts profileActions): a доплата or a change, then a payment, then a
 * recipient's passport.
 */
export type StripKind = 'extra' | 'change' | 'payment' | 'passport';
export type StripAction = { kind: StripKind; orderId: string; href: string };

type PassportState = Pick<State, 'orders' | 'deliveryProfiles'> & Partial<Pick<State, 'identityProfiles' | 'identityProfile'>>;

export const documentsPath = (recipientId?: string) => '/account/documents' + (recipientId ? '?recipient=' + encodeURIComponent(recipientId) : '');

/** Recipients of paid orders still on their way whose passport is not in the account — domain.ts needsPassport, the rule the notice uses too. */
export function missingPassports(state: PassportState): { recipientId: string; name: string; order: Order }[] {
  const identities = state.identityProfiles ?? (state.identityProfile ? [state.identityProfile] : []);
  const seen = new Map<string, { recipientId: string; name: string; order: Order }>();
  for (const order of state.orders) {
    const id = order.deliveryProfileId;
    if (!id || seen.has(id) || !needsPassport(order)) continue;
    if (identities.some((profile) => profile.recipientProfileId === id)) continue;
    const profile = state.deliveryProfiles.find((item) => item.id === id);
    if (!profile) continue;
    seen.set(id, { recipientId: id, name: profile.recipient, order });
  }
  return [...seen.values()];
}

export function firstProfileAction(state: PassportState): StripAction | undefined {
  for (const order of state.orders) {
    const reason = orderAttention(order);
    if (reason === 'extra' || reason === 'change') return { kind: reason, orderId: order.id, href: '/orders#' + encodeURIComponent(order.id) };
  }
  const unpaid = state.orders.find((order) => orderAttention(order) === 'payment');
  if (unpaid) return { kind: 'payment', orderId: unpaid.id, href: '/orders#' + encodeURIComponent(unpaid.id) };
  const passport = missingPassports(state)[0];
  return passport ? { kind: 'passport', orderId: passport.order.id, href: documentsPath(passport.recipientId) } : undefined;
}

export const stripCopy: Record<Locale, Record<StripKind, (id: string) => string>> = /*@__PURE__*/withCyrillic({
  ru: {
    extra: (id) => `Заказ ${id} ждёт доплату`,
    change: (id) => `Заказ ${id} ждёт вашего решения`,
    payment: (id) => `Заказ ${id} ждёт оплаты`,
    passport: (id) => `Заказ ${id} ждёт паспорт получателя`,
  },
  uz: {
    extra: (id) => `${id} buyurtma qo‘shimcha to‘lovni kutmoqda`,
    change: (id) => `${id} buyurtma qaroringizni kutmoqda`,
    payment: (id) => `${id} buyurtma to‘lovni kutmoqda`,
    passport: (id) => `${id} buyurtma qabul qiluvchi pasportini kutmoqda`,
  },
  en: {
    extra: (id) => `Order ${id} awaits an extra payment`,
    change: (id) => `Order ${id} awaits your decision`,
    payment: (id) => `Order ${id} awaits payment`,
    passport: (id) => `Order ${id} awaits the recipient’s passport`,
  },
});

/** The order number's tail on phones: "…101DC" (the last five characters), so the strip fits one line at 360 px. */
export const orderTail = (id: string) => '…' + id.replace(/\s+/g, '').slice(-5);

/** Phones (≤ 760 px, app/shell.css): the same line in short, given the number's tail (orderTail)
 *  so the Cyrillic copy keeps it Latin; the strip's accessible name keeps the full line (stripCopy). */
export const stripShortCopy: Record<Locale, Record<StripKind, (id: string) => string>> = /*@__PURE__*/withCyrillic({
  ru: {
    extra: (tail) => `Заказ ${tail} ждёт доплату`,
    change: (tail) => `Заказ ${tail} ждёт решения`,
    payment: (tail) => `Заказ ${tail} ждёт оплаты`,
    passport: (tail) => `Заказ ${tail} ждёт паспорт`,
  },
  uz: {
    extra: (tail) => `Buyurtma ${tail}: qo‘shimcha to‘lov`,
    change: (tail) => `Buyurtma ${tail}: qaroringiz kerak`,
    payment: (tail) => `Buyurtma ${tail}: to‘lov kutilmoqda`,
    passport: (tail) => `Buyurtma ${tail}: pasport kerak`,
  },
  en: {
    extra: (tail) => `Order ${tail} needs an extra payment`,
    change: (tail) => `Order ${tail} needs your decision`,
    payment: (tail) => `Order ${tail} awaits payment`,
    passport: (tail) => `Order ${tail} needs a passport`,
  },
});
