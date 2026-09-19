import {z} from 'zod';
import {bundledMerchantFinds, type MerchantFind} from './catalog.ts';
import {toUsd,paddedWeight,currencies} from './world.ts';
import {tariff,type Pricing} from './domain.ts';
import {safeImage,type Extracted} from '../importer/extract.ts';
import {isSupportedStoreHost} from '../importer/stores.ts';
import {estimatedBoxedWeight} from './weight.ts';

export const catalogCategories=['Обувь','Одежда','Электроника','Аксессуары','Красота и уход','Дом и быт','Спорт','Другое'] as const;
const text=z.string().trim();
const catalogRefreshStatusSchema=z.enum(['available','sold-out','unknown','failed']);
export const catalogRefreshSchema=z.object({
  lastAttemptAt:z.number().int().nonnegative().optional(),lastSuccessAt:z.number().int().nonnegative().optional(),nextCheckAt:z.number().int().nonnegative().optional(),
  status:catalogRefreshStatusSchema.optional(),lastError:text.max(500).optional(),consecutiveFailures:z.number().int().min(0).max(100).optional(),
  availableVariantCount:z.number().int().min(0).max(250).optional(),lastChange:text.max(500).optional(),
});
export type CatalogRefresh=z.infer<typeof catalogRefreshSchema>;
export const catalogDraftSchema=z.object({
  sourceUrl:text.url().max(3000),name:text.max(140),brand:text.max(100),category:z.enum(catalogCategories),
  image:text.max(3000),images:z.array(text.max(3000)).max(12),price:z.number().finite().nonnegative().optional(),currency:text.max(3),
  referencePrice:z.number().finite().positive().optional(),country:text.max(80),boxedWeight:z.number().finite().positive().max(49.5),
  variants:z.array(z.object({id:text.max(120).optional(),label:text.max(140),size:text.max(100).optional(),sizeLabel:text.max(100).optional(),color:text.max(100).optional(),available:z.boolean(),price:z.number().finite().nonnegative().optional(),image:text.max(3000).optional()})).max(250),
  collectionIds:z.array(text.max(80)).max(20),description:text.max(600),checkedAt:z.number().int().nonnegative(),
  warnings:z.array(text.max(500)).max(20),soldOut:z.boolean().optional(),reviewReasons:z.array(text.max(240)).max(10).optional(),lastCheckError:text.max(500).optional(),
});
export type CatalogDraft=z.infer<typeof catalogDraftSchema>;
export const collectionSchema=z.object({id:text.min(1).max(80),name:text.min(1).max(80),nameUz:text.max(80).default(''),nameEn:text.max(80).default(''),description:text.max(240).default(''),visible:z.boolean(),position:z.number().int().min(0).max(1000)});
export type CatalogCollection=z.infer<typeof collectionSchema>;
export const catalogEntrySchema=z.object({
  id:text.min(1).max(100),draft:catalogDraftSchema,published:catalogDraftSchema.optional(),publishedAt:z.number().optional(),
  refresh:catalogRefreshSchema.optional(),autoHiddenAt:z.number().int().nonnegative().optional(),autoHideReason:z.enum(['source-sold-out']).optional(),
});
export type CatalogEntry=z.infer<typeof catalogEntrySchema>;
export const catalogAvailabilityReportSchema=z.object({
  id:text.min(1).max(100),productId:text.min(1).max(100),sourceUrl:text.url().max(3000),
  answer:z.enum(['available','unavailable']),variant:text.max(140).optional(),reporterId:text.max(320),
  createdAt:z.number().int().nonnegative(),resolvedAt:z.number().int().nonnegative().optional(),
});
export type CatalogAvailabilityReport=z.infer<typeof catalogAvailabilityReportSchema>;
export const catalogMaxEntries=100;
export const catalogDocumentSchema=z.object({revision:z.number().int().nonnegative(),entries:z.array(catalogEntrySchema).max(catalogMaxEntries),collections:z.array(collectionSchema).max(30),availabilityReports:z.array(catalogAvailabilityReportSchema).max(300).optional()});
export type CatalogDocument=z.infer<typeof catalogDocumentSchema>;
export const catalogLifetime=7*24*60*60*1000;
/** A card is due once a day; the scheduler spreads the work across small runs. */
export const catalogRefreshInterval=24*60*60*1000;
export const catalogRefreshBatchSize=5;
const catalogRefreshRetryBase=60*60*1000;
const customerUnavailableReason='Покупатель сообщил, что товар или вариант отсутствует — проверьте магазин.';
const legacyBundledWeights:Record<string,number>={
  'nike-club-fn3859-657':.8,'apple-airtag-1pack-2026':.15,'nike-gato-ih3587-400':1.3,
  'nike-cortez-dm4044-108':1.3,'anker-nano-a2147113':.2,'merrell-wrapt':1.3,'brooks-revel-7':1.3,
  'nike-hyperspeed':1.3,'ekouaer-pajama':.5,'hanes-hoodie':.8,'silkworld-swim':.4,
  'nyx-butter-gloss':.15,'real-perfection-brushes':.4,'laura-geller-balm':.15,'elf-lip-stain':.2,
  'galaxy-s25-ultra':.6,'moto-g-power':.6,'softsoap-refill':1.6,
};

