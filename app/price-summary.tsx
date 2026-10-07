'use client';
import {useId,useState} from 'react';
import {Info} from 'lucide-react';
import {formatSum} from '@/lib/market/format';
import type {Locale} from '@/lib/market/i18n';

/** One price row; an optional explanation opens below it instead of a floating popover. `value` replaces the amount with a word. */
export function SummaryLine({label,amount,locale,help,helpLabel,negative=false,value}:{label:string;amount:number;locale:Locale;help?:string;helpLabel?:string;negative?:boolean;value?:string}){
 const [open,setOpen]=useState(false);
 const id=useId();
 // The help button stays on the line of the label's last word instead of wrapping alone.
 const cut=help?label.lastIndexOf(' '):-1;
 return <div className="basket-line">
  <span className="basket-line-label">{cut>0?label.slice(0,cut+1):help?'':label}{help&&<span className="nowrap">{cut>0?label.slice(cut+1):label}<button type="button" className="basket-help" aria-label={helpLabel} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}><Info size={15} aria-hidden="true"/></button></span>}</span>
  <b>{value??`${negative?'−':''}${formatSum(amount,locale)}`}</b>
  {help&&open&&<p id={id} className="basket-line-help">{help}</p>}
 </div>;
}
