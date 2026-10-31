import {fetchEbaySellerCategories,fetchEbaySellerSearchPage,type EbayBrowseConfig,type EbayFetch} from './ebay.ts';

// Reviewed against the store's own Contact link:
// https://www.ebay.com/str/adidas -> /cnt/intermediatedFAQ?requested=adidas_official (25 October 2026).
// A store's public slug is NOT necessarily its seller username. Never guess unknown usernames.
const reviewedSellers:Record<string,string>={adidas:'adidas_official'};
const pageSize=50,maxResults=10_000;
// eBay US top-level categories (Browse searches one category at a time). A whole-store link walks those the seller lists in.
const ebayUsRootCategories=['11450','888','26395','11700','293','58058','15032','625','281','220','1','64482','2984','6000','12576','619','1249','267','11232','11233','14339','237','20081','550','11116','45100','172008','870','1281','260','1305','3252','316','10542','99'];
type Row=Record<string,unknown>;
const row=(value:unknown):Row|undefined=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Row:undefined;
export type EbayStorefront={sourceUrl:string;store:string;seller?:string;categoryId?:string};
export type EbaySaleEvidence={url:string;listingId:string;seller:string;price:number;currency:string;referencePrice?:number;discountPercentage?:number};
export type EbayStorefrontSalePage={sourceUrl:string;seller:string;urls:string[];items:EbaySaleEvidence[];nextCursor?:string;total?:number;scanned:number;matched:number;offset:number;limited:boolean};

/** Store URLs are discovery inputs, not arbitrary URLs for the API transport. */
export function parseEbayStorefrontUrl(value:string):EbayStorefront|undefined {
  if(typeof value!=='string'||value.length>3000)return undefined;
  let url:URL;try{url=new URL(value)}catch{return undefined}
  if(url.protocol!=='https:'||!['ebay.com','www.ebay.com'].includes(url.hostname)||url.username||url.password||url.port)return undefined;
  // Reject even an explicit default port, which URL.port normalizes to an empty string.
  if(/^https:\/\/[^/]*:/i.test(value))return undefined;
  const match=url.pathname.match(/^\/str\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,79})(?:\/[a-zA-Z0-9_-]+\/_i\.html|\/_i\.html)?\/?$/);
  if(!match||url.searchParams.getAll('_sacat').length>1)return undefined;
  const store=match[1].toLowerCase(),category=url.searchParams.get('_sacat');
  if(category!==null&&!/^\d{1,10}$/.test(category))return undefined;
  const categoryId=category&&category!=='0'?category:undefined;
  const canonical=new URL(`https://www.ebay.com/str/${store}`);if(categoryId)canonical.searchParams.set('_sacat',categoryId);
  return {sourceUrl:canonical.href,store,seller:Object.hasOwn(reviewedSellers,store)?reviewedSellers[store]:undefined,categoryId};
}

const encode=(value:Row)=>btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function encodeCursor(sourceUrl:string,offset:number){return encode({v:1,sourceUrl,offset});}
type Position={categories?:string[];index:number;offset:number};
function positionFrom(cursor:string|undefined,sourceUrl:string,wholeStore:boolean):Position|undefined{
  if(cursor===undefined)return undefined;
  if(typeof cursor!=='string'||cursor.length>1000||!/^[a-zA-Z0-9_-]+$/.test(cursor))throw new Error('Некорректная страница витрины eBay. Начните импорт заново.');
  let parsed:Row|undefined;try{parsed=row(JSON.parse(atob(cursor.replaceAll('-','+').replaceAll('_','/'))))}catch{}
  const offset=Number(parsed?.offset),offsetOk=Number.isInteger(offset)&&offset>=0&&offset<=9950&&offset%pageSize===0;
  if(!wholeStore){
    if(parsed?.v!==1||parsed.sourceUrl!==sourceUrl||!offsetOk||offset<50)throw new Error('Страница не относится к этой витрине eBay. Начните импорт заново.');
    return {index:0,offset};
  }
  const categories=parsed?.categories,index=Number(parsed?.index);
  if(parsed?.v!==2||parsed.sourceUrl!==sourceUrl||!offsetOk||!Array.isArray(categories)||!categories.length||categories.length>ebayUsRootCategories.length
    ||!categories.every(id=>typeof id==='string'&&ebayUsRootCategories.includes(id))||new Set(categories).size!==categories.length||!Number.isInteger(index)||index<0||index>=categories.length)
    throw new Error('Страница не относится к этой витрине eBay. Начните импорт заново.');
  return {categories:categories as string[],index,offset};
}
/** Top-level categories where the seller lists items, most items first; every top-level category when eBay names none. */
async function storeCategories(config:EbayBrowseConfig,fetcher:EbayFetch,seller:string,store:string){
  const counts=new Map((await fetchEbaySellerCategories(config,fetcher,{seller,q:store.replace(/[_-]+/g,' ').trim()})).map(row=>[row.categoryId,row.count]));
  const found=ebayUsRootCategories.filter(id=>counts.has(id)).sort((a,b)=>counts.get(b)!-counts.get(a)!);
  return found.length?found:[...ebayUsRootCategories];
}
function amount(value:unknown){const object=row(value),n=typeof object?.value==='string'||typeof object?.value==='number'?Number(object.value):NaN;return Number.isFinite(n)&&n>0&&n<=1_000_000&&typeof object?.currency==='string'&&/^[A-Z]{3}$/.test(object.currency)?{amount:n,currency:object.currency}:undefined;}
function listingFor(item:Row){
  const legacy=typeof item.legacyItemId==='string'&&/^\d{8,15}$/.test(item.legacyItemId)?item.legacyItemId:undefined;
  const rest=typeof item.itemId==='string'?item.itemId.match(/^v1\|(\d{8,15})\|(?:0|\d+)$/)?.[1]:undefined;
  if(legacy&&rest&&legacy!==rest)return undefined;
  return legacy??rest;
}
function sale(item:Row,seller:string,now:number):EbaySaleEvidence|undefined {
  const username=row(item.seller)?.username;
  if(typeof username!=='string'||username.toLowerCase()!==seller)return undefined;
  if(!Array.isArray(item.buyingOptions)||!item.buyingOptions.includes('FIXED_PRICE'))return undefined;
  if(typeof item.itemEndDate==='string'&&Number.isFinite(Date.parse(item.itemEndDate))&&Date.parse(item.itemEndDate)<=now)return undefined;
  if(item.estimatedAvailabilityStatus==='OUT_OF_STOCK'||item.estimatedAvailableQuantity===0)return undefined;
  if(Array.isArray(item.estimatedAvailabilities)&&item.estimatedAvailabilities.length&&item.estimatedAvailabilities.every(value=>{const state=row(value);return state?.estimatedAvailabilityStatus==='OUT_OF_STOCK'||state?.estimatedAvailableQuantity===0}))return undefined;
  const id=listingFor(item),price=amount(item.price),marketing=row(item.marketingPrice);if(!id||!price||!marketing)return undefined;
  const original=amount(marketing.originalPrice),pct=typeof marketing.discountPercentage==='string'||typeof marketing.discountPercentage==='number'?Number(marketing.discountPercentage):NaN;
  // If an original price is supplied it must corroborate a real reduction in the same currency.
  if(marketing.originalPrice!==undefined&&(!original||original.currency!==price.currency||original.amount<=price.amount))return undefined;
  const referencePrice=original?.amount,discountPercentage=referencePrice!==undefined
    ?Math.round((1-price.amount/referencePrice)*10_000)/100
    :Number.isFinite(pct)&&pct>0&&pct<100?pct:undefined;
  if(referencePrice===undefined&&discountPercentage===undefined)return undefined;
  return {url:`https://www.ebay.com/itm/${id}`,listingId:id,seller,price:price.amount,currency:price.currency,...(referencePrice===undefined?{}:{referencePrice}),...(discountPercentage===undefined?{}:{discountPercentage})};
}

