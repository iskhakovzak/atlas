import {publicCatalog,type CatalogCollection,type CatalogDocument} from './catalog-editor.ts';
import {withoutAuthor} from './pricing-equal.ts';
import type {Pricing} from './domain.ts';
import type {MerchantFind} from './catalog.ts';

/**
 * The public catalog a server page renders with (14.10.2026): /stores reads it on the server exactly as
 * GET /api/catalog does (lib/market/initial-data.ts → initialPublicCatalog) and hands it to the page
 * (lib/market/store.tsx → <CatalogSeed>), so the first HTML already has the final showcase instead of a
 * skeleton and the bundled fallback photos, and the browser does not ask /api/catalog there. /catalog does not use it:
 * the full grid in the first paint cost it lab score on phones (see app/catalog/page.tsx).
 */
export type CatalogSeedValue={products:MerchantFind[];collections:Array<CatalogCollection&{productIds:string[]}>;pricing:Pricing;
 /** Set on one store's part of the catalog (/stores/[slug], the store's slug): the provider never takes such a seed over as
  *  the whole catalog, so /catalog opened next still loads every product (lib/market/store.tsx). */
 scope?:string};
/** The catalog travels inside the HTML: above this size the page renders as before (the browser asks /api/catalog). */
export const catalogSeedMaxChars=150_000;
/** Null when the page should keep the previous behaviour: nothing published (the client shows its bundled fallback and the notice) or too large. */
export function catalogSeed(document:CatalogDocument,pricing:Pricing,now=Date.now()):CatalogSeedValue|null{
 const seed:CatalogSeedValue={...publicCatalog(document,pricing,now),pricing:withoutAuthor(pricing)};
 if(!seed.products.length)return null;
 return JSON.stringify(seed).length>catalogSeedMaxChars?null:seed;
}

/**
 * One store's part of the public catalog for its page (/stores/[slug], review of stage 8, 1 November 2026): only the
 * products whose store host belongs to `slug` and the collections cut down to them, marked with `scope`. The whole
 * catalog went over catalogSeedMaxChars at about 50 products, and the page then had no products in its HTML. An empty
 * part is still a seed (the page says at once that the store has no catalog products, without asking /api/catalog);
 * null only when this store's part alone is too large to inline.
 */
export function storeCatalogSeed(catalog:{products:MerchantFind[];collections:Array<CatalogCollection&{productIds:string[]}>},pricing:Pricing,slug:string,slugOf:(product:MerchantFind)=>string):CatalogSeedValue|null{
 const products=catalog.products.filter(product=>slugOf(product)===slug);
 const ids=new Set(products.map(product=>product.id));
 const collections=catalog.collections.map(collection=>({...collection,productIds:collection.productIds.filter(id=>ids.has(id))})).filter(collection=>collection.productIds.length>0);
 const seed:CatalogSeedValue={products,collections,pricing:withoutAuthor(pricing),scope:slug};
 return JSON.stringify(seed).length>catalogSeedMaxChars?null:seed;
}
