import {
  CatalogRefreshClientError,
  runCatalogRefresh,
} from '../lib/market/catalog-refresh-client.mjs';

try {
  console.log(JSON.stringify(await runCatalogRefresh()));
} catch (error) {
  const knownError = error instanceof CatalogRefreshClientError ? error : undefined;
  console.error(JSON.stringify({
    event: 'atlas_catalog_refresh',
    outcome: 'failure',
    reasonCode: knownError?.reasonCode ?? 'unexpected_failure',
    ...(knownError?.status ? {status: knownError.status} : {}),
  }));
  process.exitCode = 1;
}
