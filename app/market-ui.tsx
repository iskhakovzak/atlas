'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Package,X,ChevronRight,ArrowUpRight} from 'lucide-react';
import Link from '@/components/site-link';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import {type Product} from '@/lib/market/domain';
import {pickLocale,uzText} from '@/lib/market/uz-cyrl';
import {isUzbek,type Locale} from '@/lib/market/i18n';
export function ProductImage({product,className='',decorative=false,locale='ru'}:{product:Product;className?:string;decorative?:boolean;locale?:Locale}){
 const [failedImage,setFailedImage]=useState('');
 const label=locale==='ru'?'Товар по ссылке':isUzbek(locale)?uzText(locale, 'Havoladagi tovar'):'Linked item';
 if(!product.image||product.image===failedImage)return <div className={'no-photo '+className}><Package size={35}/><span>{label}</span></div>;
 // Dynamic store images are displayed without proxying or optimization.
 // A photo still on its way fades in when it arrives (app/motion.css); one already loaded or cached shows at once.
 // eslint-disable-next-line @next/next/no-img-element
 return <img className={'product-img '+className} src={product.image} onError={()=>setFailedImage(product.image)} alt={decorative?'':product.name} loading="lazy" decoding="async" referrerPolicy="no-referrer"
  ref={image=>{if(image&&!image.complete)image.dataset.fade=''}} onLoad={event=>{delete event.currentTarget.dataset.fade}}/>;
}
export function PageHeading({overline,title,description,children}:{overline:string;title:string;description:string;children?:ReactNode}){return <div className="page-heading"><div><div className="eyebrow">{overline}</div><h1>{title.replace(/\.$/,'')}</h1><p>{description}</p></div>{children}</div>}
export function Empty({title,description,href,label,children}:{title:string;description:string;href?:string;label?:string;children?:ReactNode}){return <div className="empty-state"><span className="empty-icon"><Package size={30}/></span><h2>{title}</h2><p>{description}</p>{href&&<Link href={href} className="btn primary">{label??'В каталог'}<ArrowUpRight size={18}/></Link>}{children}</div>}
/** Loading placeholder: shimmering cards in the shape of the page's list, with the text for screen readers only. */
export function LoadingCards({label,rows=3}:{label:string;rows?:number}){return <div className="atlas-skeleton" role="status" aria-live="polite"><span className="sr-only">{label}</span>{Array.from({length:rows},(_,index)=><div key={index} className="atlas-skeleton-card" aria-hidden="true"><i/><span><b/><b/><b/></span></div>)}</div>}
export function Modal({open,onClose,title,description,children,locale='ru'}:{open:boolean;onClose:()=>void;title:string;description:string;children:ReactNode;locale?:Locale}){return <Dialog open={open} onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="atlas-modal" showCloseButton={false}><DialogClose asChild><button className="icon-btn modal-close" aria-label={pickLocale({ru:'Закрыть',uz:'Yopish',en:'Close'}, locale)}><X size={20}/></button></DialogClose><DialogTitle className="modal-title">{title}</DialogTitle><DialogDescription>{description}</DialogDescription>{children}</DialogContent></Dialog>}
export function Expiry({expiresAt,locale='ru'}:{expiresAt:number;locale?:Locale}){const [now,setNow]=useState(0);useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);const c=locale==='ru'?{checking:'Проверяем срок расчёта…',active:'Расчёт действует',expired:'Расчёт истёк'}:isUzbek(locale)?uzText(locale, {checking:'Hisob muddati tekshirilmoqda…',active:'Hisob amal qiladi',expired:'Hisob muddati tugadi'}):{checking:'Checking estimate validity…',active:'Estimate valid for',expired:'Estimate expired'};if(!now)return <span className="expiry">{c.checking}</span>;const seconds=Math.max(0,Math.floor((expiresAt-now)/1000));return <span className={seconds?'expiry':'expiry expired'}>{seconds?c.active+' '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):c.expired}</span>}
export function SectionLink({href,children}:{href:string;children:ReactNode}){return <Link className="text-link" href={href}>{children}<ChevronRight size={17}/></Link>}

/** The store's price before its discount, crossed out, then the percentage off: "125 $ −41%". Display only. */
export function WasPrice({was,percent,format}:{was:number;percent:number;format:(value:number)=>string}){
 return <span className="price-was-group"><del className="price-was">{format(was)}</del><span className="price-off">−{percent}%</span></span>;
}
