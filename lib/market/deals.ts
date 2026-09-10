import { price, type Pricing, type Product } from './domain.ts';

// Illustration-only reference prices. These are not merchant price history.
const demoReferenceUsd: Record<string, number> = { sneaker: 159, headphones: 199, backpack: 110 };
export type DealFilters = {
  search: string; category: string; country: string; maxTotal: number;
  sort: 'discount' | 'total-asc' | 'total-desc';
};
export const defaultDealFilters: DealFilters = { search: '', category: '', country: '', maxTotal: 0, sort: 'discount' };

export function dealQuote(product: Product, pricing: Pricing) {
  const costs = price(product.usd, product.weight, 1, product.sourceShippingUsd ?? 0, pricing);
  // Never attach the illustrative comparison to an imported merchant product.
  const referenceUsd = product.sourceUrl ? undefined : demoReferenceUsd[product.id];
  const savingsUsd = referenceUsd && referenceUsd > product.usd ? referenceUsd - product.usd : 0;
  const discount = referenceUsd && savingsUsd > 0 ? Math.round(savingsUsd / referenceUsd * 100) : 0;
  return { product, costs, referenceUsd, savingsUsd, discount };
}

export function filterDeals(products: Product[], pricing: Pricing, filters: DealFilters) {
  const search = filters.search.trim().toLocaleLowerCase();
  return products.map(product => dealQuote(product, pricing)).filter(({ product, costs }) =>
    (!filters.category || product.category === filters.category) &&
    (!filters.country || product.country === filters.country) &&
    (!filters.maxTotal || costs.total <= filters.maxTotal) &&
    (!search || [product.name, product.brand, product.category, product.country].join(' ').toLocaleLowerCase().includes(search)),
  ).sort((a, b) => filters.sort === 'total-asc' ? a.costs.total - b.costs.total : filters.sort === 'total-desc' ? b.costs.total - a.costs.total : b.discount - a.discount || a.costs.total - b.costs.total);
}
