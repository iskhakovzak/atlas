import test from 'node:test';
import assert from 'node:assert/strict';
import {
  choicesFromAction, cleanPicks, discardPendingCartAdd, draftAddress, draftChoices, draftKeyFor, draftPrefix, draftTtlMs, draftVisible,
  forgetLastDraft, forgetOtherAccounts, hasPendingCartAdd, keepPicks, lastDraftKey, markDraftDone, maxDraftBytes, maxDrafts, ownerTag,
  parseDraft, parsePendingCartAdd, pendingCartAddKey, pendingCartFreshMs, pendingTtlMs, pruneDrafts, readDraft, readLastDraft, removeDraft,
  restoreMode, savePendingCartAdd, serializeDraft, storageWritable, takePendingCartAdd, writeDraft,
} from '../lib/market/link-order-draft.ts';

const now = 1_790_000_000_000;
class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(index) { return [...this.map.keys()][index] ?? null; }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
}
class ThrowingStorage { get length() { throw Error('blocked'); } key() { throw Error('blocked'); } getItem() { throw Error('blocked'); } setItem() { throw Error('blocked'); } removeItem() { throw Error('blocked'); } }

const link = 'https://www.zara.com/es/en/shirt-p01.html';
function input(extra = {}) {
  return {
    done: false, owner: '', pageUrl: link, catalogId: '', dealId: '',
    url: link, source: link, name: 'Shirt', brand: 'Zara', declaration: '', currency: 'EUR', amount: '29.95',
    shipping: '10', shippingCurrency: 'USD', shippingEstimated: true, foundShipping: null,
    weight: '0.6', weightBasis: 'estimate', weightOrigin: 'Atlas estimate', country: 'Испания', otherCountry: '', category: 'Одежда',
    variant: 'M', variants: [{ label: 'S', available: true, price: 29.95 }, { label: 'M', available: true, price: 29.95, quantity: 4 }, { label: 'L', available: true, price: 31 }],
    selectedColor: '', selectedSize: 'M', image: 'https://static.zara.net/a.jpg', images: ['https://static.zara.net/a.jpg'],
    showSourceForm: false, note: '', verified: true, sourceCheckStatus: 'verified', importedAt: now - 60_000, sourceExpiresAt: now + 9 * 60_000,
    locks: { name: true, price: true, shipping: true, country: true, category: true, weight: true },
    picked: { M: 3, L: 1 }, manualQuantity: 1, comment: 'Gift wrap', previewSpeed: 'standard',
    ...extra,
  };
}
const stored = (extra = {}, at = now) => serializeDraft(input(extra), at);

