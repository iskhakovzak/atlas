import {env} from 'cloudflare:workers';
import {createMerchantProxyFetch} from './proxy-client.mjs';
import type {MerchantFetch} from './fetch.ts';
import type {EbayBrowseConfig} from './ebay.ts';

let cached:{endpoint:string;secret:string;fetcher:typeof fetch}|undefined;

const ebayApiHosts = new Set(['api.ebay.com', 'api.sandbox.ebay.com']);

/**
 * Official eBay OAuth/Browse API calls use the fixed eBay API origins directly;
 * the NYC merchant-page proxy intentionally accepts only its separate store
 * allowlist and must never receive OAuth credentials or access tokens.
 */
function isFixedEbayApiRequest(input:string|URL,init?:RequestInit){
  let target:URL;
  try{target=new URL(input instanceof URL?input.href:String(input))}catch{return false}
  if(!ebayApiHosts.has(target.hostname.toLowerCase()))return false;
  const method=String(init?.method??'GET').toUpperCase();
  if(target.protocol!=='https:'||target.username||target.password||target.port||target.hash)throw new Error('Unsafe eBay API target.');
  if(target.pathname==='/identity/v1/oauth2/token'&&method==='POST')return true;
  if(target.pathname==='/buy/browse/v1/item/get_item_by_legacy_id'&&method==='GET')return true;
  if(target.pathname==='/buy/browse/v1/item/get_items_by_item_group'&&method==='GET')return true;
  throw new Error('Unsupported eBay API request.');
}

/** Use NYC egress only when the complete proxy configuration is present. */
export const merchantRequest:MerchantFetch=Object.assign(
async function merchantRequest(input:string|URL,init?:RequestInit):Promise<Response>{
  if(isFixedEbayApiRequest(input,init))return fetch(input,init);
  const endpoint=env.ATLAS_IMPORT_PROXY_URL?.trim()??'';
  const secret=env.ATLAS_IMPORT_PROXY_SECRET??'';
  if(!endpoint&&!secret)return fetch(input,init);
  if(!endpoint||!secret)throw new Error('Importer egress proxy is not fully configured.');
  if(!cached||cached.endpoint!==endpoint||cached.secret!==secret){
    cached={endpoint,secret,fetcher:createMerchantProxyFetch({endpoint,secret})};
  }
  return cached.fetcher(input,init);
},
{ebayBrowseConfig():EbayBrowseConfig{
  const bindings=env as unknown as {EBAY_CLIENT_ID?:string;EBAY_CLIENT_SECRET?:string;EBAY_ENV?:string};
  const environment=bindings.EBAY_ENV?.trim().toLowerCase();
  return {
    clientId:bindings.EBAY_CLIENT_ID?.trim(),
    clientSecret:bindings.EBAY_CLIENT_SECRET,
    environment:environment==='sandbox'||environment==='production'?environment:undefined,
  };
}},
);
