import {database,HttpError,pricing} from './server';
import {catalogSaleJobSchema,createCatalogSaleRunner,saleDraftFromEvidence,type SaleJobStore} from './catalog-sale';
import {fetchEbayStorefrontSalePage,parseEbayStorefrontUrl} from '../importer/ebay-storefront';
import {fetchProduct,ManualEntryFallbackError} from '../importer/fetch';
import {EbayListingUnavailableError,EbayBrowseApiError} from '../importer/ebay';
import {catalogMerchantRequest} from '../importer/worker-fetch';
import {readCatalog,persistCatalog} from './catalog-server';
import {applyAutomaticCatalogImport,manualFallbackCatalogDraft} from './catalog-editor';
import type {CatalogDraft} from './catalog-editor';

const key=(owner:string)=>`catalog-sale:${owner}`;
const store:SaleJobStore={
 async read(owner){const row=await database().prepare('SELECT value FROM market_settings WHERE key=?').bind(key(owner)).first<{value:string}>();return row?{raw:row.value,job:catalogSaleJobSchema.parse(JSON.parse(row.value))}:undefined;},
 async write(owner,job,previous){const value=JSON.stringify(catalogSaleJobSchema.parse(job));if(new TextEncoder().encode(value).length>500_000)throw new HttpError(413,'Задание витрины слишком большое. Выберите более узкую категорию.');
  const r=await database().prepare('INSERT INTO market_settings(key,value,updated_at,updated_by) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by WHERE market_settings.value=?').bind(key(owner),value,Date.now(),owner,previous??'').run();return Boolean(r.meta.changes);
 },
};
export function catalogSaleRunner(user:{userId:string;email:string}){
 return createCatalogSaleRunner({store,
  async discover(source,cursor){try{return await fetchEbayStorefrontSalePage(source,catalogMerchantRequest.ebayBrowseConfig?.()??{},catalogMerchantRequest,cursor);}catch(error){if(error instanceof EbayBrowseApiError)throw new Error(error.describe());throw error;}},
  async importItem(item,job){
   let draft:CatalogDraft|undefined;
   try{const data=await fetchProduct(item.url,catalogMerchantRequest);draft=saleDraftFromEvidence(item,data,job);}
   catch(error){
    if(error instanceof EbayListingUnavailableError)return {skipped:true,message:'Объявление завершено или товар недоступен.'};
    if(error instanceof ManualEntryFallbackError&&error.reason==='incomplete')draft=manualFallbackCatalogDraft(error.partial,item.url,job.collectionIds,job.country,Date.now(),error.message,'incomplete');
    else throw error;
   }
   if(!draft)return {skipped:true,message:'Цена или скидка изменились; товар не опубликован.'};
   const currentPricing=await pricing();
   for(let attempt=0;attempt<3;attempt++){
    const {document,raw}=await readCatalog();
    const outcome=applyAutomaticCatalogImport(document,draft,Date.now(),currentPricing.rates);document.revision++;
    try{await persistCatalog(document,raw,user,'catalog.sale-import',{jobId:job.id});return {published:outcome.published,review:!outcome.published,message:outcome.note};}
    catch(error){if(error instanceof HttpError&&error.status===409&&attempt<2)continue;throw error;}
   }
   throw new HttpError(409,'Каталог изменяется в другой вкладке. Повторим сохранение.');
  },
 });
}
export function validatedSaleSource(value:string){const source=parseEbayStorefrontUrl(value);if(!source?.seller)throw new HttpError(400,'Вставьте ссылку подтверждённой витрины eBay, например ebay.com/str/adidas, или её категории.');return source.sourceUrl;}