test('a draft round-trips with the customer choice: options with quantities, comment, speed, weight basis and locks', () => {
  const draft = parseDraft(stored(), now);
  assert.ok(draft);
  assert.deepEqual(draft.picked, { M: 3, L: 1 });
  assert.equal(draft.comment, 'Gift wrap');
  assert.equal(draft.previewSpeed, 'standard');
  assert.equal(draft.weightBasis, 'estimate');
  assert.equal(draft.locks.price, true);
  assert.equal(draft.variants.length, 3);
  assert.equal(draft.savedAt, now);
  assert.match(stored(), /^\{"v":2,"savedAt":\d+/, 'savedAt leads the JSON so pruning does not parse whole drafts');
});

test('garbage, another version, a missing link or status and drafts older than 24 hours are rejected', () => {
  for (const raw of [null, '', 'not json', '[]', '{}', JSON.stringify({ v: 1, savedAt: now, source: link, sourceCheckStatus: 'verified' }), '{"v":2}'])
    assert.equal(parseDraft(raw, now), null, String(raw));
  assert.equal(parseDraft(stored({ source: '' }), now), null);
  assert.equal(parseDraft(stored({ sourceCheckStatus: 'done' }), now), null);
  assert.equal(parseDraft(stored({}, now - draftTtlMs - 1), now), null, 'expired');
  assert.ok(parseDraft(stored({}, now - draftTtlMs + 1000), now), 'still within 24 h');
  assert.equal(parseDraft(stored({}, now + 60 * 60_000), now), null, 'a draft from the future is not trusted');
  assert.equal(parseDraft('x'.repeat(maxDraftBytes + 1), now), null, 'oversized');
});

test('fields of the wrong type fall back to safe values instead of breaking the page', () => {
  const raw = JSON.parse(stored());
  Object.assign(raw, { name: 42, amount: { x: 1 }, variants: [null, 5, { label: '' }, { label: 'XL', price: 'cheap', quantity: -2 }], images: [1, 'https://a.example/b.jpg'], manualQuantity: 99, previewSpeed: 'rocket', weightBasis: 'guess', foundShipping: { amount: 'x' }, comment: 'c'.repeat(900) });
  const draft = parseDraft(JSON.stringify(raw), now);
  assert.equal(draft.name, '');
  assert.equal(draft.amount, '');
  assert.deepEqual(draft.variants, [{ label: 'XL', available: true }]);
  assert.deepEqual(draft.images, ['https://a.example/b.jpg']);
  assert.equal(draft.manualQuantity, 10);
  assert.equal(draft.previewSpeed, undefined);
  assert.equal(draft.weightBasis, 'estimate');
  assert.equal(draft.foundShipping, null);
  assert.equal(draft.comment.length, 500);
});

test('picks keep quantities from 1 to 10 and at most 50 options', () => {
  assert.deepEqual(cleanPicks({ S: 1, M: 10, L: 11, XL: 0, XXL: -1, XS: 2.7, bad: 'x', '': 2, ' ': 3 }), { S: 1, M: 10, L: 10, XS: 2 });
  assert.deepEqual(cleanPicks(null), {});
  assert.deepEqual(cleanPicks([1, 2]), {});
  const many = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`opt-${index}`, 2]));
  assert.equal(Object.keys(cleanPicks(many)).length, 50);
});

test('a draft too big for 300 KB drops reloadable photos first and is refused only when even that does not fit', () => {
  const photo = 'https://static.zara.net/' + 'p'.repeat(2900);
  const variants = Array.from({ length: 250 }, (_, index) => ({ label: `opt-${index}`, available: true, image: photo }));
  const lean = serializeDraft(input({ variants, colorwayImages: [{ color: 'Black', images: [photo] }] }), now);
  assert.ok(lean && lean.length <= maxDraftBytes);
  const draft = parseDraft(lean, now);
  assert.equal(draft.variants.length, 250);
  assert.equal(draft.variants[0].image, undefined);
  assert.deepEqual(draft.picked, { M: 3, L: 1 }, 'the choice survives trimming');
  const huge = Array.from({ length: 250 }, (_, index) => ({ label: `opt-${index}`.padEnd(190, 'x'), available: true, id: 'i'.repeat(2000) }));
  assert.equal(serializeDraft(input({ variants: huge }), now), null);
});

test('only a fresh store check of a plain link comes back as it was; anything else reloads and reapplies the choice', () => {
  assert.equal(restoreMode(parseDraft(stored(), now), now), 'full');
  assert.equal(restoreMode(parseDraft(stored({ sourceExpiresAt: now - 1 }), now), now), 'choices', 'stale');
  assert.equal(restoreMode(parseDraft(stored({ sourceCheckStatus: 'failed' }), now), now), 'choices', 'failed');
  assert.equal(restoreMode(parseDraft(stored({ catalogId: 'card-1' }), now), now), 'choices', 'catalog');
  assert.equal(restoreMode(parseDraft(stored({ dealId: 'deal-1' }), now), now), 'choices', 'deal');
  const nike = 'https://www.nike.com/t/air-max';
  assert.equal(restoreMode(parseDraft(stored({ source: nike }), now), now), 'choices', 'Nike without its colorway gallery');
  assert.equal(restoreMode(parseDraft(stored({ source: nike, colorwayImages: [] }), now), now), 'full');
});

test('the typed values come back only for a failed check of a plain link', () => {
  assert.equal(draftChoices(parseDraft(stored(), now)).manual, undefined);
  assert.equal(draftChoices(parseDraft(stored({ sourceCheckStatus: 'failed', catalogId: 'c' }), now)).manual, undefined);
  const choices = draftChoices(parseDraft(stored({ sourceCheckStatus: 'failed', amount: '12', name: 'Typed' }), now));
  assert.equal(choices.manual.amount, '12');
  assert.equal(choices.manual.name, 'Typed');
  assert.deepEqual(choices.picked, { M: 3, L: 1 });
});

