import {env} from 'cloudflare:workers';
import {database,failure,HttpError,json} from '@/lib/market/server';
import {catalogBatchPath,isAuthorizedCatalogRefresh} from '@/lib/market/catalog-refresh-auth';
import {runOneScheduledBatch} from '@/lib/market/catalog-batch-scheduler';

/** Signed machine-only request. The scheduler never supplies an identity, URLs or job size. */
export async function POST(request:Request){try{
 if(!await isAuthorizedCatalogRefresh(request,env.ATLAS_CATALOG_REFRESH_SECRET,Date.now(),catalogBatchPath))throw new HttpError(401,'Недопустимый запрос фонового импорта.');
 const now=Date.now(),timestamp=request.headers.get('x-atlas-refresh-timestamp')!;
 const db=database();await db.prepare('DELETE FROM market_rate_limits WHERE expires_at < ?').bind(now).run();
 const accepted=await db.prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO NOTHING RETURNING key').bind(`atlas:catalog-batch:request:${timestamp}`,now+600000).first<{key:string}>();
 if(!accepted)throw new HttpError(409,'Запрос фонового импорта уже выполнен.');
 return json({ok:true,...await runOneScheduledBatch()});
}catch(error){return failure(error,request)}}
export async function GET(){return json({error:'Используйте защищённый POST-запрос.'},405)}
