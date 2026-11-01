// Promo codes (redesign stage 6, 1 November 2026): validation, the cap at the Atlas service, dates, the use cap under
// concurrent checkouts (node:sqlite stands in for D1), and the checkout that applies and books the discount.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { normalizePromoCode, promoBase, promoDiscount, promoInputSchema, promoOrderSum, promoProblem } from '../lib/market/promo.ts';
import { findPromo, listPromos, recordRedemption, releasePromo, reservePromo, savePromo } from '../lib/market/promo-store.ts';
import { prepareAction } from '../lib/market/actions-server.ts';
import { addToCart, blank, cartSignature, products, tariff } from '../lib/market/domain.ts';
import { orderFinance, monthSummary } from '../lib/market/finance.ts';
import { feeLines } from '../lib/market/projection.ts';
import { summarizeSavedQuotes } from '../lib/market/admin-finance.ts';
import { defaultPolicy } from '../lib/market/policy.ts';
import { recentCheckMs } from '../lib/market/cart-check.ts';
import { customsVersion } from '../lib/market/world.ts';
import { serverError } from '../lib/market/i18n.ts';

const now = Date.now();
const day = 86_400_000;
const rule = (overrides = {}) => ({ id: 'PROMO-1', code: 'ATLAS10', kind: 'percent', value: 10, startsAt: now - day, endsAt: now + day, maxUses: 5, minOrder: null, active: true, uses: 0, ...overrides });

function fakeD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE market_order_finance (order_id TEXT PRIMARY KEY)');
  const migration = readFileSync(new URL('../drizzle/0017_promo_codes.sql', import.meta.url), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) sqlite.exec(statement);
  return {
    sqlite,
    prepare(sql) {
      return { bind(...values) {
        const args = values.map((value) => value === undefined ? null : typeof value === 'boolean' ? Number(value) : value);
        return {
          async first() { return sqlite.prepare(sql).get(...args) ?? null; },
          async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
          async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        };
      } };
    },
  };
}

test('codes are case-insensitive and the admin input is checked', () => {
  assert.equal(normalizePromoCode('  atlas 10 '), 'ATLAS10');
  assert.equal(promoInputSchema.parse({ code: 'summer-2026', kind: 'percent', value: 15, active: true }).code, 'SUMMER-2026');
  for (const bad of [
    { code: 'ab', kind: 'percent', value: 10, active: true },
    { code: 'КОД10', kind: 'percent', value: 10, active: true },
    { code: 'ATLAS', kind: 'percent', value: 120, active: true },
    { code: 'ATLAS', kind: 'percent', value: 0, active: true },
    { code: 'ATLAS', kind: 'fixed', value: 10.5, active: true },
    { code: 'ATLAS', kind: 'fixed', value: 1000, active: true, startsAt: now, endsAt: now - 1 },
  ]) assert.equal(promoInputSchema.safeParse(bad).success, false, JSON.stringify(bad));
});

test('a code works only while on, inside its dates, under its cap and above its minimum', () => {
  assert.equal(promoProblem(rule(), now), undefined);
  assert.equal(promoProblem(null, now), 'err_86');
  assert.equal(promoProblem(rule({ active: false }), now), 'err_86');
  assert.equal(promoProblem(rule({ startsAt: now + 1 }), now), 'err_87', 'not started yet');
  assert.equal(promoProblem(rule({ endsAt: now }), now), 'err_87', 'the end is exclusive');
  assert.equal(promoProblem(rule({ maxUses: 5, uses: 5 }), now), 'err_88');
  assert.equal(promoProblem(rule({ minOrder: 1_000_000 }), now, 999_999), 'err_89');
  assert.equal(promoProblem(rule({ minOrder: 1_000_000 }), now, 1_000_000), undefined);
  assert.equal(promoProblem(rule({ minOrder: 1_000_000 }), now), undefined, 'the code check alone leaves the minimum to the page');
  for (const code of ['err_86', 'err_87', 'err_88', 'err_89', 'err_90', 'err_91', 'err_92', 'err_93']) for (const locale of ['ru', 'uz', 'oz', 'en'])
    assert.notEqual(serverError(locale, code), serverError(locale, 'err_unknown'), `${code} ${locale}`);
});

