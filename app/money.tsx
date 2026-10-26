'use client';
import {useEffect,useRef,useState} from 'react';
import {groupDigits} from '@/lib/market/format';
import type {Locale} from '@/lib/market/i18n';
import {uzText} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';

export const sumUnit=(locale:Locale)=>locale==='ru'?'сум':isUzbek(locale)?uzText(locale, 'so‘m'):'UZS';

/** The shown number glides to a new value in 320 ms; at once with reduced motion, on first render and for tiny changes. */
function useGlide(value:number,enabled:boolean){
 // `from` is the number on screen, so a total changed mid-count glides on from where it is, not from the old target.
 const [shown,setShown]=useState(value),from=useRef(value);
 useEffect(()=>{
  const start=from.current;
  if(!enabled||start===value||typeof window==='undefined'||window.matchMedia('(prefers-reduced-motion: reduce)').matches){from.current=value;setShown(value);return}
  let frame=0;const began=performance.now();
  const step=(now:number)=>{const t=Math.min(1,(now-began)/320),eased=1-(1-t)**3,next=Math.round(start+(value-start)*eased);from.current=next;setShown(next);if(t<1)frame=requestAnimationFrame(step)};
  frame=requestAnimationFrame(step);
  return()=>cancelAnimationFrame(frame);
 },[value,enabled]);
 return enabled?shown:value;
}

/**
 * A final soum total: digits and unit in separate spans so the unit can be set smaller. Reads as "1 589 090 сум".
 * `animate`: a changed total counts to its new value; an invisible copy of the final value holds the width,
 * so the line does not jump while the digits change. Screen readers get only the final value.
 */
export function Money({value,locale,className,animate}:{value:number;locale:Locale;className?:string;animate?:boolean}){
 const shown=useGlide(value,!!animate),unit=<span className="money-unit">{' '}{sumUnit(locale)}</span>;
 if(!animate)return <span className={'money'+(className?' '+className:'')}><span className="money-n">{groupDigits(value)}</span>{unit}</span>;
 return <span className={'money money-glide'+(className?' '+className:'')}>
  <span className="money-ghost" aria-hidden="true"><span className="money-n">{groupDigits(value)}</span>{unit}</span>
  <span className="money-live" aria-hidden={shown!==value||undefined}><span className="money-n">{groupDigits(shown)}</span>{unit}</span>
  {shown!==value&&<span className="sr-only">{groupDigits(value)} {sumUnit(locale)}</span>}
 </span>;
}
