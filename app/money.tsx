'use client';
import {groupDigits} from '@/lib/market/home-copy';
import type {Locale} from '@/lib/market/i18n';

export const sumUnit=(locale:Locale)=>locale==='ru'?'сум':locale==='uz'?'so‘m':'UZS';

/** A final soum total: digits and unit in separate spans so the unit can be set smaller. Reads as "1 589 090 сум". */
export function Money({value,locale,className}:{value:number;locale:Locale;className?:string}){
 return <span className={'money'+(className?' '+className:'')}><span className="money-n">{groupDigits(value)}</span><span className="money-unit">{' '}{sumUnit(locale)}</span></span>;
}
