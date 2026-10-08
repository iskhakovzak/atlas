import {z} from 'zod';
import {bundledMerchantFinds, type MerchantFind} from './catalog.ts';
import {toUsd,paddedWeight,currencies} from './world.ts';
import {tariff,sourceVariantSchema,sourceColorwayGallerySchema,type Pricing,type Product} from './domain.ts';
import {dedupeSafeImages,safeImage,type Extracted} from '../importer/extract.ts';
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
  sourceShippingUsd:z.number().finite().nonnegative().max(10000).optional(),sourceShippingEstimated:z.boolean().optional(),
  variants:z.array(sourceVariantSchema).max(250),
  colorwayImages:z.array(sourceColorwayGallerySchema).max(250).optional(),
  collectionIds:z.array(text.max(80)).max(20),description:text.max(600),checkedAt:z.number().int().nonnegative(),
  warnings:z.array(text.max(500)).max(20),soldOut:z.boolean().optional(),reviewReasons:z.array(text.max(240)).max(10).optional(),lastCheckError:text.max(500).optional(),
  importFailureReason:z.enum(['blocked','network','upstream','response','redirect','timeout','incomplete','unknown']).optional(),
  /** Where boxedWeight came from; legacy drafts without it are treated as possibly operator-edited. */
  weightBasis:z.enum(['store','estimate','operator']).optional(),
  /** Operator-set showcase position: lower comes first; empty means no position. */
  rank:z.number().int().min(0).max(1000).optional(),
  /** The operator confirmed stock without a store response; a later successful store check replaces it. */
  confirmedBy:z.enum(['operator']).optional(),confirmedAt:z.number().int().nonnegative().optional(),
});
export type CatalogDraft=z.infer<typeof catalogDraftSchema>;
export const collectionSchema=z.object({id:text.min(1).max(80),name:text.min(1).max(80),nameUz:text.max(80).default(''),nameEn:text.max(80).default(''),description:text.max(240).default(''),visible:z.boolean(),position:z.number().int().min(0).max(1000)});
export type CatalogCollection=z.infer<typeof collectionSchema>;
export const catalogOriginSchema=z.enum(['operator-import','customer-link','bundled']);
export const catalogQueueStateSchema=z.enum(['queued','published','archived']);
export const catalogEntrySchema=z.object({
  id:text.min(1).max(100),draft:catalogDraftSchema,published:catalogDraftSchema.optional(),publishedAt:z.number().optional(),
  createdAt:z.number().int().nonnegative().optional(),origin:catalogOriginSchema.optional(),queueState:catalogQueueStateSchema.optional(),
  refresh:catalogRefreshSchema.optional(),autoHiddenAt:z.number().int().nonnegative().optional(),autoHideReason:z.enum(['source-sold-out']).optional(),
});
export type CatalogEntry=z.infer<typeof catalogEntrySchema>;
export const catalogRecheckBatchSize=10;
export function catalogRecheckBatches(ids:string[]){
  const unique=[...new Set(ids)],batches:string[][]=[];
  for(let index=0;index<unique.length;index+=catalogRecheckBatchSize)batches.push(unique.slice(index,index+catalogRecheckBatchSize));
  return batches;
}
export const catalogAvailabilityReportSchema=z.object({
  id:text.min(1).max(100),productId:text.min(1).max(100),sourceUrl:text.url().max(3000),
  answer:z.enum(['available','unavailable']),variant:text.max(140).optional(),reporterId:text.max(320),
  createdAt:z.number().int().nonnegative(),resolvedAt:z.number().int().nonnegative().optional(),
});
export type CatalogAvailabilityReport=z.infer<typeof catalogAvailabilityReportSchema>;
export const catalogMaxEntries=100;
const bundledCatalogIds=new Set(bundledMerchantFinds.map(item=>item.id));
export function isBundledCatalogEntry(id:string){return bundledCatalogIds.has(id)}
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
    sourceShippingUsd:item.sourceShippingUsd??10,sourceShippingEstimated:item.sourceShippingEstimated??true,
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
    return{id:item.id,draft,published:structuredClone(draft),publishedAt:Date.parse(item.observedOn),origin:'bundled' as const,queueState:'published' as const};
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
 const images=dedupeSafeImages([data.image??'',...(data.images??[])],data.sourceUrl,12);
 const soldOut=Boolean(data.variants?.length&&data.variants.every(variant=>!variant.available&&variant.availabilityKnown!==false));
 // The store's own "before the discount" price is kept only when it is really above the price; display only.
 const referencePrice=typeof data.referencePrice==='number'&&Number.isFinite(data.referencePrice)&&typeof data.price==='number'&&data.referencePrice>data.price?data.referencePrice:undefined;
 // Shipping the store itself quoted to a US address in USD (eBay Browse for the warehouse, JSON-LD shippingDetails) replaces the $10 placeholder; the operator still sees the editor.
 const statedShippingUsd=typeof data.shipping==='number'&&Number.isFinite(data.shipping)&&data.shipping>=0&&data.shipping<=10000
  &&(data.shippingCurrency??data.currency)?.toUpperCase()==='USD'&&(!data.shippingDestination||/^(US|USA|United States)$/i.test(data.shippingDestination.trim()))?data.shipping:undefined;
 return catalogDraftSchema.parse({sourceUrl:canonicalCatalogUrl(data.sourceUrl),name:data.title??'',brand:data.brand??new URL(data.sourceUrl).hostname,category:data.category??'Другое',image:safeImage(data.image,data.sourceUrl)??images[0]??'',images,colorwayImages:data.colorwayImages?.map(g=>({color:g.color,images:dedupeSafeImages(g.images,data.sourceUrl,12)})),price:data.price,currency:data.currency??'',referencePrice,country:data.country??country,boxedWeight:data.boxedWeight??estimatedBoxedWeight(data.category??'Другое'),weightBasis:data.boxedWeight===undefined?'estimate':'store',sourceShippingUsd:statedShippingUsd??10,sourceShippingEstimated:statedShippingUsd===undefined,variants:(data.variants??[]).map(v=>({id:v.id,label:v.label,size:v.size,sizeLabel:v.sizeLabel,...(v.sizeAlternates?{sizeAlternates:v.sizeAlternates}:{}),...(v.quantity===undefined?{}:{quantity:v.quantity}),...(v.quantityMoreThan===undefined?{}:{quantityMoreThan:v.quantityMoreThan}),color:v.color,available:v.available,...(v.availabilityKnown===undefined?{}:{availabilityKnown:v.availabilityKnown}),price:v.price,image:safeImage(v.image,data.sourceUrl)})),collectionIds,description:'',checkedAt:now,warnings:data.warnings,soldOut});
}

