"use client";
/* eslint-disable @next/next/no-img-element */
import {useMemo,useState} from "react";
import {PasteButton} from "@/components/paste-button";
import {Check,ExternalLink,ListPlus,Loader2,ShoppingBag} from "lucide-react";
import { toast } from "@/lib/market/toast";
import {useMarket} from "@/lib/market/store";
import {variantSourceUrl} from "@/lib/importer/link-selection";
import {isStockUnconfirmed} from "@/lib/importer/variant-normalization";
import {Empty,PageHeading} from "./market-ui";
import {pickLocale,uzText} from '@/lib/market/uz-cyrl';
import {formatStorePrice} from '@/lib/market/store-price';
import {isUzbek,type Locale} from '@/lib/market/i18n';
import {requestImport} from "@/lib/market/import-client";
import {parseCatalogImportQueue} from "@/lib/market/catalog-import-queue";
import {batchCartProduct,batchCurrency,batchOptionGallery,batchOptions,type BatchImportSource} from "@/lib/market/batch-import-option";

type Candidate={key:string;data:BatchImportSource;selected:number|null};

export function BatchImportView(){
 const {ready,pricing,act,state,lastActionError}=useMarket();
 const locale=state.communication.language;
  const c=locale==='ru'?{login:'Войдите, чтобы импортировать список',loginHint:'Партия и результаты проверки сохраняются в вашем профиле.',open:'Открыть вход',over:'НЕСКОЛЬКО ТОВАРОВ',title:'Загрузите ссылки и выберите варианты',intro:'Atlas сначала покажет цену, фото и варианты. Ничего не попадёт в корзину без вашего выбора.',links:'Ссылки на товары',check:'Проверить товары',checking:'Проверяем…',choose:'Выберите варианты',server:'При добавлении Atlas сверит цену, валюту и выбранный вариант.',addSelected:'Добавить выбранные',added:'Выбранные товары добавлены в корзину.',one:'Вставьте хотя бы одну ссылку.',limit:'За один раз можно проверить до 10 ссылок.',select:'Выберите вариант каждого товара.',openStore:'Открыть магазин',option:'Вариант',chooseOne:'Выберите',standard:'Стандартный',checkingProgress:(done:number,total:number)=>`Проверено ссылок: ${done} из ${total}`,addingProgress:(done:number,total:number)=>`Добавлено товаров: ${done} из ${total}`,checked:'Проверено',problem:'Проблема',addedItem:'Добавлено',failedItem:'Не добавлено',missingData:'Магазин не отдал название, цену или страну — попробуйте добавить товар через обычный импорт.',missingPrice:'Нет цены выбранного варианта.',outOfStock:'Этот вариант больше не отмечен как доступный.',partial:(done:number,total:number)=>`В корзину добавлено ${done} из ${total}. Проверьте оставшиеся товары ниже.`,noneAdded:'Ничего не добавлено. Проверьте варианты и повторите попытку.'}:{login:isUzbek(locale)?uzText(locale, 'Ro‘yxatni import qilish uchun kiring'):'Sign in to import a list',loginHint:isUzbek(locale)?uzText(locale, 'Partiya va tekshiruv natijalari profilingizda saqlanadi.'):'The batch and review results are saved to your profile.',open:isUzbek(locale)?uzText(locale, 'Kirishni ochish'):'Open sign in',over:isUzbek(locale)?uzText(locale, 'BIR NECHTA TOVAR'):'MULTIPLE ITEMS',title:isUzbek(locale)?uzText(locale, 'Havolalarni yuklang va variantlarni tanlang'):'Load links and choose options',intro:isUzbek(locale)?uzText(locale, 'Atlas avval narx, surat va variantlarni ko‘rsatadi. Tanlovingizsiz hech narsa savatga tushmaydi.'):'Atlas shows price, photos and options first. Nothing enters the cart without your choice.',links:isUzbek(locale)?uzText(locale, 'Tovar havolalari'):'Item links',check:isUzbek(locale)?uzText(locale, 'Tovarlarni tekshirish'):'Check items',checking:isUzbek(locale)?uzText(locale, 'Tekshirilmoqda…'):'Checking…',choose:isUzbek(locale)?uzText(locale, 'Variantlarni tanlang'):'Choose options',server:isUzbek(locale)?uzText(locale, 'Qo‘shishda Atlas narx, valyuta va tanlangan variantni tekshiradi.'):'When added, Atlas checks the price, currency and selected option.',addSelected:isUzbek(locale)?uzText(locale, 'Tanlanganlarni qo‘shish'):'Add selected',added:isUzbek(locale)?uzText(locale, 'Tanlangan tovarlar savatga qo‘shildi.'):'Selected items were added to the cart.',one:isUzbek(locale)?uzText(locale, 'Kamida bitta havola kiriting.'):'Paste at least one link.',limit:isUzbek(locale)?uzText(locale, 'Bir martada 10 tagacha havolani tekshirish mumkin.'):'You can check up to 10 links at a time.',select:isUzbek(locale)?uzText(locale, 'Har bir tovar uchun variant tanlang.'):'Choose an option for every item.',openStore:isUzbek(locale)?uzText(locale, 'Do‘konni ochish'):'Open store',option:isUzbek(locale)?uzText(locale, 'Variant'):'Option',chooseOne:isUzbek(locale)?uzText(locale, 'Tanlang'):'Choose',standard:isUzbek(locale)?uzText(locale, 'Standart'):'Standard',checkingProgress:(done:number,total:number)=>isUzbek(locale)?uzText(locale, `Tekshirildi: ${done}/${total}`):`Checked: ${done} of ${total}`,addingProgress:(done:number,total:number)=>isUzbek(locale)?uzText(locale, `Savatga qo‘shildi: ${done}/${total}`):`Added to cart: ${done} of ${total}`,checked:isUzbek(locale)?uzText(locale, 'Tekshirildi'):'Checked',problem:isUzbek(locale)?uzText(locale, 'Muammo'):'Issue',addedItem:isUzbek(locale)?uzText(locale, 'Qo‘shildi'):'Added',failedItem:isUzbek(locale)?uzText(locale, 'Qo‘shilmadi'):'Not added',missingData:isUzbek(locale)?uzText(locale, 'Do‘kon nom, narx yoki mamlakatni bermadi — oddiy import orqali qo‘shib ko‘ring.'):'The store did not return a name, price or country. Try the standard import.',missingPrice:isUzbek(locale)?uzText(locale, 'Tanlangan variant narxi yo‘q.'):'No price is available for the selected option.',outOfStock:isUzbek(locale)?uzText(locale, 'Bu variant endi mavjud deb ko‘rsatilmagan.'):'This option is no longer marked as available.',partial:(done:number,total:number)=>isUzbek(locale)?uzText(locale, `${total} tadan ${done} tasi savatga qo‘shildi. Qolganlarini quyida tekshiring.`):`${done} of ${total} items were added. Review the remaining items below.`,noneAdded:isUzbek(locale)?uzText(locale, 'Hech narsa qo‘shilmadi. Variantlarni tekshirib, qayta urinib ko‘ring.'):'Nothing was added. Check the options and try again.'};
  // How many links the field holds right now: the check takes up to 10 at a time (the limit in run() stays).
  const limitCopy=pickLocale({ru:{count:(n:number)=>`${n} из 10 ссылок`,tooMany:(k:number)=>`Можно до 10 ссылок за раз — уберите ${k}`,storePrice:'цена магазина'},uz:{count:(n:number)=>`10 tadan ${n} ta havola`,tooMany:(k:number)=>`Bir martada 10 tagacha havola — ${k} tasini olib tashlang`,storePrice:'do‘kon narxi'},en:{count:(n:number)=>`${n} of 10 links`,tooMany:(k:number)=>`Up to 10 links at a time — remove ${k}`,storePrice:'store price'}},locale);
  const optionCopy=pickLocale({
    ru:{currency:'Магазин не подтвердил валюту товара. Попробуйте обычный импорт.',option:'Магазин не дал варианта для заказа. Попробуйте обычный импорт.',unknownStock:'Наличие уточняется'},
    uz:{currency:'Do‘kon tovar valyutasini tasdiqlamadi. Oddiy importni sinab ko‘ring.',option:'Do‘kon buyurtma uchun variant bermadi. Oddiy importni sinab ko‘ring.',unknownStock:'Mavjudligi aniqlanmoqda'},
    en:{currency:'The store did not confirm the currency. Try the standard import.',option:'The store did not return an option for this item. Try the standard import.',unknownStock:'Stock to be confirmed'},
  },locale);
  const issueText={data:c.missingData,currency:optionCopy.currency,option:optionCopy.option,stock:c.outOfStock,price:c.missingPrice};
  const [urls,setUrls]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<{notes:string[];importFailures:string[]}>({notes:[],importFailures:[]}),[candidates,setCandidates]=useState<Candidate[]>([]),[progress,setProgress]=useState<{stage:'checking'|'adding';done:number;total:number}|null>(null);
 const linkCount=useMemo(()=>parseCatalogImportQueue(urls).links.length,[urls]);
 async function run(){
  if(busy||!ready)return;const links=parseCatalogImportQueue(urls).links;
  if(!links.length){toast.error(c.one);return}if(links.length>10){toast.error(c.limit);return}
   setBusy(true);setProgress({stage:'checking',done:0,total:links.length});setResult({notes:[],importFailures:[]});setCandidates([]);
   // Every link is checked at the same time; notes and candidates keep the pasted order.
   const outcomes:({candidate:Candidate;note:string}|{note:string})[]=new Array(links.length);let done=0;
   const publish=()=>{
    const settled=outcomes.filter(Boolean);
    setResult({notes:settled.map(item=>item.note),importFailures:settled.filter(item=>!('candidate' in item)).map(item=>item.note)});
    setProgress({stage:'checking',done,total:links.length});
   };
   try{
    await Promise.all(links.map(async(url,index)=>{
     try{
      const response=await requestImport({url},{maxWaitMs:2*60_000});
      const data=await response.json() as BatchImportSource&{error?:string};
      if(!response.ok)throw Error(data.error??c.missingData);
      if(!data.title?.trim()||!data.country?.trim())throw Error(c.missingData);
      const currency=batchCurrency(data.currency);
      if(!currency||!pricing.rates[currency])throw Error(optionCopy.currency);
      const choices=batchOptions(data);
      if(!choices.length)throw Error(optionCopy.option);
      const selectable=choices.flatMap((choice,index)=>choice.orderable&&choice.price!==undefined?[index]:[]);
      if(!selectable.length)throw Error(choices.some(choice=>choice.orderable)?c.missingPrice:c.outOfStock);
      outcomes[index]={candidate:{key:crypto.randomUUID(),data,selected:selectable.length===1?selectable[0]:null},note:`${c.checked}: ${data.title}`};
     }
     catch(error){outcomes[index]={note:`${c.problem}: ${url} — ${(error as Error).message}`}}
     done++;publish();
    }));
    const next=outcomes.flatMap(item=>'candidate' in item?[item.candidate]:[]);
    setCandidates(next);if(next.length)toast.success(c.select)
   }finally{setBusy(false);setProgress(null)}
 }
 function choose(key:string,selected:number|null){setCandidates(items=>items.map(item=>item.key===key?{...item,selected}:item))}
 async function addSelected(){
   if(busy||!ready||!candidates.length)return;if(candidates.some(item=>item.selected===null)){toast.error(c.select);return}
   setBusy(true);setProgress({stage:'adding',done:0,total:candidates.length});const notes:string[]=[],added=new Set<string>();
   try{
    for(const [index,item] of candidates.entries()){
     try{
      const choice=batchCartProduct(item.data,item.selected,pricing);
      if('error' in choice)throw Error(issueText[choice.error]);
      const ok=await act({type:'cart-add',...choice});
      if(ok){
       added.add(item.key);
       notes.push(`${c.addedItem}: ${choice.product.name} · ${choice.variant}`);
      }else{
       const reason=lastActionError()?.message;
       notes.push(`${c.failedItem}: ${choice.product.name} · ${choice.variant}${reason?` — ${reason}`:''}`);
      }
     }catch(error){notes.push(`${c.problem}: ${item.data.title} — ${(error as Error).message}`)}
     setResult({...result,notes:[...result.importFailures,...notes]});
     setProgress({stage:'adding',done:index+1,total:candidates.length});
    }
    setCandidates(items=>items.filter(item=>!added.has(item.key)));
    if(added.size===candidates.length&&!result.importFailures.length)window.location.assign('/cart');
    else if(added.size)toast.success(c.partial(added.size,candidates.length+result.importFailures.length));
    else toast.warning(c.noneAdded);
   }finally{setBusy(false);setProgress(null)}
 }
 if(!ready)return <Empty title={c.login} description={c.loginHint} href="/account" label={c.open}/>;
 return <>
  <PageHeading overline={c.over} title={c.title} description={c.intro}/>
  <section className="surface batch-import">
   <div className="paste-field-head">
    <label className="field" htmlFor="batch-urls">{c.links}</label>
    <PasteButton targetId="batch-urls" locale={locale} disabled={busy} multiline onPaste={setUrls}/>
   </div>
   <textarea id="batch-urls" disabled={busy} rows={5} value={urls} onChange={e=>setUrls(e.target.value)} placeholder={'https://www.zara.com/...\nhttps://www.amazon.com/...'}/>
   <p className={linkCount>10?'micro batch-link-count is-over':'micro batch-link-count'} aria-live="polite">{linkCount>10?limitCopy.tooMany(linkCount-10):limitCopy.count(linkCount)}</p>
   <button className="btn primary" disabled={busy||!urls.trim()||linkCount>10} onClick={()=>void run()}>
    {progress?.stage==='checking'?<><Loader2 className="spin"/>{c.checking}</>:<><ListPlus/>{c.check}</>}
   </button>
   {progress&&<p className="micro" role="status" aria-live="polite">{progress.stage==='checking'?c.checkingProgress(progress.done,progress.total):c.addingProgress(progress.done,progress.total)}</p>}
   {result.notes.length>0&&<ul className="batch-result" aria-live="polite">{result.notes.map((line,index)=><li key={index}>{line}</li>)}</ul>}
  </section>
  {candidates.length>0&&<section className="surface batch-review">
   <div className="admin-section-head">
    <div><h2>{c.choose}</h2><p>{c.server}</p></div>
    <button className="btn primary" disabled={busy||candidates.some(item=>item.selected===null)} onClick={()=>void addSelected()}>
     {progress?.stage==='adding'?<><Loader2 className="spin"/>{c.addingProgress(progress.done,progress.total)}</>:<><ShoppingBag/>{c.addSelected}</>}
    </button>
   </div>
   <div className="batch-candidates">
    {candidates.map(item=><CandidateRow key={item.key} item={item} onChange={value=>choose(item.key,value)} locale={locale} busy={busy} labels={{...c,storePrice:limitCopy.storePrice,unknownStock:optionCopy.unknownStock}}/>)}
   </div>
  </section>}
 </>;
}