function bundledDraft(item:MerchantFind):CatalogDraft{
  return catalogDraftSchema.parse({
    sourceUrl:item.sourceUrl!,name:item.name,brand:item.brand,category:item.category as CatalogDraft['category'],
    image:item.image,images:[item.image],price:item.sourcePrice,currency:item.sourceCurrency??'USD',
    referencePrice:item.referenceUsd,country:item.country??'',boxedWeight:item.boxedWeight??1,
    variants:item.variants.map(label=>({label,size:/^(?:US )?\d+(?:\.5)?$|^(?:XS|S|M|L|XL|\dXL)$/i.test(label)?label:undefined,available:true})),
    collectionIds:item.collectionIds??[],description:item.description??'',checkedAt:Date.parse(item.observedOn),warnings:[],
  });
}

export function canonicalCatalogUrl(value:string){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!isSupportedStoreHost(url.hostname))throw Error('Используйте ссылку поддерживаемого магазина.');
  url.hash='';for(const key of [...url.searchParams.keys()])if(/^(utm_.+|gclid|fbclid)$/i.test(key))url.searchParams.delete(key);
  url.searchParams.sort();return url.href;
}
export function initialCatalog():CatalogDocument{
  return {revision:0,collections:[],entries:bundledMerchantFinds.map(item=>{
    const draft=bundledDraft(item);
    return{id:item.id,draft,published:structuredClone(draft),publishedAt:Date.parse(item.observedOn)};
  })};
}

/** Adds newly bundled products to an existing D1 catalog without overwriting edits or hidden entries. */
export function synchronizeBundledCatalog(current:CatalogDocument){
  const next=structuredClone(current);let added=0,updated=0;
  for(const seed of initialCatalog().entries){
    const existing=next.entries.find(entry=>{
      if(entry.id===seed.id)return true;
      try{return canonicalCatalogUrl(entry.draft.sourceUrl)===canonicalCatalogUrl(seed.draft.sourceUrl)}catch{return entry.draft.sourceUrl===seed.draft.sourceUrl}
    });
    if(existing){
      const legacy=legacyBundledWeights[seed.id];
      const draftIsLegacy=legacy!==undefined&&Math.abs(existing.draft.boxedWeight-legacy)<1e-6;
      const draftNeedsRounding=existing.draft.boxedWeight!==seed.draft.boxedWeight&&Math.abs(existing.draft.boxedWeight-seed.draft.boxedWeight)<1e-6;
      if(draftIsLegacy||draftNeedsRounding){existing.draft.boxedWeight=seed.draft.boxedWeight;updated++}
      const publishedIsLegacy=legacy!==undefined&&existing.published&&Math.abs(existing.published.boxedWeight-legacy)<1e-6;
      const publishedNeedsRounding=existing.published&&existing.published.boxedWeight!==seed.published!.boxedWeight&&Math.abs(existing.published.boxedWeight-seed.published!.boxedWeight)<1e-6;
      if(existing.published&&(publishedIsLegacy||publishedNeedsRounding)){existing.published.boxedWeight=seed.published!.boxedWeight;updated++}
      continue;
    }
    if(next.entries.length>=catalogMaxEntries)continue;
    next.entries.push(seed);added++;
  }
  if(added||updated)next.revision++;
  return {document:catalogDocumentSchema.parse(next),added,updated};
}
export function importDraft(data:Extracted,collectionIds:string[],country:string,now=Date.now()):CatalogDraft{
  return catalogDraftSchema.parse({sourceUrl:canonicalCatalogUrl(data.sourceUrl),name:data.title??'',brand:data.brand??new URL(data.sourceUrl).hostname,category:data.category??'Другое',image:data.image??'',images:data.images??(data.image?[data.image]:[]),price:data.price,currency:data.currency??'',country:data.country??country,boxedWeight:data.boxedWeight??estimatedBoxedWeight(data.category??'Другое'),variants:(data.variants??[]).map(v=>({id:v.id,label:v.label,size:v.size,sizeLabel:v.sizeLabel,color:v.color,available:v.available,price:v.price,image:v.image})),collectionIds,description:'',checkedAt:now,warnings:data.warnings,soldOut:Boolean(data.variants?.length&&!data.variants.some(v=>v.available))});
}
export function catalogIssues(draft:CatalogDraft,now=Date.now(),rates=tariff.rates){
  const issues:string[]=[];
  try{canonicalCatalogUrl(draft.sourceUrl)}catch{issues.push('Ссылка магазина')}
  if(!draft.name)issues.push('Название');
  if(!safeImage(draft.image,draft.sourceUrl))issues.push('Фото');
  if(!draft.price||draft.price<=0)issues.push('Цена');
  if(!currencies.includes(draft.currency)||!rates[draft.currency])issues.push('Валюта');
  else if(draft.price&&toUsd(draft.price,draft.currency,rates)>10000)issues.push('Стоимость выше лимита Atlas');
  if(!draft.country)issues.push('Страна отправки');
  if(draft.soldOut)issues.push('Нет доступных вариантов');
  if(draft.lastCheckError)issues.push('Ошибка проверки магазина');
  if(draft.reviewReasons?.length)issues.push(...draft.reviewReasons);
  if(!draft.checkedAt||draft.checkedAt>now||now-draft.checkedAt>=catalogLifetime)issues.push('Обновите источник');
  return issues;
}

