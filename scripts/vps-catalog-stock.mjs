import { readFileSync } from 'node:fs';
import { catalogStockPath, signCatalogRefreshRequest } from '../lib/market/catalog-refresh-auth.ts';
import { normalizeCatalogRefreshSummary } from '../lib/market/catalog-refresh-client.mjs';

let stage = 'configuration';
try {
  const configuration = process.env.ATLAS_ENV_FILE ? JSON.parse(readFileSync(process.env.ATLAS_ENV_FILE, 'utf8')) : {};
  const secret = process.env.ATLAS_CATALOG_REFRESH_SECRET ?? configuration.ATLAS_CATALOG_REFRESH_SECRET;
  if (typeof secret !== 'string' || !secret.trim()) throw new Error('Missing refresh secret');
  const timestamp = String(Date.now());
  stage = 'request';
  const response = await fetch('http://127.0.0.1:3000' + catalogStockPath, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(100_000),
    headers: {
      'x-atlas-refresh-timestamp': timestamp,
      'x-atlas-refresh-signature': await signCatalogRefreshRequest(secret, timestamp, catalogStockPath),
    },
  });
  if (response.status === 409) {
    await response.body?.cancel();
    console.log(JSON.stringify({ event: 'atlas_catalog_stock', outcome: 'busy' }));
  } else {
    stage = 'http_' + response.status;
    if (!response.ok) { await response.body?.cancel(); throw new Error('Stock refresh rejected'); }
    stage = 'response';
    console.log(JSON.stringify({ event: 'atlas_catalog_stock', outcome: 'success', ...normalizeCatalogRefreshSummary(await response.json()) }));
  }
} catch {
  console.error(JSON.stringify({ event: 'atlas_catalog_stock', outcome: 'failure', stage }));
  process.exitCode = 1;
}
