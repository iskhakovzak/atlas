import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {getCatalogRefreshReadiness, runRefresh} from '../workers/catalog-refresh/src/index.ts';
import {isAuthorizedCatalogRefresh} from '../lib/market/catalog-refresh-auth.ts';

test('cron worker signs the protected Atlas refresh endpoint without exposing credentials', async () => {
  let captured;
  const response = await runRefresh({
    ATLAS_SITE_URL: 'https://atlas.example.test/',
    ATLAS_CATALOG_REFRESH_SECRET: 'test-secret',
  }, async (url, init) => {
    captured = {url, init};
    return new Response(JSON.stringify({ok: true}), {status: 200, headers: {'content-type': 'application/json'}});
  });
  assert.equal(response, JSON.stringify({ok: true}));
  assert.equal(captured.url, 'https://atlas.example.test/api/internal/catalog-refresh');
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers.Cookie, undefined);
  const request = new Request(captured.url, captured.init);
  assert.equal(await isAuthorizedCatalogRefresh(request, 'test-secret', Number(captured.init.headers['x-atlas-refresh-timestamp'])), true);
});

test('cron worker refuses non-HTTPS site endpoints', async () => {
  await assert.rejects(
    () => runRefresh({ATLAS_SITE_URL: 'http://atlas.example.test', ATLAS_CATALOG_REFRESH_SECRET: 'x'}),
    error => error.reasonCode === 'site_url_https_required',
  );
});

test('health reports ready configuration without disclosing the secret', async () => {
  const secret = 'health-test-secret';
  const response = await worker.fetch(new Request('https://worker.example.test/health'), {
    ATLAS_SITE_URL: 'https://atlas.example.test/',
    ATLAS_CATALOG_REFRESH_SECRET: secret,
  });
  const body = await response.text();
  const data = JSON.parse(body);

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.deepEqual(data.readiness, {
    configured: true,
    siteUrlConfigured: true,
    httpsOriginValid: true,
    refreshSecretConfigured: true,
    reasonCodes: [],
  });
  assert.equal(body.includes(secret), false);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('health reports a missing secret with a safe reason code', async () => {
  const response = await worker.fetch(new Request('https://worker.example.test/health'), {
    ATLAS_SITE_URL: 'https://atlas.example.test',
  });
  const body = await response.text();
  const data = JSON.parse(body);

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.readiness.configured, false);
  assert.equal(data.readiness.refreshSecretConfigured, false);
  assert.deepEqual(data.readiness.reasonCodes, ['refresh_secret_missing']);
  assert.equal(body.includes('ATLAS_CATALOG_REFRESH_SECRET'), false);
});

test('health refuses a non-origin URL and never echoes URL or secret values', async () => {
  const secret = 'must-not-appear';
  const privateUrl = 'https://user:private-password@atlas.example.test/admin?token=private-token';
  const response = await worker.fetch(new Request('https://worker.example.test/health'), {
    ATLAS_SITE_URL: privateUrl,
    ATLAS_CATALOG_REFRESH_SECRET: secret,
  });
  const body = await response.text();
  const data = JSON.parse(body);

  assert.equal(response.status, 503);
  assert.equal(data.readiness.siteUrlConfigured, true);
  assert.equal(data.readiness.httpsOriginValid, false);
  assert.deepEqual(data.readiness.reasonCodes, ['site_url_origin_required']);
  assert.equal(body.includes(privateUrl), false);
  assert.equal(body.includes(secret), false);
  assert.equal(body.includes('private-password'), false);
  assert.equal(body.includes('private-token'), false);
});

test('readiness lists absent and invalid configuration using stable reason codes', () => {
  assert.deepEqual(getCatalogRefreshReadiness({}), {
    configured: false,
    siteUrlConfigured: false,
    httpsOriginValid: false,
    refreshSecretConfigured: false,
    reasonCodes: ['site_url_missing', 'refresh_secret_missing'],
  });
  assert.deepEqual(getCatalogRefreshReadiness({
    ATLAS_SITE_URL: 'https://atlas.example.test/catalog',
    ATLAS_CATALOG_REFRESH_SECRET: 'configured',
  }).reasonCodes, ['site_url_origin_required']);
});

test('scheduled refresh logs sanitized success and repeatable failure summaries', async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  const successLogs = [];
  const failureLogs = [];
  const secret = 'scheduled-test-secret';
  const sensitiveResponseBody = 'private response body must-not-be-logged';
  let upstreamStatus = 200;
  globalThis.fetch = async () => new Response(sensitiveResponseBody, {status: upstreamStatus});
  console.log = value => successLogs.push(String(value));
  console.error = value => failureLogs.push(String(value));

  async function invoke(env) {
    let scheduledTask;
    await worker.scheduled({cron: '0 * * * *', scheduledTime: Date.now()}, env, {
      waitUntil(task) { scheduledTask = task; },
    });
    await scheduledTask;
  }

  try {
    await invoke({
      ATLAS_SITE_URL: 'https://atlas.example.test',
      ATLAS_CATALOG_REFRESH_SECRET: secret,
    });
    upstreamStatus = 503;
    await invoke({
      ATLAS_SITE_URL: 'https://atlas.example.test',
      ATLAS_CATALOG_REFRESH_SECRET: secret,
    });
    await invoke({
      ATLAS_SITE_URL: 'https://atlas.example.test',
      ATLAS_CATALOG_REFRESH_SECRET: secret,
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }

  const success = JSON.parse(successLogs[0]);
  assert.equal(success.event, 'atlas_catalog_refresh');
  assert.equal(success.outcome, 'success');
  assert.equal(typeof success.durationMs, 'number');
  assert.equal(successLogs[0].includes(secret), false);
  assert.equal(successLogs[0].includes(sensitiveResponseBody), false);

  assert.equal(failureLogs.length, 2);
  for (const line of failureLogs) {
    const failure = JSON.parse(line);
    assert.equal(failure.event, 'atlas_catalog_refresh');
    assert.equal(failure.outcome, 'failure');
    assert.equal(failure.reasonCode, 'upstream_rejected');
    assert.equal(failure.status, 503);
    assert.equal(line.includes(secret), false);
    assert.equal(line.includes(sensitiveResponseBody), false);
  }
});

test('cron worker does not follow redirects carrying the signed request headers', async () => {
  let captured;
  await assert.rejects(() => runRefresh({
    ATLAS_SITE_URL: 'https://atlas.example.test',
    ATLAS_CATALOG_REFRESH_SECRET: 'test-secret',
  }, async (_url, init) => {
    captured = init;
    throw new TypeError('redirect refused');
  }), error => error.reasonCode === 'upstream_unreachable');
  assert.equal(captured.redirect, 'error');
});
