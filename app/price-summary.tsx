'use client';
import {useId,useState} from 'react';
import {Info} from 'lucide-react';
import {formatSum} from '@/lib/market/home-copy';
import type {Locale} from '@/lib/market/i18n';

/** One price row; an optional explanation opens below it instead of a floating popover. `value` replaces the amount with a word. */
export function SummaryLine({label,amount,locale,help,helpLabel,negative=false,value}:{label:string;amount:number;locale:Locale;help?:string;helpLabel?:string;negative?:boolean;value?:string}){
 const [open,setOpen]=useState(false);
 const id=useId();
 return <div className="basket-line">
  <span className="basket-line-label">{label}{help&&<button type="button" className="basket-help" aria-label={helpLabel} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}><Info size={15} aria-hidden="true"/></button>}</span>
  <b>{value??`${negative?'−':''}${formatSum(amount,locale)}`}</b>
  {help&&open&&<p id={id} className="basket-line-help">{help}</p>}
 </div>;
}
