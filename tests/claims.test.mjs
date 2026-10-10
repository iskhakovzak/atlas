import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {
  products, blank, addToCart, cartSignature, checkoutCart, setCartServices, balanceOf, tariff, stateSchema,
  claimKindsOpen, claimLimit, claimWindowDays, reportParcelClaim, decideParcelClaim, orderGoodsValue, orderInsurancePaid,
  orderInsuranceRate, orderNeedsOperatorAttention, createChangeRequest, respondToChangeRequest, payExtraCharge,
  uninsuredLossPerKgUsd, uninsuredDamagePerKgUsd, maxParcelClaims,
} from '../lib/market/domain.ts';
import {applyAction} from '../lib/market/actions.ts';
import {orderFinance} from '../lib/market/finance.ts';
import {syncOrderLedger} from '../lib/market/finance-auto.ts';
import {renderHistory, renderNotification} from '../lib/market/history-copy.ts';
import {canPerformAction, operatorActionTypes, permissionsFor} from '../lib/market/access.ts';
import {queueTabsOf} from '../lib/market/operator-queue.ts';
import {queueSummaries} from '../lib/market/operator-queue-server.ts';
import {customsVersion} from '../lib/market/world.ts';

// Owner, 10.10.2026: claims on a lost or damaged parcel go through Atlas — insured up to the goods value, uninsured
// $15/kg (loss) and $3/kg (damage); the insurance follows later goods price changes at the line's rate.
const DAY = 86_400_000;
const nike = {...products[0], id: 'nike-pegasus', name: 'Pegasus', sourceUrl: 'https://www.nike.com/t/pegasus', shippingKnown: true};

function ordered(insured) {
  let s = addToCart(blank(), nike, nike.variants[0], 1000);
  if (insured) s = setCartServices(s, s.cart[0].id, ['shipping-insurance']);
  return checkoutCart(s, 'k', cartSignature(s.cart), false, 1500, customsVersion);
}
/** The order paid and moved to a status, delivered at `deliveredAt` when status 5. */
function at(s, status, deliveredAt = 10_000) {
  const order = s.orders[0];
  const history = status === 5 ? [...order.history, {at: deliveredAt, text: 'Доставлен', code: 'status', params: {status: 5}}] : order.history;
  return {...s, orders: [{...order, payment: {...order.payment, status: 'paid'}, status, history}]};
}
const first = (s) => s.orders[0];

test('a loss is reported once the parcel left, damage only on receipt and within 14 days', () => {
  const s = ordered(true);
  assert.deepEqual(claimKindsOpen(first(s), 20_000), [], 'not paid');
  assert.deepEqual(claimKindsOpen(first(at(s, 3)), 20_000), []);
  assert.deepEqual(claimKindsOpen(first(at(s, 4)), 20_000), ['loss']);
  assert.deepEqual(claimKindsOpen(first(at(s, 5, 10_000)), 10_000 + claimWindowDays * DAY), ['loss', 'damage']);
  assert.deepEqual(claimKindsOpen(first(at(s, 5, 10_000)), 10_001 + claimWindowDays * DAY), []);
  assert.throws(() => reportParcelClaim(at(s, 3), first(s).id, 'loss', 'Посылка не пришла вовремя', 20_000), /отправлена в Ташкент/);
  assert.throws(() => reportParcelClaim(at(s, 4), first(s).id, 'damage', 'Коробка пришла мятой и мокрой', 20_000), /после получения/);
  assert.throws(() => reportParcelClaim(at(s, 5, 0), first(s).id, 'damage', 'Коробка пришла мятой и мокрой', 15 * DAY), /14 дней/);
  assert.throws(() => reportParcelClaim(at(s, 4), first(s).id, 'loss', 'коротко', 20_000), /от 10 до 1000/);
});

test('limits: insured up to the goods value, uninsured $15/kg on a loss and $3/kg on damage, capped by the goods', () => {
  const insured = first(at(ordered(true), 5));
  assert.ok(orderInsuranceRate(insured) > 0);
  assert.equal(claimLimit(insured, 'loss'), insured.quote.merchandise);
  assert.equal(claimLimit(insured, 'damage'), insured.quote.merchandise);
  const plain = first(at(ordered(false), 5));
  assert.equal(orderInsuranceRate(plain), undefined);
  const fx = plain.quote.fx ?? tariff.fx;
  assert.equal(claimLimit(plain, 'loss'), Math.min(plain.quote.merchandise, Math.round(uninsuredLossPerKgUsd * plain.quote.weight * fx)));
  assert.equal(claimLimit(plain, 'damage'), Math.min(plain.quote.merchandise, Math.round(uninsuredDamagePerKgUsd * plain.quote.weight * fx)));
  // The weighed chargeable weight wins over the estimate.
  const weighed = {...plain, settlement: {...(plain.settlement ?? {}), chargeableWeight: 2}};
  assert.equal(claimLimit(weighed, 'damage'), Math.min(plain.quote.merchandise, Math.round(uninsuredDamagePerKgUsd * 2 * fx)));
});

