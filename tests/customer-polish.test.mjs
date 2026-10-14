import test from 'node:test';
import assert from 'node:assert/strict';
import { accountCopy, cartCopy } from '../lib/market/customer-copy.ts';
import { dealCopy } from '../lib/market/deal-copy.ts';
import { routeTitle, ui } from '../lib/market/i18n.ts';
import { localizeLegacyStoredCopy } from '../lib/market/history-copy.ts';

// Review notes of 14.10.2026 on the cart, the account, the balance and support.

test('the guarantee limit line names only the limit: the "without the guarantee" rule stays in the description above it', () => {
  const expected = { ru: 'Для этой посылки — до 1 200 000 сум.', uz: 'Bu posilka uchun — 1 200 000 so‘m gacha.', en: 'For this parcel — up to 1 200 000 сум.' };
  const sums = { ru: '1 200 000 сум', uz: '1 200 000 so‘m', en: '1 200 000 сум' };
  for (const locale of ['ru', 'uz', 'en']) {
    const line = cartCopy[locale].services.uninsuredLimit(sums[locale]);
    assert.equal(line, expected[locale]);
    assert.doesNotMatch(line, /Без гарантии|Kafolatsiz|Without the guarantee/);
  }
  // Cyrillic Uzbek is derived from the Latin text.
  assert.match(cartCopy.oz.services.uninsuredLimit('1 200 000 сўм'), /^Бу посилка учун — 1 200 000 сўм гача\.$/);
});

test('favourites have one Uzbek name everywhere: "Saqlanganlar"', () => {
  assert.equal(cartCopy.uz.empty.favorites(3), 'Saqlanganlar · 3');
  assert.equal(accountCopy.uz.tiles.favorites, 'Saqlanganlar');
  assert.equal(routeTitle('uz', 'favorites'), 'Saqlanganlar');
  assert.equal(ui('uz').favorites, 'Saqlanganlar');
  const deal = dealCopy('uz');
  assert.equal(deal.savedTitle, 'Saqlangan mahsulotlar');
  assert.equal(deal.saved, 'Saqlanganlar');
  // "Saralash" (sorting) is another word and stays; "Saralangan…" (favourites) is gone.
  assert.equal(deal.sort, 'Saralash');
  const texts = [JSON.stringify(deal), JSON.stringify(accountCopy.uz), cartCopy.uz.empty.favorites(1)].join(' ');
  assert.doesNotMatch(texts, /[Ss]aralangan/);
});

test('an order paid from the balance reads as a payment on /balance; the stored text is unchanged', () => {
  const stored = 'Оплата заказа из внутреннего баланса Atlas';
  assert.equal(localizeLegacyStoredCopy(stored, 'ru'), 'Оплата заказа с баланса Atlas');
  assert.equal(localizeLegacyStoredCopy(stored, 'uz'), 'Buyurtma uchun Atlas balansidan to‘lov');
  assert.equal(localizeLegacyStoredCopy(stored, 'en'), 'Order payment from the Atlas balance');
  assert.equal(localizeLegacyStoredCopy(stored, 'oz'), 'Буюртма учун Atlas балансидан тўлов');
  // The older stored wording of the same payment reads the same.
  assert.equal(localizeLegacyStoredCopy('Оплата заказа демобалансом', 'ru'), 'Оплата заказа с баланса Atlas');
  assert.equal(stored, 'Оплата заказа из внутреннего баланса Atlas');
});
