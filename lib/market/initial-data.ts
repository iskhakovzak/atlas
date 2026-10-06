import {database} from './server.ts';
import type {Pricing} from './domain.ts';
import {parseStoredPricing} from './pricing-equal.ts';
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