test('reapplied options keep what the store still sells and name the rest instead of choosing another', () => {
  const variants = [{ label: 'S' }, { label: 'M', quantity: 2 }, { label: 'L', quantity: 0 }];
  assert.deepEqual(keepPicks({ M: 3, L: 1, XL: 2, S: 4 }, variants), { picked: { M: 2, S: 4 }, missing: ['L', 'XL'] });
  assert.deepEqual(keepPicks({}, variants), { picked: {}, missing: [] });
});

test('the page address keeps the link, catalog card or deal and other parameters', () => {
  assert.equal(draftKeyFor({ pageUrl: '' }), '');
  assert.equal(draftKeyFor({ pageUrl: link }), 'url:' + link);
  assert.equal(draftKeyFor({ pageUrl: link, catalogId: 'c1', dealId: 'd1' }), 'catalog:c1:' + link);
  assert.equal(draftKeyFor({ pageUrl: link, dealId: 'd1' }), 'deal:d1:' + link);
  assert.equal(draftAddress({ pageUrl: link, catalogId: 'c1' }, '?lang=uz&url=old'), '/order-by-link?lang=uz&url=' + encodeURIComponent(link) + '&catalog=c1');
  assert.equal(draftAddress({ pageUrl: '' }), '/order-by-link');
});

test('drafts live in storage: the last unfinished one comes back, a done one does not', () => {
  const storage = new MemoryStorage();
  const key = draftKeyFor({ pageUrl: link });
  assert.equal(writeDraft(storage, key, input(), now, true), true);
  assert.equal(storage.getItem(lastDraftKey), key);
  assert.deepEqual(readDraft(storage, key, now).picked, { M: 3, L: 1 });
  assert.equal(readLastDraft(storage, now).pageUrl, link);
  forgetLastDraft(storage);
  assert.equal(readLastDraft(storage, now), null, 'the customer started a new link');
  assert.ok(readDraft(storage, key, now), 'the draft itself stays for its own address');
  writeDraft(storage, key, input(), now);
  markDraftDone(storage, key, now + 1000);
  assert.equal(readDraft(storage, key, now + 1000), null, 'done: not offered again');
  assert.equal(readLastDraft(storage, now + 1000), null);
  writeDraft(storage, key, input({ done: true }), now);
  assert.equal(storage.getItem(lastDraftKey), null, 'a done draft never becomes the last one');
  removeDraft(storage, key);
  assert.equal(storage.getItem(draftPrefix + key), null);
  storage.setItem(draftPrefix + 'url:junk', 'garbage');
  assert.equal(readDraft(storage, 'url:junk', now), null);
  assert.equal(storage.getItem(draftPrefix + 'url:junk'), null, 'garbage is cleaned up');
});

test('at most five drafts are kept, expired ones go first and the one being written always stays', () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 7; index++) storage.setItem(draftPrefix + `url:https://a.com/${index}`, stored({}, now - (7 - index) * 1000));
  storage.setItem(draftPrefix + 'url:https://a.com/old', stored({}, now - draftTtlMs - 5000));
  storage.setItem('atlas-language', 'uz');
  storage.setItem(lastDraftKey, 'url:https://a.com/0');
  pruneDrafts(storage, now, 'url:https://a.com/0');
  const left = [...storage.map.keys()].filter(key => key.startsWith(draftPrefix)).sort();
  assert.equal(left.length, maxDrafts);
  assert.ok(left.includes(draftPrefix + 'url:https://a.com/0'));
  assert.ok(left.includes(draftPrefix + 'url:https://a.com/6'));
  assert.ok(!left.includes(draftPrefix + 'url:https://a.com/old'));
  assert.equal(storage.getItem('atlas-language'), 'uz', 'other keys are untouched');
  storage.setItem(draftPrefix + 'url:https://a.com/new', stored({}, now));
  pruneDrafts(storage, now);
  assert.equal(storage.getItem(draftPrefix + 'url:https://a.com/0'), null, 'without `keep` the oldest goes');
  assert.equal(storage.getItem(lastDraftKey), null, 'a pointer to a pruned draft is cleared');
});

