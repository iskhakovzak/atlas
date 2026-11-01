// Promo codes (redesign stage 6, 1 November 2026): validation, the cap at the Atlas service, dates, the use cap under
// concurrent checkouts (node:sqlite stands in for D1), and the checkout that applies and books the discount.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { normalizePromoCode, promoBase, promoDiscount, promoInputSchema, promoOrderSum, promoProblem, promoReturnable, promoReturns } from '../lib/market/promo.ts';
import { customerPromoUses, findPromo, listPromos, placeWithPromo, recordRedemption, releasePromo, reservePromo, returnPromoUses, savePromo } from '../lib/market/promo-store.ts';
import { codedActionError, prepareAction } from '../lib/market/actions-server.ts';
import { addToCart, blank, cancelOrder, cartSignature, products, tariff } from '../lib/market/domain.ts';
import { orderFinance, monthSummary } from '../lib/market/finance.ts';
import { feeLines } from '../lib/market/projection.ts';
import { invoiceData } from '../lib/market/finance-auto.ts';
import { summarizeSavedQuotes } from '../lib/market/admin-finance.ts';
import { defaultPolicy } from '../lib/market/policy.ts';
import { recentCheckMs } from '../lib/market/cart-check.ts';
import { customsVersion } from '../lib/market/world.ts';
import { serverError } from '../lib/market/i18n.ts';

const now = Date.now();
const day = 86_400_000;
const rule = (overrides = {}) => ({ id: 'PROMO-1', code: 'ATLAS10', kind: 'percent', value: 10, startsAt: now - day, endsAt: now + day, maxUses: 5, minOrder: null, active: true, uses: 0, ...overrides });

const migrate = (sqlite, file) => {
  const migration = readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) sqlite.exec(statement);
};
/** `upTo17`: the database as it is before migration 0018 (a test then applies it itself). */
function fakeD1({ upTo17 = false } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE market_order_finance (order_id TEXT PRIMARY KEY)');
  migrate(sqlite, '0017_promo_codes.sql');
  if (!upTo17) migrate(sqlite, '0018_promo_once_return.sql');
  // D1's batch: the statements run in order inside one transaction (rolled back as a whole on an error).
  const runSync = (sql, args) => ({ meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } });
  return {
    sqlite,
    prepare(sql) {
      return { bind(...values) {
        const args = values.map((value) => value === undefined ? null : typeof value === 'boolean' ? Number(value) : value);
        return {
          sql, args,
          async first() { return sqlite.prepare(sql).get(...args) ?? null; },
          async run() { return runSync(sql, args); },
          async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        };
      } };
    },
    async batch(statements) {
      await Promise.resolve();
      sqlite.exec('BEGIN');
      try { const results = statements.map((statement) => runSync(statement.sql, statement.args)); sqlite.exec('COMMIT'); return results; }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
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
  assert.equal(promoProblem(null, now), 'err_87');
  assert.equal(promoProblem(rule({ active: false }), now), 'err_87');
  assert.equal(promoProblem(rule({ startsAt: now + 1 }), now), 'err_88', 'not started yet');
  assert.equal(promoProblem(rule({ endsAt: now }), now), 'err_88', 'the end is exclusive');
  assert.equal(promoProblem(rule({ maxUses: 5, uses: 5 }), now), 'err_89');
  assert.equal(promoProblem(rule({ minOrder: 1_000_000 }), now, 999_999), 'err_90');
  assert.equal(promoProblem(rule({ minOrder: 1_000_000 }), now, 1_000_000), undefined);
  assert.equal(promoProblem(rule({ minOrder: 1_000_000 }), now), undefined, 'the code check alone leaves the minimum to the page');
  for (const code of ['err_87', 'err_88', 'err_89', 'err_90', 'err_91', 'err_92', 'err_93', 'err_94', 'err_95', 'err_96']) for (const locale of ['ru', 'uz', 'oz', 'en'])
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
  assert.equal(promoProblem(await findPromo(db, 'LAST3'), now), 'err_89');
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
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'atlas10', promoDiscount: expected + 1 }), deps(code)), (error) => error.code === 'err_91');
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'NOPE', promoDiscount: expected }), deps(null)), (error) => error.code === 'err_87');
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'ATLAS10', promoDiscount: expected }), deps({ ...code, endsAt: now - 1 })), (error) => error.code === 'err_88' && codedActionError(error).status === 409);
  // A changed discount, dates, cap and minimum are conflicts (409); an unknown code is a plain refusal (400).
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'ATLAS10', promoDiscount: expected + 1 }), deps(code)), (error) => codedActionError(error).status === 409);
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'NOPE', promoDiscount: expected }), deps(null)), (error) => codedActionError(error).status === 400);
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'ATLAS10', promoDiscount: expected }), deps({ ...code, uses: 5 })), (error) => error.code === 'err_89');
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'ATLAS10', promoDiscount: expected }), deps({ ...code, minOrder: 1e12 })), (error) => error.code === 'err_90');
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
    // The invoice: the services subtotal is net of the discount, and goods + services + delivery is what the order costs.
    const invoice = invoiceData(books, feeLines(order).map(([, kind, label, amount]) => ({ kind, label, amount })), { id: 'c' });
    assert.equal(invoice.services, quote.service + (quote.buyout ?? 0) + (quote.conversion ?? 0) + (quote.optionalServices ?? 0) + (quote.customsHelp ?? 0) - off);
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

