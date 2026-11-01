'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {CalendarClock,CircleCheck,Info,ShieldCheck} from 'lucide-react';
import {customsDutySoum,type CustomsEstimate,type DeliverySpeed,type Pricing} from '@/lib/market/domain';
import {formatPercent,formatSum,formatUsd} from '@/lib/market/format';
import {calcCopy} from '@/lib/market/calc-copy';
import {productDetailCopy} from '@/lib/market/product-detail-copy';
import type {Locale} from '@/lib/market/i18n';
import type {sumQuotes} from './calc-summary';
import {courierAllowanceUsd} from '@/lib/market/customs';
import {Money} from './money';

/*
 * The one product page (redesign stage 5, 1 November 2026): the catalog sheet, /catalog/p/[id] and /order-by-link all
 * render app/global-link-order.tsx (ProductOrder), which lays its parts out with the blocks below: one big sum in soum,
 * "Из чего сумма" open from the start, a trust row, and "О товаре" / "Доставка" stacked instead of tabs.
 * Every amount comes from the same pricing the server uses (lib/market/domain.ts repriceCart); the server prices again
 * when the item is added.
 */

type Sums=ReturnType<typeof sumQuotes>;
const kgText=(kg:number|undefined,locale:Locale)=>kg?new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{maximumFractionDigits:2}).format(kg):'';

/** The hero number: one big sum in soum, "до Ташкента" under it; "от" before it while no option is chosen. */
export function SumHero({total,from=false,approx=false,pending=false,locale,id}:{total:number|null;from?:boolean;/** A dated price: "≈" before the sum. */approx?:boolean;pending?:boolean;locale:Locale;id?:string}){
 const t=productDetailCopy[locale];
 return <p className="pd-sum" id={id} aria-busy={pending||undefined}>
  {pending?<span className="lo-skel pd-sum-skel" aria-hidden="true"/>:total===null?<strong className="pd-sum-none">—</strong>:<strong>{from&&t.from&&<span className="pd-sum-from">{t.from} </span>}{approx&&<><span className="pd-sum-from" aria-hidden="true">≈ </span><span className="sr-only">{t.approx} </span></>}<Money value={total} locale={locale} animate/>{from&&t.fromAfter&&<span className="pd-sum-from"> {t.fromAfter}</span>}</strong>}
  <span className="pd-sum-note">{t.toTashkent}</span>
 </p>;
}

/**
 * "Из чего сумма": the item, the Atlas service, delivery by the tariff and the duty (or "no duty up to $200"), then the
 * total, open by default. `customs` is the allowance estimate for this item together with the cart; a duty the customer
 * pays at the border is named beside it and is not added in.
 */
export function SumBreakdown({sums,locale,pricing,weightKg,speed,customs}:{sums:Sums;locale:Locale;pricing:Pricing;weightKg?:number;speed:DeliverySpeed;customs?:CustomsEstimate|null}){
 const t=productDetailCopy[locale],k=calcCopy[locale];
 const service=sums.service+sums.buyout+sums.conversion+sums.customsHelp;
 const delivery=sums.shipping+sums.deliveryMargin+sums.reserve;
 const borderDuty=sums.customsDuty>0?0:customs?customsDutySoum(customs,pricing.fx):0;
 const limit=formatUsd(customs?.allowanceUsd??pricing.customsAllowanceUsd??courierAllowanceUsd,locale);
 const row=(key:string,label:ReactNode,value:ReactNode,className?:string)=><div key={key} className={className}><dt>{label}</dt><dd>{value}</dd></div>;
 return <details className="pd-breakdown" open>
  <summary><span>{t.breakdown}</span></summary>
  <dl>
   {row('item',t.item,<Money value={sums.merchandise} locale={locale}/>)}
   {row('service',<>{t.service}<small>{t.serviceHelp(formatPercent(pricing.margin+pricing.buyoutFee+pricing.conversionFee,locale))}</small></>,<Money value={service} locale={locale}/>)}
   {row('delivery',t.delivery(kgText(weightKg,locale),k.speeds[speed].toLowerCase()),<Money value={delivery} locale={locale}/>)}
   {sums.sourceShipping>0&&row('store',t.storeShipping,<Money value={sums.sourceShipping} locale={locale}/>)}
   {sums.insurance>0&&row('guarantee',<>{t.guarantee}{sums.insuranceRate!==undefined&&<small>{k.lines.insuranceRate(formatPercent(sums.insuranceRate,locale))}</small>}</>,<Money value={sums.insurance} locale={locale}/>)}
   {sums.optionalServices>0&&row('optional',k.lines.optional,<Money value={sums.optionalServices} locale={locale}/>)}
   {sums.customsDuty>0
    ?row('duty',k.lines.customsDuty,<Money value={sums.customsDuty} locale={locale}/>)
    :borderDuty>0
     ?row('duty',<>{t.duty} ≈<small>{t.dutyApart}</small></>,<span className="pd-apart">{formatSum(borderDuty,locale)}</span>,'pd-duty-apart')
     :row('duty',t.noDuty(limit),<span className="pd-zero">0</span>,'pd-no-duty')}
   {row('total',t.total,<Money value={sums.total} locale={locale}/>,'pd-total')}
  </dl>
 </details>;
}

/** Price checked · safe-arrival guarantee · delivery window: only what Atlas states, each in a few words. */
export function TrustRow({checked,days,locale}:{checked:{at?:number}|null;days:readonly [number,number]|null;locale:Locale}){
 const t=productDetailCopy[locale];
 // "Today at 14:05" only after hydration: the server's clock and the visitor's day may differ, so both renders first say the date.
 const [now,setNow]=useState<number|null>(null);
 useEffect(()=>{queueMicrotask(()=>setNow(Date.now()))},[]);
 const checkedText=(()=>{
  if(!checked?.at)return t.priceCheckOnAdd;
  const at=new Date(checked.at+5*3_600_000),today=now===null?null:new Date(now+5*3_600_000);
  const sameDay=today!==null&&at.getUTCFullYear()===today.getUTCFullYear()&&at.getUTCMonth()===today.getUTCMonth()&&at.getUTCDate()===today.getUTCDate();
  const pad=(value:number)=>String(value).padStart(2,'0');
  return sameDay?t.priceCheckedToday(`${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`):t.priceChecked(`${pad(at.getUTCDate())}.${pad(at.getUTCMonth()+1)}`);
 })();
 return <ul className="pd-trust">
  <li>{checked?.at?<CircleCheck size={16} aria-hidden="true"/>:<Info size={16} aria-hidden="true"/>}<span>{checkedText}</span></li>
  <li><ShieldCheck size={16} aria-hidden="true"/><a href="/legal#offer-insurance">{t.guaranteeTrust}</a></li>
  {days&&<li><CalendarClock size={16} aria-hidden="true"/><span>{t.days(days[0],days[1])}</span></li>}
 </ul>;
}

/** "О товаре", "Доставка": stacked sections with a heading each, no tabs. */
export function DetailSection({title,id,children}:{title:string;id:string;children:ReactNode}){
 return <section className="pd-section" aria-labelledby={id}><h2 id={id}>{title}</h2>{children}</section>;
}
