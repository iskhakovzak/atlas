import {pricingSchema,tariff,upgradePricing,type Pricing} from './domain.ts';

// Pure helpers (no server imports) shared by lib/market/store.tsx (client) and lib/market/initial-data.ts (server).

/**
 * Stable JSON of a tariff: key order does not matter, undefined fields are dropped.
 * The server reads D1 and the browser parses /api/account JSON, so the same tariff
 * can arrive with keys in a different order.
 */
function stable(value:unknown):string{
 if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
 if(value&&typeof value==='object'){
  const entries=Object.keys(value as Record<string,unknown>).sort().flatMap(key=>{const inner=(value as Record<string,unknown>)[key];return inner===undefined?[]:[`${JSON.stringify(key)}:${stable(inner)}`]});
  return `{${entries.join(',')}}`;
 }
 return JSON.stringify(value)??'null';
}

/** True when two tariffs would render the same numbers, so React state can keep the previous object. */
export function samePricing(a:Pricing|null|undefined,b:Pricing|null|undefined):boolean{
 if(a===b)return true;
 if(!a||!b)return false;
 if(a.version!==b.version||a.updatedAt!==b.updatedAt||a.fx!==b.fx)return false;
 return stable(a)===stable(b);
}

/** The next tariff for React state: the previous object when nothing changed (no re-render, no flicker). */
export function nextPricing(previous:Pricing,incoming:Pricing):Pricing{return samePricing(previous,incoming)?previous:incoming}

/**
 * Parse a saved tariff row the way lib/market/server.ts does for the APIs: validated and
 * brought to the current revision (upgradePricing), the built-in tariff otherwise.
 */
export function parseStoredPricing(value:string|null|undefined):Pricing{
 if(!value)return tariff;
 try{const parsed=pricingSchema.safeParse(JSON.parse(value));return parsed.success?upgradePricing(parsed.data):tariff}catch{return tariff}
}
