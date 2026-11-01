import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasServiceBreakdown,billLines} from '../lib/market/quote-presentation.ts';

test('service display groups fees without changing the quote total', () => {
  const quote = {
    merchandise: 887_640,
    sourceShipping: 120_000,
    service: 106_517,
    buyout: 8_876,
    conversion: 0,
    shipping: 264_000,
    deliveryMargin: 2_640,
    optionalServices: 0,
    reserve: 26_400,
  };

  const breakdown = atlasServiceBreakdown(quote);
  assert.deepEqual(breakdown, {service: 115_393, international: 266_640});
  // Cart, checkout and orders (owner, 2 November 2026): «Сервис Atlas» is the fee, delivery its own line; the sum is unchanged.
  const lines = billLines(quote);
  assert.deepEqual(lines, {service: 115_393, delivery: 266_640});
  assert.equal(quote.merchandise + quote.sourceShipping + lines.service + lines.delivery + quote.optionalServices + quote.reserve, 1_416_073);
  // The fee for paying customs through Atlas stands in «Сервис Atlas», never in delivery.
  assert.deepEqual(billLines({...quote, customsHelp: 9_000}), {service: 124_393, delivery: 266_640});
});

test('older quotes without optional fee components remain displayable', () => {
  assert.deepEqual(billLines({service: 12, shipping: 0}), {service: 12, delivery: 0});
});
