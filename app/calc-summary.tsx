'use client';
import {useId} from 'react';
import {Check,HandCoins,Scale,Wallet} from 'lucide-react';
import {formatKg,formatPercent,formatSum,formatUsd} from '@/lib/market/home-copy';
import {calcCopy} from '@/lib/market/calc-copy';
import {courierAllowanceUsd} from '@/lib/market/customs';
import {deliveryPerKgUsdFor,unknownStoreShippingUsd,type CartCustoms,type CustomsEstimate,type DeliverySpeed,type Pricing,type Quote,type SavedDeliveryProfile} from '@/lib/market/domain';
import {daysRangeFor,deliverySpeedCopy,type DeliverySpeedOption} from '@/lib/market/delivery-speed';
import {packagingKg} from '@/lib/market/world';
import type {Locale} from '@/lib/market/i18n';
import {SummaryLine} from './price-summary';
import {CustomsHow} from './customs-how';

type Sums=Pick<Quote,'merchandise'|'service'|'shipping'|'reserve'|'total'>&{buyout?:number;conversion?:number;sourceShipping?:number;deliveryMargin?:number;optionalServices?:number;storeShippingHold?:number;customsHelp?:number;customsDuty?:number};

/** Sum of quote lines, for a cart or the link-order preview. */
export function sumQuotes(quotes:Partial<Sums>[]):Required<Sums>{
 const keys=['merchandise','service','shipping','reserve','total','buyout','conversion','sourceShipping','deliveryMargin','optionalServices','storeShippingHold','customsHelp','customsDuty'] as const;
 return Object.fromEntries(keys.map(key=>[key,quotes.reduce((sum,quote)=>sum+(quote[key]??0),0)])) as Required<Sums>;
}

const kgText=(weightKg:number|undefined,locale:Locale)=>weightKg===undefined?'':new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{maximumFractionDigits:2}).format(weightKg);
const percent=(value:number,locale:Locale)=>new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{maximumFractionDigits:2}).format(value*100)+'%';
export const usdText=(value:number,locale:Locale)=>new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{style:'currency',currency:'USD',minimumFractionDigits:Number.isInteger(Math.round(value*100)/100)?0:2,maximumFractionDigits:2}).format(value);

/**
 * The calculation as the customer reads it: each fee on its own line, the total to pay, then — set apart —
 * the store-delivery hold (never in the total) and the exchange rate the amounts use.
 */
export function CalcLines({sums,locale,pricing,weightKg,storeShippingState,anyFree=false,speed,children}:{sums:Required<Sums>;locale:Locale;pricing:Pricing;weightKg?:number;storeShippingState:'stated'|'free'|'hold'|'none';anyFree?:boolean;/** Names the chosen delivery speed on the international line. */speed?:DeliverySpeed;children?:React.ReactNode}){
 const c=calcCopy[locale];
 const internationalLabel=speed?`${c.lines.international(kgText(weightKg,locale))} · ${c.speeds[speed]}`:c.lines.international(kgText(weightKg,locale));
 const freeFrom=usdText(pricing.storeShippingFreeFromUsd??50,locale);
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
   <SummaryLine label={internationalLabel} amount={sums.shipping+sums.deliveryMargin} locale={locale} help={c.weightRule} helpLabel={c.blocks.weight}/>
   {sums.reserve>0&&<SummaryLine label={c.lines.intlReserve} amount={sums.reserve} locale={locale} help={c.intlReserveHelp} helpLabel={c.lines.intlReserve}/>}
   {sums.optionalServices>0&&<SummaryLine label={c.lines.optional} amount={sums.optionalServices} locale={locale}/>}
   {sums.customsHelp>0&&<SummaryLine label={c.lines.customsHelp(percent(pricing.customsHelpFee,locale))} amount={sums.customsHelp} locale={locale} help={c.customsHelpHelp} helpLabel={c.lines.customsHelp('')}/>}
   {sums.customsDuty>0&&<SummaryLine label={c.lines.customsDuty} amount={sums.customsDuty} locale={locale} help={c.customsDutyHelp} helpLabel={c.lines.customsDuty}/>}
  </div>
  {children}
 </>;
}

/**
 * Express or standard delivery: two buttons that read as one control, each with its window and per-kg rate.
 * The cart saves the choice on the server (one speed per cart); the link-order page keeps it for the add.
 */
export function DeliverySpeedSwitch({value,options,locale,onChange,busy=false,note,compact=false}:{value:DeliverySpeed;options:DeliverySpeedOption[];locale:Locale;onChange:(speed:DeliverySpeed)=>void;busy?:boolean;note?:string;compact?:boolean}){
 const c=deliverySpeedCopy[locale];
 const id=useId();
 return <div className={'speed-switch'+(compact?' compact':'')} aria-busy={busy||undefined}>
  <p className="speed-switch-title" id={id+'-title'}>{c.title}{busy&&<span className="speed-switch-saving" role="status">{c.saving}</span>}</p>
  <div className="speed-switch-options" role="radiogroup" aria-labelledby={id+'-title'}>
   {options.map(option=><button key={option.speed} type="button" role="radio" aria-checked={value===option.speed} className={'speed-option'+(value===option.speed?' selected':'')} disabled={busy} onClick={()=>{if(value!==option.speed)onChange(option.speed)}}>
    <b>{option.name}</b><span>{option.days}</span><small>{option.rate}</small>
   </button>)}
  </div>
  {note&&<p className="speed-switch-note">{note}</p>}
 </div>;
}