// ---- The route's order of steps (app/api/actions/route.ts): count the use with its record → save → give both back ----
const use = (id, batchId, discount = 40_000) => ({ codeId: id, code: 'ROUTE', userId: 'email:r@atlas.local', batchId, orderIds: ['AT-' + batchId], discount });
const redemptions = (db, id) => db.sqlite.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(discount),0) AS total FROM market_promo_redemptions WHERE code_id=?').get(id);

test('route: a save refused with 409 gives the use and its record back', async () => {
  const db = fakeD1();
  const code = await savePromo(db, promoInputSchema.parse({ code: 'route', kind: 'fixed', value: 50_000, maxUses: 2, active: true }), 'operator@atlas.local', now);
  const stale = Object.assign(new Error('revision'), { status: 409 });
  await assert.rejects(placeWithPromo(db, use(code.id, 'k1'), async () => { throw stale; }, now), (error) => error === stale);
  assert.equal((await findPromo(db, 'ROUTE')).uses, 0);
  assert.equal(redemptions(db, code.id).n, 0, 'no record of a checkout that was not saved');
  const saved = await placeWithPromo(db, use(code.id, 'k1'), async () => 'saved', now);
  assert.deepEqual(saved, { usedUp: false, value: 'saved' });
  assert.equal((await findPromo(db, 'ROUTE')).uses, 1);
  assert.equal((await listPromos(db)).find((item) => item.id === code.id).discountTotal, 40_000, 'the admin total is the record written with the use');
});

test('route: the same checkout key counts one use', async () => {
  const db = fakeD1();
  const code = await savePromo(db, promoInputSchema.parse({ code: 'route', kind: 'fixed', value: 50_000, maxUses: 5, active: true }), 'operator@atlas.local', now);
  let saves = 0;
  const results = await Promise.all([1, 2, 3].map(() => placeWithPromo(db, use(code.id, 'same-key'), async () => ++saves, now)));
  assert.ok(results.every((result) => !result.usedUp));
  assert.equal((await findPromo(db, 'ROUTE')).uses, 1);
  assert.equal(redemptions(db, code.id).n, 1);
  assert.equal(redemptions(db, code.id).total, 40_000);
});

