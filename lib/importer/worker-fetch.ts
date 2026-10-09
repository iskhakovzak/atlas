import {env} from 'cloudflare:workers';
import {createMerchantProxyFetch} from './proxy-client.mjs';
import {withDirectFallback} from './egress.ts';
import type {MerchantFetch} from './fetch.ts';
import type {EbayBrowseConfig} from './ebay.ts';
import {createEbayAwareMerchantFetch} from './ebay-transport.ts';
import {withMerchantRoutes, type MerchantRoute} from './route-ladder.ts';
import type {BrightDataPurpose, BrightDataRuntime} from './brightdata.ts';
import {d1BrightDataJobs, readBrightDataSettings, type D1Like} from './brightdata-d1.ts';

let cached:{endpoint:string;secret:string;fetcher:(input:string|URL,init?:RequestInit)=>Promise<Response>}|undefined;

/** Use NYC egress only when the complete proxy configuration is present. */
const pageRequest:MerchantFetch=createEbayAwareMerchantFetch(
async function merchantRequest(input:string|URL,init?:RequestInit):Promise<Response>{
  const endpoint=env.ATLAS_IMPORT_PROXY_URL?.trim()??'';
  const secret=env.ATLAS_IMPORT_PROXY_SECRET??'';
  const routing=env as unknown as {ATLAS_TASHKENT_PROXY_URL?:string;ATLAS_TASHKENT_PROXY_SECRET?:string;ATLAS_RESIDENTIAL_PROXY_URL?:string;ATLAS_RESIDENTIAL_PROXY_SECRET?:string};
  const tashkent=routing.ATLAS_TASHKENT_PROXY_URL?.trim()??'';
  const tashkentSecret=routing.ATLAS_TASHKENT_PROXY_SECRET??'';
  const residential=routing.ATLAS_RESIDENTIAL_PROXY_URL?.trim()??'';
  const residentialSecret=routing.ATLAS_RESIDENTIAL_PROXY_SECRET??'';
  if(tashkent||tashkentSecret||residential||residentialSecret){
    if(Boolean(tashkent)!==Boolean(tashkentSecret)||Boolean(residential)!==Boolean(residentialSecret)||Boolean(endpoint)!==Boolean(secret))throw new Error('Importer route is not fully configured.');
    const routes:MerchantRoute[]=[];
    if(tashkent)routes.push({name:'tashkent',fetch:createMerchantProxyFetch({endpoint:tashkent,secret:tashkentSecret})});
    if(endpoint)routes.push({name:'us-vps',fetch:createMerchantProxyFetch({endpoint,secret})});
    if(residential)routes.push({name:'residential',fetch:createMerchantProxyFetch({endpoint:residential,secret:residentialSecret})});
    return withMerchantRoutes(routes)(input,init);
  }
  if(!endpoint&&!secret)return fetch(input,init);
  if(!endpoint||!secret)throw new Error('Importer egress proxy is not fully configured.');
  if(!cached||cached.endpoint!==endpoint||cached.secret!==secret){
    cached={endpoint,secret,fetcher:withDirectFallback(createMerchantProxyFetch({endpoint,secret}),(target,options)=>fetch(target,options))};
  }
  return cached.fetcher(input,init);
},
():EbayBrowseConfig=>{
  const bindings=env as unknown as {EBAY_CLIENT_ID?:string;EBAY_CLIENT_SECRET?:string;EBAY_ENV?:string;EBAY_SHIP_TO_COUNTRY?:string;EBAY_SHIP_TO_POSTAL_CODE?:string};
  const environment=bindings.EBAY_ENV?.trim().toLowerCase();
  return {
    clientId:bindings.EBAY_CLIENT_ID?.trim(),
    clientSecret:bindings.EBAY_CLIENT_SECRET,
    environment:environment==='sandbox'||environment==='production'?environment:undefined,
    // Atlas warehouse address: eBay prices seller shipping for it (defaults to the US without a postal code).
    shipToCountry:bindings.EBAY_SHIP_TO_COUNTRY?.trim(),
    shipToPostalCode:bindings.EBAY_SHIP_TO_POSTAL_CODE?.trim(),
  };
},
);

/** Bright Data for Walmart/H&M: only with the BRIGHTDATA_API_KEY secret and D1; settings live in market_settings. */
function brightDataRuntime(purpose:BrightDataPurpose){
  return async():Promise<BrightDataRuntime|undefined>=>{
    const apiKey=(env as unknown as {BRIGHTDATA_API_KEY?:string}).BRIGHTDATA_API_KEY?.trim()??'';
    if(!apiKey||!env.DB)return;
    const db=env.DB as unknown as D1Like;
    return {apiKey,settings:await readBrightDataSettings(db),jobs:d1BrightDataJobs(db),purpose};
  };
}
/** Customer links, the cart and checkout checks. */
export const merchantRequest:MerchantFetch=Object.assign((input:string|URL,init?:RequestInit)=>pageRequest(input,init),{ebayBrowseConfig:pageRequest.ebayBrowseConfig,brightData:brightDataRuntime('customer')});
/** The catalog editor and the hourly catalog refresh: Bright Data only when the "catalog" setting is on. */
export const catalogMerchantRequest:MerchantFetch=Object.assign((input:string|URL,init?:RequestInit)=>pageRequest(input,init),{ebayBrowseConfig:pageRequest.ebayBrowseConfig,brightData:brightDataRuntime('catalog')});
