import type { Locale } from './i18n.ts';
import { verbatim, withCyrillic } from './uz-cyrl.ts';

/**
 * Words of the guest cart, the one-page checkout and «Заказ принят» (redesign stage 6, 1 November 2026). The recipient
 * fields keep their words in cartCopy.checkout (lib/market/customer-copy.ts). Payment is simulated: nothing here says a
 * card was charged; the pay button marks the order paid in Atlas while no payment provider is connected.
 * Promo codes are Latin text: written through `code()` so the Cyrillic Uzbek copy leaves them as typed.
 */
type Copy = {
  merge: { moved: (n: number) => string; priceChanged: (n: number) => string; failed: (n: number) => string; open: string; moving: string };
  guest: {
    estimate: string; checkout: string; notKept: string; full: string; added: (units: number) => string;
    problemsTitle: string; problemsHint: string; problem: (code?: string) => string; openItem: string; dismiss: string;
  };
  checkout: {
    title: string; back: string; empty: string; emptyAction: string; steps: string;
    signin: { title: string; hint: string; done: (who: string) => string; locked: string };
    recipient: { title: string; other: string; useThis: string; list: string; add: string; change: string; passportLater: string };
    speed: { title: string };
    customs: { title: string; none: string };
    sum: { title: string; item: string; service: string; serviceHelp: (fee: string) => string; delivery: (kg: string, speed: string) => string; storeShipping: string; guarantee: string; duty: string; promo: (code: string) => string; balance: string; total: string; hold: (sum: string) => string; items: (n: number) => string; later: (n: number) => string };
    promo: { label: string; placeholder: string; apply: string; remove: string; checking: string; applied: (code: string, sum: string) => string; percent: (value: string) => string; fixed: (sum: string) => string; onlyService: string; minOrder: (sum: string) => string; open: string };
    check: { running: string; changedTitle: string; changedHint: string; failed: string; retry: string };
    pay: { button: (sum: string) => string; busy: string; signinFirst: string; demo: string; consentFirst: string; paying: string };
  };
  success: { title: string; text: (n: number) => string; total: string; demo: string; numbers: string; passportTitle: string; passportText: (name: string) => string; passportReady: string; addPassport: string; orders: string; catalog: string; paid: string };
};

const n = (count: number, one: string, few: string, many: string) => {
  const mod10 = count % 10, mod100 = count % 100;
  return mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
};
const code = (value: string) => verbatim(value);

