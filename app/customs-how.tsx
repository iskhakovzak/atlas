'use client';
import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Popover as PopoverPrimitive} from 'radix-ui';
import {Calculator,Minus,Plus,X} from 'lucide-react';
import {calcCopy} from '@/lib/market/calc-copy';
import {formatSum} from '@/lib/market/home-copy';
import type {CustomsEstimate,Pricing} from '@/lib/market/domain';
import type {Locale} from '@/lib/market/i18n';

/** How long the window stays without the pointer or focus on it (owner, 7.10.2026). */
export const customsHowMs=5000;
const presets=[100,200,300,500,1000];
const step=50,maxUsd=10_000;
/** Two-column cart (summary on the right): the window opens to the left, over the free side of the page. */
const sideQuery='(min-width: 960px)';

function useWide(){
 const subscribe=useCallback((change:()=>void)=>{const media=window.matchMedia(sideQuery);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[]);
 return useSyncExternalStore(subscribe,()=>window.matchMedia(sideQuery).matches,()=>false);
}

/** The allowance this recipient still has this month, as the cart counts it. */
export function allowanceLeftUsd(estimate:Pick<CustomsEstimate,'allowanceUsd'|'atlasUsedUsd'|'outsideUsedUsd'|'outsideUnknown'>){
 return estimate.outsideUnknown?0:Math.max(0,estimate.allowanceUsd-estimate.atlasUsedUsd-(estimate.outsideUsedUsd??0));
}
/** Duty for goods worth `valueUsd` with `leftUsd` of allowance: the same formula and rounding as the cart's estimate. */
export function dutyFor(valueUsd:number,leftUsd:number,rate:number,fx:number){
 const excessUsd=Math.round(Math.max(0,valueUsd-leftUsd)*100)/100;
 return {excessUsd,dutySoum:Math.ceil(Math.round(excessUsd*rate*100)/100*fx)};
}

const usd=(value:number,locale:Locale)=>new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{style:'currency',currency:'USD',maximumFractionDigits:Number.isInteger(value)?0:2}).format(value);

/**
 * "How customs is calculated": a small window with the rule and a calculator instead of a link away from the cart.
 * It closes by itself after 5 s; while the pointer or focus is on it, it stays. It never covers the bill's total:
 * on a wide screen it opens beside the summary, on a phone above the link.
 */
