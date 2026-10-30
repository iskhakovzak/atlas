import test from 'node:test';
import assert from 'node:assert/strict';
import { distinguishingAxes, optionDisplay } from '../lib/market/variant-display.ts';

const ebay = (us, size, price = 27) => ({
  label: `US Shoe Size: ${us} · Size: ${size}`, price,
  options: [{ name: 'US Shoe Size', value: us }, { name: 'Size', value: size }, { name: 'Brand', value: 'adidas' }, { name: 'Color', value: 'Aurora Ivy / Cloud White' }, { name: 'Upper Material', value: '"see description"' }],
});

test('an eBay option tile shows only what tells the options apart', () => {
  const items = [ebay('5', '5'), ebay('5.5', '5-')];
  assert.deepEqual(distinguishingAxes(items), ['US Shoe Size'], 'Brand and colour are the same for all; "Size" repeats the US size');
  const shown = optionDisplay(items);
  assert.equal(shown.text(items[1]), '5.5');
  assert.equal(shown.priceVaries, false, 'one price for all: the tiles do not repeat it');
  assert.equal(optionDisplay([ebay('5', '5', 27), ebay('6', '6', 31)]).priceVaries, true);
});

test('two independent axes both stay; options without axes keep their label', () => {
  const items = [
    { label: 'a', options: [{ name: 'Color', value: 'Black' }, { name: 'Size', value: 'M' }] },
    { label: 'b', options: [{ name: 'Color', value: 'Black' }, { name: 'Size', value: 'L' }] },
    { label: 'c', options: [{ name: 'Color', value: 'White' }, { name: 'Size', value: 'M' }] },
  ];
  assert.deepEqual(distinguishingAxes(items), ['Color', 'Size']);
  assert.equal(optionDisplay(items).text(items[2]), 'White · M');
  assert.equal(optionDisplay([{ label: '128 GB' }, { label: '256 GB' }]).text({ label: '256 GB' }), '256 GB');
});
