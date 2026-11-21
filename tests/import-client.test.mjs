import test from 'node:test';
import assert from 'node:assert/strict';
import {requestImport} from '../lib/market/import-client.ts';

const url = 'https://www.walmart.com/ip/1234';
const pending = () => Response.json({pending: true, retryAfterMs: 12_000, message: 'Collecting'}, {status: 202});

test('polling spends at most the remaining wait budget and never sends a request after the deadline', async t => {
  let now = 0, fetches = 0;
  const delays = [];
  t.mock.method(Date, 'now', () => now);
  const response = await requestImport({url}, {
    maxWaitMs: 4_000,
    fetcher: async () => { fetches += 1; now += 1_500; return pending(); },
    sleep: async ms => { delays.push(ms); now += ms; },
  });
  assert.equal(fetches, 1);
  assert.deepEqual(delays, [2_500]);
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, 'Collecting');
});

test('changing the link aborts an outstanding fetch and suppresses pending updates', async () => {
  const controller = new AbortController();
  const updates = [];
  const responsePromise = requestImport({url, fresh: true, reuseRecent: true}, {
    signal: controller.signal,
    fetcher: (_path, init) => {
      assert.equal(init.signal, controller.signal);
      assert.deepEqual(JSON.parse(init.body), {url, fresh: true, reuseRecent: true});
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), {once: true}));
    },
    onPending: result => updates.push(result),
  });
  controller.abort();
  assert.equal((await responsePromise).status, 202);
  assert.deepEqual(updates, []);
});

test('changing the link interrupts the backoff between polls', {timeout: 1_000}, async () => {
  const controller = new AbortController();
  let fetches = 0;
  const response = await requestImport({url}, {
    signal: controller.signal,
    fetcher: async () => { fetches += 1; return pending(); },
    onPending: () => setImmediate(() => controller.abort()),
  });
  assert.equal(response.status, 202);
  assert.equal(fetches, 1);
});

test('a malformed pending body still leaves a retryable result', async () => {
  const response = await requestImport({url}, {
    maxWaitMs: 0,
    fetcher: async () => Response.json(null, {status: 202}),
    onPending: result => assert.deepEqual(result, {pending: true}),
  });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).manualEntryAvailable, true);
});
