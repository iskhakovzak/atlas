'use client';
import { useEffect, useState } from 'react';
import type { MerchantFind } from './catalog.ts';

/**
 * The full catalog product behind a list card (3 November 2026): the public list (GET /api/catalog) has no options,
 * galleries or description (lib/market/catalog-summary.ts), so the sheet asks GET /api/catalog/<id> when it opens. One
 * request per product for five minutes (the answer itself is cached for a minute by the browser); a failure is not kept.
 */
const keep = 5 * 60_000;
const loaded = new Map<string, { at: number; request: Promise<MerchantFind> }>();

export function loadCatalogProduct(id: string): Promise<MerchantFind> {
  const known = loaded.get(id);
  if (known && Date.now() - known.at < keep) return known.request;
  const request = fetch('/api/catalog/' + encodeURIComponent(id))
    .then(async (response) => {
      const data = await response.json().catch(() => ({})) as { product?: MerchantFind; error?: string };
      if (!response.ok || !data.product || data.product.id !== id) throw Error(data.error ?? 'Catalog product load failed');
      return data.product;
    });
  loaded.set(id, { at: Date.now(), request });
  request.catch(() => { if (loaded.get(id)?.request === request) loaded.delete(id); });
  return request;
}

/** Starts loading a list product's full card ahead of its sheet (a card under the pointer); a full product needs nothing. */
export function preloadCatalogProduct(product: { id: string; listing?: true } | null | undefined) {
  if (product?.listing) loadCatalogProduct(product.id).catch(() => undefined);
}

/**
 * The product to show in full: a full one as it is, a list one once GET /api/catalog/<id> answers. `failed` after a
 * failed load; `retry` asks again.
 */
export function useFullCatalogProduct<T extends { id: string; listing?: true }>(product: T | null): { full: MerchantFind | T | null; failed: boolean; retry: () => void } {
  const [answer, setAnswer] = useState<{ id: string; product?: MerchantFind; failed?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const id = product?.listing ? product.id : '';
  useEffect(() => {
    if (!id) return;
    let active = true;
    loadCatalogProduct(id).then(
      (full) => { if (active) setAnswer({ id, product: full }); },
      () => { if (active) setAnswer({ id, failed: true }); },
    );
    return () => { active = false; };
  }, [id, attempt]);
  if (!product) return { full: null, failed: false, retry: () => undefined };
  if (!product.listing) return { full: product, failed: false, retry: () => undefined };
  const mine = answer?.id === product.id ? answer : null;
  return { full: mine?.product ?? null, failed: Boolean(mine?.failed), retry: () => { setAnswer(null); setAttempt((value) => value + 1); } };
}
