import {env} from 'cloudflare:workers';
import {createMerchantProxyFetch} from './proxy-client.mjs';
import {withDirectFallback} from './egress.ts';
import type {MerchantFetch} from './fetch.ts';
import type {EbayBrowseConfig} from './ebay.ts';
import {createEbayAwareMerchantFetch} from './ebay-transport.ts';

let cached:{endpoint:string;secret:string;fetcher:(input:string|URL,init?:RequestInit)=>Promise<Response>}|undefined;

/** Use NYC egress only when the complete proxy configuration is present. */
export const merchantRequest:MerchantFetch=createEbayAwareMerchantFetch(
async function merchantRequest(input:string|URL,init?:RequestInit):Promise<Response>{
  const endpoint=env.ATLAS_IMPORT_PROXY_URL?.trim()??'';
  const secret=env.ATLAS_IMPORT_PROXY_SECRET??'';
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