/** Keep a supported merchant link reviewable when its public importer is blocked. */
export function manualFallbackCatalogDraft(data:Extracted|undefined,sourceUrl:string,collectionIds:string[],country:string,now=Date.now(),failureMessage?:string,failureReason:CatalogDraft['importFailureReason']='unknown'):CatalogDraft{
 const host=new URL(sourceUrl).hostname.replace(/^www\./,'');
 const draft=importDraft({
  ...data,sourceUrl,brand:data?.brand??host,price:undefined,currency:'',
  variants:(data?.variants??[]).map(variant=>({...variant,price:undefined,available:false,availabilityKnown:false})),
  warnings:[...(data?.warnings??[]),'Автоимпорт не подтвердил данные магазина. Проверьте карточку вручную перед публикацией.'],
 },collectionIds,country,now);
 return catalogDraftSchema.parse({...draft,weightBasis:'estimate',reviewReasons:['Требуется ручная проверка цены, варианта и фото перед публикацией.'],lastCheckError:(failureMessage||'Магазин не подтвердил цену и наличие.').slice(0,500),importFailureReason:failureReason});
}

const generatedCatalogDescriptions = new Set([
  'Товар из каталога Atlas. Цена, выбранный вариант и наличие повторно проверяются в магазине перед добавлением в корзину.',
  'Товар из каталога Atlas. При добавлении Atlas сверяет цену и валюту с данными магазина, если они доступны.',
]);
export function cleanGeneratedCatalogDescription(value:string){
  const normalized=value.normalize('NFKC').replace(/^[\uFEFF\u200B\u200E\u200F\u2060]+/u,'').trim();
  // A few legacy drafts were saved with a stray leading Cyrillic “в” before
  // this generated copy. Treat only that exact whole-field variant as boilerplate.
  const withoutLegacyPrefix=normalized.replace(/^[вВ](?=Товар из каталога Atlas\.)/u,'');
  return generatedCatalogDescriptions.has(withoutLegacyPrefix)?'':value;
}

