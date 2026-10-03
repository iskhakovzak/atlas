import {createHmac} from 'node:crypto';

const refreshPath = '/api/internal/catalog-refresh';
const metricNames = ['selected', 'checked', 'available', 'soldOut', 'unknown', 'failed', 'skipped'];
const maxResponseBytes = 16_384;

export class CatalogRefreshClientError extends Error {
  constructor(reasonCode, status) {
    super(reasonCode);
    this.name = 'CatalogRefreshClientError';
    this.reasonCode = reasonCode;
    this.status = status;
  }
}

export function buildCatalogRefreshEndpoint(environment) {
  const explicitEndpoint = environment.ATLAS_REFRESH_URL?.trim();
  const siteUrl = environment.ATLAS_SITE_URL?.trim();
  if (!explicitEndpoint && !siteUrl) throw new CatalogRefreshClientError('site_url_missing');

  let endpoint;
  try {
    endpoint = new URL(explicitEndpoint || `${siteUrl.replace(/\/+$/, '')}${refreshPath}`);
  } catch {
    throw new CatalogRefreshClientError('site_url_invalid');
  }

  if (endpoint.protocol !== 'https:') throw new CatalogRefreshClientError('site_url_https_required');
  if (
    endpoint.username || endpoint.password || endpoint.port || endpoint.pathname !== refreshPath
    || endpoint.search || endpoint.hash
  ) throw new CatalogRefreshClientError('refresh_endpoint_invalid');

  return endpoint;
}

export function normalizeCatalogRefreshSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.ok !== true) {
    throw new CatalogRefreshClientError('upstream_invalid_response');
  }

  const summary = {};
  for (const name of metricNames) {
    if (!Number.isSafeInteger(value[name]) || value[name] < 0) {
      throw new CatalogRefreshClientError('upstream_invalid_response');
    }
    summary[name] = value[name];
  }
  return summary;
}

async function readBoundedText(response) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    await response.body?.cancel();
    throw new CatalogRefreshClientError('upstream_invalid_response');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new CatalogRefreshClientError('upstream_invalid_response');
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxResponseBytes) {
      await reader.cancel();
      throw new CatalogRefreshClientError('upstream_invalid_response');
    }
    text += decoder.decode(value, {stream: true});
  }
  return text + decoder.decode();
}

export async function runCatalogRefresh({environment = process.env, fetcher = fetch, now = Date.now} = {}) {
  const endpoint = buildCatalogRefreshEndpoint(environment);
  const secret = environment.ATLAS_CATALOG_REFRESH_SECRET;
  if (typeof secret !== 'string' || !secret.trim()) {
    throw new CatalogRefreshClientError('refresh_secret_missing');
  }

  const timestamp = String(now());
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}\nPOST\n${refreshPath}`)
    .digest('hex');

  let response;
  try {
    response = await fetcher(endpoint.href, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(180_000),
      headers: {
        'x-atlas-refresh-timestamp': timestamp,
        'x-atlas-refresh-signature': signature,
        accept: 'application/json',
      },
    });
  } catch {
    throw new CatalogRefreshClientError('upstream_unreachable');
  }

  if (!response.ok) {
    await response.body?.cancel();
    throw new CatalogRefreshClientError('upstream_rejected', response.status);
  }

  let payload;
  try {
    payload = JSON.parse(await readBoundedText(response));
  } catch (error) {
    if (error instanceof CatalogRefreshClientError) throw error;
    throw new CatalogRefreshClientError('upstream_invalid_response');
  }

  return {
    event: 'atlas_catalog_refresh',
    outcome: 'success',
    ...normalizeCatalogRefreshSummary(payload),
  };
}
