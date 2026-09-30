import {env} from 'cloudflare:workers';
import {createMerchantProxyFetch} from './proxy-client.mjs';

let cached:{endpoint:string;secret:string;fetcher:typeof fetch}|undefined;

/** Use NYC egress only when the complete proxy configuration is present. */
export function merchantRequest(input:string|URL,init?:RequestInit):Promise<Response>{
  const endpoint=env.ATLAS_IMPORT_PROXY_URL?.trim()??'';
  const secret=env.ATLAS_IMPORT_PROXY_SECRET??'';
  if(!endpoint&&!secret)return fetch(input,init);
  if(!endpoint||!secret)throw new Error('Importer egress proxy is not fully configured.');
  if(!cached||cached.endpoint!==endpoint||cached.secret!==secret){
    cached={endpoint,secret,fetcher:createMerchantProxyFetch({endpoint,secret})};
  }
  return cached.fetcher(input,init);
}