export const checkoutCopy: Record<Locale, Copy> = /*@__PURE__*/withCyrillic({
  ru: {
    merge: {
      moved: count => `Корзина перенесена в аккаунт: ${count} ${n(count, 'товар', 'товара', 'товаров')}, цены сверены с магазинами.`,
      priceChanged: count => `У ${count} ${n(count, 'товара', 'товаров', 'товаров')} цена изменилась — она отмечена в корзине.`,
      failed: count => `${count} ${n(count, 'товар не удалось', 'товара не удалось', 'товаров не удалось')} перенести: магазин изменил данные.`,
      open: 'Открыть корзину', moving: 'Переносим корзину в аккаунт и сверяем цены…',
    },
    guest: {
      estimate: 'Сумма предварительная: цену, вес и наличие сверим с магазином при оформлении.',
      checkout: 'Оформить', notKept: 'Этот браузер не сохраняет данные (приватный режим). Войдите, чтобы корзина не потерялась.',
      full: 'В корзине уже 20 товаров. Оформите их или удалите лишние.', added: units => units > 1 ? `Добавлено в корзину: ${units} шт.` : 'Добавлено в корзину',
      problemsTitle: 'Не перенесено в аккаунт', problemsHint: 'Эти товары были в корзине до входа, но магазин изменил их данные. Откройте товар, чтобы выбрать вариант заново.',
      problem: code => code === 'err_71' ? 'Этого варианта сейчас нет в наличии.' : code === 'err_69' ? 'Магазин изменил этот вариант.' : code === 'err_38' ? 'Магазин не ответил — попробуйте позже.' : 'Магазин изменил данные товара.',
      openItem: 'Открыть товар', dismiss: 'Убрать',
    },
    checkout: {
      title: 'Оформление заказа', back: 'Вернуться в корзину', empty: 'В корзине нет товаров для оформления.', emptyAction: 'Перейти в каталог', steps: 'Шаги оформления',
      signin: { title: 'Вход', hint: 'Войдите любым способом — корзина и выбор сохранятся, со страницы уходить не нужно.', done: who => `Вы вошли: ${who}`, locked: 'Откроется после входа' },
      recipient: { title: 'Получатель', other: 'Другой получатель', useThis: 'Доставить этому получателю', list: 'Сохранённые получатели', add: 'Новый получатель', change: 'Изменить', passportLater: 'Паспорт попросим после оплаты' },
      speed: { title: 'Доставка' },
      customs: { title: 'Таможня', none: 'Пошлины нет: заказ укладывается в лимит получателя.' },
      sum: { title: 'Из чего сумма', item: 'Товар', service: 'Сервис Atlas', serviceHelp: fee => `Комиссия Atlas ${fee} от цены товара: выкуп, проверка и упаковка.`, delivery: (kg, speed) => kg ? `Доставка · ${kg} кг · ${speed}` : `Доставка · ${speed}`, storeShipping: 'Доставка магазина до склада', guarantee: 'Гарантия сохранности', duty: 'Пошлина', promo: c => `Промокод ${c}`, balance: 'С баланса Atlas', total: 'К оплате', hold: sum => `Отдельно удерживается ${sum} на доставку магазина — в сумму не входит.`, items: count => `${count} ${n(count, 'товар', 'товара', 'товаров')}`, later: count => `Ещё ${count} шт. отложено в корзине — их можно оформить позже.` },
      promo: { label: 'Промокод', placeholder: 'Например, ATLAS10', apply: 'Применить', remove: 'Убрать', checking: 'Проверяем…', applied: (c, sum) => `Промокод ${c}: −${sum}`, percent: value => `−${value} от сервиса Atlas`, fixed: sum => `−${sum} от сервиса Atlas`, onlyService: 'Скидка только на сервис Atlas: цену товара и доставку промокод не меняет.', minOrder: sum => `Действует от ${sum}.`, open: 'Есть промокод?' },
      check: { running: 'Сверяем цены и наличие с магазинами…', changedTitle: 'С момента добавления изменилась цена', changedHint: 'Итог ниже уже пересчитан по новой цене.', failed: 'Не удалось сверить цены. Проверьте связь и повторите.', retry: 'Повторить' },
      pay: { button: sum => `Оплатить ${sum}`, busy: 'Оформляем…', signinFirst: 'Войдите, чтобы оплатить', demo: 'Демо-оплата: платёжный провайдер ещё не подключён, деньги с карты не списываются.', consentFirst: 'Отметьте согласие с таможенными условиями.', paying: 'Отмечаем оплату…' },
    },
    success: {
      title: 'Заказ принят', text: count => count > 1 ? `Оформили ${count} заказа одной посылкой. Следующий шаг — паспорт получателя для таможни.` : 'Следующий шаг — паспорт получателя для таможни.',
      total: 'Сумма заказа',
      demo: 'Оплата отмечена в Atlas в демо-режиме: платёжный провайдер не подключён, деньги не списывались.', numbers: 'Номера заказов',
      passportTitle: 'Паспорт получателя', passportText: name => `Нужен для таможенной декларации${name ? ` на имя ${name}` : ''}. Займёт минуту.`, passportReady: 'Паспорт этого получателя уже добавлен — ничего делать не нужно.',
      addPassport: 'Добавить паспорт', orders: 'Мои заказы', catalog: 'Продолжить покупки', paid: 'Оплачено',
    },
  },
  uz: {
    merge: {
      moved: count => `Savat akkauntga ko‘chirildi: ${count} ta tovar, narxlar do‘konlar bilan tekshirildi.`,
      priceChanged: count => `${count} ta tovarning narxi o‘zgardi — savatda belgilangan.`,
      failed: count => `${count} ta tovarni ko‘chirib bo‘lmadi: do‘kon ma’lumotlarni o‘zgartirdi.`,
      open: 'Savatni ochish', moving: 'Savatni akkauntga ko‘chiryapmiz va narxlarni tekshiryapmiz…',
    },
    guest: {
      estimate: 'Summa taxminiy: narx, vazn va mavjudlikni rasmiylashtirishda do‘kon bilan tekshiramiz.',
      checkout: 'Rasmiylashtirish', notKept: 'Bu brauzer ma’lumotlarni saqlamaydi (maxfiy rejim). Savat yo‘qolmasligi uchun kiring.',
      full: 'Savatda allaqachon 20 ta tovar bor. Ularni rasmiylashtiring yoki ortiqchasini o‘chiring.', added: units => units > 1 ? `Savatga qo‘shildi: ${units} dona` : 'Savatga qo‘shildi',
      problemsTitle: 'Akkauntga ko‘chirilmadi', problemsHint: 'Bu tovarlar kirishdan oldin savatda edi, lekin do‘kon ularning ma’lumotlarini o‘zgartirdi. Variantni qayta tanlash uchun tovarni oching.',
      problem: code => code === 'err_71' ? 'Bu variant hozir mavjud emas.' : code === 'err_69' ? 'Do‘kon bu variantni o‘zgartirdi.' : code === 'err_38' ? 'Do‘kon javob bermadi — keyinroq urinib ko‘ring.' : 'Do‘kon tovar ma’lumotlarini o‘zgartirdi.',
      openItem: 'Tovarni ochish', dismiss: 'Olib tashlash',
    },
    checkout: {
      title: 'Buyurtmani rasmiylashtirish', back: 'Savatga qaytish', empty: 'Savatda rasmiylashtirish uchun tovar yo‘q.', emptyAction: 'Katalogga o‘tish', steps: 'Rasmiylashtirish bosqichlari',
      signin: { title: 'Kirish', hint: 'Istalgan usul bilan kiring — savat va tanlov saqlanadi, sahifadan chiqish shart emas.', done: who => `Siz kirdingiz: ${who}`, locked: 'Kirgandan keyin ochiladi' },
      recipient: { title: 'Qabul qiluvchi', other: 'Boshqa qabul qiluvchi', useThis: 'Shu qabul qiluvchiga yetkazish', list: 'Saqlangan qabul qiluvchilar', add: 'Yangi qabul qiluvchi', change: 'O‘zgartirish', passportLater: 'Pasportni to‘lovdan keyin so‘raymiz' },
      speed: { title: 'Yetkazish' },
      customs: { title: 'Bojxona', none: 'Boj yo‘q: buyurtma qabul qiluvchi limitiga sig‘adi.' },
      sum: { title: 'Summa nimadan iborat', item: 'Tovar', service: 'Atlas xizmati', serviceHelp: fee => `Tovar narxidan ${fee} Atlas komissiyasi: sotib olish, tekshirish va qadoqlash.`, delivery: (kg, speed) => kg ? `Yetkazish · ${kg} kg · ${speed}` : `Yetkazish · ${speed}`, storeShipping: 'Do‘kondan omborgacha yetkazish', guarantee: 'Saqlash kafolati', duty: 'Boj', promo: c => `${c} promokodi`, balance: 'Atlas balansidan', total: 'To‘lov', hold: sum => `Do‘kon yetkazishi uchun alohida ${sum} ushlab turiladi — summaga kirmaydi.`, items: count => `${count} ta tovar`, later: count => `Savatda yana ${count} dona keyinroq rasmiylashtirish uchun qoldirilgan.` },
      promo: { label: 'Promokod', placeholder: 'Masalan, ATLAS10', apply: 'Qo‘llash', remove: 'Olib tashlash', checking: 'Tekshiryapmiz…', applied: (c, sum) => `${c} promokodi: −${sum}`, percent: value => `Atlas xizmatidan −${value}`, fixed: sum => `Atlas xizmatidan −${sum}`, onlyService: 'Chegirma faqat Atlas xizmatiga: promokod tovar narxi va yetkazishni o‘zgartirmaydi.', minOrder: sum => `${sum} dan amal qiladi.`, open: 'Promokodingiz bormi?' },
      check: { running: 'Narx va mavjudlikni do‘konlar bilan tekshiryapmiz…', changedTitle: 'Qo‘shilgandan beri narx o‘zgardi', changedHint: 'Quyidagi jami yangi narx bo‘yicha qayta hisoblangan.', failed: 'Narxlarni tekshirib bo‘lmadi. Aloqani tekshirib, qayta urinib ko‘ring.', retry: 'Qayta urinish' },
      pay: { button: sum => `${sum} to‘lash`, busy: 'Rasmiylashtiryapmiz…', signinFirst: 'To‘lash uchun kiring', demo: 'Demo to‘lov: to‘lov provayderi hali ulanmagan, kartadan pul yechilmaydi.', consentFirst: 'Bojxona shartlariga roziligingizni belgilang.', paying: 'To‘lovni belgilayapmiz…' },
    },
    success: {
      title: 'Buyurtma qabul qilindi', text: count => count > 1 ? `${count} ta buyurtma bitta jo‘natmada rasmiylashtirildi. Keyingi qadam — bojxona uchun qabul qiluvchining pasporti.` : 'Keyingi qadam — bojxona uchun qabul qiluvchining pasporti.',
      total: 'Buyurtma summasi',
      demo: 'To‘lov Atlasda demo rejimda belgilandi: to‘lov provayderi ulanmagan, pul yechilmadi.', numbers: 'Buyurtma raqamlari',
      passportTitle: 'Qabul qiluvchining pasporti', passportText: name => `Bojxona deklaratsiyasi uchun kerak${name ? ` (${name} nomiga)` : ''}. Bir daqiqa vaqt oladi.`, passportReady: 'Bu qabul qiluvchining pasporti allaqachon qo‘shilgan — hech narsa qilish shart emas.',
      addPassport: 'Pasport qo‘shish', orders: 'Buyurtmalarim', catalog: 'Xaridni davom ettirish', paid: 'To‘langan',
    },
  },
  en: {
    merge: {
      moved: count => `Your cart moved to your account: ${count} ${count === 1 ? 'item' : 'items'}, prices checked with the stores.`,
      priceChanged: count => `${count} ${count === 1 ? 'item has' : 'items have'} a new price — marked in the cart.`,
      failed: count => `${count} ${count === 1 ? 'item' : 'items'} could not be moved: the store changed the details.`,
      open: 'Open cart', moving: 'Moving your cart to your account and checking prices…',
    },
    guest: {
      estimate: 'This total is an estimate: we check the price, weight and stock with the store at checkout.',
      checkout: 'Check out', notKept: 'This browser keeps no data (private mode). Sign in so the cart is not lost.',
      full: 'The cart already holds 20 items. Check them out or remove some.', added: units => units > 1 ? `Added to cart: ${units} pcs` : 'Added to cart',
      problemsTitle: 'Not moved to your account', problemsHint: 'These were in the cart before you signed in, but the store changed their details. Open the item to choose the option again.',
      problem: code => code === 'err_71' ? 'This option is out of stock now.' : code === 'err_69' ? 'The store changed this option.' : code === 'err_38' ? 'The store did not answer — try again later.' : 'The store changed the item details.',
      openItem: 'Open item', dismiss: 'Remove',
    },
    checkout: {
      title: 'Checkout', back: 'Back to cart', empty: 'There is nothing in the cart to check out.', emptyAction: 'Go to catalog', steps: 'Checkout steps',
      signin: { title: 'Sign in', hint: 'Sign in any way you like — your cart and choices stay, no need to leave this page.', done: who => `Signed in: ${who}`, locked: 'Opens after you sign in' },
      recipient: { title: 'Recipient', other: 'Another recipient', useThis: 'Deliver to this recipient', list: 'Saved recipients', add: 'New recipient', change: 'Change', passportLater: 'We ask for the passport after payment' },
      speed: { title: 'Delivery' },
      customs: { title: 'Customs', none: 'No duty: the order fits the recipient’s allowance.' },
      sum: { title: 'What the total is made of', item: 'Item', service: 'Atlas service', serviceHelp: fee => `Atlas fee of ${fee} of the item price: purchase, inspection and packing.`, delivery: (kg, speed) => kg ? `Delivery · ${kg} kg · ${speed}` : `Delivery · ${speed}`, storeShipping: 'Store delivery to the warehouse', guarantee: 'Safe-arrival guarantee', duty: 'Duty', promo: c => `Promo code ${c}`, balance: 'From Atlas balance', total: 'To pay', hold: sum => `${sum} is held separately for store delivery — not part of the total.`, items: count => `${count} ${count === 1 ? 'item' : 'items'}`, later: count => `${count} more left in the cart for later.` },
      promo: { label: 'Promo code', placeholder: 'For example, ATLAS10', apply: 'Apply', remove: 'Remove', checking: 'Checking…', applied: (c, sum) => `Promo code ${c}: −${sum}`, percent: value => `−${value} off the Atlas service`, fixed: sum => `−${sum} off the Atlas service`, onlyService: 'The discount applies only to the Atlas service: the item price and delivery stay the same.', minOrder: sum => `Valid from ${sum}.`, open: 'Have a promo code?' },
      check: { running: 'Checking prices and stock with the stores…', changedTitle: 'The price changed since you added it', changedHint: 'The total below already uses the new price.', failed: 'Could not check the prices. Check your connection and try again.', retry: 'Try again' },
      pay: { button: sum => `Pay ${sum}`, busy: 'Placing the order…', signinFirst: 'Sign in to pay', demo: 'Demo payment: no payment provider is connected yet, nothing is charged to your card.', consentFirst: 'Tick your agreement with the customs terms.', paying: 'Recording the payment…' },
    },
    success: {
      title: 'Order placed', text: count => count > 1 ? `${count} orders placed as one parcel. Next step — the recipient’s passport for customs.` : 'Next step — the recipient’s passport for customs.',
      total: 'Order total',
      demo: 'The payment was recorded in Atlas in demo mode: no payment provider is connected and no money was taken.', numbers: 'Order numbers',
      passportTitle: 'Recipient’s passport', passportText: name => `Needed for the customs declaration${name ? ` in the name of ${name}` : ''}. Takes a minute.`, passportReady: 'This recipient’s passport is already added — nothing to do.',
      addPassport: 'Add passport', orders: 'My orders', catalog: 'Continue shopping', paid: 'Paid',
    },
  },
});

/** A promo code as typed text inside copy (kept Latin in Cyrillic Uzbek). */
export const promoCodeText = (value: string, locale: Locale) => locale === 'oz' ? code(value) : value;