const customerLinkReviewReason='Добавлен после запроса покупателя — проверьте источник и опубликуйте вручную.';

/**
 * Turn the verified link-order snapshot into an operator-reviewable catalog
 * draft. It deliberately does not create a published snapshot: a customer
 * request is a useful demand signal, not editorial approval or a stock claim.
 */
export function customerLinkDraft(product:Product,source:Extracted,now=Date.now()):CatalogDraft{
  if(!product.sourceUrl)throw Error('Для каталога нужна ссылка на источник.');
  const category=catalogCategories.includes(product.category as typeof catalogCategories[number])
    ? product.category as typeof catalogCategories[number]
    : source.category??'Другое';
  const sourceImages=[...(source.images??[]),source.image??'',product.image].map(image=>safeImage(image,product.sourceUrl!)).filter((image):image is string=>Boolean(image)).slice(0,12);
  const variants=source.variants?.length
    ? source.variants
    : product.variants.map((label,index)=>({id:index===0?product.sourceVariantId:undefined,label,available:true}));
  const merged:Extracted={
    ...source,
    sourceUrl:product.sourceUrl,
    title:source.title??product.name,
    brand:source.brand??product.brand,
    category,
    image:sourceImages[0]??'',
    images:sourceImages,
    price:source.price??product.sourcePrice,
    currency:source.currency??product.sourceCurrency,
    boxedWeight:source.boxedWeight??product.boxedWeight,
    country:source.country??product.country,
    variants,
    warnings:[...source.warnings,customerLinkReviewReason],
  };
  const draft=importDraft(merged,[],product.country??merged.country??'',now);
  // A customer-entered weight is never authoritative; only a store-published one is.
  const weightBasis=source.boxedWeight!==undefined?'store':'estimate';
  return catalogDraftSchema.parse({...draft,weightBasis,sourceShippingUsd:product.sourceShippingUsd??10,sourceShippingEstimated:product.sourceShippingEstimated??true,description:cleanGeneratedCatalogDescription(product.description??''),reviewReasons:[customerLinkReviewReason]});
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
  if(!draft.variants.length)issues.push('Доступный вариант');
  if(draft.variants.some(variant=>!variant.label.trim()))issues.push('Название варианта');
  if(draft.variants.length&&!draft.variants.some(variant=>variant.available&&variant.availabilityKnown!==false))issues.push('Подтвердите доступный вариант');
  if(draft.soldOut)issues.push('Нет доступных вариантов');
  if(draft.variants.some(variant=>variant.availabilityKnown===false))issues.push('Наличие не подтверждено магазином');
  if(draft.lastCheckError)issues.push('Ошибка проверки магазина');
  if(draft.reviewReasons?.length)issues.push(...draft.reviewReasons);
  // The operator's own stock confirmation keeps a card current for one lifetime; the price keeps its own date (checkedAt).
  const confirmedFresh=draft.confirmedAt!==undefined&&draft.confirmedAt<=now&&now-draft.confirmedAt<catalogLifetime;
  if(!draft.checkedAt||draft.checkedAt>now||(now-draft.checkedAt>=catalogLifetime&&!confirmedFresh))issues.push('Обновите источник');
  return issues;
}

