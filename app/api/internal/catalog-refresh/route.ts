import {env} from 'cloudflare:workers';
import {database,failure,HttpError,json} from '@/lib/market/server';
import {apiErrorMessage,requestLocale} from '@/lib/market/i18n';
import {isAuthorizedCatalogRefresh} from '@/lib/market/catalog-refresh-auth';
import {refreshDueCatalog} from '@/lib/market/catalog-refresh';
import {refreshProviderBooks} from '@/lib/market/provider-usage';
import {catalogMerchantRequest as merchantRequest} from '@/lib/importer/worker-fetch';

async function acquireRefreshLease(){
  const now=Date.now(),db=database();
  await db.prepare('DELETE FROM market_rate_limits WHERE expires_at < ?').bind(now).run();
  const lease=await db.prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO NOTHING RETURNING key').bind('atlas:catalog-refresh:lease',now+120000).first<{key:string}>();
  if(!lease)throw new HttpError(409,'Проверка каталога уже выполняется.');
  return async()=>{await db.prepare('DELETE FROM market_rate_limits WHERE key=?').bind('atlas:catalog-refresh:lease').run()};
}

/**
 * This route is intentionally not a browser action: a separate scheduler signs
 * requests with a Worker secret. It never accepts a customer identity or a
 * caller-controlled batch size.
 */
export async function POST(request:Request){
  let release:undefined|(()=>Promise<void>);
  try{
    if(!await isAuthorizedCatalogRefresh(request,env.ATLAS_CATALOG_REFRESH_SECRET))throw new HttpError(401,'Недопустимый запрос обновления каталога.');
    release=await acquireRefreshLease();
    const result=await refreshDueCatalog(Date.now(),merchantRequest);
    // Hourly: settle Bright Data jobs nobody waited for and post yesterday's paid records to the books.
    const providers=await refreshProviderBooks();
    return json({ok:true,...result,providerEntries:providers.inserted});
  }catch(error){return failure(error,request)}finally{try{await release?.()}catch{}}
}

export async function GET(request:Request){const locale=requestLocale(request);return json({error:locale==='ru'?'Используйте защищённый POST-запрос.':apiErrorMessage(405,locale)},405)}