export function recheckedDraft(previous:CatalogDraft,fresh:CatalogDraft){
  const reasons:string[]=[];
  if(previous.currency!==fresh.currency)reasons.push(`Валюта: ${previous.currency} → ${fresh.currency}`);
  if(previous.price!==fresh.price)reasons.push(`Цена: ${previous.price??'—'} → ${fresh.price??'—'} ${fresh.currency}`);
  const before=previous.variants.filter(v=>v.available).length,after=fresh.variants.filter(v=>v.available).length;
  if(before!==after)reasons.push(`Доступные варианты: ${before} → ${after}`);
  if(previous.soldOut!==fresh.soldOut)reasons.push(fresh.soldOut?'Товар закончился':'Товар снова доступен');
  return catalogDraftSchema.parse({...fresh,referencePrice:previous.referencePrice,description:previous.description,collectionIds:previous.collectionIds,reviewReasons:reasons,lastCheckError:undefined});
}

export function catalogRefreshDueAt(entry:CatalogEntry){
  return entry.refresh?.nextCheckAt??(entry.draft.checkedAt+catalogRefreshInterval);
}

/**
 * Pick a bounded, merchant-fair batch. Only a published card (or one hidden by
 * this job) is watched; manually hidden drafts are deliberately left alone.
 */
export function dueCatalogEntries(document:CatalogDocument,now=Date.now(),limit=catalogRefreshBatchSize){
  const selected:CatalogEntry[]=[],hosts=new Set<string>();
  const candidates=document.entries
    .filter(entry=>Boolean(entry.published||entry.autoHiddenAt))
    .filter(entry=>catalogRefreshDueAt(entry)<=now)
    .sort((left,right)=>catalogRefreshDueAt(left)-catalogRefreshDueAt(right));
  for(const entry of candidates){
    let host:string;
    try{host=new URL(entry.draft.sourceUrl).hostname.toLowerCase().replace(/^www\./,'')}catch{continue}
    if(hosts.has(host))continue;
    hosts.add(host);selected.push(entry);
    if(selected.length>=Math.min(Math.max(1,limit),catalogRefreshBatchSize))break;
  }
  return selected;
}

function resolveAvailabilityReports(document:CatalogDocument,id:string,now:number){
  document.availabilityReports=document.availabilityReports?.map(report=>report.productId===id&&!report.resolvedAt?{...report,resolvedAt:now}:report);
}

function refreshError(value:unknown){
  const message=value instanceof Error?value.message:String(value);
  return message.replace(/[\r\n\t]+/g,' ').trim().slice(0,500)||'Магазин не подтвердил данные.';
}

export type ScheduledRefreshOutcome='available'|'sold-out'|'unknown'|'failed'|'skipped';

