import {readCatalogSnapshot} from './catalog-server';
import {createPublicCatalogMemo} from './public-catalog-cache';
import {withoutAuthor} from './pricing-equal';
import {pricing as currentPricing} from './server';

const catalogMemo=createPublicCatalogMemo();

export async function loadPublicCatalog({now=Date.now(),backfill=true}:{now?:number;backfill?:boolean}={}){
  const [{document},pricing]=await Promise.all([readCatalogSnapshot({backfill}),currentPricing()]);
  return {catalog:catalogMemo(document,pricing,now),pricing:withoutAuthor(pricing)};
}

export async function loadPublicCatalogList(options?:{backfill?:boolean}){
  const {catalog,pricing}=await loadPublicCatalog(options);
  return {...catalog.list(),pricing};
}
