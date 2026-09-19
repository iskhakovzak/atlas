import {env} from 'cloudflare:workers';
import {database,failure,HttpError,json} from '@/lib/market/server';
import {isAuthorizedCatalogRefresh} from '@/lib/market/catalog-refresh-auth';
import {refreshDueCatalog} from '@/lib/market/catalog-refresh';

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
    return json({ok:true,...await refreshDueCatalog()});
  }catch(error){return failure(error)}finally{try{await release?.()}catch{}}
}

export async function GET(){return json({error:'Используйте защищённый POST-запрос.'},405)}
