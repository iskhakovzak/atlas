'use client';
import {useId,useState} from 'react';
import {ArrowRight,Info,Link2,PackageCheck,Scale,ShieldCheck,Truck} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {deliveryPerKgUsdFor,deliverySpeeds,perKgSoumFor,pricingForCountry,type DeliverySpeed} from '@/lib/market/domain';
import {courierAllowanceUsd} from '@/lib/market/customs';
import {combinedShipmentWeight} from '@/lib/market/world';
import {deliveryCopy} from '@/lib/market/delivery-copy';
import {deliverySpeedCopy} from '@/lib/market/delivery-speed';
import {tariffRows,type TariffRow} from '@/lib/market/home-facts';
import {formatKg,formatSum,formatUsd} from '@/lib/market/format';
import {regionCountryCode} from '@/lib/market/store-geo';
import {storeBrands,storeCountryNames} from '@/lib/market/store-brands';
import {pickLocale} from '@/lib/market/uz-cyrl';
import type {Locale} from '@/lib/market/i18n';
import {Flag} from './flags';

/** The calculator's weight field: "1,2" and "1.2" are the same; anything outside 0.01–50 kg is not a weight. */
function parseKg(text:string){
 const value=Number(text.replace(',','.').trim());
 return Number.isFinite(value)&&value>=.01&&value<=50?value:null;
}

/**
 * /delivery (redesign stage 8, 1 November 2026): one card per dispatch country with its own price per kg and days for
 * each speed (lib/market/home-facts.ts tariffRows reads pricing.countryOverrides, so a country priced apart shows its
 * own figures), the monthly duty-free allowance, how the weight is counted and a delivery calculator priced exactly as
 * an order prices the delivery line (domain.ts price(): the billed weight × the country's soum rate, plus its margin).
 */
export function DeliveryView(){
 const {state,pricing,siteContent}=useMarket();
 const locale=state.communication.language as Locale;
 const c=deliveryCopy[locale],speed=deliverySpeedCopy[locale];
 const rows=tariffRows(pricing);
 const allowance=formatUsd(pricing.customsAllowanceUsd??courierAllowanceUsd,locale);
 const courier=siteContent.courierNote?pickLocale(siteContent.courierNote,locale):null;
 return <div className="delivery-page">
  <header className="delivery-head">
   <h1>{c.title}</h1>
   <p>{c.lead}</p>
  </header>

  <section className="delivery-section" aria-labelledby="delivery-countries-title">
   <h2 id="delivery-countries-title">{c.countriesTitle}</h2>
   <ul className="delivery-countries">{rows.map(row=><CountryCard key={row.region.id} row={row} locale={locale}/>)}</ul>
  </section>

  <div className="delivery-split">
   <DeliveryCalculator rows={rows} locale={locale}/>
   <div className="delivery-facts">
    <section className="delivery-card delivery-limit" aria-labelledby="delivery-limit-title">
     <span className="delivery-card-icon" aria-hidden="true"><ShieldCheck size={20}/></span>
     <h2 id="delivery-limit-title">{c.limitTitle(allowance)}</h2>
     <p>{c.limitText(allowance)}</p>
     <Link className="text-link" href="/customs">{c.limitLink}<ArrowRight size={16} aria-hidden="true"/></Link>
    </section>
    <section className="delivery-card" aria-labelledby="delivery-weight-title">
     <span className="delivery-card-icon" aria-hidden="true"><Scale size={20}/></span>
     <h2 id="delivery-weight-title">{c.weightTitle}</h2>
     <ul className="delivery-rules">{c.weightRules.map(rule=><li key={rule}>{rule}</li>)}</ul>
    </section>
    {courier&&<section className="delivery-card" aria-labelledby="delivery-courier-title">
     <span className="delivery-card-icon" aria-hidden="true"><Truck size={20}/></span>
     <h2 id="delivery-courier-title">{c.courierTitle}</h2>
     <p>{courier}</p>
    </section>}
   </div>
  </div>
  <p className="delivery-note"><Info size={16} aria-hidden="true"/><span>{c.note} {speed.appliesToCart}</span></p>
 </div>;
}

