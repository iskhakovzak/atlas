import test from 'node:test';
import assert from 'node:assert/strict';
import { routeKey, toastSurvivesRoute } from '../lib/market/toast-route.ts';

test('a new section clears the toasts', () => {
  assert.equal(toastSurvivesRoute('/catalog', '/cart'), false);
  assert.equal(toastSurvivesRoute('/order-by-link?url=x', '/account'), false);
  assert.equal(toastSurvivesRoute('/catalog/p/find-1', '/stores'), false);
});

test('the catalog sheet opening and closing is the same screen; the same page with another query too', () => {
  assert.equal(toastSurvivesRoute('/catalog', '/catalog/p/find-1'), true);
  assert.equal(toastSurvivesRoute('/catalog/p/find-1', '/catalog?page=2'), true);
  assert.equal(toastSurvivesRoute('/cart', '/cart/'), true);
  assert.equal(toastSurvivesRoute('/order-by-link?url=a', '/order-by-link?url=b'), true);
});

test('route keys drop the language prefix, query and trailing slash', () => {
  assert.equal(routeKey('/uz/catalog/'), '/catalog');
  assert.equal(routeKey('/'), '/');
  assert.equal(routeKey('/en'), '/');
});