test('route: the last use goes to one checkout, the next one is refused with err_89 and nothing is saved', async () => {
  const db = fakeD1();
  const code = await savePromo(db, promoInputSchema.parse({ code: 'route', kind: 'fixed', value: 50_000, maxUses: 1, active: true }), 'operator@atlas.local', now);
  const saved = [];
  const results = await Promise.all(['a', 'b'].map((key) => placeWithPromo(db, use(code.id, key), async () => { saved.push(key); return key; }, now)));
  assert.equal(results.filter((result) => result.usedUp).length, 1);
  assert.equal(saved.length, 1, 'the refused checkout is not saved');
  assert.equal((await findPromo(db, 'ROUTE')).uses, 1);
  assert.equal(redemptions(db, code.id).n, 1, 'the refused checkout leaves no record');
  assert.equal(promoProblem(await findPromo(db, 'ROUTE'), now), 'err_89');
  // Switched off: refused, nothing counted.
  await savePromo(db, promoInputSchema.parse({ id: code.id, code: 'ROUTE', kind: 'fixed', value: 50_000, maxUses: 10, active: false }), 'operator@atlas.local', now);
  assert.deepEqual(await placeWithPromo(db, use(code.id, 'c'), async () => 'x', now), { usedUp: true, code: 'err_89' });
  // No code: just the save.
  assert.deepEqual(await placeWithPromo(db, null, async () => 'plain', now), { usedUp: false, value: 'plain' });
});

// ---- Owner decisions, 2 November 2026: «Один раз на покупателя» and the use returned after a cancel before the purchase ----
const buyer = (userId, id, batchId, discount = 40_000) => ({ codeId: id, code: 'ONCE', userId, batchId, orderIds: ['AT-' + batchId], discount, oncePerCustomer: true });

test('once per customer: on for a new code, off for codes made before migration 0018, kept when the field is absent', async () => {
  assert.equal(promoInputSchema.parse({ code: 'once', kind: 'percent', value: 10, active: true }).oncePerCustomer, undefined);
  const old = fakeD1({ upTo17: true });
  // Made before 0018 (the column does not exist yet): inserted as the stage-6 code did.
  old.sqlite.prepare("INSERT INTO market_promo_codes (id,code,kind,value,active,uses,created_at,updated_at,created_by,updated_by) VALUES ('PROMO-OLD','EARLY','percent',10,1,0,?,?,'op','op')").run(now, now);
  assert.equal((await findPromo(old, 'EARLY')).oncePerCustomer, undefined, 'before 0018 the option does not exist');
  migrate(old.sqlite, '0018_promo_once_return.sql');
  assert.equal((await findPromo(old, 'EARLY')).oncePerCustomer, false, 'an existing code keeps the old behaviour');
  // A change from an admin page without the field leaves the setting as it is; the form can switch it either way.
  await savePromo(old, promoInputSchema.parse({ id: 'PROMO-OLD', code: 'EARLY', kind: 'percent', value: 15, active: true }), 'operator@atlas.local', now);
  assert.equal((await findPromo(old, 'EARLY')).oncePerCustomer, false);
  await savePromo(old, promoInputSchema.parse({ id: 'PROMO-OLD', code: 'EARLY', kind: 'percent', value: 15, active: true, oncePerCustomer: true }), 'operator@atlas.local', now);
  assert.equal((await findPromo(old, 'EARLY')).oncePerCustomer, true);
  const fresh = await savePromo(old, promoInputSchema.parse({ code: 'fresh', kind: 'percent', value: 10, active: true }), 'operator@atlas.local', now);
  assert.equal(fresh.oncePerCustomer, true, 'a new code works once per customer unless switched off');
  const many = await savePromo(old, promoInputSchema.parse({ code: 'many', kind: 'percent', value: 10, active: true, oncePerCustomer: false }), 'operator@atlas.local', now);
  assert.equal(many.oncePerCustomer, false);
  // The check: an unreturned use of this account refuses the code with its own message.
  assert.equal(promoProblem({ ...rule(), oncePerCustomer: true, usedByCustomer: true }, now), 'err_96');
  assert.equal(promoProblem({ ...rule(), oncePerCustomer: false, usedByCustomer: true }, now), undefined);
  assert.equal(promoProblem({ ...rule(), oncePerCustomer: true, usedByCustomer: false }, now), undefined);
  assert.equal(promoProblem({ ...rule(), oncePerCustomer: true, usedByCustomer: true, endsAt: now }, now), 'err_88', 'dates first');
});

