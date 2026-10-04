'use client';
import {useEffect,useId,useState} from 'react';
import {ExternalLink,HandCoins,Landmark,Scale,Wallet} from 'lucide-react';
import {formatSum} from '@/lib/market/home-copy';
import {calcCopy} from '@/lib/market/calc-copy';
import {customsReferences} from '@/lib/market/customs';
import type {CartCustoms,CustomsEstimate,Pricing,Quote,SavedDeliveryProfile} from '@/lib/market/domain';
import type {Locale} from '@/lib/market/i18n';
import {SummaryLine} from './price-summary';

type Sums=Pick<Quote,'merchandise'|'service'|'shipping'|'reserve'|'total'>&{buyout?:number;conversion?:number;sourceShipping?:number;deliveryMargin?:number;optionalServices?:number;storeShippingHold?:number};

/** Sum of quote lines, for a cart or the link-order preview. */
export function sumQuotes(quotes:Partial<Sums>[]):Required<Sums>{
 const keys=['merchandise','service','shipping','reserve','total','buyout','conversion','sourceShipping','deliveryMargin','optionalServices','storeShippingHold'] as const;
 return Object.fromEntries(keys.map(key=>[key,quotes.reduce((sum,quote)=>sum+(quote[key]??0),0)])) as Required<Sums>;
}

const percent=(value:number,locale:Locale)=>new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{maximumFractionDigits:2}).format(value*100)+'%';
export const usdText=(value:number,locale:Locale)=>new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{style:'currency',currency:'USD',minimumFractionDigits:Number.isInteger(Math.round(value*100)/100)?0:2,maximumFractionDigits:2}).format(value);

/**
 * The calculation as the customer reads it: each fee on its own line, the total to pay, then — set apart —
 * the store-delivery hold (never in the total) and the exchange rate the amounts use.
 */
export function CalcLines({sums,locale,pricing,weightKg,storeShippingState,anyFree=false,children}:{sums:Required<Sums>;locale:Locale;pricing:Pricing;weightKg?:number;storeShippingState:'stated'|'free'|'hold'|'none';anyFree?:boolean;children?:React.ReactNode}){
 const c=calcCopy[locale];
 const freeFrom=usdText(pricing.storeShippingFreeFromUsd??50,locale);
 const kg=weightKg===undefined?'':new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{maximumFractionDigits:2}).format(weightKg);
 // A cart can mix stores: a stated charge, a separate hold and free delivery each get their own line.
 const stated=sums.sourceShipping>0||storeShippingState==='stated';
 const hold=sums.storeShippingHold>0||storeShippingState==='hold';
 const free=!hold&&(anyFree||storeShippingState==='free');
 return <>
  <div className="basket-lines">
   <SummaryLine label={c.lines.items} amount={sums.merchandise} locale={locale}/>
   <SummaryLine label={c.lines.atlasFee(percent(pricing.margin,locale))} amount={sums.service} locale={locale} help={c.feeHelp} helpLabel={c.lines.atlasFee('')}/>
   {sums.buyout>0&&<SummaryLine label={c.lines.buyout} amount={sums.buyout} locale={locale}/>}
   {sums.conversion>0&&<SummaryLine label={c.lines.conversion} amount={sums.conversion} locale={locale}/>}
   {stated&&<SummaryLine label={c.lines.storeShipping} amount={sums.sourceShipping} locale={locale}/>}
   {free&&<SummaryLine label={c.lines.storeShipping} amount={0} value={c.lines.free} locale={locale} help={c.freeNote(freeFrom)} helpLabel={c.lines.storeShipping}/>}
   {hold&&<SummaryLine label={c.lines.storeShipping} amount={0} value={c.lines.holdOutside} locale={locale} help={c.holdHelp(freeFrom)} helpLabel={c.lines.storeShipping}/>}
   <SummaryLine label={kg?c.lines.international(kg):c.lines.international('').replace(/ · $/,'')} amount={sums.shipping+sums.deliveryMargin} locale={locale} help={c.weightRule} helpLabel={c.blocks.weight}/>
   {sums.reserve>0&&<SummaryLine label={c.lines.intlReserve} amount={sums.reserve} locale={locale} help={c.intlReserveHelp} helpLabel={c.lines.intlReserve}/>}
   {sums.optionalServices>0&&<SummaryLine label={c.lines.optional} amount={sums.optionalServices} locale={locale}/>}
  </div>
  {children}
 </>;
}

/** The hold for unknown store delivery, shown apart from the amount to pay. */
export function HoldNote({amount,locale,pricing}:{amount:number;locale:Locale;pricing:Pricing}){
 const c=calcCopy[locale];
 if(amount<=0)return null;
 return <div className="calc-hold" role="note">
  <Wallet size={17} aria-hidden="true"/>
  <div><span>{c.hold}</span><small>{c.holdNote}</small></div>
  <b>{formatSum(amount,locale)}</b>
  <p className="calc-hold-help">{c.holdHelp(usdText(pricing.storeShippingFreeFromUsd??50,locale)).split('. ').slice(1,3).join('. ')}.</p>
 </div>;
}

/** Which rate the amounts use, and since when. */
export function FxNote({pricing,locale}:{pricing:Pricing;locale:Locale}){
 const c=calcCopy[locale];
 const [now,setNow]=useState(0);
 useEffect(()=>{const timer=setTimeout(()=>setNow(Date.now()),0);return()=>clearTimeout(timer)},[]);
 const rate=formatSum(pricing.fx,locale);
 const live=pricing.fxSource==='cbu'&&pricing.fxCbuRate&&pricing.fxUpdatedAt;
 const when=live&&now?new Intl.DateTimeFormat(locale==='en'?'en-GB':'ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(pricing.fxUpdatedAt):'';
 return <p className="calc-fx"><Landmark size={14} aria-hidden="true"/>{live?c.fxCbu(rate,new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{maximumFractionDigits:2}).format(pricing.fxCbuRate!),String(pricing.fxMarkup??1.012).replace('.',locale==='en'?'.':','),when):c.fxSet(rate)}</p>;
}

