import {z} from 'zod';
import {identity,sameOrigin,requestJson,json,failure,HttpError,database} from '@/lib/market/server';
import {readCatalog,persistCatalog} from '@/lib/market/catalog-server';
import {reportCatalogAvailability} from '@/lib/market/catalog-editor';

const reportSchema=z.object({
  productId:z.string().min(1).max(100),sourceUrl:z.string().url().max(3000),
  answer:z.enum(['available','unavailable']),variant:z.string().trim().max(140).optional(),
});

export async function POST(request:Request){try{
  sameOrigin(request);const user=await identity(),payload=reportSchema.safeParse(await requestJson(request,10000));
  if(!payload.success)throw new HttpError(400,'Не удалось сохранить ответ о наличии.');
  const now=Date.now(),key=`${user.userId}:catalog-availability:${Math.floor(now/86400000)}`,db=database();
  const limit=await db.prepare('INSERT INTO market_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+172800000).first<{count:number}>();
  if(!limit||limit.count>30)throw new HttpError(429,'Лимит сообщений на сегодня исчерпан.');
  const {document,raw}=await readCatalog();
  let next;try{next=reportCatalogAvailability(document,{...payload.data,reporterId:user.userId},now)}catch(error){throw new HttpError(400,(error as Error).message)}
  await persistCatalog(next,raw,user,`catalog.availability.${payload.data.answer}`);
  return json({saved:true,revision:next.revision});
}catch(error){return failure(error)}}
