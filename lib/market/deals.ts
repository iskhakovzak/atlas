import { price, type Pricing, type Product } from './domain.ts';
import { bundledMerchantFinds,type MerchantFind } from './catalog.ts';
export type DealFilters = {
  search: string; category: string; country: string; maxTotal: number;
  sort: 'discount' | 'total-asc' | 'total-desc';
};
export const defaultDealFilters: DealFilters = { search: '', category: '', country: '', maxTotal: 0, sort: 'discount' };

export function dealQuote(product: Product, pricing: Pricing,records:MerchantFind[]=bundledMerchantFinds) {
  const costs = price(product.usd, product.weight, 1, product.sourceShippingUsd ?? 0, pricing);
  // Compare only the exact sourced listing; no invented price history or ID-only match.
  const referenceUsd = records.find(item=>item.id===product.id&&item.sourceUrl===product.sourceUrl&&item.usd===product.usd)?.referenceUsd;
  const savingsUsd = referenceUsd && referenceUsd > product.usd ? referenceUsd - product.usd : 0;
  const discount = referenceUsd && savingsUsd > 0 ? Math.round(savingsUsd / referenceUsd * 100) : 0;
  return { product, costs, referenceUsd, savingsUsd, discount };
}

export function filterDeals(products: Product[], pricing: Pricing, filters: DealFilters,records:MerchantFind[]=bundledMerchantFinds) {
  const search = filters.search.trim().toLocaleLowerCase();
  return products.map(product => dealQuote(product, pricing,records)).filter(({ product, costs }) =>
    (!filters.category || product.category === filters.category) &&
    (!filters.country || product.country === filters.country) &&
    (!filters.maxTotal || costs.total <= filters.maxTotal) &&
    (!search || [product.name, product.brand, product.category, product.country].join(' ').toLocaleLowerCase().includes(search)),
  ).sort((a, b) => filters.sort === 'total-asc' ? a.costs.total - b.costs.total : filters.sort === 'total-desc' ? b.costs.total - a.costs.total : b.discount - a.discount || a.costs.total - b.costs.total);
}
