"use client";
/* eslint-disable @next/next/no-img-element */
import {useState} from "react";
import {Check,ExternalLink,ListPlus,Loader2,ShoppingBag} from "lucide-react";
import {toast} from "sonner";
import {useMarket} from "@/lib/market/store";
import {safeImage,inferProductCategory,type Extracted,type ProductVariant} from "@/lib/importer/extract";
import {currencies,toUsd,paddedWeight} from "@/lib/market/world";
import {type Product} from "@/lib/market/domain";
import {Empty,PageHeading} from "./market-ui";

const weights:Record<string,number>={"Обувь":1.3,"Одежда":0.6,"Электроника":1,"Аксессуары":0.7,"Красота и уход":0.6,"Дом и быт":2,"Спорт":1,"Другое":1.5};
type Candidate={key:string;data:Extracted&{fetchedAt?:number;expiresAt?:number};selected:string};

export function BatchImportView(){
 const {ready,pricing,act}=useMarket();
 const [urls,setUrls]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState<string[]>([]),[candidates,setCandidates]=useState<Candidate[]>([]);
 async function run(){
  if(busy||!ready)return;const links=[...new Set(urls.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];
  if(!links.length){toast.error('Вставьте хотя бы одну ссылку.');return}if(links.length>10){toast.error('За один раз можно проверить до 10 ссылок.');return}
  setBusy(true);setResult([]);setCandidates([]);const notes:string[]=[],next:Candidate[]=[];
  for(const url of links){try{const response=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});const data=await response.json() as Candidate['data']&{error?:string};if(!response.ok)throw Error(data.error??'Не удалось получить данные.');const available=(data.variants??[]).filter(v=>v.available);if(!data.title||!data.country||(data.price===undefined&&!available.some(v=>v.price!==undefined)))throw Error('Магазин не отдал название, цену или страну — добавьте товар через обычный импорт.');next.push({key:crypto.randomUUID(),data,selected:available.length===1?available[0].label:''});notes.push(`Проверено: ${data.title}`)}catch(error){notes.push(`Проблема: ${url} — ${(error as Error).message}`)}}
  setCandidates(next);setResult(notes);setBusy(false);if(next.length)toast.success('Товары загружены. Выберите вариант каждого товара.');
 }
 function choose(key:string,selected:string){setCandidates(items=>items.map(item=>item.key===key?{...item,selected}:item))}
 async function addSelected(){
  if(candidates.some(item=>!item.selected)){toast.error('Выберите вариант каждого товара.');return}
  setBusy(true);const notes:string[]=[],added=new Set<string>();
  for(const item of candidates){const data=item.data,available=data.variants?.filter(v=>v.available)??[],chosen=available.find(v=>v.label===item.selected);try{const category=data.category??inferProductCategory(data.title??'',data.brand??'');const currency=currencies.includes(data.currency??'')?data.currency!:'USD';const currentPrice=chosen?.price??data.price;if(currentPrice===undefined)throw Error('Нет цены выбранного варианта.');const sourceShipping=data.shipping??10;const shippingCurrency=currencies.includes(data.shippingCurrency??'')?data.shippingCurrency!:currency;const boxedWeight=data.boxedWeight??weights[category]??1.5;const image=safeImage(chosen?.image??data.image??'',data.sourceUrl)??'';const product:Product={id:data.sourceUrl+'#'+item.selected,name:data.title!,brand:data.brand??new URL(data.sourceUrl).hostname,category,usd:toUsd(currentPrice,currency,pricing.rates),weight:paddedWeight(boxedWeight),image,sourceUrl:data.sourceUrl,sourceVariantId:chosen?.id,variants:[item.selected],country:data.country,sourceCurrency:currency,sourcePrice:currentPrice,sourceShipping,sourceShippingCurrency:shippingCurrency,sourceShippingUsd:toUsd(sourceShipping,shippingCurrency,pricing.rates),sourceShippingEstimated:data.shipping===undefined,shippingKnown:true,boxedWeight,weightOrigin:data.boxedWeight?'со страницы магазина':'оценка по категории',importedAt:data.fetchedAt,sourceExpiresAt:data.expiresAt,declarationDescription:data.declarationDescription};const ok=await act({type:'cart-add',product,variant:item.selected});if(ok)added.add(item.key);notes.push(ok?`Добавлено: ${product.name}`:`Не добавлено: ${product.name}`)}catch(error){notes.push(`Проблема: ${data.title} — ${(error as Error).message}`)}}
  setResult(notes);setCandidates(items=>items.filter(item=>!added.has(item.key)));setBusy(false);if(added.size)toast.success('Выбранные товары добавлены в корзину.');
 }
 if(!ready)return <Empty title="Войдите, чтобы импортировать список" description="Партия и результаты проверки сохраняются в вашем профиле." href="/account" label="Открыть вход"/>;
 return <><PageHeading overline="НЕСКОЛЬКО ТОВАРОВ" title="Загрузите ссылки и выберите варианты" description="Atlas сначала покажет цену, фото и доступные варианты. Ничего не попадёт в корзину без вашего выбора."/><section className="surface batch-import"><label className="field" htmlFor="batch-urls">Ссылки на товары</label><textarea id="batch-urls" rows={8} value={urls} onChange={e=>setUrls(e.target.value)} placeholder={'https://www.zara.com/...\nhttps://www.amazon.com/...'}/><button className="btn primary" disabled={busy||!urls.trim()} onClick={()=>void run()}>{busy?<Loader2 className="spin"/>:<ListPlus/>}{busy?'Проверяем…':'Проверить товары'}</button>{result.length>0&&<ul className="batch-result">{result.map((line,index)=><li key={index}>{line}</li>)}</ul>}</section>{candidates.length>0&&<section className="surface batch-review"><div className="admin-section-head"><div><h2>Выберите варианты</h2><p>Цена и наличие ещё раз проверятся сервером при добавлении.</p></div><button className="btn primary" disabled={busy||candidates.some(item=>!item.selected)} onClick={()=>void addSelected()}><ShoppingBag/>Добавить выбранные</button></div><div className="batch-candidates">{candidates.map(item=><CandidateRow key={item.key} item={item} onChange={value=>choose(item.key,value)}/>)}</div></section>}</>;
}

function CandidateRow({item,onChange}:{item:Candidate;onChange:(value:string)=>void}){const data=item.data,available=(data.variants??[]).filter(v=>v.available);const choices:ProductVariant[]=available.length?available:[{label:'Стандартный',available:true,price:data.price,image:data.image}];return <article className="batch-candidate">{data.image?<img src={data.image} alt=""/>:<span className="batch-no-image"/>}<div className="batch-candidate-info"><b>{data.title}</b><small>{data.brand??new URL(data.sourceUrl).hostname} · {data.currency}</small><a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">Открыть магазин <ExternalLink size={13}/></a></div><label><span>Вариант</span><select value={item.selected} onChange={event=>onChange(event.target.value)}><option value="">Выберите</option>{choices.map(choice=><option key={choice.id??choice.label} value={choice.label}>{choice.label}{choice.price!==undefined?` · ${choice.price} ${data.currency}`:''}</option>)}</select></label>{item.selected?<Check aria-label="Выбрано"/>:<span/>}</article>}