test('the discount is taken off the Atlas fee only, never more than it and never below zero', () => {
  const lines = [
    { id: 'a', quote: { service: 10_000, buyout: 500, conversion: 500, total: 400_000, merchandise: 300_000, shipping: 80_000 } },
    { id: 'b', quote: { service: 5_000, total: 200_000, merchandise: 150_000, shipping: 45_000 } },
  ];
  assert.equal(promoBase(lines[0].quote), 11_000);
  const percent = promoDiscount({ kind: 'percent', value: 10 }, lines);
  assert.equal(percent.total, 1_600);
  assert.equal([...percent.perLine.values()].reduce((sum, value) => sum + value, 0), 1_600);
  const fixed = promoDiscount({ kind: 'fixed', value: 1_000_000 }, lines);
  assert.equal(fixed.total, 16_000, 'a fixed amount above the fee stops at the fee');
  assert.equal(fixed.perLine.get('a'), 11_000);
  assert.equal(fixed.perLine.get('b'), 5_000);
  const all = promoDiscount({ kind: 'percent', value: 100 }, lines);
  assert.equal(all.total, 16_000);
  for (const line of lines) assert.ok((all.perLine.get(line.id) ?? 0) <= promoBase(line.quote));
  assert.equal(promoDiscount({ kind: 'percent', value: 50 }, [{ id: 'x', quote: { service: 0, total: 100 } }]).total, 0);
  // Uneven shares: three lines, rounding goes to a line with room, the total stays exact.
  const three = promoDiscount({ kind: 'fixed', value: 1_000 }, [{ id: '1', quote: { service: 333, total: 1 } }, { id: '2', quote: { service: 333, total: 1 } }, { id: '3', quote: { service: 334, total: 1 } }]);
  assert.equal(three.total, 1_000);
  assert.equal(promoOrderSum([{ quote: { service: 1, total: 500, customsDuty: 100 } }]), 400, 'a prepaid duty is not part of the minimum');
});

test('D1: one code per text, uses counted atomically under concurrent checkouts, released on a failed save', async () => {
  const db = fakeD1();
  const created = await savePromo(db, promoInputSchema.parse({ code: 'last3', kind: 'fixed', value: 50_000, maxUses: 3, active: true }), 'operator@atlas.local', now);
  assert.equal(created.code, 'LAST3');
  assert.equal(await savePromo(db, promoInputSchema.parse({ code: 'Last3', kind: 'percent', value: 5, active: true }), 'operator@atlas.local', now), null, 'the same text in another case is the same code');
  assert.equal((await findPromo(db, ' last3 ')).id, created.id, 'found whatever the case and spaces');
  // Ten customers press «Оплатить» at once: exactly three get the code.
  const results = await Promise.all(Array.from({ length: 10 }, () => reservePromo(db, created.id, now)));
  assert.equal(results.filter(Boolean).length, 3);
  assert.equal((await findPromo(db, 'LAST3')).uses, 3);
  assert.equal(promoProblem(await findPromo(db, 'LAST3'), now), 'err_88');
  // A save that failed after the use was counted gives it back; the count never goes below zero.
  await releasePromo(db, created.id);
  assert.equal((await findPromo(db, 'LAST3')).uses, 2);
  assert.equal(await reservePromo(db, created.id, now), true);
  assert.equal(await reservePromo(db, created.id, now), false);
  // Switched off or out of its dates: no use is counted.
  const off = await savePromo(db, promoInputSchema.parse({ id: created.id, code: 'LAST3', kind: 'fixed', value: 50_000, maxUses: 10, active: false }), 'operator@atlas.local', now + 1);
  assert.equal(off.active, false);
  assert.equal(await reservePromo(db, created.id, now), false);
  const later = await savePromo(db, promoInputSchema.parse({ code: 'LATER', kind: 'percent', value: 5, startsAt: now + day, active: true }), 'operator@atlas.local', now);
  assert.equal(await reservePromo(db, later.id, now), false);
  // The redemption is one row per checkout key; the admin list sums the discount given.
  await recordRedemption(db, { codeId: created.id, code: 'LAST3', userId: 'email:a@atlas.local', batchId: 'key-1', orderIds: ['AT-1'], discount: 40_000 }, now);
  await recordRedemption(db, { codeId: created.id, code: 'LAST3', userId: 'email:a@atlas.local', batchId: 'key-1', orderIds: ['AT-1'], discount: 40_000 }, now);
  const listed = (await listPromos(db)).find((item) => item.id === created.id);
  assert.equal(listed.discountTotal, 40_000);
});

// ---- The checkout that uses a code ----
const product = (id, price) => ({
  ...products[0], id, name: id, usd: price, variants: ['Black · 9'], country: 'США', boxedWeight: 0.8, weight: 1.3,
  sourceUrl: `https://www.amazon.com/dp/${id}`, sourcePrice: price, sourceCurrency: 'USD', sourceVariantId: 'v9', sourceCheckedAt: now,
  sourceShipping: 10, sourceShippingUsd: 10, sourceShippingCurrency: 'USD', sourceShippingEstimated: true, shippingKnown: true,
});
const home = { recipient: 'Анна Каримова', phone: '+998 90 123 45 67', region: 'Ташкент', city: 'Ташкент', address: 'ул. Амира Темура, 1', postalCode: '100000', comment: '' };
const deps = (promo) => ({ fetchProduct: async () => { throw Error('not asked'); }, pricing: tariff, policy: defaultPolicy, operator: false, now, recentCheckMs, promo });
const checkout = (state, extra = {}) => ({ type: 'checkout', key: 'promo-' + Math.random(), signature: cartSignature(state.cart), useBalance: false, expectedCredit: 0, consentVersion: customsVersion, delivery: home, ...extra });