/**
 * One bounded official page. Callers persist progress and import full listings separately before publication.
 * A category link (_sacat) pages through that category; a whole-store link pages through each top-level category in turn.
 */
export async function fetchEbayStorefrontSalePage(sourceUrl:string,config:EbayBrowseConfig,fetcher:EbayFetch=fetch,cursor?:string):Promise<EbayStorefrontSalePage>{
  const storefront=parseEbayStorefrontUrl(sourceUrl);
  if(!storefront)throw new Error('Нужна HTTPS-ссылка витрины eBay вида ebay.com/str/магазин.');
  if(!storefront.seller)throw new Error('Продавец этой витрины eBay ещё не подтверждён. Используйте ссылки на товары.');
  const wholeStore=!storefront.categoryId,position=positionFrom(cursor,storefront.sourceUrl,wholeStore);
  const categories=wholeStore?position?.categories??await storeCategories(config,fetcher,storefront.seller,storefront.store):[storefront.categoryId!];
  const index=position?.index??0,offset=position?.offset??0;
  const payload=await fetchEbaySellerSearchPage(config,fetcher,{seller:storefront.seller,categoryId:categories[index],offset});
  const summaries=Array.isArray(payload.itemSummaries)?payload.itemSummaries:[];
  if(summaries.length>pageSize)throw new Error('eBay вернул слишком большую страницу витрины.');
  const items=[...new Map(summaries.map(value=>row(value)).filter((value):value is Row=>Boolean(value)).map(value=>sale(value,storefront.seller!,Date.now())).filter((value):value is EbaySaleEvidence=>Boolean(value)).map(value=>[value.listingId,value])).values()];
  const total=typeof payload.total==='number'&&Number.isInteger(payload.total)&&payload.total>=0?payload.total:undefined;
  // A provider page can be sparse (or temporarily empty) while still supplying a next page.
  // Advance our bounded offset only; never fetch the URL returned in `next`.
  const nextOffset=offset+pageSize,hasMore=(typeof payload.next==='string'&&Boolean(payload.next.trim()))||(summaries.length>0&&total!==undefined&&nextOffset<total);
  const limited=hasMore&&nextOffset>=maxResults;
  const nextCursor=!wholeStore
    ?(hasMore&&!limited?encodeCursor(storefront.sourceUrl,nextOffset):undefined)
    :hasMore&&!limited?encode({v:2,sourceUrl:storefront.sourceUrl,categories,index,offset:nextOffset})
    :index+1<categories.length?encode({v:2,sourceUrl:storefront.sourceUrl,categories,index:index+1,offset:0}):undefined;
  // A whole store sums several searches, so one category's total is not the store's.
  return {sourceUrl:storefront.sourceUrl,seller:storefront.seller,urls:items.map(item=>item.url),items,scanned:summaries.length,matched:items.length,offset,...(total===undefined||wholeStore?{}:{total}),...(nextCursor?{nextCursor}:{}),limited};
}
