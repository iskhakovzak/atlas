import test from 'node:test';
import assert from 'node:assert/strict';
import {atlasServiceTotal} from '../lib/market/quote-presentation.ts';

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

  const groupedService = atlasServiceTotal(quote);

  assert.equal(groupedService, 382_033);
  assert.equal(quote.merchandise + quote.sourceShipping + groupedService + quote.optionalServices + quote.reserve, 1_416_073);
});

test('older quotes without optional fee components remain displayable', () => {
  assert.equal(atlasServiceTotal({service: 12, shipping: 0}), 12);
});
