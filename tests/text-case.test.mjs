import test from 'node:test';
import assert from 'node:assert/strict';
import { capitalizeFirst, capitalizeWords } from '../lib/market/text-case.ts';

test('a full name gets a capital on every word, an address only on the first letter', () => {
  assert.equal(capitalizeWords('karimova zarina'), 'Karimova Zarina');
  assert.equal(capitalizeWords('каримова зарина-хон'), 'Каримова Зарина-Хон');
  assert.equal(capitalizeWords('g‘ulomov o\'tkir'), 'G‘ulomov O\'tkir', 'an Uzbek apostrophe is not a word start');
  assert.equal(capitalizeWords('McDonald '), 'McDonald ', 'the rest stays as typed');
  assert.equal(capitalizeFirst('навои 12, кв. 5'), 'Навои 12, кв. 5');
  assert.equal(capitalizeFirst(' tashkent'), ' Tashkent');
  assert.equal(capitalizeFirst('12 улица'), '12 улица');
  assert.equal(capitalizeWords(''), '');
});