function CandidateRow({item,onChange,locale,busy,labels}:{item:Candidate;onChange:(value:number|null)=>void;locale:Locale;busy:boolean;labels:{openStore:string;option:string;chooseOne:string;outOfStock:string;storePrice:string;missingPrice:string;unknownStock:string}}){
 const {data,selected}=item;
 const choices=batchOptions(data);
 const currency=batchCurrency(data.currency);
 const selectedVariant=selected===null?undefined:choices[selected]?.variant;
 const image=batchOptionGallery(data,selectedVariant)[0];
 return <article className="batch-candidate">
  {image?<img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"/>:<span className="batch-no-image"/>}
  <div className="batch-candidate-info">
   <b>{data.title}</b><small>{data.brand??new URL(data.sourceUrl).hostname} · {currency}</small>
   <a href={variantSourceUrl(data.sourceUrl,selectedVariant)} target="_blank" rel="noopener noreferrer">{labels.openStore} <ExternalLink size={14}/></a>
  </div>
  <label><span>{labels.option} · {labels.storePrice}</span>
   <select value={selected??""} disabled={busy} onChange={event=>onChange(event.target.value===""?null:Number(event.target.value))}>
    <option value="">{labels.chooseOne}</option>
    {choices.map(({variant,price,orderable},index)=>{
      const sameLabel=choices.some(other=>other.variant!==variant&&other.variant.label===variant.label);
      const details=sameLabel?[variant.sellerId,variant.offerId??variant.id].filter(Boolean).join(' · '):'';
      const stock=!orderable?labels.outOfStock:isStockUnconfirmed(variant)?labels.unknownStock:'';
      const amount=price===undefined||!currency?labels.missingPrice:formatStorePrice(price,currency,locale);
      return <option key={index} value={index} disabled={!orderable||price===undefined}>{[variant.label,details,amount,stock].filter(Boolean).join(' · ')}</option>;
    })}
   </select>
  </label>
  {selected!==null?<Check aria-label={locale==='ru'?'Выбрано':isUzbek(locale)?uzText(locale, 'Tanlandi'):'Selected'}/>:<span/>}
 </article>;
}