test('once per customer: a second checkout of the same account is refused (err_96), others and the same key are not', async () => {
  const db = fakeD1();
  const code = await savePromo(db, promoInputSchema.parse({ code: 'once', kind: 'fixed', value: 50_000, maxUses: 10, active: true }), 'operator@atlas.local', now);
  assert.deepEqual(await placeWithPromo(db, buyer('email:a@atlas.local', code.id, 'a1'), async () => 'saved', now), { usedUp: false, value: 'saved' });
  assert.deepEqual(await customerPromoUses(db, code.id, 'email:a@atlas.local'), ['a1']);
  let saved = false;
  assert.deepEqual(await placeWithPromo(db, buyer('email:a@atlas.local', code.id, 'a2'), async () => { saved = true; }, now), { usedUp: true, code: 'err_96' });
  assert.equal(saved, false, 'the refused checkout is not saved');
  assert.equal(redemptions(db, code.id).n, 1, 'and leaves no record');
  // The lost answer of the first checkout, sent again with its key: the same checkout, nothing more counted.
  assert.deepEqual(await placeWithPromo(db, buyer('email:a@atlas.local', code.id, 'a1'), async () => 'again', now), { usedUp: false, value: 'again' });
  assert.deepEqual(await placeWithPromo(db, buyer('email:b@atlas.local', code.id, 'b1'), async () => 'b', now), { usedUp: false, value: 'b' });
  assert.equal((await findPromo(db, 'ONCE')).uses, 2);
  // A code without the option: the same account may use it again.
  const many = await savePromo(db, promoInputSchema.parse({ code: 'many', kind: 'fixed', value: 50_000, active: true, oncePerCustomer: false }), 'operator@atlas.local', now);
  for (const key of ['m1', 'm2']) assert.equal((await placeWithPromo(db, { ...buyer('email:a@atlas.local', many.id, key), oncePerCustomer: false }, async () => key, now)).usedUp, false);
  // The general cap still answers err_89 for a once-per-customer code another account has used up.
  const last = await savePromo(db, promoInputSchema.parse({ code: 'last', kind: 'fixed', value: 50_000, maxUses: 1, active: true }), 'operator@atlas.local', now);
  await placeWithPromo(db, buyer('email:a@atlas.local', last.id, 'l1'), async () => 'l1', now);
  assert.deepEqual(await placeWithPromo(db, buyer('email:c@atlas.local', last.id, 'l2'), async () => 'l2', now), { usedUp: true, code: 'err_89' });
});

test('once per customer: two checkouts of one account paying at once get the code once', async () => {
  const db = fakeD1();
  const code = await savePromo(db, promoInputSchema.parse({ code: 'once', kind: 'fixed', value: 50_000, active: true }), 'operator@atlas.local', now);
  const saved = [];
  const results = await Promise.all(['k1', 'k2', 'k3', 'k4'].map((key) => placeWithPromo(db, buyer('email:same@atlas.local', code.id, key), async () => { saved.push(key); return key; }, now)));
  assert.equal(results.filter((result) => !result.usedUp).length, 1);
  assert.ok(results.filter((result) => result.usedUp).every((result) => result.code === 'err_96'));
  assert.equal(saved.length, 1);
  assert.equal((await findPromo(db, 'ONCE')).uses, 1);
  assert.equal(redemptions(db, code.id).n, 1);
});