/**
 * Apply a successful source observation without deleting editorial data. A
 * public snapshot changes only when the source supplied a complete, explicit
 * option matrix. A definitive all-sold-out matrix unpublishes the card but
 * keeps its draft so a later source recovery can restore it.
 */
export function applyScheduledCatalogRefresh(current:CatalogDocument,id:string,fresh:CatalogDraft,now=Date.now()):{document:CatalogDocument;outcome:ScheduledRefreshOutcome}{
  const next=structuredClone(current),entry=next.entries.find(item=>item.id===id);
  if(!entry)return {document:catalogDocumentSchema.parse(next),outcome:'skipped'};
  const checked=recheckedDraft(entry.draft,fresh);
  const changes=(checked.reviewReasons??[]).join(' · ').slice(0,500)||undefined;
  const candidate=catalogDraftSchema.parse({...checked,reviewReasons:[],lastCheckError:undefined});
  const availableVariantCount=fresh.variants.filter(variant=>variant.available).length;
  const hasExplicitMatrix=fresh.variants.length>0;
  const successBase:CatalogRefresh={
    ...entry.refresh,lastAttemptAt:now,lastSuccessAt:now,nextCheckAt:now+catalogRefreshInterval,
    consecutiveFailures:0,availableVariantCount,lastChange:changes,lastError:undefined,
  };
  if(!hasExplicitMatrix){
    entry.refresh={...successBase,status:'unknown',lastError:'Магазин не отдал подтверждённую матрицу вариантов.'};
    entry.draft.lastCheckError=entry.refresh.lastError;
    next.revision++;
    return {document:catalogDocumentSchema.parse(next),outcome:'unknown'};
  }
  if(!availableVariantCount){
    entry.draft=candidate;
    entry.refresh={...successBase,status:'sold-out'};
    if(entry.published){delete entry.published;delete entry.publishedAt;entry.autoHiddenAt=now;entry.autoHideReason='source-sold-out'};
    resolveAvailabilityReports(next,id,now);
    next.revision++;
    return {document:catalogDocumentSchema.parse(next),outcome:'sold-out'};
  }
  const publishable=!catalogIssues(candidate,now).length;
  if(!publishable){
    entry.refresh={...successBase,status:'unknown',lastError:'Магазин отдал неполные данные для безопасного обновления карточки.'};
    entry.draft.lastCheckError=entry.refresh.lastError;
    next.revision++;
    return {document:catalogDocumentSchema.parse(next),outcome:'unknown'};
  }
  entry.draft=candidate;
  entry.refresh={...successBase,status:'available'};
  if(entry.published||entry.autoHiddenAt){
    entry.published=structuredClone(candidate);entry.publishedAt=now;delete entry.autoHiddenAt;delete entry.autoHideReason;
  }
  resolveAvailabilityReports(next,id,now);
  next.revision++;
  return {document:catalogDocumentSchema.parse(next),outcome:'available'};
}

/** A fetch failure is never evidence that a product has sold out. */
export function markCatalogRefreshFailed(current:CatalogDocument,id:string,error:unknown,now=Date.now()):{document:CatalogDocument;outcome:ScheduledRefreshOutcome}{
  const next=structuredClone(current),entry=next.entries.find(item=>item.id===id);
  if(!entry)return {document:catalogDocumentSchema.parse(next),outcome:'skipped'};
  const consecutiveFailures=Math.min(100,(entry.refresh?.consecutiveFailures??0)+1);
  const retry=Math.min(catalogRefreshInterval,catalogRefreshRetryBase*2**Math.min(5,consecutiveFailures-1));
  const lastError=refreshError(error);
  entry.refresh={...entry.refresh,lastAttemptAt:now,nextCheckAt:now+retry,status:'failed',lastError,consecutiveFailures};
  entry.draft.lastCheckError=lastError;
  next.revision++;
  return {document:catalogDocumentSchema.parse(next),outcome:'failed'};
}