export function recheckedDraft(previous:CatalogDraft,fresh:CatalogDraft){
  const reasons:string[]=[];
  if(previous.currency!==fresh.currency)reasons.push(`Валюта: ${previous.currency} → ${fresh.currency}`);
  if(previous.price!==fresh.price)reasons.push(`Цена: ${previous.price??'—'} → ${fresh.price??'—'} ${fresh.currency}`);
  const before=previous.variants.filter(v=>v.available).length,after=fresh.variants.filter(v=>v.available).length;
  if(before!==after)reasons.push(`Доступные варианты: ${before} → ${after}`);
  if(previous.soldOut!==fresh.soldOut)reasons.push(fresh.soldOut?'Товар закончился':'Товар снова доступен');
  // Editorial fields stay as the operator left them; the store's values are surfaced for review instead.
  const name=previous.name||fresh.name;
  if(fresh.name&&fresh.name!==name)reasons.push(`Название в магазине: ${fresh.name}`.slice(0,240));
  const storeWeight=fresh.weightBasis==='store'&&(previous.weightBasis==='store'||previous.weightBasis==='estimate');
  if(fresh.weightBasis==='store'&&fresh.boxedWeight!==previous.boxedWeight)reasons.push(`Вес магазина: ${previous.boxedWeight} → ${fresh.boxedWeight} кг${storeWeight?'':' (оставлен вес редактора)'}`);
  const image=previous.image||fresh.image,images=previous.images.length?previous.images:fresh.images;
  // A fresh store answer outranks the operator's own stock confirmation, so confirmedBy/confirmedAt are not carried over.
  return catalogDraftSchema.parse({...fresh,name,brand:previous.brand||fresh.brand,category:previous.category,country:previous.country||fresh.country,image,images,boxedWeight:storeWeight?fresh.boxedWeight:previous.boxedWeight,weightBasis:storeWeight?'store':previous.weightBasis,referencePrice:fresh.referencePrice??previous.referencePrice,sourceShippingUsd:previous.sourceShippingUsd??10,sourceShippingEstimated:previous.sourceShippingEstimated??true,description:previous.description,collectionIds:previous.collectionIds,rank:previous.rank,reviewReasons:reasons,lastCheckError:undefined,confirmedBy:undefined,confirmedAt:undefined});
}

export function catalogRefreshDueAt(entry:CatalogEntry){
  return entry.refresh?.nextCheckAt??(entry.draft.checkedAt+catalogRefreshInterval);
}

/**
 * Pick a bounded, merchant-fair batch. Only a published card (or one this job
 * hid while it was still in its published lifecycle) is watched; manually
 * hidden or re-queued drafts are deliberately left alone, including legacy
 * archived/queued entries that still carry an auto-hide marker.
 */
