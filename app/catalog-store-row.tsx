'use client';

import { ArrowRight } from 'lucide-react';
import Link from '@/components/site-link';
import { useRowAtStart } from '@/lib/market/row-start';
import { brandForHost } from '@/lib/market/store-brands';
import { storeLabel, type CatalogQuery } from '@/lib/market/catalog-query';
import type { catalogCopy } from '@/lib/market/catalog-copy';
import { storesCopy } from '@/lib/market/stores-copy';
import type { Locale } from '@/lib/market/i18n';
import { StoreLogo } from './store-logo';

type Copy = (typeof catalogCopy)['ru'];
type Entry = { key: string; name: string; logo: boolean; hosts: string[]; count: number };

/**
 * The «Магазин» filter as a row of round store logos above the grid (redesign stage 8, owner 1 November 2026: ordinary
 * buyers find a filter by store easier than a separate page). One logo per store: its country storefronts (amazon.com,
 * amazon.de) are one tap that adds or removes all of them. Counts are the store facet's (lib/market/catalog-query.ts
 * catalogFacets: what each store would show with the other filters), so they do not change when a store is picked.
 */
export function CatalogStoreRow({ stores, query, setQuery, cc, locale }: { stores: [string, number][]; query: CatalogQuery; setQuery: (query: CatalogQuery) => void; cc: Copy; locale: Locale }) {
  const entries = new Map<string, Entry>();
  for (const [host, count] of stores) {
    const brand = brandForHost(host);
    const key = brand?.key ?? host;
    const entry = entries.get(key) ?? { key, name: brand?.name ?? storeLabel(host, locale), logo: brand?.logo ?? false, hosts: [], count: 0 };
    entry.hosts.push(host); entry.count += count;
    entries.set(key, entry);
  }
  // Bigger stores first; a chosen store keeps its place even when the other filters leave it nothing.
  const list = [...entries.values()].filter((entry) => entry.count > 0 || entry.hosts.some((host) => query.stores.includes(host)))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const row = useRowAtStart<HTMLUListElement>(list.map((entry) => entry.key).join(' '));
  if (list.length < 2) return null;
  const toggle = (entry: Entry, on: boolean) => setQuery({ ...query, stores: on ? query.stores.filter((host) => !entry.hosts.includes(host)) : [...new Set([...query.stores, ...entry.hosts])] });
  return <div className="catalog-stores" role="group" aria-label={cc.store}>
    <ul {...row} className="catalog-stores-row">
      {list.map((entry) => {
        const on = entry.hosts.every((host) => query.stores.includes(host));
        const words = storesCopy[locale];
        return <li key={entry.key}><button type="button" aria-pressed={on} onClick={() => toggle(entry, on)}>
          <span className="catalog-stores-logo"><StoreLogo brand={entry} size={48} /></span>
          <span className="catalog-stores-name">{entry.name}</span>
          <span className="catalog-stores-count"><span aria-hidden="true">{entry.count}</span><span className="sr-only">{words.products(entry.count)}</span></span>
        </button></li>;
      })}
      <li className="catalog-stores-more"><Link href="/stores"><span className="catalog-stores-logo" aria-hidden="true"><ArrowRight size={20} /></span><span className="catalog-stores-name">{storesCopy[locale].allStores}</span></Link></li>
    </ul>
  </div>;
}