test('blocked storage never throws and the page simply works without it', () => {
  const storage = new ThrowingStorage();
  assert.equal(writeDraft(storage, 'url:x', input(), now, true), false);
  assert.equal(readDraft(storage, 'url:x', now), null);
  assert.equal(readLastDraft(storage, now), null);
  assert.doesNotThrow(() => { markDraftDone(storage, 'url:x', now); removeDraft(storage, 'url:x'); forgetLastDraft(storage); pruneDrafts(storage, now); });
  assert.equal(savePendingCartAdd(storage, { action: addOne(), returnTo: '/order-by-link', draftKey: 'url:x' }, now), false);
  assert.equal(takePendingCartAdd(storage, now), null);
  assert.equal(writeDraft(null, 'url:x', input(), now), false);
});

const product = (variant = 'M') => ({ id: link + '#' + variant, name: 'Shirt', brand: 'Zara', category: 'Одежда', usd: 32, weight: 0.9, image: '', variants: [variant], sourceUrl: link, sourcePrice: 29.95, sourceCurrency: 'EUR' });
const addOne = (extra = {}) => ({ type: 'cart-add', product: product(), variant: 'M', quantity: 3, note: 'Gift wrap', ...extra });
const addMany = () => ({ type: 'cart-add-many', items: [{ product: product('M'), variant: 'M', quantity: 3 }, { product: product('L'), variant: 'L', quantity: 1 }] });

test('a guest cart add is kept for 30 minutes and taken out exactly once', () => {
  const storage = new MemoryStorage();
  assert.equal(savePendingCartAdd(storage, { action: addMany(), speed: 'standard', returnTo: '/order-by-link?url=x', draftKey: 'url:x' }, now), true);
  assert.equal(hasPendingCartAdd(storage, now), true);
  const pending = takePendingCartAdd(storage, now + 1000);
  assert.equal(pending.action.type, 'cart-add-many');
  assert.equal(pending.lines, 2);
  assert.equal(pending.units, 4);
  assert.equal(pending.speed, 'standard');
  assert.equal(pending.returnTo, '/order-by-link?url=x');
  assert.equal(takePendingCartAdd(storage, now + 2000), null, 'a second render or tab gets nothing');
  savePendingCartAdd(storage, { action: addOne(), returnTo: '/order-by-link', draftKey: 'url:x' }, now);
  assert.equal(hasPendingCartAdd(storage, now + pendingTtlMs + 1), false);
  assert.equal(takePendingCartAdd(storage, now + pendingTtlMs + 1), null, 'expired');
  assert.equal(storage.getItem(pendingCartAddKey), null, 'an expired add is removed, not left behind');
});

test('a malformed or tampered guest cart add is refused', () => {
  const bad = [
    addOne({ type: 'checkout' }), addOne({ quantity: 11 }), addOne({ quantity: 0 }), addOne({ variant: '' }), addOne({ note: 'x'.repeat(501) }),
    addOne({ product: { ...product(), usd: 0 } }), addOne({ product: { ...product(), name: '' } }), addOne({ product: { ...product(), variants: [] } }),
    { type: 'cart-add-many', items: [] }, { type: 'cart-add-many', items: Array.from({ length: 21 }, () => ({ product: product(), variant: 'M', quantity: 1 })) },
    { type: 'cart-add-many', items: [{ product: product(), variant: 'M' }] },
  ];
  for (const action of bad) assert.equal(savePendingCartAdd(new MemoryStorage(), { action, returnTo: '/', draftKey: '' }, now), false, JSON.stringify(action).slice(0, 80));
  const raw = (extra) => JSON.stringify({ v: 1, savedAt: now, expiresAt: now + pendingTtlMs, action: addOne(), returnTo: '/order-by-link', draftKey: 'url:x', ...extra });
  assert.ok(parsePendingCartAdd(raw(), now));
  assert.equal(parsePendingCartAdd(raw({ v: 2 }), now), null);
  assert.equal(parsePendingCartAdd(raw({ expiresAt: now + pendingTtlMs * 5 }), now), null, 'a lifetime longer than 30 minutes is not believed');
  assert.equal(parsePendingCartAdd(raw({ savedAt: now + 60 * 60_000 }), now), null);
  assert.equal(parsePendingCartAdd('{', now), null);
  assert.equal(parsePendingCartAdd(raw({ returnTo: '//evil.example/x' }), now).returnTo, '/order-by-link', 'only a same-site path');
  assert.equal(parsePendingCartAdd(raw({ returnTo: 'https://evil.example' }), now).returnTo, '/order-by-link');
});

