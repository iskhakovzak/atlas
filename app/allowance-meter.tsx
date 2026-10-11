'use client';

import {useEffect,useId,useState} from 'react';
import type {Locale} from '@/lib/market/i18n';
import type {AllowancePart} from '@/lib/market/allowance';
import {withCyrillic} from '@/lib/market/uz-cyrl';

type Part={key:string;kind:'order'|'cart'|'left';usd:number;label:string};
const copy=/*@__PURE__*/withCyrillic({
 ru:{order:(date:string)=>`Заказ от ${date}`,orderPlain:'Заказ',orders:'Заказы',inCart:'В корзине',afterCart:'Останется после корзины',cart:'В корзине, ещё не учтено',left:'Остаток без пошлины',over:'Сверх лимита',limit:'лимит'},
 uz:{order:(date:string)=>`${date} buyurtmasi`,orderPlain:'Buyurtma',orders:'Buyurtmalar',inCart:'Savatda',afterCart:'Savatdan keyin qoladi',cart:'Savatda, hali hisobga olinmagan',left:'Bojsiz qoldiq',over:'Limitdan oshgan',limit:'limit'},
 en:{order:(date:string)=>`Order of ${date}`,orderPlain:'Order',orders:'Orders',inCart:'In the cart',afterCart:'Left after the cart',cart:'In the cart, not counted yet',left:'Left duty-free',over:'Over the allowance',limit:'limit'},
}) satisfies Record<Locale,unknown>;
const money=(usd:number)=>'$'+(Math.round(usd*100)/100).toLocaleString('en-US',{maximumFractionDigits:2});
/** "$1,011.7": the one dollar format of the allowance card, for its headline too. */
export const allowanceMoney=money;

/**
 * The month's duty-free allowance for one recipient as a bar: each counted checkout is one whole segment (all its
 * lines together), the cart a dashed one, the rest is what is left. Past the limit mark the bar is hatched, not red:
 * duty is due on that part only (owner, 12 October 2026). Segments are buttons: tap, hover or focus one to read it
 * below the bar; otherwise the line below is a legend of the totals.
 */
export function AllowanceMeter({limit,orders,cartUsd=0,locale,label}:{limit:number;orders:AllowancePart[];cartUsd?:number;locale:Locale;label:string}){
 const c=copy[locale],id=useId();
 const day=new Intl.DateTimeFormat(locale==='oz'?'uz-Cyrl':locale,{day:'numeric',month:'long'});
 const used=orders.reduce((sum,part)=>sum+part.usd,0);
 const total=used+cartUsd,scale=Math.max(limit,total)||1;
 const parts:Part[]=[
  ...orders.map(part=>({key:part.id,kind:'order' as const,usd:part.usd,label:part.at?c.order(day.format(part.at)):c.orderPlain})),
  ...(cartUsd>0?[{key:'cart',kind:'cart' as const,usd:cartUsd,label:c.cart}]:[]),
  ...(total<limit?[{key:'left',kind:'left' as const,usd:limit-total,label:c.left}]:[]),
 ];
 const [active,setActive]=useState<string|null>(null);
 // The fill grows in once after mount (CSS transition; reduced motion turns it off).
 const [shown,setShown]=useState(false);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setShown(true));return()=>cancelAnimationFrame(frame)},[]);
 const current=parts.find(part=>part.key===active);
 const overUsd=Math.max(0,total-limit);
 // Where the limit sits on the bar, in %. Its label shifts left by the same share of its own width, so it never runs
 // off the bar or over "$0": at 100% it ends at the mark, near the start it begins at it.
 const at=limit/scale*100;
 return <div className={'allowance-meter'+(shown?' shown':'')+(overUsd>0?' over':'')}>
  <div className="allowance-track" role="group" aria-label={label} aria-describedby={id+'-readout'}>
   {parts.map(part=><button key={part.key} type="button" className={'allowance-part '+part.kind+(active===part.key?' active':'')}
    style={{flexGrow:part.usd/scale}} aria-label={`${part.label}: ${money(part.usd)}`} aria-pressed={active===part.key}
    onClick={()=>setActive(active===part.key?null:part.key)} onMouseEnter={()=>setActive(part.key)} onFocus={()=>setActive(part.key)}/>)}
   {overUsd>0&&<span className="allowance-over" style={{left:`${at}%`}} aria-hidden="true"/>}
   {overUsd>0&&<span className="allowance-limit" style={{left:`${at}%`}} aria-hidden="true"/>}
  </div>
  <div className="allowance-scale" aria-hidden="true">
   {(overUsd===0||at>34)&&<span className="start">$0</span>}
   <span className="mark" style={{left:`${at}%`,transform:`translateX(-${at}%)`}}>{money(limit)} {c.limit}</span>
   {overUsd>0&&at<62&&<span className="end">{money(total)}</span>}
  </div>
  <p id={id+'-readout'} className="allowance-readout" aria-live="polite">
   {current?<span className={'allowance-key '+current.kind}><i/><b>{current.label}</b> {money(current.usd)}</span>:<>
    {used>0&&<span className="allowance-key order"><i/>{c.orders}{orders.length>1?` · ${orders.length}`:''} <b>{money(used)}</b></span>}
    {cartUsd>0&&<span className="allowance-key cart"><i/>{c.inCart} <b>{money(cartUsd)}</b></span>}
    {overUsd>0?<span className="allowance-key over"><i/>{c.over} <b>{money(overUsd)}</b></span>:<span className="allowance-key left"><i/>{cartUsd>0?c.afterCart:c.left} <b>{money(limit-total)}</b></span>}
   </>}
  </p>
 </div>;
}
