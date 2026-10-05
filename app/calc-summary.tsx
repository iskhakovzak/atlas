'use client';
import {useId,useState} from 'react';
import {HandCoins,Scale,Wallet} from 'lucide-react';
import {formatKg,formatPercent,formatSum,formatUsd} from '@/lib/market/home-copy';
import {calcCopy} from '@/lib/market/calc-copy';
import {courierAllowanceUsd} from '@/lib/market/customs';
import {deliveryPerKgUsdFor,unknownStoreShippingUsd,type CartCustoms,type CustomsEstimate,type Pricing,type Quote,type SavedDeliveryProfile} from '@/lib/market/domain';
import {packagingKg} from '@/lib/market/world';
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
   <SummaryLine label={c.lines.international(kg)} amount={sums.shipping+sums.deliveryMargin} locale={locale} help={c.weightRule} helpLabel={c.blocks.weight}/>
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

/**
 * The bill before a link is pasted: the same rows as a real bill, the amounts left as blanks, each row
 * stating its live rule from the tariff. It shows the shape of the answer instead of a list of promises.
 */
export function BlankBill({pricing,locale}:{pricing:Pricing;locale:Locale}){
 const c=calcCopy[locale],b=c.blank;
 const cbu=pricing.fxSource==='cbu'&&Boolean(pricing.fxCbuRate);
 const rows:[string,string][]=[
  [b.item,cbu?b.itemCbu(formatPercent((pricing.fxMarkup??1.012)-1,locale)):b.itemSet],
  [b.fee,b.feeRule(formatPercent(pricing.margin+pricing.buyoutFee+pricing.conversionFee,locale))],
  [b.delivery,b.deliveryRule(formatUsd(deliveryPerKgUsdFor(pricing),locale),formatKg(packagingKg,locale))],
  [b.reserve,b.reserveRule],
 ];
 return <section className="bill-blank" aria-labelledby="bill-blank-title">
  <h2 id="bill-blank-title">{b.title}</h2>
  <p className="bill-blank-lead">{b.lead}</p>
  <dl className="bill">{rows.map(([label,rule])=><div key={label}><dt>{label}</dt><dd className="bill-fill" aria-hidden="true"/><dd className="bill-note">{rule}</dd></div>)}</dl>
  <p className="bill-total"><span>{b.total}</span><span className="bill-fill" aria-hidden="true"/></p>
  <div className="bill-blank-outside"><h3>{c.outside}</h3><ul>
   <li>{b.storeRule(formatUsd(pricing.storeShippingFreeFromUsd??50,locale),formatUsd(unknownStoreShippingUsd,locale))}</li>
   <li>{b.customsRule(formatUsd(pricing.customsAllowanceUsd??courierAllowanceUsd,locale))}</li>
  </ul></div>
 </section>;
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
 const over=estimate.dutiableUsd>0;
 const fee=Math.round(estimate.valueUsd*(pricing.customsHelpFee??0.03)*100)/100;
 return <section className={'calc-customs'+(compact?' compact':'')} aria-labelledby={id+'-title'}>
  <header><Scale size={17} aria-hidden="true"/><h3 id={id+'-title'}>{c.title}</h3><b className={over?undefined:'ok'}>{over?`≈ ${formatSum(Math.round(estimate.estimateUsd*pricing.fx),locale)}`:c.notNeeded}</b></header>
  <p className="calc-customs-sum">{over?c.summaryOver(usd(estimate.dutiableUsd),`${Math.round(estimate.rate*100)}%`,usd(estimate.minimumPerKg)):estimate.outsideUnknown?c.outsideUnknown:c.summaryNone(usd(estimate.allowanceUsd),usd(remaining))}</p>
  {profiles.length>1&&onRecipient&&<div className="field calc-customs-recipient"><label htmlFor={id+'-recipient'}>{c.recipient}</label><select id={id+'-recipient'} value={recipientId} onChange={event=>onRecipient(event.target.value)}>{profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.recipient}</option>)}</select></div>}
  {onChoices&&<div className="calc-customs-choices">
   <label className="calc-check"><input type="checkbox" disabled={busy} checked={choices.outsideUsed} onChange={event=>save({outsideUsed:event.target.checked,outsideUsd:event.target.checked&&outsideText.trim()?Number(outsideText):undefined})}/><span>{c.outside}</span></label>
   {choices.outsideUsed&&<div className="field calc-outside"><label htmlFor={id+'-outside'}>{c.outsideAmount}</label><input id={id+'-outside'} type="number" inputMode="decimal" min="0" max="100000" step="0.01" value={outsideText} onChange={event=>setOutsideText(event.target.value)} onBlur={()=>{const value=outsideText.trim()===''?undefined:Number(outsideText);if(value===undefined||(Number.isFinite(value)&&value>=0&&value<=100000))save({outsideUsd:value})}}/></div>}
   {over&&<label className="calc-check"><input type="checkbox" disabled={busy} checked={choices.help} onChange={event=>save({help:event.target.checked})}/><span><HandCoins size={15} aria-hidden="true"/> {c.help}<small>{c.helpFee(`${Math.round((pricing.customsHelpFee??0.03)*100)}%`,usd(fee))}</small></span></label>}
   {estimate.helpRequested&&<p className="calc-help-fee">{c.helpNote}</p>}
  </div>}
  <a className="calc-customs-link" href="/customs">{c.howLink}</a>
 </section>;
}