test('the choice inside a cart add can be selected again after a price change', () => {
  assert.deepEqual(choicesFromAction(addMany(), 'express').picked, { M: 3, L: 1 });
  const one = choicesFromAction(addOne());
  assert.deepEqual(one.picked, { M: 3 });
  assert.equal(one.comment, 'Gift wrap');
  assert.equal(one.manualQuantity, 3);
  assert.equal(choicesFromAction({ type: 'cart-add', product: product(), variant: 'M' }).picked.M, 1);
});

test('a damaged entry never brings back a link or a photo the page would refuse', () => {
  const raw = JSON.parse(stored());
  assert.equal(parseDraft(JSON.stringify({ ...raw, source: 'not a url' }), now), null, 'a broken store link drops the draft');
  assert.equal(parseDraft(JSON.stringify({ ...raw, source: 'http://www.zara.com/x' }), now), null, 'only https');
  assert.equal(parseDraft(JSON.stringify({ ...raw, source: 'https://localhost/x' }), now), null);
  const draft = parseDraft(JSON.stringify({ ...raw, pageUrl: 'javascript:alert(1)', image: 'javascript:alert(1)', images: ['https://static.zara.net/a.jpg', 'http://x.com/a.jpg', 'https://10.0.0.1/a.jpg'], variants: [{ label: 'M', available: true, image: 'https://evil.local/a.jpg' }, { label: 'L', available: true, image: '/rel.jpg' }] }), now);
  assert.equal(draft.pageUrl, '', 'a page link that is not a store link is dropped (and with it the "last draft" pointer)');
  assert.equal(draft.image, '');
  assert.deepEqual(draft.images, ['https://static.zara.net/a.jpg']);
  assert.equal(draft.variants[0].image, undefined, 'an unsafe option photo is dropped, the option stays');
  assert.equal(draft.variants[1].image, 'https://www.zara.com/rel.jpg', 'a relative photo resolves against the store link');
  const storage = new MemoryStorage();
  const key = draftKeyFor({ pageUrl: link });
  storage.setItem(draftPrefix + key, JSON.stringify({ ...raw, pageUrl: 'javascript:alert(1)' }));
  storage.setItem(lastDraftKey, key);
  assert.equal(readLastDraft(storage, now), null, 'a pointer whose draft does not match its own address is dropped');
  assert.equal(storage.getItem(lastDraftKey), null);
});

test('the store product price and a typed option survive the draft', () => {
  assert.equal(parseDraft(stored({ basePrice: 40 }), now).basePrice, 40);
  assert.equal(parseDraft(stored({ basePrice: -1 }), now).basePrice, undefined);
  const typed = draftChoices(parseDraft(stored({ sourceCheckStatus: 'failed', variants: [], variant: ' EU 42 ', manualQuantity: 3, picked: {} }), now));
  assert.deepEqual(typed.manualOption, { label: 'EU 42', quantity: 3 });
  assert.equal(draftChoices(parseDraft(stored(), now)).manualOption, undefined, 'with listed options the last one touched is not a typed option');
});