export function reportCatalogAvailability(current:CatalogDocument,input:{productId:string;sourceUrl:string;answer:'available'|'unavailable';variant?:string;reporterId:string},now=Date.now()){
  const next=structuredClone(current),entry=next.entries.find(item=>item.id===input.productId);
  if(!entry||canonicalCatalogUrl(entry.draft.sourceUrl)!==canonicalCatalogUrl(input.sourceUrl))throw Error('Товар каталога не найден.');
  const report=catalogAvailabilityReportSchema.parse({id:crypto.randomUUID(),...input,sourceUrl:entry.draft.sourceUrl,createdAt:now});
  const previous=(next.availabilityReports??[]).filter(item=>item.resolvedAt||item.productId!==input.productId||item.reporterId!==input.reporterId);
  next.availabilityReports=[report,...previous].slice(0,300);
  if(input.answer==='unavailable'){
    entry.draft.reviewReasons=[...new Set([...(entry.draft.reviewReasons??[]),customerUnavailableReason])].slice(0,10);
  }
  next.revision++;
  return catalogDocumentSchema.parse(next);
}
export function publicCatalog(document:CatalogDocument,pricing:Pricing,now=Date.now()){
  const products:MerchantFind[]=document.entries.flatMap(entry=>{
    const d=entry.published;if(!d||catalogIssues(d,now,pricing.rates).length)return [];
    const variants=d.variants.filter(v=>v.available).map(v=>v.label);
    return [{id:entry.id,name:d.name,brand:d.brand,category:d.category,store:new URL(d.sourceUrl).hostname.replace(/^www\./,''),observedOn:new Date(d.checkedAt).toISOString().slice(0,10),usd:toUsd(d.price!,d.currency,pricing.rates),sourcePrice:d.price,sourceCurrency:d.currency,referenceUsd:d.referencePrice&&d.referencePrice>d.price!?toUsd(d.referencePrice,d.currency,pricing.rates):undefined,image:d.image,sourceUrl:d.sourceUrl,description:d.description,country:d.country,boxedWeight:d.boxedWeight,weight:paddedWeight(d.boxedWeight),variants:variants.length?variants:['Уточнить вариант в магазине'],sourceShipping:10,sourceShippingUsd:10,sourceShippingCurrency:'USD',sourceShippingEstimated:true,shippingKnown:false,sourceExpiresAt:d.checkedAt+catalogLifetime,collectionIds:d.collectionIds}];
  });
  const collections=document.collections.filter(c=>c.visible).sort((a,b)=>a.position-b.position).map(c=>({...c,productIds:products.filter(p=>p.collectionIds?.includes(c.id)).map(p=>p.id)})).filter(c=>c.productIds.length);
  return {products,collections};
}

export type CatalogCommand=
  |{kind:'edit';id:string;draft:CatalogDraft}
  |{kind:'publish';ids:string[]}
  |{kind:'hide';ids:string[]}
  |{kind:'collection';collection:CatalogCollection};
export function changeCatalog(current:CatalogDocument,command:CatalogCommand,now=Date.now(),pricing:Pricing=tariff):CatalogDocument{
  const next=structuredClone(current);
  if(command.kind==='collection'){
    const value=collectionSchema.parse(command.collection),index=next.collections.findIndex(c=>c.id===value.id);
    if(index<0)next.collections.push(value);else next.collections[index]=value;
  }else if(command.kind==='edit'){
    const entry=next.entries.find(e=>e.id===command.id);if(!entry)throw Error('Товар не найден');
    const draft=catalogDraftSchema.parse(command.draft);
    // Source identity and observation time come only from server imports.
    draft.sourceUrl=entry.draft.sourceUrl;draft.checkedAt=entry.draft.checkedAt;draft.soldOut=entry.draft.soldOut;draft.reviewReasons=[];draft.lastCheckError=undefined;
    draft.image=safeImage(draft.image,draft.sourceUrl)??'';
    draft.images=draft.images.map(i=>safeImage(i,draft.sourceUrl)).filter((i):i is string=>!!i);
    if(draft.collectionIds.some(id=>!next.collections.some(c=>c.id===id)))throw Error('Подборка не найдена');
    entry.draft=draft;
  }else{
    for(const id of command.ids){
      const entry=next.entries.find(e=>e.id===id);if(!entry)throw Error('Товар не найден');
      if(command.kind==='hide'){delete entry.published;delete entry.publishedAt;next.availabilityReports=next.availabilityReports?.map(report=>report.productId===id&&!report.resolvedAt?{...report,resolvedAt:now}:report);continue}
      const issues=catalogIssues(entry.draft,now,pricing.rates);
      if(issues.length)throw Error(`${entry.draft.name||'Товар'}: ${issues.join(', ')}`);
      entry.published=structuredClone(entry.draft);entry.publishedAt=now;
    }
  }
  next.revision++;return catalogDocumentSchema.parse(next);
}
