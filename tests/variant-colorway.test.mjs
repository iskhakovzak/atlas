import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSingleColorway } from '../lib/market/variant-colorway.ts';

test('a slash-separated merchant name is displayed as one colorway, not as selectable colors', () => {
  assert.deepEqual(describeSingleColorway('Light Armory Blue/Light Armory Blue/Gum Light Brown/White'), {
    primary: 'Light Armory Blue',
    components: ['Light Armory Blue', 'Gum Light Brown', 'White'],
  });
});

test('empty colorway components are ignored without losing the original display name', () => {
  assert.deepEqual(describeSingleColorway(' / Navy / '), {
    primary: 'Navy',
    components: ['Navy'],
  });
  assert.deepEqual(describeSingleColorway(''), { primary: '', components: [] });
});
