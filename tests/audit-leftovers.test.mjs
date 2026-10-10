import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allowanceAfterCartUsd, allowanceLeftUsd, courierAllowanceUsd, estimateCourierCustoms } from '../lib/market/customs.ts';
import { products, tariff, blank, addToCart, setCartCustoms, cartSignature, checkoutCart } from '../lib/market/domain.ts';
import { cartCustomsEstimate } from '../lib/market/allowance.ts';
import { reloadAfterErrorCodes, serverError, serverErrors } from '../lib/market/i18n.ts';
import { customsVersion } from '../lib/market/world.ts';
import { ManualEntryFallbackError } from '../lib/importer/fetch.ts';
import { createImportFlights, freshRetryGapMs } from '../lib/importer/import-flight.ts';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// 1. "Tashkent" in the delivery promise of the internal screens.
test('internal screens promise delivery to Tashkent, not to Uzbekistan', () => {
  assert.match(source('app/admin-investor.tsx'), /с доставкой в Ташкент</);
  assert.match(source('lib/market/investor-metrics.ts'), /с доставкой в Ташкент\. Сводка/);
  const orders = source('app/order-workspace.tsx');
  for (const text of ['sendUzbekistan: "Отправить в Ташкент"', 'sendUzbekistan: "Toshkentga jo‘natish"', 'sendUzbekistan: "Ship to Tashkent"', 'до Ташкента, от и до', 'Toshkentgacha ish kunlari', 'abroad to Tashkent, from and to'])
    assert.ok(orders.includes(text), text);
  for (const text of ['Отправить в Узбекистан', 'Ship to Uzbekistan', 'O‘zbekistonga jo‘natish', 'до Узбекистана, от и до'])
    assert.ok(!orders.includes(text), text);
  assert.match(source('public/llms.txt'), /delivering to Tashkent/);
});

// 2. The customs allowance from the tariff.
test('the customs calculator counts with the tariff allowance, the law’s $200 when the tariff leaves it empty', () => {
  const input = { valueUsd: 300, grossKg: 1, date: '2026-09-11' };
  const law = estimateCourierCustoms(input);
  assert.equal(law.allowanceUsd, courierAllowanceUsd);
  assert.equal(law.excessUsd, 100);
  const raised = estimateCourierCustoms({ ...input, pricing: { customsAllowanceUsd: 300 } });
  assert.equal(raised.allowanceUsd, 300);
  assert.equal(raised.excessUsd, 0);
  assert.equal(raised.upperUsd, 0);
  const lowered = estimateCourierCustoms({ ...input, usedUsd: 50, pricing: { customsAllowanceUsd: 100 } });
  assert.equal(lowered.remainingUsd, 50);
  assert.equal(lowered.excessUsd, 250);
  // The operator's rate and per-kg minimum too, like the cart (customsParams).
  const rated = estimateCourierCustoms({ ...input, pricing: { customsRate: 0.1, customsMinimumPerKg: 5 } });
  assert.deepEqual([rated.rate, rated.minimumPerKg, rated.lowerUsd, rated.upperUsd], [0.1, 5, 10, 10]);
  assert.equal(estimateCourierCustoms({ ...input, pricing: {} }).excessUsd, 100);
  // The tariff does not make an invalid date valid.
  assert.equal(estimateCourierCustoms({ ...input, date: '2025-04-30', pricing: { customsAllowanceUsd: 300 } }), null);
});

test('"No duty · $X left" is the allowance left after this cart, never below 0', () => {
  const estimate = { allowanceUsd: 200, atlasUsedUsd: 50, valueUsd: 120 };
  assert.equal(allowanceLeftUsd(estimate), 150);
  assert.equal(allowanceAfterCartUsd(estimate), 30);
  assert.equal(allowanceAfterCartUsd({ ...estimate, outsideUsedUsd: 20 }), 10);
  assert.equal(allowanceAfterCartUsd({ ...estimate, valueUsd: 400 }), 0);
  assert.equal(allowanceAfterCartUsd({ ...estimate, outsideUnknown: true }), 0);
  assert.equal(allowanceAfterCartUsd({ ...estimate, valueUsd: 99.995 }), 50.01);
  // The cart's own estimate: the tariff's allowance, minus this cart.
  const now = Date.UTC(2026, 9, 5, 12);
  const cart = addToCart(blank(), products[0], products[0].variants[0], now, tariff);
  const customs = cartCustomsEstimate(cart, { ...tariff, customsAllowanceUsd: 500 }, { name: 'Zarina Karimova' }, { outsideUsed: false, help: false }, now);
  assert.equal(customs.allowanceUsd, 500);
  assert.equal(allowanceAfterCartUsd(customs), Math.round((500 - customs.valueUsd) * 100) / 100);
  assert.match(source('app/calc-summary.tsx'), /noDuty\(usd\(allowanceAfterCartUsd\(estimate\)\)\)/);
});

