import {database,pricing as currentPricing} from './server.ts';
import {readCatalog} from './catalog-server.ts';
import {catalogSeed,storeCatalogSeed,type CatalogSeedValue} from './catalog-seed.ts';
import {publicCatalog} from './catalog-editor.ts';
import {catalogCountsBySlug,productStoreSlug,storeProductIds} from './store-pages.ts';
import type {MerchantFind} from './catalog.ts';
import type {Pricing} from './domain.ts';
import {parseStoredPricing} from './pricing-equal.ts';
import {mergeSiteContent,parseStoredSiteContent,siteContentStorageKey,type SiteContentView} from './site-content-schema.ts';
export {samePricing,nextPricing,parseStoredPricing} from './pricing-equal.ts';
import {withoutAuthor} from './pricing-equal.ts';

/**
 * The current tariff for the first server render (app/layout.tsx → MarketProvider initialPricing),
 * so the home page shows the same sums before and after /api/account answers.
 * Read-only: no FX refresh is scheduled here (the API routes do that). Returns null when the
 * database is unavailable, for example during a build or prerender.
 */
export async function initialPricing():Promise<Pricing|null>{
 try{
  const row=await database().prepare("SELECT value FROM market_settings WHERE key='pricing'").first<{value:string}>();
  const pricing=parseStoredPricing(row?.value);
  return pricing&&withoutAuthor(pricing);
 }catch{return null}
}

/**
 * The site content document (contacts, legal entity, payment methods, reviews, parcel photos) for the
 * first server render (app/layout.tsx → MarketProvider initialSiteContent), merged with the code defaults,
 * so the footer and home sections show the same blocks before and after hydration. Missing or invalid
 * storage (a build, a prerender, an older document) gives the defaults: every unfilled block stays hidden.
 */
export async function initialSiteContent():Promise<SiteContentView>{
 try{
  const row=await database().prepare('SELECT value FROM market_settings WHERE key=?').bind(siteContentStorageKey).first<{value:string}>();
  return mergeSiteContent(parseStoredSiteContent(row?.value));
 }catch{return mergeSiteContent(null)}
}

/** Both settings of the first render in one D1 query instead of two: every page render asks for them. */
export async function initialSettings():Promise<{pricing:Pricing|null;siteContent:SiteContentView}>{
 try{
  const rows=await database().prepare('SELECT key,value FROM market_settings WHERE key IN (?,?)').bind('pricing',siteContentStorageKey).all<{key:string;value:string}>();
  const values=new Map(rows.results.map(row=>[row.key,row.value]));
  const pricing=parseStoredPricing(values.get('pricing'));
  return {pricing:pricing&&withoutAuthor(pricing),siteContent:mergeSiteContent(parseStoredSiteContent(values.get(siteContentStorageKey)))};
 }catch{return {pricing:null,siteContent:mergeSiteContent(null)}}
}

/**
 * The public catalog for the first render of /catalog and /stores (<CatalogSeed> in those pages), read exactly as
 * GET /api/catalog reads it: the same catalog sync and the same tariff read, which also schedules the Central Bank
 * rate refresh when it is due, as the request the page no longer makes did. Null (the page then loads the catalog in
 * the browser as before) when nothing is published, the catalog is too large to inline, or the database is unavailable.
 */
export async function initialPublicCatalog():Promise<CatalogSeedValue|null>{
 try{
  const [{document},pricing]=await Promise.all([readCatalog({backfill:true}),currentPricing()]);
  return catalogSeed(document,pricing);
 }catch{return null}
}

/**
 * One published catalog card for its own page (/catalog/p/[id]), read as GET /api/catalog reads the catalog, with the
 * tariff the page prices it with. Null when no published card has this id (the page answers 404). A database failure
 * is thrown, not turned into a 404: a product page must not drop out of search because one read failed.
 */
export async function publicCatalogProduct(id:string):Promise<{product:MerchantFind;pricing:Pricing}|null>{
 const [{document},pricing]=await Promise.all([readCatalog({backfill:true}),currentPricing()]);
 const product=publicCatalog(document,pricing).products.find(item=>item.id===id);
 return product?{product,pricing:withoutAuthor(pricing)}:null;
}

/**
 * A store page (/stores/[slug]) reads the catalog once: that store's part of it to render its products with
 * (catalog-seed.ts storeCatalogSeed: null only when that part alone is too large to inline, the browser then asks
 * /api/catalog), the ids of its products for the CollectionPage (from the whole catalog, whatever fits into the HTML)
 * and every store's product count, which decides the empty state, the description and whether the page is indexed.
 * `pricing` is the tariff it was priced with. Seed, counts and pricing are null and the ids empty when the database is unavailable.
 */
export async function storeCatalog(slug:string):Promise<{seed:CatalogSeedValue|null;counts:Map<string,number>|null;productIds:string[];pricing:Pricing|null}>{
 try{
  const [{document},pricing]=await Promise.all([readCatalog({backfill:true}),currentPricing()]);
  const catalog=publicCatalog(document,pricing);
  return {seed:storeCatalogSeed(catalog,pricing,slug,productStoreSlug),counts:catalogCountsBySlug(catalog.products),productIds:storeProductIds(catalog.products,slug),pricing:withoutAuthor(pricing)};
 }catch{return {seed:null,counts:null,productIds:[],pricing:null}}
}