/** The scheduler checks a published card and an auto-hidden one it may bring back; never one an operator hid. */
export function isWatchedCatalogEntry(entry:CatalogEntry){return Boolean(entry.published||(entry.autoHiddenAt&&(entry.queueState==='published'||entry.queueState===undefined)))}
export function dueCatalogEntries(document:CatalogDocument,now=Date.now(),limit=catalogRefreshBatchSize){
  const selected:CatalogEntry[]=[],hosts=new Set<string>();
  const candidates=document.entries
    .filter(entry=>isWatchedCatalogEntry(entry))
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
  const availableVariantCount=fresh.variants.filter(variant=>variant.available&&variant.availabilityKnown!==false).length;
  const unknownVariantCount=fresh.variants.filter(variant=>variant.availabilityKnown===false).length;
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
  if(unknownVariantCount){
    const message='Магазин не отдал подтверждённую матрицу наличия — опубликованный снимок сохранён до следующей проверки.';
    entry.refresh={...successBase,status:'unknown',lastError:message};
    entry.draft.lastCheckError=message;
    next.revision++;
    return {document:catalogDocumentSchema.parse(next),outcome:'unknown'};
  }
  if(!availableVariantCount){
    entry.draft=candidate;
    entry.refresh={...successBase,status:'sold-out'};
    if(entry.published){delete entry.published;delete entry.publishedAt;entry.autoHiddenAt=now;entry.autoHideReason='source-sold-out'}
    else if(!isWatchedCatalogEntry(entry)){delete entry.autoHiddenAt;delete entry.autoHideReason}
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
  if(isWatchedCatalogEntry(entry)){
    entry.published=structuredClone(candidate);entry.publishedAt=now;delete entry.autoHiddenAt;delete entry.autoHideReason;
  }else{delete entry.autoHiddenAt;delete entry.autoHideReason}
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
    const d=entry.published;if(!d)return [];
    const issues=catalogIssues(d,now,pricing.rates);
    const freshnessOnly=issues.every(issue=>['Обновите источник','Ошибка проверки магазина','Наличие не подтверждено магазином'].includes(issue));
    if(issues.length&&!freshnessOnly)return [];
    const priceNeedsConfirmation=issues.length>0;
    const variants=d.variants.filter(v=>v.available&&v.availabilityKnown!==false).map(v=>v.label);
    const sourceImages=dedupeSafeImages([d.image,...d.images,...d.variants.map(variant=>variant.image??'')],d.sourceUrl,12);
    const sourceVariants=d.variants.map(variant=>{
      const image=safeImage(variant.image,d.sourceUrl);
      return {
        ...variant,
        ...(image?{image}:{image:undefined}),
        ...(priceNeedsConfirmation?{available:true,availabilityKnown:false,price:undefined}:{}),
      };
    });
    const hasRecordedPrice=typeof d.price==='number'&&d.price>0&&Boolean(pricing.rates[d.currency]);
    const recordedUsd=hasRecordedPrice?toUsd(d.price!,d.currency,pricing.rates):undefined;
    const sourceShippingUsd=d.sourceShippingUsd??10,sourceShippingEstimated=d.sourceShippingEstimated??true;
    return [{id:entry.id,name:d.name,brand:d.brand,category:d.category,store:new URL(d.sourceUrl).hostname.replace(/^www\./,''),observedOn:new Date(d.checkedAt).toISOString().slice(0,10),usd:recordedUsd??1,sourcePrice:hasRecordedPrice?d.price:undefined,sourceCurrency:hasRecordedPrice?d.currency:undefined,referenceUsd:!priceNeedsConfirmation&&d.referencePrice&&d.referencePrice>d.price!?toUsd(d.referencePrice,d.currency,pricing.rates):undefined,image:sourceImages[0]??'',sourceImages,sourceVariants,sourceColorwayImages:d.colorwayImages?.map(g=>({color:g.color,images:dedupeSafeImages(g.images,d.sourceUrl,12)})),sourceUrl:d.sourceUrl,description:cleanGeneratedCatalogDescription(d.description),country:d.country,boxedWeight:d.boxedWeight,weight:paddedWeight(d.boxedWeight),variants:priceNeedsConfirmation?['Уточнить вариант в магазине']:variants.length?variants:['Уточнить вариант в магазине'],sourceShipping:sourceShippingUsd,sourceShippingUsd,sourceShippingCurrency:'USD',sourceShippingEstimated,shippingKnown:!sourceShippingEstimated,sourceExpiresAt:Math.max(d.checkedAt,d.confirmedAt??0)+catalogLifetime,sourceCheckedAt:d.checkedAt,collectionIds:d.collectionIds,priceNeedsConfirmation,...(entry.publishedAt??entry.createdAt?{addedAt:entry.publishedAt??entry.createdAt}:{}),...(d.rank===undefined?{}:{rank:d.rank}),...(d.confirmedAt===undefined?{}:{confirmedAt:d.confirmedAt})}];
  });
  const collections=document.collections.filter(c=>c.visible).sort((a,b)=>a.position-b.position).map(c=>({...c,productIds:products.filter(p=>p.collectionIds?.includes(c.id)).map(p=>p.id)})).filter(c=>c.productIds.length);
  return {products,collections};
}

export type CatalogCommand=
  |{kind:'edit';id:string;draft:CatalogDraft}
  |{kind:'publish';ids:string[]}
  /** The operator confirmed stock themselves (for example by opening the store page) and publishes without a store response. */
  |{kind:'confirm';ids:string[]}
  |{kind:'hide';ids:string[]}
  |{kind:'delete-drafts';ids:string[]}
  |{kind:'collection';collection:CatalogCollection};

/**
 * The operator's own stock confirmation: every listed option becomes a known stock state and the check
 * errors are cleared. The price was not re-read, so `checkedAt` (the date of the price) stays as it was:
 * `catalogIssues` treats the card as current for one lifetime from `confirmedAt`, and the storefront keeps
 * printing the price with its date. Publication still has to pass the same review as `publish`, so a
 * card without a price or a photo stays unpublished.
 */
