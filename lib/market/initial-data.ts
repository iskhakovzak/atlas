import {database} from './server.ts';
import type {Pricing} from './domain.ts';
import {parseStoredPricing} from './pricing-equal.ts';
import {mergeSiteContent,parseStoredSiteContent,siteContentStorageKey,type SiteContentView} from './site-content-schema.ts';
export {samePricing,nextPricing,parseStoredPricing} from './pricing-equal.ts';

/**
 * The current tariff for the first server render (app/layout.tsx → MarketProvider initialPricing),
 * so the home page shows the same sums before and after /api/account answers.
 * Read-only: no FX refresh is scheduled here (the API routes do that). Returns null when the
 * database is unavailable, for example during a build or prerender.
 */
export async function initialPricing():Promise<Pricing|null>{
 try{
  const row=await database().prepare("SELECT value FROM market_settings WHERE key='pricing'").first<{value:string}>();
  return parseStoredPricing(row?.value);
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
