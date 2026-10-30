/** Read only a previously cached snapshot; this request must never start a merchant fetch. */
export async function readImportCachePreview(url: string, fetcher: typeof fetch = fetch): Promise<{title?: string; brand?: string; images: string[]} | null> {
  try {
    const response = await fetcher('/api/import', {method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'same-origin', body: JSON.stringify({url, cacheOnly: true})});
    if (!response.ok || response.status === 204) return null;
    const data = await response.json() as Record<string, unknown>;
    if (!data || data.cached !== true) return null;
    const title = typeof data.title === 'string' ? data.title.slice(0, 500) : undefined;
    const brand = typeof data.brand === 'string' ? data.brand.slice(0, 200) : undefined;
    const images = [data.image, ...(Array.isArray(data.images) ? data.images : [])].filter((image): image is string => typeof image === 'string').slice(0, 12);
    return title || images.length ? {title, brand, images} : null;
  } catch {
    return null;
  }
}
