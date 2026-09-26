'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Package,X,ChevronRight,ArrowUpRight} from 'lucide-react';
import Link from '@/components/site-link';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import {money,type Product,type Quote} from '@/lib/market/domain';
export function Choice({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:string[];label:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="select-control"><SelectValue>{value}</SelectValue></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>}
export function ProductImage({product,className='',decorative=false,locale='ru'}:{product:Product;className?:string;decorative?:boolean;locale?:'ru'|'uz'|'en'}){
 const [failedImage,setFailedImage]=useState('');
 const label=locale==='ru'?'Товар по ссылке':locale==='uz'?'Havoladagi tovar':'Linked item';
 if(!product.image||product.image===failedImage)return <div className={'no-photo '+className}><Package size={35}/><span>{label}</span></div>;
 // Dynamic store images are displayed without proxying or optimization.
 // eslint-disable-next-line @next/next/no-img-element
 return <img className={'product-img '+className} src={product.image} onError={()=>setFailedImage(product.image)} alt={decorative?'':product.name} loading="lazy" referrerPolicy="no-referrer"/>;
}
export function PageHeading({overline,title,description,children}:{overline:string;title:string;description:string;children?:ReactNode}){return <div className="page-heading"><div><div className="eyebrow">{overline}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>}
export function Empty({title,description,href,label,children}:{title:string;description:string;href?:string;label?:string;children?:ReactNode}){return <div className="empty-state"><span className="empty-icon"><Package size={30}/></span><h2>{title}</h2><p>{description}</p>{href&&<Link href={href} className="btn primary">{label??'В каталог'}<ArrowUpRight size={18}/></Link>}{children}</div>}
export function Modal({open,onClose,title,description,children,locale='ru'}:{open:boolean;onClose:()=>void;title:string;description:string;children:ReactNode;locale?:'ru'|'uz'|'en'}){return <Dialog open={open} onOpenChange={v=>{if(!v)onClose()}}><DialogContent className="atlas-modal" showCloseButton={false}><DialogClose asChild><button className="icon-btn modal-close" aria-label={{ru:'Закрыть',uz:'Yopish',en:'Close'}[locale]}><X size={20}/></button></DialogClose><DialogTitle className="modal-title">{title}</DialogTitle><DialogDescription>{description}</DialogDescription>{children}</DialogContent></Dialog>}
export function CostLines({ q, shippingUnknown = false, locale = "ru" }: { q: Pick<Quote, "merchandise" | "service" | "shipping" | "reserve" | "sourceShipping" | "buyout" | "conversion" | "deliveryMargin" | "optionalServices">; shippingUnknown?: boolean; locale?: "ru" | "uz" | "en" }) {
  const copy = {
    ru: { labels: ["Товар", "Доставка магазина", "Сервис Atlas", "Выкуп", "Конвертация", "Международная доставка", "Маржа доставки", "Общий сбор Atlas", "Возвратный резерв"], unknown: "Уточняется", free: "Бесплатно" },
    uz: { labels: ["Tovar", "Do‘kon yetkazishi", "Atlas xizmati", "Xarid komissiyasi", "Konvertatsiya", "Xalqaro yetkazish", "Yetkazish marjasi", "Atlas umumiy yig‘imi", "Qaytariladigan zaxira"], unknown: "Aniqlanmoqda", free: "Bepul" },
    en: { labels: ["Item", "Store delivery", "Atlas service", "Purchase fee", "Conversion", "International delivery", "Delivery margin", "General Atlas fee", "Refundable reserve"], unknown: "To be confirmed", free: "Free" },
  }[locale];
  const rows = [
    [copy.labels[0], q.merchandise], [copy.labels[1], q.sourceShipping ?? 0], [copy.labels[2], q.service],
    [copy.labels[3], q.buyout ?? 0], [copy.labels[4], q.conversion ?? 0], [copy.labels[5], q.shipping],
    [copy.labels[6], q.deliveryMargin ?? 0], [copy.labels[7], q.optionalServices ?? 0], [copy.labels[8], q.reserve],
  ];
  return <dl className="cost-lines">{rows.filter(([label, value]) => Number(value) > 0 || label === copy.labels[0] || label === copy.labels[1]).map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{shippingUnknown && label === copy.labels[1] ? copy.unknown : label === copy.labels[1] && Number(value) === 0 ? copy.free : money(Number(value))}</dd></div>)}</dl>;
}
export function Expiry({expiresAt,locale='ru'}:{expiresAt:number;locale?:'ru'|'uz'|'en'}){const [now,setNow]=useState(0);useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);const c=locale==='ru'?{checking:'Проверяем срок расчёта…',active:'Расчёт действует',expired:'Расчёт истёк'}:locale==='uz'?{checking:'Hisob muddati tekshirilmoqda…',active:'Hisob amal qiladi',expired:'Hisob muddati tugadi'}:{checking:'Checking estimate validity…',active:'Estimate valid for',expired:'Estimate expired'};if(!now)return <span className="expiry">{c.checking}</span>;const seconds=Math.max(0,Math.floor((expiresAt-now)/1000));return <span className={seconds?'expiry':'expiry expired'}>{seconds?c.active+' '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):c.expired}</span>}
export function SectionLink({href,children}:{href:string;children:ReactNode}){return <Link className="text-link" href={href}>{children}<ChevronRight size={17}/></Link>}
