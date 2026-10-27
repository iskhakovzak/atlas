import test from 'node:test';
import assert from 'node:assert/strict';
import {
  catalogItemHref, itemParam, withoutItemParam, rememberPendingFavorite, takePendingFavorite, pendingFavoriteToSave,
  pendingFavoriteKey, pendingFavoriteTtlMs, distinctCovers, readRecentProducts, rememberRecentProduct, clearRecentProducts,
} from '../lib/market/catalog-links.ts';
import { readCatalogQuery } from '../lib/market/catalog-query.ts';

test('a product row links to its store filter with the product to open', () => {
  assert.equal(catalogItemHref('/catalog?store=amazon.com,amazon.de', 'p 1/2'), '/catalog?store=amazon.com,amazon.de&item=p%201%2F2');
  assert.equal(catalogItemHref('/catalog', 'x'), '/catalog?item=x');
  assert.equal(catalogItemHref('/catalog?store=a.com#grid', 'x'), '/catalog?store=a.com&item=x#grid');
  // The extra parameter does not change the filters the catalog reads.
  assert.deepEqual(readCatalogQuery('?store=amazon.com&item=x'), readCatalogQuery('?store=amazon.com'));
});

test('item is read from the address and dropped without touching the filters', () => {
  assert.equal(itemParam('?store=a.com&item=p%201'), 'p 1');
  assert.equal(itemParam('?store=a.com'), null);
  assert.equal(itemParam('?item='), null);
  assert.equal(withoutItemParam('http://localhost:5191/catalog?store=a.com,b.com&item=x&sale=1#top'), '/catalog?store=a.com,b.com&sale=1#top');
  assert.equal(withoutItemParam('/catalog?item=x'), '/catalog');
  assert.equal(withoutItemParam('/catalog?it%65m=x&q=%E2%80%94'), '/catalog?q=%E2%80%94');
  assert.equal(withoutItemParam('/catalog?bad=%E0%A4%A&item=1'), '/catalog?bad=%E0%A4%A');
});

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k) => data.has(k) ? data.get(k) : null, setItem: (k, v) => { data.set(k, String(v)); }, removeItem: (k) => { data.delete(k); } };
}

test('the guest heart is remembered and taken once', () => {
  const storage = memoryStorage();
  rememberPendingFavorite(storage, 'p1', 1000);
  assert.deepEqual(JSON.parse(storage.data.get(pendingFavoriteKey)), { id: 'p1', at: 1000 });
  assert.equal(takePendingFavorite(storage), JSON.stringify({ id: 'p1', at: 1000 }));
  assert.equal(storage.data.has(pendingFavoriteKey), false);
  assert.equal(takePendingFavorite(storage), null);
  // Blocked storage never throws into the page.
  const broken = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); }, removeItem() { throw Error('blocked'); } };
  assert.doesNotThrow(() => rememberPendingFavorite(broken, 'p1', 1));
  assert.equal(takePendingFavorite(broken), null);
  assert.equal(takePendingFavorite(null), null);
});

test('only a fresh note for a catalog product not saved yet is saved', () => {
  const now = 10_000_000;
  const catalogIds = new Set(['p1', 'p2']);
  const note = (id, at) => JSON.stringify({ id, at });
  assert.equal(pendingFavoriteToSave(note('p1', now - 1000), { now, catalogIds, favorites: [] }), 'p1');
  // Already saved: the action toggles, so it must not run.
  assert.equal(pendingFavoriteToSave(note('p1', now - 1000), { now, catalogIds, favorites: ['p1'] }), null);
  assert.equal(pendingFavoriteToSave(note('p1', now - pendingFavoriteTtlMs - 1), { now, catalogIds, favorites: [] }), null);
  assert.equal(pendingFavoriteToSave(note('gone', now), { now, catalogIds, favorites: [] }), null);
  assert.equal(pendingFavoriteToSave(note('p1', now + 10 * 60_000), { now, catalogIds, favorites: [] }), null);
  for (const raw of [null, '', 'nope', '[]', '{"id":5,"at":1}', '{"id":"p1"}', 'null']) assert.equal(pendingFavoriteToSave(raw, { now, catalogIds, favorites: [] }), null, String(raw));
});

test('set covers prefer photos the earlier sets have not used', () => {
  const item = (id, image = `/img/${id}.jpg`) => ({ product: { id, image } });
  const sale = { items: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => item(id)) };
  const amazon = { items: ['a', 'b', 'c', 'd', 'g', 'h'].map((id) => item(id)) };
  const cheap = { items: ['a', 'b', 'c', 'g', 'h'].map((id) => item(id)) };
  const [first, second, third] = distinctCovers([sale, amazon, cheap]);
  assert.deepEqual(first, ['/img/a.jpg', '/img/b.jpg', '/img/c.jpg', '/img/d.jpg']);
  // Two fresh photos, then the set's own used ones fill the collage.
  assert.deepEqual(second, ['/img/g.jpg', '/img/h.jpg', '/img/a.jpg', '/img/b.jpg']);
  // Nothing fresh left: the set still shows its own products.
  assert.deepEqual(third, ['/img/a.jpg', '/img/b.jpg', '/img/c.jpg', '/img/g.jpg']);
  // Products without a photo are skipped; a three-product set keeps three (one large photo on the strip).
  assert.deepEqual(distinctCovers([{ items: [item('x', ''), item('y'), item('z'), item('w')] }]), [['/img/y.jpg', '/img/z.jpg', '/img/w.jpg']]);
});

test('recently viewed keeps the newest twelve distinct ids and survives broken storage', () => {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  for (let index = 0; index < 14; index++) rememberRecentProduct(storage, 'p' + index);
  assert.deepEqual(rememberRecentProduct(storage, 'p5').slice(0, 3), ['p5', 'p13', 'p12']);
  assert.equal(readRecentProducts(storage).length, 12);
  assert.equal(readRecentProducts(storage).filter((id) => id === 'p5').length, 1);
  data.set('atlas-recent-products', '{not json');
  assert.deepEqual(readRecentProducts(storage), []);
  clearRecentProducts(storage);
  assert.deepEqual(readRecentProducts(storage), []);
  assert.deepEqual(readRecentProducts(null), []);
});
