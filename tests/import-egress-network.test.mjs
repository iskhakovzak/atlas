import test from 'node:test';
import assert from 'node:assert/strict';
import { withDirectFallback } from '../lib/importer/egress.ts';

test('a network failure falls back directly only for eligible stores', async () => {
  let calls = 0;
  const fetcher = withDirectFallback(async () => { throw new TypeError('fetch failed'); }, async () => { calls++; return new Response('ok'); });
  const response = await fetcher('https://kith.com/products/example');
  assert.equal(response.headers.get('x-atlas-egress'), 'direct');
  assert.equal(calls, 1);
  await assert.rejects(fetcher('https://www.target.com/p/example'), TypeError);
  assert.equal(calls, 1);
});

test('an authentication error does not fall back', async () => {
  const fetcher = withDirectFallback(async () => { throw new Error('Importer proxy rejected the request (401).'); }, async () => { throw new Error('should not be called'); });
  await assert.rejects(fetcher('https://kith.com/products/example'), /401/);
});
