import { price, storeShippingHoldUsd, storeShippingUsd, type Pricing, type Product } from './domain.ts';
import { toUsd } from './world.ts';
import { bundledMerchantFinds,type MerchantFind } from './catalog.ts';
export type DealFilters = {
  search: string; category: string; country: string; maxTotal: number;
  sort: 'discount' | 'total-asc' | 'total-desc';
};
export const defaultDealFilters: DealFilters = { search: '', category: '', country: '', maxTotal: 0, sort: 'discount' };

export function hasActiveDealFilters(filters: DealFilters, collectionId = '') {
  return Boolean(
    collectionId || filters.search.trim() || filters.category || filters.country || filters.maxTotal ||
    filters.sort !== defaultDealFilters.sort,
  );
}

export function dealQuote(product: Product, pricing: Pricing,records:MerchantFind[]=bundledMerchantFinds) {
  const estimateUsd=product.priceNeedsConfirmation
    ?product.sourcePrice!==undefined&&product.sourceCurrency&&pricing.rates[product.sourceCurrency]
      ?toUsd(product.sourcePrice,product.sourceCurrency,pricing.rates)
      :undefined
    :product.usd;
  const costs = estimateUsd===undefined ? null : price(estimateUsd, product.weight, 1, storeShippingUsd(product), pricing);
  // Unknown store delivery is not in the total: a separate hold below the free threshold, none above it.
  const holdUsd = estimateUsd===undefined ? 0 : storeShippingHoldUsd(product, estimateUsd, pricing);
  // Compare only the exact sourced listing; no invented price history or ID-only match.
  const referenceUsd = records.find(item=>item.id===product.id&&item.sourceUrl===product.sourceUrl&&item.usd===product.usd)?.referenceUsd;
  const savingsUsd = !product.priceNeedsConfirmation && referenceUsd && referenceUsd > product.usd ? referenceUsd - product.usd : 0;
  const discount = referenceUsd && savingsUsd > 0 ? Math.round(savingsUsd / referenceUsd * 100) : 0;
  return { product, costs, holdUsd, referenceUsd:product.priceNeedsConfirmation?undefined:referenceUsd, savingsUsd, discount:product.priceNeedsConfirmation?0:discount };
}

export function filterDeals(products: Product[], pricing: Pricing, filters: DealFilters,records:MerchantFind[]=bundledMerchantFinds) {
  const search = filters.search.trim().toLocaleLowerCase();
  return products.map(product => dealQuote(product, pricing,records)).filter(({ product, costs }) =>
    (!filters.category || product.category === filters.category) &&
    (!filters.country || product.country === filters.country) &&
    (!filters.maxTotal || Boolean(costs && costs.total <= filters.maxTotal)) &&
    (!search || [product.name, product.brand, product.category, product.country].join(' ').toLocaleLowerCase().includes(search)),
  ).sort((a, b) => {
    if(!a.costs&&b.costs)return 1;if(a.costs&&!b.costs)return -1;
    return filters.sort === 'total-asc' ? (a.costs?.total??0) - (b.costs?.total??0) : filters.sort === 'total-desc' ? (b.costs?.total??0) - (a.costs?.total??0) : b.discount - a.discount || (a.costs?.total??0) - (b.costs?.total??0);
  });
}