/**
 * The customs estimate for one recipient, with the customer's choices: allowance used outside Atlas and the
 * "Atlas helps pay customs" request. Only shown amounts; the server works the figures out again at checkout.
 */
export function CustomsPanel({estimate,choices,locale,pricing,profiles,recipientId,onRecipient,onChoices,compact=false,busy=false}:{estimate:CustomsEstimate;choices:CartCustoms;locale:Locale;pricing:Pricing;profiles:SavedDeliveryProfile[];recipientId?:string;onRecipient?:(id:string)=>void;onChoices?:(next:CartCustoms)=>void;compact?:boolean;busy?:boolean}){
 const c=calcCopy[locale].customs;
 const id=useId();
 const [outsideText,setOutsideText]=useState(choices.outsideUsd===undefined?'':String(choices.outsideUsd));
 const remaining=Math.max(0,estimate.allowanceUsd-estimate.atlasUsedUsd-(estimate.outsideUsedUsd??0));
 const usd=(value:number)=>usdText(value,locale);
 const save=(patch:Partial<CartCustoms>)=>onChoices?.({...choices,...patch});
 return <section className={'calc-customs'+(compact?' compact':'')} aria-labelledby={id+'-title'}>
  <header><Scale size={17} aria-hidden="true"/><h3 id={id+'-title'}>{c.title}</h3><b>{estimate.dutiableUsd>0?`≈ ${formatSum(Math.round(estimate.estimateUsd*pricing.fx),locale)}`:c.notNeeded}</b></header>
  {profiles.length>1&&onRecipient&&<div className="field calc-customs-recipient"><label htmlFor={id+'-recipient'}>{c.recipient}</label><select id={id+'-recipient'} value={recipientId} onChange={event=>onRecipient(event.target.value)}>{profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.recipient}{profile.label&&profile.label!==profile.recipient?` · ${profile.label}`:''}</option>)}</select></div>}
  {!(profiles.length>1&&onRecipient)&&(estimate.recipientName?<p className="micro">{c.recipient}: <b>{estimate.recipientName}</b></p>:<p className="micro">{c.noRecipient}</p>)}
  <dl className="calc-customs-lines">
   <div><dt>{c.limitShort}</dt><dd>{usd(estimate.allowanceUsd)}</dd></div>
   {estimate.atlasUsedUsd>0&&<div><dt>{c.atlasShort}</dt><dd>−{usd(estimate.atlasUsedUsd)}</dd></div>}
   {(estimate.outsideUsedUsd??0)>0&&<div><dt>{c.outsideShort}</dt><dd>−{usd(estimate.outsideUsedUsd!)}</dd></div>}
   <div><dt>{c.itemsShort}</dt><dd>{usd(estimate.valueUsd)}</dd></div>
   <div className="strong"><dt>{c.dutiable}</dt><dd>{usd(estimate.dutiableUsd)}</dd></div>
   {estimate.dutiableUsd>0&&<div className="strong"><dt>{c.estimate} · {Math.round(estimate.rate*100)}%</dt><dd>≈ {usd(estimate.estimateUsd)}</dd></div>}
  </dl>
  {estimate.dutiableUsd>0?<p className="micro">{c.minimum(usd(estimate.minimumPerKg))}</p>:<p className="micro">{c.none(usd(remaining))}</p>}
  {onChoices&&<div className="calc-customs-choices">
   <label className="calc-check"><input type="checkbox" disabled={busy} checked={choices.outsideUsed} onChange={event=>save({outsideUsed:event.target.checked,outsideUsd:event.target.checked&&outsideText.trim()?Number(outsideText):undefined})}/>{c.outside}</label>
   {choices.outsideUsed&&<div className="field calc-outside"><label htmlFor={id+'-outside'}>{c.outsideAmount}</label><input id={id+'-outside'} type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={outsideText} onChange={event=>setOutsideText(event.target.value)} onBlur={()=>{const value=outsideText.trim()===''?undefined:Number(outsideText);if(value===undefined||(Number.isFinite(value)&&value>=0&&value<=100000))save({outsideUsd:value})}}/>{estimate.outsideUnknown&&<small className="calc-warn" role="status">{c.outsideUnknown}</small>}</div>}
   {estimate.dutiableUsd>0&&<label className="calc-check"><input type="checkbox" disabled={busy} checked={choices.help} onChange={event=>save({help:event.target.checked})}/><span><HandCoins size={15} aria-hidden="true"/> {c.help}</span></label>}
   {estimate.helpRequested&&<p className="calc-help-fee"><span>{c.helpFee(`${Math.round((pricing.customsHelpFee??0.03)*100)}%`,usd(estimate.dutiableUsd),usd(estimate.helpFeeUsd??0))}</span><small>{c.helpNote}</small></p>}
  </div>}
  <details className="calc-customs-more"><summary>{c.sources}</summary>
   <p>{c.separate} {c.rule}</p><p>{c.dispute}</p><p>{c.relative}</p>
   <ul>{customsReferences.slice(0,3).map(ref=><li key={ref.url}><a href={ref.url} target="_blank" rel="noopener noreferrer">{ref.title}<ExternalLink size={12} aria-hidden="true"/></a></li>)}</ul>
  </details>
 </section>;
}