/** One dispatch country: flag and name, how many stores Atlas buys from there, and each speed's price per kg and days. */
function CountryCard({row,locale}:{row:TariffRow;locale:Locale}){
 const c=deliveryCopy[locale],speed=deliverySpeedCopy[locale];
 const code=regionCountryCode(row.region.id);
 const stores=storeBrands.filter(brand=>brand.storefronts.some(front=>front.country===code)).length;
 return <li className="delivery-country">
  <header>
   <Flag region={row.region.id}/>
   <h3>{storeCountryNames[code][locale]}</h3>
   {stores>0&&<Link className="delivery-country-stores" href={'/stores?country='+code} aria-label={`${c.storesLink}: ${storeCountryNames[code][locale]} — ${c.stores(stores)}`}>{c.stores(stores)}</Link>}
  </header>
  <dl>{row.options.map(option=><div key={option.speed} data-speed={option.speed}>
   <dt>{speed.names[option.speed]}</dt>
   <dd><span className="delivery-rate"><b>{formatUsd(option.usd,locale)}</b>{c.perKg}</span><span className={option.days?'delivery-days':'delivery-days is-pending'}>{option.days?c.days(option.days[0],option.days[1]):c.pending}</span></dd>
  </div>)}</dl>
 </li>;
}

/** Delivery for a weight from a country at a speed, priced as an order's delivery line is. */
function DeliveryCalculator({rows,locale}:{rows:TariffRow[];locale:Locale}){
 const {pricing}=useMarket();
 const c=deliveryCopy[locale],speedCopy=deliverySpeedCopy[locale];
 const id=useId();
 const [region,setRegion]=useState(rows[0]?.region.id??'us');
 const [weight,setWeight]=useState('1,2');
 const [speed,setSpeed]=useState<DeliverySpeed>('standard');
 const row=rows.find(entry=>entry.region.id===region)??rows[0];
 const kg=parseKg(weight);
 // The same country label the rates card reads (tariffRows): one with its own override wins.
 const country=row?.region.countries.find(name=>pricing.countryOverrides?.[name])??row?.region.countries[0];
 const billed=kg===null?null:combinedShipmentWeight(kg);
 // The order's delivery line (domain.ts price()): ceil(billed × soum per kg) plus the delivery margin on it.
 const resolved=pricingForCountry(pricing,country);
 const base=billed===null?0:Math.ceil(billed*perKgSoumFor(resolved,speed));
 const sum=base+Math.round(base*resolved.deliveryMargin);
 const usd=billed===null?0:Math.round(billed*deliveryPerKgUsdFor(pricing,country,speed)*100)/100;
 const days=row?.options.find(option=>option.speed===speed)?.days;
 return <section className="delivery-card delivery-calc" aria-labelledby={id+'-title'}>
  <span className="delivery-card-icon" aria-hidden="true"><PackageCheck size={20}/></span>
  <h2 id={id+'-title'}>{c.calcTitle}</h2>
  <p>{c.calcLead}</p>
  <div className="delivery-calc-fields">
   <div className="field">
    <label htmlFor={id+'-country'}>{c.calcCountry}</label>
    <select id={id+'-country'} value={region} onChange={event=>setRegion(event.target.value as typeof region)}>
     {rows.map(entry=><option key={entry.region.id} value={entry.region.id}>{storeCountryNames[regionCountryCode(entry.region.id)][locale]}</option>)}
    </select>
   </div>
   <div className="field">
    <label htmlFor={id+'-weight'}>{c.calcWeight}</label>
    <input id={id+'-weight'} type="text" inputMode="decimal" autoComplete="off" value={weight} maxLength={6} aria-invalid={kg===null||undefined} aria-describedby={id+'-weight-hint'} onChange={event=>setWeight(event.target.value)}/>
    <small id={id+'-weight-hint'}>{kg===null?c.calcInvalid:c.calcWeightHint}</small>
   </div>
  </div>
  <fieldset className="delivery-speeds">
   <legend>{c.calcSpeed}</legend>
   <div className="delivery-speeds-track">{deliverySpeeds.map(option=><label key={option} className="delivery-speed">
    <input type="radio" name={id+'-speed'} value={option} checked={speed===option} onChange={()=>setSpeed(option)}/>
    <span>{speedCopy.names[option]}</span>
   </label>)}</div>
  </fieldset>
  <div className="delivery-calc-result" role="status" aria-live="polite">
   {billed===null?<span className="delivery-calc-empty">{c.calcInvalid}</span>:<>
    <span className="delivery-calc-label">{c.calcTotal}</span>
    <b className="delivery-calc-usd">{formatUsd(usd,locale)}</b>
    <span className="delivery-calc-sum">{c.calcSum(formatSum(sum,locale))}</span>
    <span className="delivery-calc-meta">{c.calcBilled(formatKg(billed,locale))} · {c.calcBilledNote}{days?` · ${c.days(days[0],days[1])}`:''}</span>
   </>}
  </div>
  <Link className="btn primary delivery-calc-cta" href="/order-by-link"><Link2 size={18} aria-hidden="true"/>{c.calcCta}<ArrowRight size={18} aria-hidden="true"/></Link>
 </section>;
}