test('an approved claim credits the balance once; the books and the history say so in three languages', () => {
  // applyAction stamps Date.now(): the parcel was delivered just now.
  let s = at(ordered(true), 5, Date.now());
  const id = first(s).id;
  s = applyAction(s, {type: 'parcel-claim-report', id, kind: 'damage', description: 'Экран треснул, коробка вскрыта'}, false, tariff);
  const claim = first(s).claims[0];
  assert.equal(claim.status, 'submitted');assert.equal(claim.insured, true);assert.equal(claim.limit, orderGoodsValue(first(s)));
  assert.ok(orderNeedsOperatorAttention(first(s)));
  assert.equal(queueTabsOf(first(s), 0).done, false, 'a delivered order with a waiting claim is not done');
  assert.throws(() => applyAction(s, {type: 'parcel-claim-report', id, kind: 'loss', description: 'Ещё одна претензия по заказу'}, false, tariff), /уже подана/);
  assert.throws(() => applyAction(s, {type: 'parcel-claim-decide', id, claimId: claim.id, decision: 'approved', amount: 1}, false, tariff), /оператор|Operator|доступ/i);
  // Staff cannot file one on a customer's order: /api/operations takes operator actions only (err_18).
  assert.ok(!operatorActionTypes.includes('parcel-claim-report'));
  assert.throws(() => decideParcelClaim(s, id, claim.id, 'approved', claim.limit + 1, '', 30_000), /не больше/);
  const before = balanceOf(s);
  const paid = applyAction(s, {type: 'parcel-claim-decide', id, claimId: claim.id, decision: 'approved', amount: claim.limit - 1000, note: ''}, true, tariff);
  assert.equal(balanceOf(paid), before + claim.limit - 1000);
  assert.equal(first(paid).claims[0].status, 'approved');
  assert.ok(!orderNeedsOperatorAttention(first(paid)));
  assert.throws(() => decideParcelClaim(paid, id, claim.id, 'approved', 1, '', 40_000), /уже рассмотрена/);
  // No second claim on a line whose claim was paid.
  assert.deepEqual(claimKindsOpen(first(paid), 20_000), []);
  // Books: an auto entry for the payout.
  const auto = syncOrderLedger(first(paid), 'c1');
  assert.ok(auto.some((entry) => entry.kind === 'claim_payout' && entry.amountUzs === claim.limit - 1000));
  // Copy renders in every language, the saved state reads back.
  for (const locale of ['ru', 'uz', 'en']) {
    for (const entry of first(paid).history.filter((item) => item.code?.startsWith('claim-'))) assert.doesNotMatch(renderHistory(entry, locale), /undefined|\{/);
    for (const notice of paid.notifications.filter((item) => item.code?.startsWith('claim-'))) assert.ok(renderNotification(notice, locale).title);
  }
  assert.equal(stateSchema.parse(JSON.parse(JSON.stringify(paid))).orders[0].claims[0].amount, claim.limit - 1000);
});

test('a declined claim needs a reason the customer sees, and the customer may file again', () => {
  let s = at(ordered(false), 4);
  const id = first(s).id;
  s = reportParcelClaim(s, id, 'loss', 'Трек не обновляется три недели', 20_000);
  const claim = first(s).claims[0];
  assert.equal(claim.insured, false);
  assert.throws(() => decideParcelClaim(s, id, claim.id, 'declined', undefined, 'нет', 30_000), /причину/);
  const before = balanceOf(s);
  s = decideParcelClaim(s, id, claim.id, 'declined', undefined, 'Посылка вручена, есть подпись получателя', 30_000);
  assert.equal(balanceOf(s), before);
  assert.equal(first(s).claims[0].note, 'Посылка вручена, есть подпись получателя');
  assert.match(renderHistory(first(s).history.at(-1), 'ru'), /подпись получателя/);
  assert.deepEqual(claimKindsOpen(first(s), 20_000), ['loss']);
});

test('the insurance follows a goods price change at the line rate; delivery changes carry none', () => {
  let s = at(ordered(true), 1);
  const order = first(s), rate = orderInsuranceRate(order);
  s = createChangeRequest(s, order.id, {kind: 'price', title: 'Цена', reason: 'Магазин поднял цену', amountDelta: 100_000}, 2000);
  const request = first(s).changeRequests[0];
  assert.equal(request.insuranceDelta, Math.round(100_000 * rate));
  assert.equal(request.amountDelta, 100_000 + request.insuranceDelta);
  s = respondToChangeRequest(s, order.id, request.id, 'approved', request.amountDelta, 2100);
  assert.equal(orderGoodsValue(first(s)), order.quote.merchandise + 100_000);
  assert.equal(orderInsurancePaid(first(s)), (order.quote.serviceFees[0].amount) + request.insuranceDelta);
  // Store delivery is not goods: no insurance on it.
  s = createChangeRequest(s, order.id, {kind: 'source-shipping', title: 'Доставка', reason: 'Магазин взял за доставку', amountDelta: 50_000}, 2200);
  assert.equal(first(s).changeRequests[1].insuranceDelta, undefined);
  assert.equal(first(s).changeRequests[1].amountDelta, 50_000);
  // A cheaper price returns the insurance on the difference too.
  const fresh = ordered(true);
  const cheaper = createChangeRequest(fresh, first(fresh).id, {kind: 'price', title: 'Цена', reason: 'Скидка', amountDelta: -20_000}, 2000);
  assert.equal(first(cheaper).changeRequests[0].insuranceDelta, Math.round(-20_000 * rate));
  // An uninsured line gets no insurance on a change.
  const bare = ordered(false);
  const plain = createChangeRequest(bare, first(bare).id, {kind: 'price', title: 'Цена', reason: 'Дороже', amountDelta: 10_000}, 2000);
  assert.equal(first(plain).changeRequests[0].insuranceDelta, undefined);
});

test('an extra invoice for goods carries the insurance; one for something else does not; the books split it', () => {
  let s = at(ordered(true), 1);
  const order = first(s), rate = orderInsuranceRate(order), fx = order.quote.fx ?? tariff.fx;
  s = applyAction(s, {type: 'extra-charge-request', id: order.id, amountUsd: 10, reason: 'Магазин поднял цену'}, true, tariff);
  const charge = first(s).extraCharges[0];
  const base = Math.ceil(10 * fx);
  assert.equal(charge.insuranceAmount, Math.round(base * rate));
  assert.equal(charge.amount, base + charge.insuranceAmount);
  s = payExtraCharge(s, order.id, charge.id, charge.amount, 3000);
  assert.equal(orderGoodsValue(first(s)), order.quote.merchandise + base);
  const finance = orderFinance(first(s), 'c1');
  const fees = order.quote.serviceFees.reduce((sum, fee) => sum + fee.amount, 0);
  assert.ok(finance.services >= fees + charge.insuranceAmount, 'the insurance on the invoice is Atlas income');
  // Not goods: no insurance, not in the goods value.
  let other = at(ordered(true), 1);
  const otherId = first(other).id;
  other = applyAction(other, {type: 'extra-charge-request', id: otherId, amountUsd: 10, reason: 'Доставка магазина', goods: false}, true, tariff);
  const fee = first(other).extraCharges[0];
  assert.equal(fee.insuranceAmount, undefined);assert.equal(fee.goods, false);assert.equal(fee.amount, base);
  other = payExtraCharge(other, otherId, fee.id, fee.amount, 3000);
  assert.equal(orderGoodsValue(first(other)), first(other).quote.merchandise);
});

test('only operations staff decide claims; the light queue summary sees a waiting claim', async () => {
  const staff = (role) => ({operator: false, role, permissions: permissionsFor(role)});
  assert.equal(canPerformAction(staff('procurement'), 'parcel-claim-decide'), true);
  assert.equal(canPerformAction(staff('warehouse'), 'parcel-claim-decide'), false);
  let s = at(ordered(true), 4);
  s = reportParcelClaim(s, first(s).id, 'loss', 'Трек не обновляется три недели', 20_000);
  const sqlite = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(new URL('../drizzle/', import.meta.url)).filter((name) => name.endsWith('.sql')).sort())
    for (const part of fs.readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8').split('--> statement-breakpoint')) if (part.trim()) sqlite.exec(part);
  const statement = (sql, args = []) => ({bind: (...values) => statement(sql, values), all: async () => ({results: sqlite.prepare(sql).all(...args)})});
  sqlite.prepare('INSERT INTO market_accounts (user_id,name,state,revision,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('tg:1', 'Анна', JSON.stringify(s), 1, 1, 9);
  const [summary] = await queueSummaries({prepare: (sql) => statement(sql)});
  assert.equal(orderNeedsOperatorAttention(summary.order), true);
  assert.deepEqual(queueTabsOf(summary.order, summary.credit), queueTabsOf(first(s), 0));
});

test('an old delivered order without a coded delivery entry still closes the damage window', () => {
  const s = at(ordered(true), 5);
  const order = {...first(s), history: first(s).history.filter((entry) => entry.code !== 'status').map((entry) => ({...entry, at: 50_000}))};
  assert.deepEqual(claimKindsOpen(order, 50_000 + claimWindowDays * DAY), ['loss', 'damage']);
  assert.deepEqual(claimKindsOpen(order, 50_001 + claimWindowDays * DAY), []);
});

test('after the ceiling of declined claims the form closes with a polite answer instead of a schema error', () => {
  const s = at(ordered(false), 4);
  const declined = Array.from({length: maxParcelClaims}, (_, index) => ({id: `CLM-${index}`, kind: 'loss', description: 'Посылка не пришла вовремя', reportedAt: 20_000, status: 'declined', insured: false, limit: 1000, note: 'Нашлась на складе', decidedAt: 21_000}));
  const full = {...s, orders: [{...first(s), claims: declined}]};
  assert.deepEqual(claimKindsOpen(first(full), 30_000), []);
  assert.throws(() => reportParcelClaim(full, first(full).id, 'loss', 'Посылка снова не пришла', 30_000), /напишите в поддержку/);
});