export function CustomsHow({estimate,pricing,locale}:{estimate:CustomsEstimate;pricing:Pick<Pricing,'fx'>;locale:Locale}){
 const c=calcCopy[locale].customs.how;
 const wide=useWide();
 const [open,setOpen]=useState(false);
 const [held,setHeld]=useState(false);
 // Each time the countdown starts again, the bar restarts too.
 const [round,setRound]=useState(0);
 const left=allowanceLeftUsd(estimate);
 // The cart's own amount to the cent, so its duty here is the one the bill shows.
 const cartUsd=estimate.valueUsd;
 const [amount,setAmount]=useState(cartUsd>0?cartUsd:300);
 // Pointer or focus on the window keeps it; a tap on a phone pins it until it is closed (there is no hover there).
 const pointerInside=useRef(false),focusInside=useRef(false),touched=useRef(false),byPointer=useRef(false);
 const triggerRef=useRef<HTMLButtonElement>(null),contentRef=useRef<HTMLDivElement>(null);

 // On a phone the window opens above the link: if it does not fit there, the page moves the link down (not under
 // the bars fixed at the bottom), so the whole window, result included, shows without scrolling inside it.
 useEffect(()=>{
  if(!open||wide)return;
  const frame=window.requestAnimationFrame(()=>{
   const trigger=triggerRef.current?.getBoundingClientRect(),body=contentRef.current?.querySelector('.customs-how-body');
   if(!trigger||!body)return;
   const need=body.scrollHeight+34+8+7+12;
   const floor=Math.min(window.innerHeight,...[...document.querySelectorAll('.basket-sticky:not(.is-hidden), .mobile-nav')].map(bar=>bar.getBoundingClientRect().top).filter(top=>top>0))-12;
   const down=Math.min(need-trigger.top,floor-trigger.bottom);
   if(down>0)window.scrollBy({top:-down,behavior:'smooth'});
  });
  return()=>window.cancelAnimationFrame(frame);
 },[open,wide]);

 useEffect(()=>{
  if(!open||held)return;
  const timer=window.setTimeout(()=>setOpen(false),customsHowMs);
  return()=>window.clearTimeout(timer);
 },[open,held,round]);

 const sync=()=>{
  const next=pointerInside.current||focusInside.current||touched.current;
  setHeld(next);
  if(!next)setRound(value=>value+1);
 };
 const change=(next:boolean)=>{
  setOpen(next);
  if(next){pointerInside.current=false;focusInside.current=false;touched.current=false;setHeld(false);setRound(value=>value+1)}
 };
 const result=dutyFor(amount,left,estimate.rate,pricing.fx);
 const percent=new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{maximumFractionDigits:2}).format(estimate.rate*100)+'%';
 const choices=[...presets.map(value=>({value,label:usd(value,locale)})),...(cartUsd>0&&!presets.includes(cartUsd)?[{value:cartUsd,label:c.thisCart}]:[])];

 return <PopoverPrimitive.Root open={open} onOpenChange={change}>
  <PopoverPrimitive.Trigger asChild>
   <button ref={triggerRef} type="button" className="calc-customs-link customs-how-trigger" onPointerDown={()=>{byPointer.current=true}} onKeyDown={()=>{byPointer.current=false}}><Calculator size={15} aria-hidden="true"/>{c.title}</button>
  </PopoverPrimitive.Trigger>
  <PopoverPrimitive.Portal>
   <PopoverPrimitive.Content ref={contentRef} className="customs-how" side={wide?'left':'top'} align={wide?'center':'start'} sideOffset={wide?18:8} collisionPadding={12}
    aria-label={c.title} data-held={held||undefined}
    // Opened with a click, focus stays on the link so the countdown runs; opened from the keyboard, focus goes inside.
    onOpenAutoFocus={event=>{if(byPointer.current)event.preventDefault()}}
    onPointerEnter={()=>{pointerInside.current=true;sync()}} onPointerLeave={()=>{pointerInside.current=false;sync()}}
    // Keyboard focus keeps the window; a mouse click on its buttons does not, so it still closes once the pointer leaves.
    onFocus={event=>{if(event.target.matches(':focus-visible')){focusInside.current=true;sync()}}} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null)){focusInside.current=false;sync()}}}
    onPointerDown={event=>{if(event.pointerType!=='mouse'){touched.current=true;sync()}}}>
    <div className="customs-how-body">
     <header className="customs-how-head">
      <h3>{c.title}</h3>
      <PopoverPrimitive.Close className="customs-how-close" aria-label={c.close}><X size={16} aria-hidden="true"/></PopoverPrimitive.Close>
     </header>
     <p className="customs-how-rule">{c.rule(usd(estimate.allowanceUsd,locale),percent,usd(estimate.minimumPerKg,locale))}</p>
     <p className="customs-how-left">{left>0?c.left(usd(left,locale)):c.leftNone}</p>
     <div className="customs-how-calc" role="group" aria-label={c.try}>
      <span className="customs-how-label">{c.try}</span>
      <div className="customs-how-chips">{choices.map(choice=><button key={choice.label} type="button" aria-pressed={amount===choice.value} className={amount===choice.value?'on':''} onClick={()=>setAmount(choice.value)}>{choice.label}</button>)}</div>
      <div className="customs-how-stepper">
       <button type="button" aria-label={c.minus} disabled={amount<=0} onClick={()=>setAmount(value=>Math.max(0,Math.ceil(value/step)*step-step))}><Minus size={15} aria-hidden="true"/></button>
       <output aria-label={c.amount}>{usd(amount,locale)}</output>
       <button type="button" aria-label={c.plus} disabled={amount>=maxUsd} onClick={()=>setAmount(value=>Math.min(maxUsd,Math.floor(value/step)*step+step))}><Plus size={15} aria-hidden="true"/></button>
      </div>
      <p className={'customs-how-result'+(result.excessUsd>0?' over':'')} aria-live="polite">{result.excessUsd>0?c.over(usd(result.excessUsd,locale),formatSum(result.dutySoum,locale)):c.none}</p>
     </div>
     <p className="customs-how-final">{c.final} <a href="/customs" target="_blank" rel="noopener">{c.details} ↗</a></p>
    </div>
    <span className="customs-how-timer" key={round} aria-hidden="true"/>
    <PopoverPrimitive.Arrow className="customs-how-arrow" width={14} height={7}/>
   </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
 </PopoverPrimitive.Root>;
}
