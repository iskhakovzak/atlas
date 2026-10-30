import test from 'node:test';
import assert from 'node:assert/strict';
import { importTimingHeader } from '../lib/importer/import-timing.ts';

test('timings omit missing and invalid stages and report bounded, rounded durations', () => {
  assert.equal(importTimingHeader({ lookup: 12.4, merchant: 230.8, cacheWrite: NaN, total: 255.3 }),
    'lookup;dur=12, merchant;dur=231, total;dur=255');
});
