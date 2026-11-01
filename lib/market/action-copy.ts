import type { Locale } from './i18n.ts';
import type { NextStep, NextStepKind } from './next-step.ts';
import { formatSum, ruPlural } from './format.ts';
import { withCyrillic } from './uz-cyrl.ts';

/**
 * The words of "what waits for you" (owner, 1 November 2026: the mint strip under the header was "вообще не то").
 * One card language on the home hero and the profile, one toast after sign-in: what is needed in plain words, the
 * product by its name (the order number only small and grey), one button that leads straight to it.
 */
type DoneKind = Exclude<NextStepKind, 'cart'>;
export type ActionCopy = {
  title: Record<DoneKind, string> & { cart: (items: number) => string };
  /** The line under the title: the product and why. `what`: the product name, or the item count of a checkout. */
  hint: Record<NextStepKind, (what: string) => string>;
  /** The one button; the amount when it is known. */
  button: Record<NextStepKind, (amount?: string) => string>;
  later: string;
  /** The toast after sign-in: one sentence with the product's short name, and its action. */
  toast: Record<DoneKind, (short: string) => string>;
  toastAction: Record<DoneKind, string>;
  /** The card's region name for screen readers. */
  region: string;
  items: (count: number) => string;
};

export const actionCopy: Record<Locale, ActionCopy> = /*@__PURE__*/withCyrillic({
  ru: {
    title: { extra: 'Нужна доплата', change: 'Нужно ваше решение', payment: 'Завершите оплату', passport: 'Нужен паспорт получателя', cart: (n) => `В корзине ${n} ${ruPlural(n, ['товар', 'товара', 'товаров'])}` },
    hint: {
      extra: (what) => `Заказ «${what}» — посмотрите, за что, и подтвердите`,
      change: (what) => `Заказ «${what}» — ответьте, и мы продолжим`,
      payment: (what) => `${what} — один платёж за весь заказ`,
      passport: (what) => `Для таможни — заказ «${what}», займёт минуту`,
      cart: () => 'Осталось оформить заказ',
    },
    button: {
      extra: (amount) => amount ? `Доплатить ${amount}` : 'Посмотреть доплату',
      change: () => 'Ответить',
      payment: (amount) => amount ? `Оплатить ${amount}` : 'Оплатить',
      passport: () => 'Добавить паспорт',
      cart: () => 'Оформить заказ',
    },
    later: 'Позже',
    toast: {
      extra: (short) => `Заказ «${short}» ждёт доплату — без неё не продолжим`,
      change: (short) => `По заказу «${short}» нужно ваше решение`,
      payment: (short) => `Завершите оплату заказа «${short}»`,
      passport: (short) => `Добавьте паспорт для заказа «${short}» — нужно для таможни`,
    },
    toastAction: { extra: 'Открыть', change: 'Ответить', payment: 'Оплатить', passport: 'Добавить' },
    region: 'Ждёт вашего действия',
    items: (n) => `${n} ${ruPlural(n, ['товар', 'товара', 'товаров'])}`,
  },
  uz: {
    title: { extra: 'Qo‘shimcha to‘lov kerak', change: 'Qaroringiz kerak', payment: 'To‘lovni yakunlang', passport: 'Qabul qiluvchining pasporti kerak', cart: (n) => `Savatda ${n} ta tovar` },
    hint: {
      extra: (what) => `${what} buyurtmasi — nima uchunligini ko‘rib, tasdiqlang`,
      change: (what) => `${what} buyurtmasi — javob bering, davom ettiramiz`,
      payment: (what) => `${what} — butun buyurtma uchun bitta to‘lov`,
      passport: (what) => `Bojxona uchun — ${what} buyurtmasi, bir daqiqa oladi`,
      cart: () => 'Buyurtmani rasmiylashtirish qoldi',
    },
    button: {
      extra: (amount) => amount ? `${amount} qo‘shimcha to‘lash` : 'Qo‘shimcha to‘lovni ko‘rish',
      change: () => 'Javob berish',
      payment: (amount) => amount ? `${amount} to‘lash` : 'To‘lash',
      passport: () => 'Pasport qo‘shish',
      cart: () => 'Rasmiylashtirish',
    },
    later: 'Keyinroq',
    toast: {
      extra: (short) => `${short} buyurtmasi qo‘shimcha to‘lovni kutmoqda`,
      change: (short) => `${short} buyurtmasi bo‘yicha qaroringiz kerak`,
      payment: (short) => `${short} buyurtmasi to‘lovini yakunlang`,
      passport: (short) => `${short} buyurtmasi uchun pasport qo‘shing — bojxona uchun kerak`,
    },
    toastAction: { extra: 'Ochish', change: 'Javob berish', payment: 'To‘lash', passport: 'Qo‘shish' },
    region: 'Harakatingizni kutmoqda',
    items: (n) => `${n} ta tovar`,
  },
  en: {
    title: { extra: 'Extra payment needed', change: 'Your decision is needed', payment: 'Finish your payment', passport: 'Recipient’s passport needed', cart: (n) => `${n} ${n === 1 ? 'item' : 'items'} in your cart` },
    hint: {
      extra: (what) => `Order ${what} — see what it is for and confirm`,
      change: (what) => `Order ${what} — reply and we will carry on`,
      payment: (what) => `${what} — one payment for the whole order`,
      passport: (what) => `For customs — order ${what}, takes a minute`,
      cart: () => 'Only checkout is left',
    },
    button: {
      extra: (amount) => amount ? `Pay ${amount} extra` : 'Review extra payment',
      change: () => 'Reply',
      payment: (amount) => amount ? `Pay ${amount}` : 'Pay',
      passport: () => 'Add passport',
      cart: () => 'Check out',
    },
    later: 'Later',
    toast: {
      extra: (short) => `Your ${short} order needs an extra payment`,
      change: (short) => `Your ${short} order needs your decision`,
      payment: (short) => `Finish paying for your ${short} order`,
      passport: (short) => `Add a passport for your ${short} order — customs needs it`,
    },
    toastAction: { extra: 'Open', change: 'Reply', payment: 'Pay', passport: 'Add' },
    region: 'Waiting for you',
    items: (n) => `${n} ${n === 1 ? 'item' : 'items'}`,
  },
});

