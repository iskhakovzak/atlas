'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Package,X,ChevronRight,ArrowUpRight,CircleHelp} from 'lucide-react';
import Link from '@/components/site-link';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from '@/components/ui/dialog';
import {money,type Product,type Quote} from '@/lib/market/domain';
import {atlasServiceBreakdown,atlasServiceTotal} from '@/lib/market/quote-presentation';
export function Choice({value,onChange,options,label,disabled=false,className=''}:{value:string;onChange:(v:string)=>void;options:string[];label:string;disabled?:boolean;className?:string}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className={`select-control ${className}`.trim()}><SelectValue>{value}</SelectValue></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>}
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
export function CostLines({ q, shippingUnknown = false, locale = "ru", internationalHelp }: { q: Pick<Quote, "merchandise" | "service" | "shipping" | "reserve" | "sourceShipping" | "buyout" | "conversion" | "deliveryMargin" | "optionalServices">; shippingUnknown?: boolean; locale?: "ru" | "uz" | "en"; internationalHelp?: string }) {
  const copy = {
    ru: { item: "Товар", merchantShipping: "Доставка магазина", service: "Сервис Atlas", international: "Международная доставка", optional: "Общий сбор Atlas", reserve: "Возвратный резерв", breakdown: "Состав сервиса", help: "Как считается международная доставка", reserveHelp: "Резерв рассчитан с запасом до уточнения веса и габаритов посылки. Если международная доставка после проверки выйдет дешевле, разницу зачислим на внутренний баланс Atlas. Если дороже — сначала сообщим сумму и запросим ваше согласие на доплату. Это не окончательная цена перевозчика.", reserveHelpLabel: "О возвратном резерве", unknown: "Уточняется", free: "Бесплатно" },
    uz: { item: "Tovar", merchantShipping: "Do‘kon yetkazishi", service: "Atlas xizmati", international: "Xalqaro yetkazish", optional: "Atlas umumiy yig‘imi", reserve: "Qaytariladigan zaxira", breakdown: "Xizmat tarkibi", help: "Xalqaro yetkazish qanday hisoblanadi", reserveHelp: "Zaxira jo‘natma vazni va o‘lchamlari aniqlanguncha hisobga olingan. Tekshiruvdan keyin xalqaro yetkazish arzonroq bo‘lsa, farq Atlas ichki balansiga qaytariladi. Qimmatroq bo‘lsa, avval summa aytiladi va qo‘shimcha to‘lov uchun roziligingiz so‘raladi. Bu tashuvchining yakuniy narxi emas.", reserveHelpLabel: "Qaytariladigan zaxira haqida", unknown: "Aniqlanmoqda", free: "Bepul" },
    en: { item: "Item", merchantShipping: "Store delivery", service: "Atlas service", international: "International delivery", optional: "General Atlas fee", reserve: "Refundable reserve", breakdown: "Service breakdown", help: "How international delivery is estimated", reserveHelp: "This reserve allows for the parcel’s weight and dimensions to be confirmed. If international delivery is lower after checking, the difference is credited to your Atlas balance. If it is higher, we will tell you the amount and ask for your approval before any additional payment. This is not a carrier’s final price.", reserveHelpLabel: "About the refundable reserve", unknown: "To be confirmed", free: "Free" },
  }[locale];
  const breakdown = atlasServiceBreakdown(q);
  const serviceParts = [
    { key: "service", label: copy.service, amount: breakdown.service },
    { key: "international", label: copy.international, amount: breakdown.international },
  ];
  const serviceTotal = atlasServiceTotal(q);
  return <dl className="cost-lines">
    <div><dt>{copy.item}</dt><dd>{money(q.merchandise)}</dd></div>
    <div><dt>{copy.merchantShipping}</dt><dd>{shippingUnknown ? copy.unknown : q.sourceShipping ? money(q.sourceShipping) : copy.free}</dd></div>
    {serviceTotal > 0 && <div className="cost-service-row">
      <dt>{copy.service}</dt>
      <dd>
        <span className="cost-service-total">{money(serviceTotal)}</span>
        <details className="cost-service-breakdown">
          <summary>{copy.breakdown}</summary>
          <dl>{serviceParts.filter(part => part.amount > 0).map(part => <div key={part.key}>
            <dt>{part.label}</dt>
            <dd>
              <span>{money(part.amount)}</span>
              {part.key === "international" && internationalHelp && <details className="quote-cost-help">
                <summary aria-label={copy.help} title={copy.help}><CircleHelp size={16}/></summary>
                <div className="quote-cost-help-popover"><p>{internationalHelp}</p></div>
              </details>}
            </dd>
          </div>)}</dl>
        </details>
      </dd>
    </div>}
    {(q.optionalServices ?? 0) > 0 && <div><dt>{copy.optional}</dt><dd>{money(q.optionalServices ?? 0)}</dd></div>}
    {q.reserve > 0 && <div className="cost-reserve-row"><dt>{copy.reserve}</dt><dd><span>{money(q.reserve)}</span><details className="quote-cost-help reserve-cost-help">
      <summary aria-label={copy.reserveHelpLabel} title={copy.reserveHelpLabel}><CircleHelp size={16}/></summary>
      <div className="quote-cost-help-popover"><p>{copy.reserveHelp}</p></div>
    </details></dd></div>}
  </dl>;
}
export function Expiry({expiresAt,locale='ru'}:{expiresAt:number;locale?:'ru'|'uz'|'en'}){const [now,setNow]=useState(0);useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);const c=locale==='ru'?{checking:'Проверяем срок расчёта…',active:'Расчёт действует',expired:'Расчёт истёк'}:locale==='uz'?{checking:'Hisob muddati tekshirilmoqda…',active:'Hisob amal qiladi',expired:'Hisob muddati tugadi'}:{checking:'Checking estimate validity…',active:'Estimate valid for',expired:'Estimate expired'};if(!now)return <span className="expiry">{c.checking}</span>;const seconds=Math.max(0,Math.floor((expiresAt-now)/1000));return <span className={seconds?'expiry':'expiry expired'}>{seconds?c.active+' '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):c.expired}</span>}
export function SectionLink({href,children}:{href:string;children:ReactNode}){return <Link className="text-link" href={href}>{children}<ChevronRight size={17}/></Link>}
