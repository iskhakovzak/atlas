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
export type CatalogSeedValue={products:MerchantFind[];collections:Array<CatalogCollection&{productIds:string[]}>;pricing:Pricing};
/** The catalog travels inside the HTML: above this size the page renders as before (the browser asks /api/catalog). */
export const catalogSeedMaxChars=150_000;
/** Null when the page should keep the previous behaviour: nothing published (the client shows its bundled fallback and the notice) or too large. */
export function catalogSeed(document:CatalogDocument,pricing:Pricing,now=Date.now()):CatalogSeedValue|null{
 const seed:CatalogSeedValue={...publicCatalog(document,pricing,now),pricing:withoutAuthor(pricing)};
 if(!seed.products.length)return null;
 return JSON.stringify(seed).length>catalogSeedMaxChars?null:seed;
}
