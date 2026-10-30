'use client';

import { useId, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Link from '@/components/site-link';
import { TooltipProvider } from '@/components/ui/tooltip';
import { type Product } from '@/lib/market/domain';
import { catalogDeliverySpeed, catalogQuoteSpeed } from '@/lib/market/deals';
import { useMarket } from '@/lib/market/store';
import { catalogCopy } from '@/lib/market/catalog-copy';
import { applyCatalogQuery, catalogItems, emptyCatalogQuery } from '@/lib/market/catalog-query';
import type { MerchantFind } from '@/lib/market/catalog';
import { courierAllowanceUsd } from '@/lib/market/customs';
import type { Locale } from '@/lib/market/i18n';
import { CatalogCard } from './catalog-card';
import { preloadProductSheet } from './product-sheet-lazy';

/**
 * A row of compact catalog cards on the cart page (a separate chunk, loaded only when there is something to show):
 * the catalog's picks under an empty cart, the customer's saved products under a full one. Real products in the
 * storefront's order (the operator's position, a confirmed price, the larger discount); each card keeps its own
 * "−N%" and "Top price" chips and opens the product sheet, where it is added to the cart as anywhere else.
 * Without `title` and `link` the row is the catalog's picks with a link to the whole catalog.
 */
export function CartPicks({ title, link, products, limit = 8, onSelect }: { title?: string; link?: { href: string; label: string }; products: MerchantFind[]; limit?: number; onSelect: (product: Product) => void }) {
  const { state, pricing, ready, act, catalogProducts } = useMarket();
  const locale = state.communication.language as Locale, cc = catalogCopy[locale];
  const [saving, setSaving] = useState<string | null>(null);
  const titleId = useId();
  // Deals are judged against the whole catalog, so a card's "Top price" is the same here as on /catalog.
  const shown = useMemo(() => applyCatalogQuery(catalogItems(products, pricing, catalogProducts), emptyCatalogQuery, { dutyLimitUsd: courierAllowanceUsd }).slice(0, limit), [products, pricing, catalogProducts, limit]);
  const speed = ready ? catalogQuoteSpeed(state.cart) : catalogDeliverySpeed;
  if (!shown.length) return null;
  const go = link ?? { href: '/catalog', label: cc.viewAllShort };
  async function save(product: Product) {
    setSaving(product.id);
    try { await act({ type: 'favorite', id: product.id }); } finally { setSaving(null); }
  }
  return <TooltipProvider delayDuration={300}><section className="cart-picks" aria-labelledby={titleId}>
    <header><h2 id={titleId}>{title ?? cc.teaserTitle}</h2><Link className="btn secondary" href={go.href}>{go.label}<ArrowRight size={17} aria-hidden="true" /></Link></header>
    <div className="finds-grid finds-grid-compact" onPointerEnter={preloadProductSheet} onFocus={preloadProductSheet}>{shown.map((item) => <CatalogCard key={item.product.id} item={item} locale={locale} select={onSelect} variant="compact" speed={speed} saved={state.favorites.includes(item.product.id)} canSave={ready} saving={saving !== null} onSave={() => void save(item.product)} />)}</div>
  </section></TooltipProvider>;
}
