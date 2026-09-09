export type Extracted={title?:string;brand?:string;category?:ProductCategory;declarationDescription?:string;image?:string;price?:number;currency?:string;shipping?:number;shippingCurrency?:string;shippingDestination?:string;boxedWeight?:number;weightKind?:'shipping'|'net';country?:string;warnings:string[];sourceUrl:string;method:string};
export type ProductCategory='Обувь'|'Одежда'|'Электроника'|'Аксессуары'|'Красота и уход'|'Дом и быт'|'Спорт'|'Другое';
const clean=(s:unknown)=>typeof s==='string'?s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff))).trim():'';
const number=(v:unknown)=>{if(typeof v==='number')return Number.isFinite(v)&&v>=0?v:undefined;if(typeof v!=='string')return undefined;const n=Number(v.replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>=0?n:undefined};
export function safeImage(value:unknown,base:string){const s=typeof value==='string'?value:typeof value==='object'&&value?String((value as Record<string,unknown>).url??(value as Record<string,unknown>).contentUrl??''):'';try{const u=new URL(s,base);if(!s||u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^[\d.:\[\]]+$/.test(u.hostname)||u.hostname.endsWith('.local')||u.hostname==='localhost')return undefined;return u.href}catch{return undefined}}
export function parseWeight(value:unknown){if(!value||typeof value!=='object')return undefined;const q=value as Record<string,unknown>,n=number(q.value);if(n===undefined||n<=0)return undefined;const unit=String(q.unitCode??q.unitText??'').toLowerCase();const factor=({kg:1,kilogram:1,kilograms:1,kgm:1,g:.001,gram:.001,grams:.001,grm:.001,lb:.45359237,lbs:.45359237,lbr:.45359237,oz:.0283495231,onz:.0283495231} as Record<string,number>)[unit];return factor?Math.ceil(n*factor*1000)/1000:undefined}
const regionNames:Record<string,string>={US:'США',ES:'Испания',DE:'Германия',GB:'Великобритания',FR:'Франция',IT:'Италия',CN:'Китай',TR:'Турция',JP:'Япония',KR:'Южная Корея',AE:'ОАЭ',CA:'Канада',AU:'Австралия'};
export function inferProductCategory(title:string,brand=''):ProductCategory{const text=(title+' '+brand).toLowerCase();if(/sneaker|shoe|boot|sandal|trainer|кроссов|обув|туфл|ботин|zapato|zapatilla/.test(text))return 'Обувь';if(/phone|headphone|laptop|tablet|camera|console|monitor|телефон|наушник|ноутбук|планшет|камера|приставк/.test(text))return 'Электроника';if(/lipstick|serum|cream|perfume|makeup|skincare|крем|сыворот|духи|помад|космет/.test(text))return 'Красота и уход';if(/bag|backpack|wallet|belt|watch|jewelry|рюкзак|сумк|кошел|ремень|час|украшен/.test(text))return 'Аксессуары';if(/tent|dumbbell|yoga|running|football|ski|sport|палатк|гантел|йог|бег|спорт|лыж/.test(text))return 'Спорт';if(/chair|table|lamp|kitchen|bedding|furniture|стул|стол|ламп|кухн|постель|мебел/.test(text))return 'Дом и быт';if(/shirt|dress|jacket|coat|jeans|pants|hoodie|t-shirt|skirt|футбол|куртк|пальто|джинс|брюк|плать|юбк|vestido/.test(text))return 'Одежда';return 'Другое'}
export function declarationFor(category:ProductCategory,title:string,brand=''){const item={
 'Обувь':'Обувь для личного пользования',
 'Одежда':'Одежда для личного пользования',
 'Электроника':'Электронное устройство для личного пользования',
 'Аксессуары':'Аксессуар для личного пользования',
 'Красота и уход':'Косметика или средства ухода для личного пользования',
 'Дом и быт':'Товар для дома и личного пользования',
 'Спорт':'Спортивный товар для личного пользования',
 'Другое':'Товар для личного пользования'
 }[category];const cleanTitle=clean(title).slice(0,100);return (brand?clean(brand)+' — ':'')+(cleanTitle||item)+'. '+item+'.'}
export function extractProduct(html:string,sourceUrl:string):Extracted {
 const meta:Record<string,string>={};for(const tag of html.match(/<meta\b[^>]*>/gi)??[]){const a:Record<string,string>={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))a[m[1].toLowerCase()]=clean(m[2]??m[3]);const key=a.property??a.name??a.itemprop;if(key&&a.content)meta[key.toLowerCase()]=a.content;}
 // JSON-LD has no fixed shape; traversal is bounded by depth and node count below.
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const nodes:Record<string,any>[]=[];
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 const walk=(x:any,depth=0)=>{if(depth>15||nodes.length>4000||!x||typeof x!=='object')return;if(Array.isArray(x)){for(const y of x)walk(y,depth+1)}else{nodes.push(x);for(const y of Object.values(x))walk(y,depth+1)}};
 for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{walk(JSON.parse(match[1]))}catch{}}
 const p=nodes.find(n=>[n['@type']].flat().some(t=>t==='Product'||t==='ProductGroup'));
 const offers=p?.offers;const offer=Array.isArray(offers)?offers[0]:offers;const details=offer?.shippingDetails;const ship=Array.isArray(details)?details[0]:details;
 const rate=ship?.shippingRate,shipping=number(rate?.value??rate?.price);const destination=ship?.shippingDestination?.addressCountry;
 const image=safeImage(Array.isArray(p?.image)?p.image[0]:p?.image??meta['og:image']??meta['twitter:image'],sourceUrl);
 // Aggregate/auction lowPrice is not a buy-now price. Never substitute it.
 const price=number(offer?.price??offer?.priceSpecification?.price??meta['product:price:amount']??meta['og:price:amount']);
 const currency=clean(offer?.priceCurrency??offer?.priceSpecification?.priceCurrency??meta['product:price:currency']??meta['og:price:currency']).toUpperCase()||undefined;
 const title=clean(p?.name??meta['og:title']??meta['twitter:title']??html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).slice(0,140)||undefined;
 const gross=parseWeight(p?.shippingWeight),net=parseWeight(p?.weight);const loc=offer?.availableAtOrFrom?.address?.addressCountry??p?.offers?.shippingOrigin?.addressCountry;
 const rawBrand=p?.brand;const brand=clean(typeof rawBrand==='object'&&rawBrand?((rawBrand as Record<string,unknown>).name??(rawBrand as Record<string,unknown>)['@id']):rawBrand).slice(0,80)||new URL(sourceUrl).hostname.replace(/^www\./,'');const category=inferProductCategory(title??'',brand);
 const warnings:string[]=[];if(!price)warnings.push('Цена не найдена: укажите её со страницы выбранного варианта.');if(shipping===undefined)warnings.push('Доставка магазина не найдена. Это не означает бесплатную доставку.');if(!gross&&!net)warnings.push('Вес не опубликован. Предложим приблизительный вес по категории.');if(net&&!gross)warnings.push('Магазин указал вес товара; вес коробки может не входить. Проверьте поле веса.');if(Array.isArray(offers)&&offers.length>1)warnings.push('Найдено несколько предложений: показано первое. Проверьте вариант и цену.');if(offer?.['@type']==='AggregateOffer')warnings.push('Указан диапазон цен. Нужна цена конкретного варианта.');
 return {title,brand,category,declarationDescription:declarationFor(category,title??'',brand),image,price,currency,shipping,shippingCurrency:clean(rate?.currency)||currency,shippingDestination:typeof destination==='string'?destination:undefined,boxedWeight:gross??net,weightKind:gross?'shipping':net?'net':undefined,country:regionNames[String(loc).toUpperCase()],warnings,sourceUrl,method:p?'JSON-LD':'Open Graph'};
}