test('return: a use comes back once, whatever the repeats and races; the admin totals leave it out', async () => {
  const db = fakeD1();
  const code = await savePromo(db, promoInputSchema.parse({ code: 'once', kind: 'fixed', value: 50_000, maxUses: 1, active: true }), 'operator@atlas.local', now);
  await placeWithPromo(db, buyer('email:a@atlas.local', code.id, 'a1'), async () => 'saved', now);
  assert.equal(promoProblem(await findPromo(db, 'ONCE'), now), 'err_89', 'the only use is taken');
  // Five returns at once and a later repeat: one use back.
  const counts = await Promise.all(Array.from({ length: 5 }, () => returnPromoUses(db, 'email:a@atlas.local', ['a1'], now + 1)));
  assert.equal(counts.reduce((sum, value) => sum + value, 0), 1);
  assert.equal(await returnPromoUses(db, 'email:a@atlas.local', ['a1', 'a1'], now + 2), 0);
  assert.equal((await findPromo(db, 'ONCE')).uses, 0);
  assert.equal(db.sqlite.prepare("SELECT returned_at FROM market_promo_redemptions WHERE batch_id='a1'").get().returned_at, now + 1, 'the record stays, marked');
  const listed = (await listPromos(db)).find((item) => item.id === code.id);
  assert.equal(listed.discountTotal, 0);
  assert.equal(listed.returnedUses, 1);
  // One account cannot return the use of another; an unknown checkout returns nothing.
  await placeWithPromo(db, buyer('email:b@atlas.local', code.id, 'b1'), async () => 'b', now);
  assert.equal(await returnPromoUses(db, 'email:a@atlas.local', ['b1', 'nope'], now), 0);
  assert.equal((await findPromo(db, 'ONCE')).uses, 1);
  // The same customer may use the code again after the return (it was never really used).
  await returnPromoUses(db, 'email:b@atlas.local', ['b1'], now);
  assert.deepEqual(await customerPromoUses(db, code.id, 'email:a@atlas.local'), []);
  assert.equal((await placeWithPromo(db, buyer('email:a@atlas.local', code.id, 'a2'), async () => 'again', now)).usedUp, false);
  assert.equal((await findPromo(db, 'ONCE')).uses, 1);
  assert.equal((await listPromos(db)).find((item) => item.id === code.id).discountTotal, 40_000);
});

test('return: only a checkout whose orders with the code are all cancelled before the purchase', async () => {
  const state = addToCart(addToCart(blank(), product('r1', 40), 'Black · 9', now, tariff), product('r2', 25), 'Black · 9', now, tariff);
  const code = rule({ kind: 'percent', value: 50, oncePerCustomer: true, usedByCustomer: false });
  const discount = promoDiscount(code, state.cart).total;
  const action = checkout(state, { promoCode: 'ATLAS10', promoDiscount: discount });
  const placed = (await prepareAction(state, action, deps(code))).next;
  const [first, second] = placed.orders;
  assert.ok(first.promo && second.promo);
  assert.deepEqual(promoReturns(state, placed), [], 'placing is not a return');
  const one = cancelOrder(placed, first.id, now);
  assert.deepEqual(promoReturns(placed, one), [], 'one order of two still uses the discount');
  const both = cancelOrder(one, second.id, now);
  assert.deepEqual(promoReturns(one, both), [action.key]);
  assert.deepEqual(promoReturns(both, cancelOrder(both, second.id, now)), [], 'a repeated cancel returns nothing again');
  assert.deepEqual(promoReturnable(both, [action.key, 'other']), [action.key]);
  assert.deepEqual(promoReturnable(one, [action.key]), []);
  // Bought from the store: that order cannot be cancelled, and the use stays when the other one is.
  const bought = { ...placed, orders: placed.orders.map((order, index) => index === 0 ? { ...order, status: 1 } : order) };
  assert.throws(() => cancelOrder(bought, first.id, now));
  assert.deepEqual(promoReturns(bought, cancelOrder(bought, second.id, now)), []);
  // A customer with an unreturned use of a once-per-customer code is refused at checkout with err_96 (409).
  await assert.rejects(prepareAction(state, checkout(state, { promoCode: 'ATLAS10', promoDiscount: discount }), deps({ ...code, usedByCustomer: true })), (error) => error.code === 'err_96' && codedActionError(error).status === 409);
});