test('checkout: the code lowers only the Atlas service, the server checks the amount, and the books show it', async () => {
  const state = addToCart(addToCart(blank(), product('p1', 40), 'Black · 9', now, tariff), product('p2', 25), 'Black · 9', now, tariff);
  const code = rule({ kind: 'percent', value: 50 });
  const expected = promoDiscount(code, state.cart).total;
  assert.ok(expected > 0);
  // The amount the page showed must be the server's.
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'atlas10', promoDiscount: expected + 1 }), deps(code)), (error) => error.code === 'err_90');
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'NOPE', promoDiscount: expected }), deps(null)), (error) => error.code === 'err_86');
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'ATLAS10', promoDiscount: expected }), deps({ ...code, endsAt: now - 1 })), (error) => error.code === 'err_87');
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'ATLAS10', promoDiscount: expected }), deps({ ...code, uses: 5 })), (error) => error.code === 'err_88');
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'ATLAS10', promoDiscount: expected }), deps({ ...code, minOrder: 1e12 })), (error) => error.code === 'err_89');
  const result = await prepareAction(state, checkout(state, { promoCode: 'atlas10', promoDiscount: expected }), deps(code));
  const orders = result.next.orders;
  assert.equal(orders.length, 2);
  const before = new Map(state.cart.map((line) => [line.product.id, line.quote]));
  let given = 0;
  for (const order of orders) {
    const quote = before.get(order.product.id), off = order.quote.promoDiscount ?? 0;
    given += off;
    assert.equal(order.promo.code, 'ATLAS10');
    assert.ok(off <= quote.service + (quote.buyout ?? 0) + (quote.conversion ?? 0), 'never more than the Atlas fee');
    assert.equal(order.quote.total, quote.total - off, 'only the discount leaves the total');
    assert.equal(order.quote.merchandise, quote.merchandise, 'the goods price is untouched');
    assert.equal(order.quote.shipping, quote.shipping, 'delivery is untouched');
    assert.equal(order.payment.amount, order.quote.total);
    assert.ok(order.history.some((entry) => entry.code === 'promo'));
    // Agency books: the discount comes off Atlas's commission, the goods stay transit at full price.
    const books = orderFinance(order, 'email:c@atlas.local');
    assert.equal(books.commission, quote.service + (quote.buyout ?? 0) + (quote.conversion ?? 0) - off);
    assert.equal(books.promoDiscount, off);
    assert.ok(feeLines(order).some(([, kind, , amount]) => kind === 'promo_discount' && amount === -off));
  }
  assert.equal(given, expected);
  const paid = orders.map((order) => ({ ...orderFinance({ ...order, payment: { ...order.payment, status: 'paid', updatedAt: now } }, 'c') }));
  assert.equal(monthSummary(paid[0].month, paid, [], 0.15).income.promoDiscounts, expected);
  assert.equal(summarizeSavedQuotes(orders).lines.find((line) => line.key === 'promo-discount').amount, -expected);
  // A repeated key places nothing new and changes nothing.
  const action = checkout(state, { promoCode: 'ATLAS10', promoDiscount: expected });
  const first = await prepareAction(state, action, deps(code));
  const again = await prepareAction(first.next, { ...action, signature: cartSignature(first.next.cart) }, deps(code));
  assert.equal(again.next.orders.length, first.next.orders.length);
});

test('checkout: the balance pays what is left after the discount', async () => {
  const base = addToCart(blank(), product('p3', 40), 'Black · 9', now, tariff);
  const state = { ...base, entries: [{ id: 'top-up', at: now, amount: 100_000_000, debit: 'cash', credit: 'customer-credit', description: 'test' }] };
  const code = rule({ kind: 'fixed', value: 5_000 });
  const discount = promoDiscount(code, state.cart).total;
  await assert.rejects(prepareAction(state, checkout(state, { useBalance: true, expectedCredit: state.cart[0].quote.total, promoCode: 'ATLAS10', promoDiscount: discount }), deps(code)), /Баланс изменился/);
  const result = await prepareAction(state, checkout(state, { useBalance: true, expectedCredit: state.cart[0].quote.total - discount, promoCode: 'ATLAS10', promoDiscount: discount }), deps(code));
  assert.equal(result.next.orders[0].payment.status, 'paid');
  assert.equal(result.next.orders[0].balanceUsed, state.cart[0].quote.total - discount);
});
