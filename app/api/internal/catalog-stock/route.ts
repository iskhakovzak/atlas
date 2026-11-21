import {env} from 'cloudflare:workers';
import {failure,HttpError,json} from '@/lib/market/server';
import {catalogStockPath,isAuthorizedCatalogRefresh} from '@/lib/market/catalog-refresh-auth';
import {acquireCatalogRefreshLease,refreshDueCatalog} from '@/lib/market/catalog-refresh';
import {catalogMerchantRequest} from '@/lib/importer/worker-fetch';

/** The frequent VPS job checks only catalog stock and prices. */
export async function POST(request:Request){
  let release:undefined|(()=>Promise<void>);
  try{
    if(!await isAuthorizedCatalogRefresh(request,env.ATLAS_CATALOG_REFRESH_SECRET,Date.now(),catalogStockPath)){
      throw new HttpError(401,'Недопустимый запрос обновления каталога.');
    }
    release=await acquireCatalogRefreshLease();
    return json({ok:true,...await refreshDueCatalog(Date.now(),catalogMerchantRequest)});
  }catch(error){return failure(error,request)}
  finally{try{await release?.()}catch(error){console.error('Catalog refresh lease release failed',error)}}
}
