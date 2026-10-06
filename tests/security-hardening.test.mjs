import test from 'node:test';
import assert from 'node:assert/strict';
import { products, blank, addToCart, cartSignature, checkoutCart } from '../lib/market/domain.ts';
import { actionSchema } from '../lib/market/actions.ts';
import { customsVersion } from '../lib/market/world.ts';
import nextConfig from '../next.config.ts';

test('no customer action replaces the whole account document', () => {
  const forged = { ...blank(), entries: [{ id: 'x', orderId: 'AT-X', at: 1, amount: 50_000_000, debit: 'atlas-cash', credit: 'customer-credit', description: 'forged' }] };
  assert.equal(actionSchema.safeParse({ type: 'import-legacy', data: JSON.stringify(forged) }).success, false);
});

test('new order numbers carry 48 random bits', () => {
  let s = addToCart(blank(), products[0], 'US 9', 1000);
  s = checkoutCart(s, 'purchase-1', cartSignature(s.cart), false, 1001, customsVersion);
  assert.match(s.orders[0].id, /^AT-[0-9A-F]{12}$/);
});

test('every page refuses to be framed while the CSP only reports', async () => {
  const rules = await nextConfig.headers();
  assert.ok(rules.length >= 2);
  for (const rule of rules) {
    const headers = new Map(rule.headers.map(({ key, value }) => [key, value]));
    assert.equal(headers.get('X-Frame-Options'), 'DENY', rule.source);
  }
});
