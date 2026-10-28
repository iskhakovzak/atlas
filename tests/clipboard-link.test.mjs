import test from 'node:test';
import assert from 'node:assert/strict';
import { storeLinkIn } from '../lib/market/clipboard-link.ts';

test('a copied store link is offered; other text, other sites and unsafe links are not', () => {
  assert.equal(storeLinkIn('Look at this https://www.nike.com/t/club-hoodie/FN3859-657 via Nike'), 'https://www.nike.com/t/club-hoodie/FN3859-657');
  assert.equal(storeLinkIn('www.amazon.com/dp/B0CT2NQ7WG'), 'https://www.amazon.com/dp/B0CT2NQ7WG');
  assert.equal(storeLinkIn('my password 123'), '');
  assert.equal(storeLinkIn('https://example.org/item'), '');
  assert.equal(storeLinkIn('https://user:pass@www.nike.com/t/x'), '');
  assert.equal(storeLinkIn(''), '');
});
