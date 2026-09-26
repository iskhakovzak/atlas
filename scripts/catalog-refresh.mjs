import { createHmac } from 'node:crypto';

const endpoint = process.env.ATLAS_REFRESH_URL || `${(process.env.ATLAS_SITE_URL || '').replace(/\/$/, '')}/api/internal/catalog-refresh`;
const secret = process.env.ATLAS_CATALOG_REFRESH_SECRET;

if (!endpoint || endpoint === '/api/internal/catalog-refresh') {
  throw new Error('Set ATLAS_REFRESH_URL or ATLAS_SITE_URL before running the catalog refresh.');
}
if (!secret) throw new Error('Set ATLAS_CATALOG_REFRESH_SECRET in the scheduler environment.');

const timestamp = String(Date.now());
const path = new URL(endpoint).pathname;
if (path !== '/api/internal/catalog-refresh') throw new Error('ATLAS_REFRESH_URL must point to /api/internal/catalog-refresh.');
const signature = createHmac('sha256', secret).update(`${timestamp}\nPOST\n${path}`).digest('hex');
const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'x-atlas-refresh-timestamp': timestamp,
    'x-atlas-refresh-signature': signature,
    accept: 'application/json',
  },
});
const body = await response.text();
if (!response.ok) {
  throw new Error(`Catalog refresh failed (${response.status}): ${body.slice(0, 500)}`);
}
console.log(body);

