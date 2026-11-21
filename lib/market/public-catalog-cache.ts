import {catalogLifetime,publicCatalog,type CatalogDocument} from './catalog-editor.ts';
import {publicCatalogList,type PublicCatalog} from './catalog-list.ts';
import {topDealMaxAgeMs} from './top-deal.ts';
import type {MerchantFind} from './catalog.ts';
import type {Pricing} from './domain.ts';

const maxMemoAgeMs=30_000;

function nextStockChange(document:Readonly<CatalogDocument>,now:number){
  let next=now+maxMemoAgeMs;
  for(const {published} of document.entries){
    if(!published)continue;
    const {checkedAt,confirmedAt}=published;
    for(const time of [checkedAt,checkedAt+catalogLifetime,checkedAt+topDealMaxAgeMs+1,confirmedAt??0,(confirmedAt??0)+catalogLifetime]){
      if(time>now&&time<next)next=time;
    }
  }
  return next;
}

/** Share one public projection for an immutable catalog head and its price rates. */
export function createPublicCatalogMemo(){
  let last:{document:Readonly<CatalogDocument>;ratesKey:string;builtAt:number;expiresAt:number;full:PublicCatalog;list?:PublicCatalog;products?:Map<string,MerchantFind>}|undefined;
  return (document:Readonly<CatalogDocument>,pricing:Pricing,now=Date.now())=>{
    const ratesKey=JSON.stringify(pricing.rates);
    if(!last||last.document!==document||last.ratesKey!==ratesKey||now<last.builtAt||now>=last.expiresAt){
      last={document,ratesKey,builtAt:now,expiresAt:nextStockChange(document,now),full:publicCatalog(document,pricing,now)};
    }
    const record=last;
    return {
      list:()=>record.list??=publicCatalogList(record.full),
      product:(id:string)=>{
        record.products??=new Map(record.full.products.map(item=>[item.id,item]));
        return record.products.get(id);
      },
    };
  };
}
