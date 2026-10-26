'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Package,ChevronRight,ArrowUpRight} from 'lucide-react';
import Link from '@/components/site-link';
// The window (Radix Dialog) lives in app/modal.tsx, so pages without one do not load it.
import {type Product} from '@/lib/market/domain';
import {uzText} from '@/lib/market/uz-cyrl';
import {isUzbek,type Locale} from '@/lib/market/i18n';
import {retryOriginal,sizedImage,sizedSrcSet} from '@/lib/market/image-size';
/** `size`: about how many pixels wide the store should send the photo (twice the largest box it fills, for sharp phone screens). */
export function ProductImage({product,className='',decorative=false,locale='ru',size=600}:{product:Product;className?:string;decorative?:boolean;locale?:Locale;size?:number}){
 const [failedImage,setFailedImage]=useState('');
 const label=locale==='ru'?'Товар по ссылке':isUzbek(locale)?uzText(locale, 'Havoladagi tovar'):'Linked item';
 if(!product.image||product.image===failedImage)return <div className={'no-photo '+className}><Package size={35}/><span>{label}</span></div>;
 // Store images load straight from the store, asked at about `size` pixels where its image server allows (lib/market/image-size.ts).
 // A photo still on its way fades in when it arrives (app/motion.css); one already loaded or cached shows at once.
 // `sizes="auto"`: a lazy image picks from srcset by the box it actually gets (Chromium); others take the `size` copy as before.
 // eslint-disable-next-line @next/next/no-img-element
 return <img className={'product-img '+className} src={sizedImage(product.image,size)} srcSet={sizedSrcSet(product.image,size)} sizes={`auto, ${size}px`} onError={event=>{if(!retryOriginal(event.currentTarget,product.image))setFailedImage(product.image)}} alt={decorative?'':product.name} loading="lazy" decoding="async" referrerPolicy="no-referrer"
  ref={image=>{if(image&&!image.complete)image.dataset.fade=''}} onLoad={event=>{delete event.currentTarget.dataset.fade}}/>;
}
export function PageHeading({overline,title,description,children}:{overline:string;title:string;description:string;children?:ReactNode}){return <div className="page-heading"><div><div className="eyebrow">{overline}</div><h1>{title.replace(/\.$/,'')}</h1><p>{description}</p></div>{children}</div>}
export function Empty({title,description,href,label,children}:{title:string;description:string;href?:string;label?:string;children?:ReactNode}){return <div className="empty-state"><span className="empty-icon"><Package size={30}/></span><h2>{title}</h2><p>{description}</p>{href&&<Link href={href} className="btn primary">{label??'В каталог'}<ArrowUpRight size={18}/></Link>}{children}</div>}
/** Loading placeholder: shimmering cards in the shape of the page's list, with the text for screen readers only. */
/**
 * Placeholders shaped like the page that is loading, so nothing jumps when it arrives: `basket` — cart lines (photo, name,
 * price, controls) and the total; `order` — order cards (number and status, progress, sum); `list` — plain rows.
 */
export function LoadingCards({label,rows=3,shape='list'}:{label:string;rows?:number;shape?:'list'|'basket'|'order'}){
 const items=Array.from({length:rows},(_,index)=>index);
 if(shape==='basket')return <div className="atlas-skeleton sk-basket" role="status" aria-live="polite"><span className="sr-only">{label}</span>
  <div className="sk-basket-lines" aria-hidden="true">{items.map(index=><div key={index} className="atlas-skeleton-card sk-basket-line"><i/><span><b/><b/><b/></span><em/></div>)}</div>
  <div className="atlas-skeleton-card sk-basket-total" aria-hidden="true"><span><b/><b/><b/></span><u/></div>
 </div>;
 if(shape==='order')return <div className="atlas-skeleton sk-orders" role="status" aria-live="polite"><span className="sr-only">{label}</span>
  {items.map(index=><div key={index} className="atlas-skeleton-card sk-order" aria-hidden="true"><span><b/><b/></span><em/><s/><span><b/><b/></span></div>)}
 </div>;
 return <div className="atlas-skeleton" role="status" aria-live="polite"><span className="sr-only">{label}</span>{items.map(index=><div key={index} className="atlas-skeleton-card" aria-hidden="true"><i/><span><b/><b/><b/></span></div>)}</div>}
export function Expiry({expiresAt,locale='ru'}:{expiresAt:number;locale?:Locale}){const [now,setNow]=useState(0);useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);const c=locale==='ru'?{checking:'Проверяем срок расчёта…',active:'Расчёт действует',expired:'Расчёт истёк'}:isUzbek(locale)?uzText(locale, {checking:'Hisob muddati tekshirilmoqda…',active:'Hisob amal qiladi',expired:'Hisob muddati tugadi'}):{checking:'Checking estimate validity…',active:'Estimate valid for',expired:'Estimate expired'};if(!now)return <span className="expiry">{c.checking}</span>;const seconds=Math.max(0,Math.floor((expiresAt-now)/1000));return <span className={seconds?'expiry':'expiry expired'}>{seconds?c.active+' '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):c.expired}</span>}
export function SectionLink({href,children}:{href:string;children:ReactNode}){return <Link className="text-link" href={href}>{children}<ChevronRight size={17}/></Link>}

/** The store's price before its discount, crossed out, then the percentage off: "125 $ −41%". Display only. */
export function WasPrice({was,percent,format}:{was:number;percent:number;format:(value:number)=>string}){
 return <span className="price-was-group"><del className="price-was">{format(was)}</del><span className="price-off">−{percent}%</span></span>;
}