// 3. Error codes for the quote, tariff and duty refusals at checkout.
test('the expired quote, the new tariff and the recalculated duty refuse checkout with their own codes', () => {
  const now = Date.UTC(2026, 9, 5, 12);
  const cart = addToCart(blank(), products[0], products[0].variants[0], now, tariff);
  const sign = cartSignature(cart.cart);
  const late = cart.cart[0].quote.expiresAt + 1;
  assert.throws(() => checkoutCart(cart, 'e', sign, false, late, customsVersion), (error) => error.code === 'err_75' && error.message === serverError('ru', 'err_75'));
  assert.throws(() => checkoutCart(cart, 't', sign, false, now, customsVersion, undefined, undefined, undefined, { ...tariff, version: 'managed-2' }), (error) => error.code === 'err_76' && error.message === serverError('ru', 'err_76'));
  const help = setCartCustoms(addToCart(blank(), products[0], products[0].variants[0], now, tariff, 3), { outsideUsed: false, help: true }, now, tariff);
  const customs = cartCustomsEstimate(help, tariff, { name: 'Zarina Karimova' }, help.cartCustoms, now);
  const duty = Math.ceil(customs.estimateUsd * tariff.fx);
  assert.ok(duty > 0);
  assert.throws(() => checkoutCart(help, 'd', cartSignature(help.cart), false, now, customsVersion, undefined, undefined, undefined, tariff, customs, duty - 1), (error) => error.code === 'err_77' && error.message === serverError('ru', 'err_77'));
});

test('err_75–err_77 read in ru, uz and en, and the client reloads the account after them', () => {
  const generic = (locale) => serverError(locale, 'err_unknown');
  for (const locale of ['ru', 'uz', 'en', 'oz'])
    for (const code of ['err_75', 'err_76', 'err_77']) {
      assert.equal(typeof serverErrors[locale][code], 'string', `${locale} ${code}`);
      assert.notEqual(serverError(locale, code), generic(locale), `${locale} ${code}`);
    }
  assert.match(serverError('en', 'err_76'), /rates/i);
  assert.match(serverError('uz', 'err_77'), /boj/i);
  assert.deepEqual([...reloadAfterErrorCodes], ['err_75', 'err_76', 'err_77']);
  assert.match(source('lib/market/store.tsx'), /reloadAfterErrorCodes\.includes\(data\.errorCode\)\)\)await refresh\(\)/);
});

// 4. A fresh import passes a remembered wall after 15 s.
test('a remembered wall answers a normal import for 90 s, a fresh one (the customer’s retry) only for 15 s', async () => {
  let clock = 0;
  const flights = createImportFlights({ clock: () => clock });
  let calls = 0;
  const wall = async () => { calls++; throw new ManualEntryFallbackError(undefined, undefined, 'blocked'); };
  await flights.run('u', wall);
  assert.equal(freshRetryGapMs, 15_000);
  clock += 10_000;
  assert.equal(flights.recentFailure('u', freshRetryGapMs)?.reason, 'blocked', 'a retry within 15 s does not ask the store again');
  clock += 5_000;
  assert.equal(flights.recentFailure('u', freshRetryGapMs), undefined, 'after 15 s the retry goes to the store');
  assert.equal(flights.recentFailure('u')?.reason, 'blocked', 'a normal import still gets the remembered wall');
  // The retry hits the wall again: the 15 s start over for it, the 90 s for everyone else.
  await flights.run('u', wall);
  assert.equal(calls, 2);
  clock += 14_999;
  assert.ok(flights.recentFailure('u', freshRetryGapMs));
  clock += 75_000;
  assert.ok(flights.recentFailure('u'));
  clock += 2;
  assert.equal(flights.recentFailure('u'), undefined);
  assert.equal(flights.size().negative, 0);
  assert.match(source('app/api/import/route.ts'), /recentFailure\(sourceUrl, fresh \? freshRetryGapMs : undefined\)/);
});
