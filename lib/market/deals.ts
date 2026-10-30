import { price, storeShippingHoldUsd, storeShippingUsd, type CartItem, type DeliverySpeed, type Pricing, type Product } from './domain.ts';
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

/**
 * The storefront quotes the cheapest way in (owner, 30 October 2026): standard delivery, unless the customer's cart
 * already ships at another speed, and no customs (duty is chosen in the cart).
 */
export const catalogDeliverySpeed: DeliverySpeed = 'standard';
export function catalogQuoteSpeed(cart: Pick<CartItem, 'deliverySpeed'>[]): DeliverySpeed {
  return cart.find((item) => item.deliverySpeed)?.deliverySpeed ?? catalogDeliverySpeed;
}

/** The lowest price of an option the store still sells, in USD; the product price when no option says less. */
export function cheapestUsd(product: Product, pricing: Pricing) {
  const currency = product.sourceCurrency ?? 'USD';
  const options = (product.sourceVariants ?? [])
    .filter((variant) => variant.available && variant.availabilityKnown !== false && variant.quantity !== 0 && variant.price !== undefined && variant.price > 0)
    .map((variant) => currency === 'USD' ? variant.price! : pricing.rates[currency] ? toUsd(variant.price!, currency, pricing.rates) : undefined)
    .filter((usd): usd is number => usd !== undefined && Number.isFinite(usd));
  const lowest = options.length ? Math.min(...options) : undefined;
  return lowest !== undefined && lowest < product.usd ? Math.round(lowest * 100) / 100 : product.usd;
}

export function dealQuote(product: Product, pricing: Pricing,records:MerchantFind[]=bundledMerchantFinds,speed:DeliverySpeed=catalogDeliverySpeed) {
  const estimateUsd=product.priceNeedsConfirmation
    ?product.sourcePrice!==undefined&&product.sourceCurrency&&pricing.rates[product.sourceCurrency]
      ?toUsd(product.sourcePrice,product.sourceCurrency,pricing.rates)
      :undefined
    :cheapestUsd(product, pricing);
  const costs = estimateUsd===undefined ? null : price(estimateUsd, product.weight, 1, storeShippingUsd(product), pricing, speed);
  // Unknown store delivery is not in the total: a separate hold below the free threshold, none above it.
  const holdUsd = estimateUsd===undefined ? 0 : storeShippingHoldUsd(product, estimateUsd, pricing);
  // Compare only the exact sourced listing; no invented price history or ID-only match.
  const referenceUsd = records.find(item=>item.id===product.id&&item.sourceUrl===product.sourceUrl&&item.usd===product.usd)?.referenceUsd;
  // A dated snapshot keeps its discount when its recorded price is in USD, the currency of the reference (owner,
  // 12 October 2026: the sale and its percent matter); the card shows the date beside the price.
  const nowUsd = product.priceNeedsConfirmation ? (product.sourceCurrency === 'USD' ? product.sourcePrice : undefined) : product.usd;
  const savingsUsd = nowUsd !== undefined && referenceUsd && referenceUsd > nowUsd ? referenceUsd - nowUsd : 0;
  const discount = referenceUsd && savingsUsd > 0 ? Math.round(savingsUsd / referenceUsd * 100) : 0;
  return { product, costs, holdUsd, referenceUsd:nowUsd===undefined?undefined:referenceUsd, savingsUsd, discount };
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
