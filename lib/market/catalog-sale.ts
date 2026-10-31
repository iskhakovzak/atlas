import {z} from 'zod';
import type {EbaySaleEvidence,EbayStorefrontSalePage} from '../importer/ebay-storefront.ts';
import type {Extracted} from '../importer/extract.ts';
import {importDraft,type CatalogDraft} from './catalog-editor.ts';

const evidence=z.object({url:z.string().url().max(3000),listingId:z.string().regex(/^\d{8,15}$/),seller:z.string().max(80),price:z.number().positive().max(10000),currency:z.string().regex(/^[A-Z]{3}$/),referencePrice:z.number().positive().optional(),discountPercentage:z.number().positive().max(100).optional()});
export const catalogSaleJobSchema=z.object({
 id:z.string().max(100),sourceUrl:z.string().url().max(3000),country:z.string().max(80),collectionIds:z.array(z.string().max(80)).max(20),
 status:z.enum(['running','paused','completed']),cursor:z.string().max(1000).optional(),discoveryDone:z.boolean(),limited:z.boolean(),
 pending:z.array(evidence).max(100),seen:z.array(z.string().max(20)).max(10000),scanned:z.number().int().nonnegative(),matched:z.number().int().nonnegative(),
 processed:z.number().int().nonnegative(),published:z.number().int().nonnegative(),review:z.number().int().nonnegative(),skipped:z.number().int().nonnegative(),failed:z.number().int().nonnegative(),
 total:z.number().int().nonnegative().optional(),updatedAt:z.number(),leaseUntil:z.number(),leaseId:z.string().optional(),pauseRequested:z.boolean().optional(),message:z.string().max(500).optional(),
 retryAt:z.number().optional(),consecutiveErrors:z.number().int().nonnegative().optional(),recent:z.array(z.object({url:z.string().max(3000),message:z.string().max(500)})).max(5),
 principal:z.object({email:z.string().max(320),method:z.string().max(40)}).optional(),
});
export type CatalogSaleJob=z.infer<typeof catalogSaleJobSchema>;
export function publicSaleJob(job:CatalogSaleJob|undefined){if(!job)return undefined;const {principal,...visible}=job;void principal;return visible;}
export const isEbayStorefrontLink=(value:string)=>{try{const u=new URL(value);return u.protocol==='https:'&&/^(?:www\.)?ebay\.com$/.test(u.hostname)&&/^\/str\//.test(u.pathname)&&!u.username&&!u.password&&!u.port}catch{return false}};
export type SaleJobStore={read:(owner:string)=>Promise<{raw:string;job:CatalogSaleJob}|undefined>;write:(owner:string,job:CatalogSaleJob,previous:string|null)=>Promise<boolean>};
/** Both discovery evidence and the detailed item must corroborate the same current price/currency. */
export function saleDraftFromEvidence(item:EbaySaleEvidence,data:Extracted,job:Pick<CatalogSaleJob,'country'|'collectionIds'>):CatalogDraft|undefined{
 const source=new URL(data.sourceUrl??item.url),id=source.pathname.match(/\/itm\/(?:[^/]+\/)?(\d+)\/?$/)?.[1];
 if(!/^(?:www\.)?ebay\.com$/.test(source.hostname)||id!==item.listingId||data.currency!==item.currency)return undefined;
 const available=data.variants?.filter(v=>v.available&&v.availabilityKnown===true&&v.quantity!==0&&v.price&&v.price>0)??[];
 const matching=available.some(v=>Math.round(v.price!*100)===Math.round(item.price*100)),reference=item.referencePrice;
 if(reference!==undefined&&reference<=item.price)return undefined;
 if(!matching||!(reference&&reference>item.price||item.discountPercentage&&item.discountPercentage>0&&item.discountPercentage<100))return undefined;
 const draft=importDraft(data,job.collectionIds,job.country,Date.now());
 const minimum=Math.min(...available.map(v=>v.price!));
 if(reference&&Math.round(minimum*100)===Math.round(item.price*100))draft.referencePrice=reference;
 return draft;
}
type Dependencies={store:SaleJobStore;discover:(source:string,cursor?:string)=>Promise<EbayStorefrontSalePage>;importItem:(item:EbaySaleEvidence,job:CatalogSaleJob)=>Promise<{published?:boolean;review?:boolean;skipped?:boolean;message?:string}>;now?:()=>number;uuid?:()=>string};

/** Resumable operator-owned work. Network work runs only under a single leased claim. */
export function createCatalogSaleRunner(deps:Dependencies){
 const now=deps.now??Date.now,uuid=deps.uuid??(()=>crypto.randomUUID()),store=deps.store;
 const read=async(owner:string)=> (await store.read(owner))?.job;
 async function start(owner:string,input:Pick<CatalogSaleJob,'sourceUrl'|'country'|'collectionIds'>,principal?:{email:string;method:string}){
  const previous=await store.read(owner);if(previous?.job.status==='running'){
   if(principal&&!previous.job.principal){const updated={...previous.job,principal,updatedAt:now()};if(!await store.write(owner,updated,previous.raw))throw Error('Задание изменилось в другой вкладке. Обновите страницу.');return updated;}
   return previous.job;
  }
  if(previous?.job.status==='paused'&&previous.job.sourceUrl===input.sourceUrl&&previous.job.country===input.country&&JSON.stringify(previous.job.collectionIds)===JSON.stringify(input.collectionIds))return control(owner,previous.job.id,true,principal);
  const job:CatalogSaleJob={...input,...(principal?{principal}:{}),id:uuid(),status:'running',discoveryDone:false,limited:false,pending:[],seen:[],scanned:0,matched:0,processed:0,published:0,review:0,skipped:0,failed:0,updatedAt:now(),leaseUntil:0,recent:[]};
  if(!await store.write(owner,job,previous?.raw??null))throw Error('Задание изменилось в другой вкладке. Обновите страницу.');return job;
 }
 async function control(owner:string,id:string,resume:boolean,principal?:{email:string;method:string}){
  const row=await store.read(owner);if(!row||row.job.id!==id)throw Error('Задание импорта не найдено.');
  if(row.job.status==='completed')return row.job;
  const job={...row.job,...(resume&&principal?{principal}:{}),status:resume?'running' as const:'paused' as const,pauseRequested:!resume,updatedAt:now(),message:undefined,retryAt:0,consecutiveErrors:0};
  if(!await store.write(owner,job,row.raw))throw Error('Задание изменилось. Повторите действие.');return job;
 }
 async function step(owner:string,id:string){
  const row=await store.read(owner);if(!row||row.job.id!==id)throw Error('Задание импорта не найдено.');
  if(row.job.status!=='running'||row.job.leaseUntil>now()||(row.job.retryAt??0)>now())return row.job;
  const job=structuredClone(row.job);job.leaseUntil=now()+180_000;job.leaseId=uuid();job.pauseRequested=false;
  if(!await store.write(owner,job,row.raw))return await read(owner);
  const claimed=JSON.stringify(catalogSaleJobSchema.parse(job));
  const retry=(error:unknown)=>{job.consecutiveErrors=(job.consecutiveErrors??0)+1;job.failed++;job.status=job.consecutiveErrors<3?'running':'paused';job.retryAt=now()+15_000*2**(job.consecutiveErrors-1);job.message=(error instanceof Error?error.message:'Не удалось сохранить товар.').slice(0,500);};
  try{
   if(!job.pending.length&&!job.discoveryDone){
    const page=await deps.discover(job.sourceUrl,job.cursor),seen=new Set(job.seen);
    for(const item of page.items){const checked=evidence.safeParse(item);if(!checked.success||seen.has(item.listingId))continue;seen.add(item.listingId);job.pending.push(checked.data);}
    job.seen=[...seen];job.scanned+=page.scanned;job.matched=job.seen.length;job.total=page.total;job.cursor=page.nextCursor;job.discoveryDone=!page.nextCursor;job.limited=job.limited||page.limited;
   }
   // Three full listings fit one bounded request. The next call continues automatically.
   for(let i=0;i<3&&job.pending.length;i++){
    const item=job.pending[0];
    try{const result=await deps.importItem(item,job);job.processed++;if(result.published)job.published++;else if(result.review)job.review++;else job.skipped++;
     if(result.message)job.recent=[{url:item.url,message:result.message.slice(0,500)},...job.recent].slice(0,5);
    }catch(error){
     // A persistence, quota or network problem is a pause, never a silently discarded item.
     retry(error);break;
    }
    job.pending.shift();job.retryAt=0;job.consecutiveErrors=0;job.message=undefined;
   }
   if(!job.pending.length&&job.discoveryDone)job.status='completed';
  }catch(error){retry(error);}
  job.updatedAt=now();job.leaseUntil=0;
  // A pause from another tab may arrive while the current listing is being saved.
  let previous=claimed;const latest=await store.read(owner);
  if(latest?.raw!==claimed){if(!latest||latest.job.id!==job.id||latest.job.leaseId!==job.leaseId)return latest?.job;previous=latest.raw;if(latest.job.pauseRequested&&job.status!=='completed')job.status='paused';}
  job.pauseRequested=false;
  if(!await store.write(owner,job,previous))return await read(owner);
  return job;
 }
 return {read,start,control,step};
}