test("a draft saved under an account is only that account's; a guest draft follows the guest into an account", () => {
  const alice = ownerTag({ email: 'Alice@Example.test ', createdAt: 1 }), bob = ownerTag({ email: 'bob@example.test', createdAt: 2 });
  assert.match(alice, /^a[0-9a-f]{8}$/);
  assert.equal(alice, ownerTag({ email: 'alice@example.test', createdAt: 1 }), 'case and spaces of the e-mail do not matter');
  assert.notEqual(alice, bob);
  assert.equal(ownerTag(null), '');
  assert.equal(parseDraft(stored({ owner: alice }), now).owner, alice);
  assert.equal(parseDraft(stored({ owner: 'someone' }), now).owner, '', 'a tag of another shape is not believed');
  assert.equal(draftVisible({ owner: '' }, null), true, 'a guest draft is shown before the account is known');
  assert.equal(draftVisible({ owner: '' }, alice), true);
  assert.equal(draftVisible({ owner: alice }, alice), true);
  assert.equal(draftVisible({ owner: alice }, bob), false);
  assert.equal(draftVisible({ owner: alice }, ''), false, 'after signing out the next guest does not get it');
  assert.equal(draftVisible({ owner: alice }, null), false, 'nor while the account is unknown');

  const storage = new MemoryStorage();
  const mine = 'url:https://a.com/1', theirs = 'url:https://a.com/2', guest = 'url:https://a.com/3';
  writeDraft(storage, mine, input({ owner: bob, pageUrl: 'https://a.com/1' }), now);
  writeDraft(storage, guest, input({ owner: '', pageUrl: 'https://a.com/3' }), now);
  writeDraft(storage, theirs, input({ owner: alice, pageUrl: 'https://a.com/2' }), now);
  assert.equal(storage.getItem(lastDraftKey), theirs);
  forgetOtherAccounts(storage, bob);
  assert.equal(storage.getItem(draftPrefix + theirs), null, "another account's draft is removed");
  assert.equal(storage.getItem(lastDraftKey), null, 'with the pointer to it');
  assert.ok(storage.getItem(draftPrefix + mine));
  assert.ok(storage.getItem(draftPrefix + guest));
  forgetOtherAccounts(storage, '');
  assert.equal(storage.getItem(draftPrefix + mine), null, "a guest on this device gets no account's drafts");
  assert.ok(storage.getItem(draftPrefix + guest));
  assert.doesNotThrow(() => forgetOtherAccounts(new ThrowingStorage(), ''));
});

test('a kept add is sent only where it belongs and dropped when the guest returns without signing in', () => {
  const storage = new MemoryStorage();
  const keep = () => savePendingCartAdd(storage, { action: addOne(), returnTo: '/order-by-link?url=x', draftKey: 'url:x' }, now);
  keep();
  assert.equal(hasPendingCartAdd(storage, now, { draftKey: 'url:y' }), false, 'another product page does not send it');
  assert.equal(takePendingCartAdd(storage, now, { draftKey: 'url:y' }), null);
  assert.ok(storage.getItem(pendingCartAddKey), 'and leaves it for its own page');
  assert.equal(hasPendingCartAdd(storage, now + pendingCartFreshMs + 1, { maxAgeMs: pendingCartFreshMs }), false, 'the cart sends only a fresh one');
  assert.equal(hasPendingCartAdd(storage, now + pendingCartFreshMs + 1, { draftKey: 'url:x' }), true, 'its own page still may');
  assert.equal(takePendingCartAdd(storage, now, { draftKey: 'url:x' }).draftKey, 'url:x');
  keep();
  discardPendingCartAdd(storage, 'url:y', now);
  assert.ok(storage.getItem(pendingCartAddKey), 'a change on another product keeps it');
  discardPendingCartAdd(storage, 'url:x', now);
  assert.equal(storage.getItem(pendingCartAddKey), null, 'a changed choice on its product drops it');
  keep();
  discardPendingCartAdd(storage);
  assert.equal(storage.getItem(pendingCartAddKey), null, 'a guest back without signing in drops it');
  storage.setItem(pendingCartAddKey, '{broken');
  assert.equal(hasPendingCartAdd(storage, now), false);
  assert.equal(storage.getItem(pendingCartAddKey), null, 'an unreadable one is removed on sight');
  assert.ok(pendingTtlMs <= 30 * 60_000);
  assert.equal(storageWritable(storage), true);
  assert.equal(storageWritable(new ThrowingStorage()), false);
  assert.equal(storageWritable(null), false);
  assert.doesNotThrow(() => discardPendingCartAdd(new ThrowingStorage()));
});
