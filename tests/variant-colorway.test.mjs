import test from 'node:test';
import assert from 'node:assert/strict';
import {describeSingleColorway} from '../lib/market/variant-colorway.ts';

test('single Nike colorway is presented by its primary color while preserving distinct components', () => {
  assert.deepEqual(describeSingleColorway('Light Armory Blue/Light Armory Blue/Gum Light Brown/White'), {
    primary: 'Light Armory Blue',
    components: ['Light Armory Blue', 'Gum Light Brown', 'White'],
  });
});

test('colorway descriptions tolerate empty components and retain the source label', () => {
  assert.deepEqual(describeSingleColorway(' / Navy / '), {
    primary: 'Navy',
    components: ['Navy'],
  });
  assert.deepEqual(describeSingleColorway(''), {primary: '', components: []});
});