/** A product's name for one sentence: its first words, up to about 24 characters ("Nike Air Max 90"). */
export function shortProductName(name: string, max = 24): string {
  const words = name.replace(/\s+/g, ' ').trim().split(' ');
  let out = '';
  for (const word of words) {
    const next = out ? out + ' ' + word : word;
    if (next.length > max && out) break;
    out = next;
  }
  return out.length > max + 6 ? out.slice(0, max).trimEnd() + '…' : out;
}

/** The card's three lines for a step: title, the line under it, and the button. */
export function actionLines(step: NextStep, locale: Locale): { title: string; hint: string; button: string } {
  const t = actionCopy[locale] ?? actionCopy.ru;
  const name = step.product ? shortProductName(step.product.name, 28) : '';
  const what = step.kind === 'payment' && (step.lines ?? 1) > 1 ? t.items(step.items) : name;
  const amount = step.amount !== undefined && step.amount > 0 ? formatSum(step.amount, locale) : undefined;
  return {
    title: step.kind === 'cart' ? t.title.cart(step.items) : t.title[step.kind],
    hint: t.hint[step.kind](what),
    button: t.button[step.kind](amount),
  };
}

/** The toast after sign-in for the first step that is not the cart (the cart needs no reminder). */
export function actionToastOf(step: NextStep | null | undefined, locale: Locale): { text: string; action: string; href: string } | null {
  if (!step || step.kind === 'cart') return null;
  const t = actionCopy[locale] ?? actionCopy.ru;
  const short = step.product ? shortProductName(step.product.name) : step.orderId ?? '';
  return { text: t.toast[step.kind](short), action: t.toastAction[step.kind], href: step.href };
}
