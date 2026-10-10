'use client';
import {Suspense,lazy,useState} from 'react';
import type {Product} from '@/lib/market/domain';

// The product sheet (gallery, variant select, price tabs, the importer's image filter) is a separate chunk:
// the home page and /catalog load it when a visitor reaches for a card or opens one, not with the first screen.
const load=()=>import('./product-sheet');
const ProductSheetChunk=lazy(()=>load().then(module=>({default:module.ProductSheet})));
/** Starts loading the sheet when a card is about to be opened (pointer over the cards, focus on one). */
export const preloadProductSheet=()=>{void load()};

/** Same props as ProductSheet. Mounted from the first opened product on, so the sheet still animates its closing. */
export function LazyProductSheet({product,onClose}:{product:Product|null;onClose:()=>void}){
  const [used,setUsed]=useState(false);
  if(product&&!used)setUsed(true);
  return used?<Suspense fallback={null}><ProductSheetChunk product={product} onClose={onClose}/></Suspense>:null;
}
