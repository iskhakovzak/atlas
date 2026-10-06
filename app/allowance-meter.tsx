'use client';

import {useEffect,useId,useState} from 'react';
import type {Locale} from '@/lib/market/i18n';
import {withCyrillic} from '@/lib/market/uz-cyrl';

type Part={key:string;kind:'order'|'cart'|'left'|'over';usd:number;label:string};
const copy=withCyrillic({
 ru:{order:(id:string)=>`Заказ ${id}`,cart:'В корзине, ещё не учтено',left:'Остаток без пошлины',over:'Сверх лимита',limit:'лимит',hint:'Нажмите на часть полосы, чтобы увидеть, из чего она.'},
 uz:{order:(id:string)=>`Buyurtma ${id}`,cart:'Savatda, hali hisobga olinmagan',left:'Bojsiz qoldiq',over:'Limitdan oshgan',limit:'limit',hint:'Tarkibini ko‘rish uchun chiziq qismiga bosing.'},
 en:{order:(id:string)=>`Order ${id}`,cart:'In the cart, not counted yet',left:'Left duty-free',over:'Over the allowance',limit:'limit',hint:'Tap a part of the bar to see what it is.'},
}) satisfies Record<Locale,unknown>;
const money=(usd:number)=>'$'+(Math.round(usd*100)/100).toLocaleString('en-US',{maximumFractionDigits:2});

/**
 * The month's duty-free allowance for one recipient as a bar: each counted order is a segment, the cart a dashed one,
 * the rest is what is left; anything over the limit shows past the limit mark. Segments are buttons: tap, hover or
 * focus one to read it below the bar.
 */
export function AllowanceMeter({limit,orders,cartUsd=0,locale,label}:{limit:number;orders:{id:string;usd:number}[];cartUsd?:number;locale:Locale;label:string}){
 const c=copy[locale],id=useId();
 const used=orders.reduce((sum,part)=>sum+part.usd,0);
 const total=used+cartUsd,scale=Math.max(limit,total)||1;
 const parts:Part[]=[
  ...orders.map(part=>({key:part.id,kind:'order' as const,usd:part.usd,label:c.order(part.id)})),
  ...(cartUsd>0?[{key:'cart',kind:'cart' as const,usd:cartUsd,label:c.cart}]:[]),
  ...(total<limit?[{key:'left',kind:'left' as const,usd:limit-total,label:c.left}]:[]),
 ];
 const [active,setActive]=useState<string|null>(null);
 // The fill grows in once after mount (CSS transition; reduced motion turns it off).
 const [shown,setShown]=useState(false);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setShown(true));return()=>cancelAnimationFrame(frame)},[]);
 const current=parts.find(part=>part.key===active);
 const overUsd=Math.max(0,total-limit);
 return <div className={'allowance-meter'+(shown?' shown':'')}>
  <div className="allowance-track" role="group" aria-label={label} aria-describedby={id+'-readout'}>
   {parts.map(part=><button key={part.key} type="button" className={'allowance-part '+part.kind+(active===part.key?' active':'')}
    style={{flexGrow:part.usd/scale}} aria-label={`${part.label}: ${money(part.usd)}`} aria-pressed={active===part.key}
    onClick={()=>setActive(active===part.key?null:part.key)} onMouseEnter={()=>setActive(part.key)} onFocus={()=>setActive(part.key)}/>)}
   {total>limit&&<span className="allowance-limit" style={{left:`${limit/scale*100}%`}} aria-hidden="true"/>}
  </div>
  <div className="allowance-scale" aria-hidden="true"><span>$0</span><span style={{left:`${limit/scale*100}%`}}>{money(limit)} {c.limit}</span></div>
  <p id={id+'-readout'} className="allowance-readout" aria-live="polite">
   {current?<><b>{current.label}</b> {money(current.usd)}</>:overUsd>0?<><b>{c.over}</b> {money(overUsd)}</>:<span>{c.hint}</span>}
  </p>
 </div>;
}