/** The hold for unknown store delivery, shown apart from the amount to pay. */
export function HoldNote({amount,locale}:{amount:number;locale:Locale;/** Kept for callers; the rule itself is the help of the bill's store-delivery line. */pricing?:Pricing}){
 const c=calcCopy[locale];
 if(amount<=0)return null;
 return <div className="calc-hold" role="note">
  <Wallet size={17} aria-hidden="true"/>
  <div><span>{c.hold}</span><small>{c.holdNote}</small></div>
  <b>{formatSum(amount,locale)}</b>
 </div>;
}

/**
 * The bill before a link is pasted: the same rows as a real bill, the amounts left as blanks, each row
 * stating its live rule from the tariff. It shows the shape of the answer instead of a list of promises.
 */
export function BlankBill({pricing,locale}:{pricing:Pricing;locale:Locale}){
 const c=calcCopy[locale],b=c.blank;
 const cbu=pricing.fxSource==='cbu'&&Boolean(pricing.fxCbuRate);
 // Both speeds from the US window (the blank bill has no country yet).
 const daysText=(speed:DeliverySpeed)=>{const range=daysRangeFor(pricing,[],speed);const sc=deliverySpeedCopy[locale];return range?sc.days(range[0],range[1]):sc.daysUnknown;};
 const rows:[string,string][]=[
  [b.item,cbu?b.itemCbu(formatPercent((pricing.fxMarkup??1.012)-1,locale)):b.itemSet],
  [b.fee,b.feeRule(formatPercent(pricing.margin+pricing.buyoutFee+pricing.conversionFee,locale))],
  [b.delivery,b.deliveryRule(c.speedRule(formatUsd(deliveryPerKgUsdFor(pricing),locale),daysText('express'),formatUsd(deliveryPerKgUsdFor(pricing,undefined,'standard'),locale),daysText('standard')),formatKg(packagingKg,locale))],
  // A reserve on top of delivery only when the tariff still sets one (none since 5 October 2026).
  ...(pricing.reserve>0?[[b.reserve,b.reserveRule] as [string,string]]:[]),
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
 * Customs in one short block: the monthly allowance per recipient, the estimated duty when this cart goes over it,
 * and — where the customer can choose — who pays the duty: "Atlas pays customs" (a line in the bill at `customsHelpFee`
 * of the cart) or the customer at customs. `helpAmount` is that fee in soum (already in the bill when chosen). The
 * server works the figures out again. "How customs is calculated" opens a small calculator (CustomsHow).
 */
/** The duty prepaid with "Atlas pays customs for me": the server rounds the same way at checkout (checkoutCart). */
export const customsDutyAmount=(estimate:Pick<CustomsEstimate,'estimateUsd'>,pricing:Pick<Pricing,'fx'>)=>Math.ceil(estimate.estimateUsd*pricing.fx);

export function CustomsPanel({estimate,choices,locale,pricing,profiles,recipientId,onRecipient,onChoices,helpAmount,compact=false,busy=false}:{estimate:CustomsEstimate;choices:CartCustoms;locale:Locale;pricing:Pricing;profiles:SavedDeliveryProfile[];recipientId?:string;onRecipient?:(id:string)=>void;onChoices?:(next:CartCustoms)=>void;helpAmount?:number;compact?:boolean;busy?:boolean}){
 const c=calcCopy[locale].customs;
 const id=useId();
 const usd=(value:number)=>usdText(value,locale);
 const over=estimate.dutiableUsd>0;
 return <section className={'calc-customs'+(compact?' compact':'')} aria-labelledby={id+'-title'}>
  <header><Scale size={17} aria-hidden="true"/><h3 id={id+'-title'}>{c.allowanceTitle(usd(estimate.allowanceUsd))}</h3></header>
  <p className="calc-customs-sum">{c.allowanceNote}</p>
  {over&&<p className="calc-customs-over">{(choices.help?c.overIncluded:c.overNote)(usd(estimate.dutiableUsd),formatSum(customsDutyAmount(estimate,pricing),locale))}</p>}
  {profiles.length>1&&onRecipient&&<div className="field calc-customs-recipient"><label htmlFor={id+'-recipient'}>{c.recipient}</label><select id={id+'-recipient'} value={recipientId} onChange={event=>onRecipient(event.target.value)}>{profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.recipient}</option>)}</select></div>}
  {/* Who pays the duty: Atlas (set apart as the easier way) or the customer, when the parcel arrives. */}
  {onChoices&&helpAmount!==undefined&&<fieldset className="customs-choice" disabled={busy} aria-busy={busy||undefined}>
   <legend>{c.choice.title}</legend>
   <label className={'customs-option atlas'+(choices.help?' selected':'')}>
    <input type="radio" name={id+'-payer'} checked={choices.help} onChange={()=>onChoices({...choices,help:true})}/>
    <span className="customs-option-body">
     <span className="customs-option-head"><HandCoins size={16} aria-hidden="true"/><b>{c.choice.atlas}</b><em>{c.choice.badge}</em></span>
     <span className="customs-option-perks" role="list">{c.choice.perks.map(perk=><span role="listitem" key={perk}><Check size={14} aria-hidden="true"/>{perk}</span>)}</span>
     <small className="customs-option-fee">{choices.help?c.helpChosen(formatSum(helpAmount,locale)):c.choice.fee(percent(pricing.customsHelpFee,locale),formatSum(helpAmount,locale))}</small>
    </span>
   </label>
   <label className={'customs-option self'+(!choices.help?' selected':'')}>
    <input type="radio" name={id+'-payer'} checked={!choices.help} onChange={()=>onChoices({...choices,help:false})}/>
    <span className="customs-option-body">
     <span className="customs-option-head"><b>{c.choice.self}</b><small>{c.choice.selfFee}</small></span>
     <small>{over?c.choice.selfOver:c.choice.selfUnder}</small>
    </span>
   </label>
  </fieldset>}
  <CustomsHow estimate={estimate} pricing={pricing} locale={locale}/>
 </section>;
}
