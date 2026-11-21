import {applyCatalogQuery,catalogItems,emptyCatalogQuery} from './catalog-query.ts';
import {homeCatalogTeaserSize} from './catalog-summary.ts';
import {courierAllowanceUsd} from './customs.ts';
import type {MerchantFind} from './catalog.ts';
import type {Pricing} from './domain.ts';

export type HomeCatalogPreview={products:MerchantFind[];total:number;pricing:Pricing};

export function rankedHomeCatalog(products:MerchantFind[],pricing:Pricing){
  return applyCatalogQuery(catalogItems(products,pricing),emptyCatalogQuery,{dutyLimitUsd:courierAllowanceUsd});
}

export function homeCatalogPreview(products:MerchantFind[],pricing:Pricing):HomeCatalogPreview{
  const ranked=rankedHomeCatalog(products,pricing);
  return {products:ranked.slice(0,homeCatalogTeaserSize).map(item=>item.product),total:ranked.length,pricing};
}