function confirmedDraft(draft:CatalogDraft,now:number):CatalogDraft{
  return catalogDraftSchema.parse({
    ...draft,soldOut:false,reviewReasons:[],lastCheckError:undefined,importFailureReason:undefined,
    variants:draft.variants.map(variant=>({...variant,available:variant.available!==false,availabilityKnown:true})),
    confirmedBy:'operator',confirmedAt:now,
  });
}
export function changeCatalog(current:CatalogDocument,command:CatalogCommand,now=Date.now(),pricing:Pricing=tariff):CatalogDocument{
  const next=structuredClone(current);
  if(command.kind==='collection'){
    const value=collectionSchema.parse(command.collection),index=next.collections.findIndex(c=>c.id===value.id);
    if(index<0)next.collections.push(value);else next.collections[index]=value;
  }else if(command.kind==='edit'){
    const entry=next.entries.find(e=>e.id===command.id);if(!entry)throw Error('Товар не найден');
    const draft=catalogDraftSchema.parse(command.draft);
    // Source identity and observation time come only from server imports.
    draft.sourceUrl=entry.draft.sourceUrl;draft.checkedAt=entry.draft.checkedAt;draft.soldOut=entry.draft.soldOut&&!entry.draft.variants.some(variant=>variant.availabilityKnown===false);draft.reviewReasons=[];draft.lastCheckError=undefined;
    // The operator's stock confirmation is server-recorded too: an edit neither grants nor removes it.
    draft.confirmedBy=entry.draft.confirmedBy;draft.confirmedAt=entry.draft.confirmedAt;
    // Weight provenance is server-owned: a changed weight is the operator's and outranks later store refreshes.
    draft.weightBasis=draft.boxedWeight!==entry.draft.boxedWeight?'operator':entry.draft.weightBasis;
    draft.image=safeImage(draft.image,draft.sourceUrl)??'';
    draft.images=draft.images.map(i=>safeImage(i,draft.sourceUrl)).filter((i):i is string=>!!i);
    if(draft.collectionIds.some(id=>!next.collections.some(c=>c.id===id)))throw Error('Подборка не найдена');
    entry.draft=draft;
    // The showcase position is ordering, not a claim about the product, so a published card takes it at once.
    if(entry.published){if(draft.rank===undefined)delete entry.published.rank;else entry.published.rank=draft.rank}
  }else if(command.kind==='delete-drafts'){
    const ids=[...new Set(command.ids)];
    for(const id of ids){
      const entry=next.entries.find(item=>item.id===id);if(!entry)throw Error('Товар не найден');
      if(entry.published)throw Error('Опубликованный товар сначала уберите из публичного каталога.');
      if(isBundledCatalogEntry(id))throw Error('Встроенный товар нельзя удалить; его можно только скрыть.');
    }
    const removed=new Set(ids);next.entries=next.entries.filter(entry=>!removed.has(entry.id));
    next.availabilityReports=next.availabilityReports?.filter(report=>!removed.has(report.productId));
  }else{
    for(const id of command.ids){
      const entry=next.entries.find(e=>e.id===id);if(!entry)throw Error('Товар не найден');
      // A manual hide outranks an earlier auto-hide, so the scheduler stops watching the card.
      if(command.kind==='hide'){delete entry.published;delete entry.publishedAt;delete entry.autoHiddenAt;delete entry.autoHideReason;entry.queueState='archived';next.availabilityReports=next.availabilityReports?.map(report=>report.productId===id&&!report.resolvedAt?{...report,resolvedAt:now}:report);continue}
      const draft=command.kind==='confirm'?confirmedDraft(entry.draft,now):entry.draft;
      const issues=catalogIssues(draft,now,pricing.rates);
      if(issues.length)throw Error(`${draft.name||'Товар'}: ${issues.join(', ')}`);
      entry.draft=draft;
      entry.published=structuredClone(draft);entry.publishedAt=now;entry.queueState='published';delete entry.autoHiddenAt;delete entry.autoHideReason;
      if(command.kind==='confirm')resolveAvailabilityReports(next,id,now);
    }
  }
  next.revision++;return catalogDocumentSchema.parse(next);
}
