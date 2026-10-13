'use client';
import {Fragment,useEffect,useId,useState,type FormEvent,type ReactNode} from 'react';
import { ArrowRight, ArrowUpRight, BadgeCheck, Check, CircleHelp, ClipboardPaste, Info, Landmark, Link2, LockKeyhole, MessagesSquare, PackageCheck, Plane, ReceiptText, Scale, SearchCheck, ShieldCheck, Store, Truck } from 'lucide-react';
import Link from '@/components/site-link';
import {PasteButton} from '@/components/paste-button';
import {useMarket} from '@/lib/market/store';
import {deliveryPerKgUsdFor,deliverySpeeds,price,unknownStoreShippingUsd,validateSource} from '@/lib/market/domain';
import {atlasServiceBreakdown} from '@/lib/market/quote-presentation';
import {courierAllowanceUsd} from '@/lib/market/customs';
import {combinedShipmentWeight,packagingKg} from '@/lib/market/world';
import {homeCopy} from '@/lib/market/home-copy';
import {formatKg,formatPercent,formatPriceUsd,formatSum,formatUsd,groupDigits} from '@/lib/market/format';
import {speedPriceRange,tariffRows} from '@/lib/market/home-facts';
import {deliveryDaysFor,deliveryRegions,paymentLabels} from '@/lib/market/site-content';
import {localizedStatuses,routeTitle,type Locale} from '@/lib/market/i18n';
import {pickLocale} from '@/lib/market/uz-cyrl';
import {popularBrandKeys,storeBrands,storeFocusNames,storefrontUrl} from '@/lib/market/store-brands';
import {StoreLogo,StoreMark,hasStoreMark} from './store-logo';
import {StoreMarquee} from './store-marquee';
import {CountryFlag,Flag} from './flags';
import {Money} from './money';
import {JsonLd} from './json-ld';
import {faqPage} from '@/lib/seo/structured-data';
import {MissingContent} from './site-footer';

/** The hero's popular stores; the wide-screen facts row and closing card show the same list (app/home-facts.tsx, HomeClosing). */
export const heroStores=['nike','zara','amazon','apple','iherb','adidas','hm','sephora'].map(key=>storeBrands.find(brand=>brand.key===key)!).filter(Boolean);
/**
 * The worked example on the home page, priced by the same function as a real order (owner, 14.10.2026): $69 sneakers,
 * standard delivery, 0.7 kg in the box, so with the packaging allowance the bill weighs the usual 1 kg.
 */
const exampleUsd=69,exampleBoxedKg=.7,exampleSpeed='standard' as const;
/** The step the tracking example stands at ("In transit"): the money sheet and the wide-screen step example agree. */
export const trackingCurrent=4;

export function useHomeCopy(){
 const {state}=useMarket();
 const locale=state.communication.language as Locale;
 return {locale,c:homeCopy[locale]};
}

/** Scrolls to the home link field and focuses it (no smooth scroll under reduced motion). */
export function focusLinkInput(){
 const input=document.getElementById('finds-product-url') as HTMLInputElement|null;
 if(!input)return;
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 input.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});
 input.focus({preventScroll:true});
}

export function InfoTip({label,children}:{label:string;children:ReactNode}){
 const [open,setOpen]=useState(false);
 const id=useId();
 useEffect(()=>{
  if(!open)return;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false)};
  window.addEventListener('keydown',close);
  return ()=>window.removeEventListener('keydown',close);
 },[open]);
 return <span className="home-tip">
  <button type="button" className="home-tip-button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}><Info size={16} aria-hidden="true"/></button>
  {open&&<span id={id} role="note" className="home-tip-panel">{children}</span>}
 </span>;
}

/** The popular stores and "All N stores": the hero's list, repeated in the wide-screen closing card. */
export function HomeStoreList({label,labelledBy}:{label?:string;labelledBy?:string}){
 const {c}=useHomeCopy();
 return <ul aria-label={label} aria-labelledby={labelledBy}>{heroStores.map(store=><li key={store.key}><a href={storefrontUrl(store)} target="_blank" rel="noopener noreferrer"><StoreLogo brand={store} size={20}/>{store.name}<span className="sr-only"> ({c.hero.openStore})</span></a></li>)}<li><Link className="home-stores-all" href="/stores">{c.hero.allStores(storeBrands.length)}</Link></li></ul>;
}

/** A product link field: a valid link opens the order by link with it, anything else shows the hero's hint. */
function useLinkSubmit(){
 const {c}=useHomeCopy();
 const [url,setUrl]=useState('');
 const [error,setError]=useState('');
 function submit(event:FormEvent){
  event.preventDefault();
  try{const target=validateSource(url.trim());setError('');window.location.assign('/order-by-link?url='+encodeURIComponent(target))}
  catch{setError(c.hero.invalid)}
 }
 return {url,error,submit,change:(value:string)=>{setUrl(value);setError('')}};
}

export function HomeHero({showCatalogLink}:{showCatalogLink:boolean}){
 const {status}=useMarket();
 const {c,locale}=useHomeCopy();
 const {url,error,submit,change}=useLinkSubmit();
 return <section className="home-hero" aria-labelledby="home-title">
  <h1 id="home-title">{c.hero.title}</h1>
  <p className="home-hero-lead">{c.hero.lead}</p>
  <form id="home-link-form" className="home-link-form" onSubmit={submit} noValidate>
   <label className="sr-only" htmlFor="finds-product-url">{c.hero.label}</label>
   <span className="home-link-field"><Link2 size={20} aria-hidden="true"/><input id="finds-product-url" name="url" type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.hero.placeholder} aria-invalid={!!error} aria-describedby={error?'home-link-error':'home-link-note'} onChange={event=>change(event.target.value)}/><PasteButton targetId="finds-product-url" locale={locale} onPaste={change}/></span>
   <button type="submit" className="btn primary home-cta">{c.hero.calculate}</button>
  </form>
  {error?<p id="home-link-error" className="home-link-error" role="alert">{error}</p>:<p id="home-link-note" className="home-link-note">{status==='authenticated'?c.hero.memberNote:c.hero.guestNote}</p>}
  <div className="home-stores home-stores-marquee">
   <StoreMarquee label={c.hero.popular} openStore={c.hero.openStore} allStores={c.hero.allStores(storeBrands.length)} hint={c.hero.storesHint} locale={locale}/>
   <p className="home-stores-hint tip-text">{c.hero.storesHint}</p>
  </div>
  <div className="home-hero-links"><Link href="/batch-import">{c.hero.batch}</Link>{showCatalogLink&&<Link href="/catalog">{c.hero.catalog}</Link>}</div>
 </section>;
}

/** The worked example's amounts, priced like a real order: the bill card and the wide-screen step example show the same numbers. */
export function useExampleBill(){
 const {pricing}=useMarket();
 const quote=price(exampleUsd,combinedShipmentWeight(exampleBoxedKg),1,0,pricing,exampleSpeed);
 return {quote,parts:atlasServiceBreakdown(quote)};
}

/**
 * The worked example as a bill in a folder: the white sheet is the amount to pay, the slip under it holds
 * what is kept apart from it. Every amount comes from price() with the packed weight, as in a real order.
 */
export function ExampleQuote(){
 const {pricing}=useMarket();
 const {locale,c}=useHomeCopy();
 const {quote,parts}=useExampleBill();
 const packed=combinedShipmentWeight(exampleBoxedKg);
 const fee=formatPercent(pricing.margin+pricing.buyoutFee+pricing.conversionFee,locale);
 const days=deliveryDaysFor(pricing,'us',exampleSpeed);
 const allowance=pricing.customsAllowanceUsd??courierAllowanceUsd;
 const usd=formatUsd(exampleUsd,locale);
 // The bar under the total and the dots on the two lines share these colours (app/home-bill.css); the amounts stay in the text.
 const itemShare=quote.total>0?Math.round(quote.merchandise/quote.total*1000)/10:0;
 // Only the goods' price counts towards the duty-free allowance, as in the cart (lib/market/allowance.ts).
 const allowanceUsed=allowance>0?Math.min(100,exampleUsd/allowance*100):0;
 // The whole bill in dollars at the same Atlas rate: the store's $69 next to what reaches Tashkent.
 const totalUsd=pricing.fx>0?formatUsd(Math.round(quote.total/pricing.fx),locale):null;
 return <aside id="example" className="folio home-folio" aria-labelledby="example-title">
  {/* The caption names the example as an order line: what is bought, where and for how much (owner, 14.10.2026: the card
      looked dry and empty). It takes the place of the old one-line caption, so the card grows only a little. */}
  <p className="folio-cap bill-product"><span className="bill-product-mark" aria-hidden="true"><StoreMark brandKey="nike" height={14} maxWidth={28}/></span><span className="bill-product-name" aria-hidden="true"><b>{c.trust.trackingProduct}</b><small>nike.com · {usd}</small></span><b id="example-title" className="bill-product-label">{c.example.title}<span className="sr-only">: {c.example.product(usd)}</span></b></p>
  <div className="folio-sheet home-quote">
   <p className="bill-route"><span className="bill-route-end"><Flag region="us" className="bill-route-flag"/><span className="sr-only">{c.example.routeLabel}: </span>{c.tariffs.regions.us}</span><span className="bill-route-path" aria-hidden="true"><span className="bill-route-line"/><Plane className="bill-route-plane" size={17} strokeWidth={2}/></span><span className="sr-only"> → </span><span className="bill-route-end">{c.example.to}</span></p>
   {days&&<p className="bill-days">{c.example.days(days[0],days[1])}</p>}
   <dl className="bill">
    <div className="bill-row-item"><dt>{c.example.item}</dt><dd>{formatSum(quote.merchandise,locale)}</dd><dd className="bill-note">{c.example.itemNote(usd)}</dd></div>
    {/* One «Atlas service» line with its parts folded under it, as the real bill groups them (app/cost-lines.tsx). */}
    <div className="bill-row-service"><dt>{c.example.service}</dt><dd>{formatSum(parts.service+parts.international,locale)}</dd><dd className="bill-note"><details className="bill-breakdown"><summary>{c.example.serviceParts}</summary><ul className="bill-parts">
     <li><span>{c.example.fee(fee)}</span><span>{formatSum(parts.service,locale)}</span></li>
     <li><span>{c.example.delivery} <small>{c.example.deliveryNote(formatKg(packed,locale),formatUsd(deliveryPerKgUsdFor(pricing,undefined,exampleSpeed),locale))}</small></span><span>{formatSum(parts.international,locale)}</span></li>
    </ul></details></dd></div>
    {/* A reserve on top of delivery only while the tariff sets one (none since 5 October 2026). */}
    {quote.reserve>0&&<div><dt><span className="home-dt-with-tip">{c.example.reserve}<InfoTip label={c.example.reserveHelpLabel}>{c.example.reserveHelp}</InfoTip></span></dt><dd>{formatSum(quote.reserve,locale)}</dd><dd className="bill-note">{c.example.reserveNote(formatKg(packagingKg,locale))}</dd></div>}
   </dl>
   <p className="bill-total home-quote-total"><span>{c.example.total}</span><strong><Money value={quote.total} locale={locale}/></strong></p>
   <span className="bill-split" aria-hidden="true"><span style={{flexGrow:itemShare}}/><span style={{flexGrow:100-itemShare}}/></span>
   {/* The bar's legend (owner, 14.10.2026: "make it even better"): most of the money is the item itself. */}
   <p className="bill-split-legend"><span>{c.example.shareItem(formatPercent(Math.round(itemShare)/100,locale))}</span><span>{c.example.shareService(formatPercent((100-Math.round(itemShare))/100,locale))}</span></p>
   {/* The Atlas rate is no longer printed here (owner, 14.10.2026: anyone can divide; the rate is explained in the money
       section and fixed in the order at payment). The dollar total says what the store's price turns into. */}
   {totalUsd&&<p className="bill-usd"><PackageCheck className="bill-usd-icon" size={16} strokeWidth={2} aria-hidden="true"/>{c.example.totalUsd(totalUsd)}</p>}
  </div>
  <section className="folio-outside home-customs-slip" aria-labelledby="example-outside">
   <h2 id="example-outside"><ShieldCheck className="home-customs-icon" size={16} aria-hidden="true"/>{c.example.dutyTitle(formatUsd(allowance,locale))}</h2>
   <p className="home-customs-meter"><span className="home-customs-track" aria-hidden="true"><span style={{width:`${allowanceUsed}%`}}/></span><span>{c.example.dutyUsed(usd,formatUsd(Math.max(0,allowance-exampleUsd),locale))}</span></p>
   <p className="home-customs-note">{c.example.dutyNote}</p>
  </section>
 </aside>;
}

const stepIcons=[Link2,ReceiptText,BadgeCheck,Truck];
/** The money rules in the order of homeCopy.trust.facts: price check, rate, one service line, store shipping, weighing. */
const factIcons=[SearchCheck,LockKeyhole,ReceiptText,Truck,Scale];
/** Step 1's example: a few of the catalogue's popular stores that have a mark, and how many more there are. */
const stepStores=popularBrandKeys.filter(key=>hasStoreMark(key)&&storeBrands.some(brand=>brand.key===key)).slice(0,4);

export function HowItWorks(){
 const {c,locale}=useHomeCopy();
 const {siteContent}=useMarket();
 // TODO(owner): crypto payments — confirm their legal status in Uzbekistan before keeping them on the site. Until then
 // crypto goes last and quieter than the card and local payment methods.
 const payments=[...siteContent.paymentMethods].sort((a,b)=>Number(a==='crypto')-Number(b==='crypto'));
 const courierNote=siteContent.courierNote?pickLocale(siteContent.courierNote,locale):undefined;
 return <section id="how" className="home-section" data-chapter="how" aria-labelledby="how-title">
  <h2 id="how-title">{c.how.title}</h2>
  <ol className="home-steps">{c.how.steps.map((step,index)=><li key={step.title} className="home-step">
   <span className="home-step-station" aria-hidden="true">{index+1}</span>
   {/* Wide screens only: the stage's icon in the card's corner (owner, 7.10.2026: "fill the cards a little"). */}
   <span className="hw-step-icon" aria-hidden="true">{(()=>{const Icon=stepIcons[index];return <Icon size={22} strokeWidth={1.9}/>})()}</span>
   <h3>{step.title}</h3><p>{step.text}</p>
   {index===2&&(siteContent.paymentMethods.length?<ul className="home-payments" aria-label={c.how.paymentsLabel}>{payments.map(method=><li key={method} className={method==='crypto'?'home-payment-minor':undefined}>{paymentLabels[method]}</li>)}</ul>:<MissingContent what="способы оплаты — только реально подключённые провайдеры"/>)}
   {/* Owner, 7.10.2026: the parcel goes to the door by courier. Price and coverage are the owner's words (admin, «Контент сайта»). */}
   {index===3&&<><ul className="home-payments home-delivery" aria-label={c.how.deliveryLabel}><li>{c.how.courier}</li></ul>{courierNote?<p className="home-courier-note">{courierNote}</p>:<MissingContent what="курьер по Ташкенту: цена и зона доставки"/>}</>}
   {/* Wide screens only (app/home-wide-content.css): a small picture of the step, built from the page's own copy and numbers.
       The first one is a working link field (owner, 7.10.2026), the rest are pictures. */}
   <div className="hw-demo-wrap" aria-hidden={index===0?undefined:true}><StepDemo index={index}/></div>
  </li>)}</ol>
 </section>;
}

/** The first step's working link field: the same check and destination as the hero's form. */
function StepLinkForm(){
 const {status}=useMarket();
 const {c,locale}=useHomeCopy();
 const {url,error,submit,change}=useLinkSubmit();
 return <form className="hw-demo hw-demo-field" onSubmit={submit} noValidate>
  <label className="sr-only" htmlFor="how-product-url">{c.hero.label}</label>
  <span className="hw-demo-input"><Link2 size={15} strokeWidth={2} aria-hidden="true"/><input id="how-product-url" name="url" type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.hero.placeholder} aria-invalid={!!error} aria-describedby="how-link-note" onChange={event=>change(event.target.value)}/><PasteButton targetId="how-product-url" locale={locale} onPaste={change}/><button type="submit" aria-label={c.hero.calculate} title={c.hero.calculate}><ArrowRight size={15} strokeWidth={2.2} aria-hidden="true"/></button></span>
  <span className="hw-demo-stores" aria-hidden="true">{stepStores.map(key=><StoreMark key={key} brandKey={key} height={17} maxWidth={58}/>)}<small>{c.how.moreStores(storeBrands.length-stepStores.length)}</small></span>
  <span id="how-link-note" className={'hw-demo-note'+(error?' error':'')} role={error?'alert':undefined}>{error||(status==='authenticated'?c.hero.memberNote:c.hero.guestNote)}</span>
 </form>;
}

/** The example inside a step card: the link field, the example bill, what is checked before the order, the tracking example. */
function StepDemo({index}:{index:number}){
 const {locale,c}=useHomeCopy();
 const {quote,parts}=useExampleBill();
 if(index===0)return <StepLinkForm/>;
 if(index===1){
  const rows:[string,number][]=[[c.example.item,quote.merchandise],[c.example.service,parts.service+parts.international],...(quote.reserve>0?[[c.example.reserve,quote.reserve] as [string,number]]:[])];
  return <div className="hw-demo hw-demo-bill"><span className="hw-tag">{c.example.title}</span>
   {rows.map(([label,amount])=><span key={label} className="hw-demo-row"><span>{label}</span><i/><b>{formatSum(amount,locale)}</b></span>)}
   <span className="hw-demo-total"><span>{c.example.total}</span><b>{formatSum(quote.total,locale)}</b></span>
  </div>;
 }
 // Before the order nothing is done yet: neutral points, not ticks.
 if(index===2)return <div className="hw-demo hw-demo-check">{c.wide.stepCheck.map(text=><span key={text} className="hw-demo-point"><span className="hw-demo-dot"/>{text}</span>)}<span className="hw-demo-button"><Check size={15} strokeWidth={2.4}/>{c.how.confirm}</span></div>;
 const statuses=localizedStatuses(locale),start=Math.max(0,statuses.length-3);
 return <div className="hw-demo hw-demo-track"><span className="hw-demo-tags"><span className="hw-tag">{c.trust.example}</span><span className="hw-tag hw-tag-line">{c.how.courier}</span></span><span className="hw-demo-item">{`${c.trust.trackingProduct} · ${c.trust.trackingOrder}`}</span>
  <span className="hw-demo-list">{statuses.slice(start).map((label,offset)=>{const at=start+offset,state=at<trackingCurrent?'done':at===trackingCurrent?'current':'next';
   return <span key={label} className="hw-demo-status" data-state={state}><span className="hw-demo-status-dot">{state==='done'&&<Check size={11} strokeWidth={3}/>}</span>{label}</span>;})}</span>
 </div>;
}

export function DeliveryTariffs(){
 const {pricing}=useMarket();
 const {locale,c}=useHomeCopy();
 const missingDays=deliveryRegions.some(region=>deliverySpeeds.some(speed=>!deliveryDaysFor(pricing,region.id,speed)));
 // One table (owner, 13.10.2026): a price chip per speed above it, the days per country in it. The owner can still
 // set a rate per country and speed: then the chip says "from" and that speed's cells carry their own price.
 const rows=tariffRows(pricing);
 const chips=deliverySpeeds.flatMap(speed=>{const range=speedPriceRange(rows,speed);return range?[{speed,usd:range.min,uniform:range.min===range.max}]:[];});
 const uniform=new Set(chips.filter(chip=>chip.uniform).map(chip=>chip.speed));
 return <section id="tariffs" className="home-section tariff-section" data-chapter="tariffs" aria-labelledby="tariffs-title">
  <h2 id="tariffs-title">{c.tariffs.title}</h2>
  <p className="home-section-lead">{c.tariffs.lead}</p>
  <div className="tariff-table">
   <ul className="tariff-chips" aria-label={c.tariffs.perKg}>{chips.map(({speed,usd,uniform})=><li key={speed} className={`tariff-chip tariff-${speed}`}>
    <span className="tariff-speed">{c.tariffs.speeds[speed]}</span>
    <b>{uniform?formatUsd(usd,locale):c.wide.priceFrom(formatUsd(usd,locale))}<small>{c.tariffs.perKgUnit}</small></b>
    <span className="tariff-100g">{c.tariffs.per100g(formatPriceUsd(usd/10,locale))}</span>
   </li>)}</ul>
   <table>
    <caption className="sr-only">{c.tariffs.time}</caption>
    <thead><tr><th scope="col">{c.tariffs.country}</th>{deliverySpeeds.map(speed=><th key={speed} scope="col" className={`tariff-${speed}`}>{c.tariffs.speeds[speed]}</th>)}</tr></thead>
    <tbody>{rows.map(({region,options})=><tr key={region.id}>
     <th scope="row"><span className="tariff-country"><Flag region={region.id}/><span>{c.tariffs.regions[region.id]}</span></span></th>
     {options.map(({speed,days,usd})=><td key={speed} className={`tariff-${speed}`}>
      <span className={days?'tariff-days':'tariff-days tariff-pending'}>{days?c.tariffs.days(days[0],days[1]):c.tariffs.pending}</span>
      {!uniform.has(speed)&&<span className="tariff-cell-price">{formatUsd(usd,locale)}{c.tariffs.perKgUnit}</span>}
     </td>)}
    </tr>)}</tbody>
   </table>
  </div>
  {missingDays&&<MissingContent what="сроки доставки по странам и скоростям (дни, от–до)"/>}
  <p className="home-note tariff-note">{c.tariffs.weightNote} {c.tariffs.rateNote}</p>
  {/* Wide screens only: what the table's days cover. No days here — they stay in the table. */}
  <div className="hw-route" role="group" aria-label={c.wide.routeTitle}>
   <h3>{c.wide.routeTitle}</h3>
   <ol>
    <li><span className="hw-route-icon" aria-hidden="true"><Store size={20} strokeWidth={1.8}/></span><span><b>{c.wide.routeStore}</b><small>{c.wide.routeStoreNote}</small></span></li>
    <li className="hw-route-main"><span className="hw-route-icon" aria-hidden="true"><Plane size={20} strokeWidth={1.8}/></span><span><b>{c.wide.routeFly} <em>{c.wide.routeFlyNote}</em></b><small>{`${c.tariffs.speeds.express} ${c.wide.or} ${c.tariffs.speeds.standard.toLocaleLowerCase(locale)}`}</small></span></li>
    <li><span className="hw-route-icon" aria-hidden="true"><Landmark size={20} strokeWidth={1.8}/></span><span><b>{c.wide.routeCustoms}</b><small>{c.wide.routeCustomsNote}</small></span></li>
   </ol>
  </div>
 </section>;
}

export function TrustSection(){
 const {pricing,siteContent}=useMarket();
 const {locale,c}=useHomeCopy();
 const statuses=localizedStatuses(locale);
 const current=trackingCurrent;
 const {legal,reviews,parcelPhotos,completedOrders}=siteContent;
 const legalAddress=(legal.address?pickLocale(legal.address,locale):undefined);
 const freeFromUsd=pricing.storeShippingFreeFromUsd??50;
 const facts=c.trust.facts({
  fee:formatPercent(pricing.margin+pricing.buyoutFee+pricing.conversionFee,locale),
  freeFrom:formatUsd(freeFromUsd,locale),
  hold:formatUsd(unknownStoreShippingUsd,locale),
  // An order below the free threshold, so the example gets the reserve.
  holdExample:formatUsd(Math.max(1,Math.floor(freeFromUsd*0.6)),locale),
 });
 // Two parts so phones can show each as a sheet of its own: the money facts, then the proof (tracking, photos, legal).
 return <section id="trust" className="home-section" data-chapter="trust" aria-labelledby="trust-title">
  <div className="home-trust-money">
  <h2 id="trust-title">{c.trust.title}</h2>
  {completedOrders!==null?<p className="home-counter"><strong>{groupDigits(completedOrders)}</strong> {c.trust.ordersDone}</p>:<MissingContent what="число реально выполненных заказов"/>}
  {/* Each rule as a card with a short title (owner, 14.10.2026: the plain list read as a wall of text). */}
  <ul className="home-fact-cards">{facts.map((fact,index)=>{const Icon=factIcons[index]??Check;return <li key={fact.title}><span className="home-fact-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.9}/></span><h3>{fact.title}</h3><p>{fact.text}</p></li>;})}</ul>
  </div>
  <div className="home-trust-proof">
  <div className={'home-trust-grid'+(reviews.length?'':' single')}>
   <article className="home-tracking" aria-labelledby="tracking-title">
    <header><h3 id="tracking-title">{c.trust.trackingTitle}</h3><span className="home-badge">{c.trust.example}</span></header>
    <p className="home-tracking-item"><span className="home-tracking-mark" aria-hidden="true"><StoreMark brandKey="nike" height={13} maxWidth={26}/></span><span className="home-tracking-name"><b>{c.trust.trackingProduct}</b><span>{c.trust.trackingOrder}</span></span><span className="home-tracking-now"><span className="home-tracking-pulse" aria-hidden="true"/>{c.trust.trackingNow}: {statuses[current]}</span></p>
    <ol>{statuses.map((status,index)=><li key={status} data-state={index<current?'done':index===current?'current':'next'} aria-current={index===current?'step':undefined}><span className="home-tracking-dot" aria-hidden="true">{index<current&&<Check size={12}/>}</span>{status}</li>)}</ol>
    <p className="home-note">{c.trust.trackingNote}</p>
   </article>
   {reviews.length?<div className="home-reviews"><h3>{c.trust.reviewsTitle}</h3>{reviews.map(review=><figure key={review.name+review.text.ru}><blockquote>{pickLocale(review.text,locale)}</blockquote><figcaption>{review.name}{review.city?`, ${review.city}`:''}</figcaption></figure>)}</div>:<MissingContent what="отзывы реальных клиентов (с их согласия)"/>}
  </div>
  {parcelPhotos.length?<div className="home-parcels"><h3>{c.trust.photosTitle}</h3><ul>{parcelPhotos.map(photo=><li key={photo.src}>
   {/* Static photos from public/ are small and lazy-loaded; next/image is not used in this app. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={photo.src} alt={pickLocale(photo.alt,locale)} loading="lazy" decoding="async" width={320} height={240}/>
  </li>)}</ul></div>:<MissingContent what="фото реальных посылок (файлы в public/)"/>}
  {/* Without company details the block would hold only a link that the FAQ and the footer already give. */}
  {legal.entityName||legal.inn||legalAddress?<div className="home-legal">
   <h3>{c.trust.legalTitle}</h3>
   <dl>{legal.entityName&&<div><dt>{c.trust.entity}</dt><dd>{legal.entityName}</dd></div>}{legal.inn&&<div><dt>{c.trust.inn}</dt><dd>{legal.inn}</dd></div>}{legalAddress&&<div><dt>{c.trust.address}</dt><dd>{legalAddress}</dd></div>}</dl>
   <Link href="/legal#offer">{c.trust.legalLink}</Link>
  </div>:<MissingContent what="юрлицо, ИНН и адрес"/>}
  </div>
 </section>;
}

// The FAQ chat: a 5s turn per question, and the answer's first sentence (at most ~120 characters).
const chatTiming=(index:number,count:number)=>({animationDelay:`${index*5}s`,animationDuration:`${count*5}s`});
const firstSentence=(text:string)=>{const first=text.split(/(?<=[.!?])\s/)[0]??text;return first.length>124?first.slice(0,120).replace(/\s+\S*$/,'')+'…':first};
export function HomeFaq(){
 const {locale,c}=useHomeCopy();
 const {pricing,siteContent}=useMarket();
 // One range per speed across the countries (shortest to longest); the table under #tariffs has them per country.
 const known=deliverySpeeds.flatMap(speed=>{
  const all=deliveryRegions.flatMap(region=>{const days=deliveryDaysFor(pricing,region.id,speed);return days?[days]:[];});
  return all.length?[`${c.tariffs.speeds[speed].toLocaleLowerCase(locale)} ${c.tariffs.days(Math.min(...all.map(d=>d[0])),Math.max(...all.map(d=>d[1])))}`]:[];
 });
 const prohibitedUrl=siteContent.prohibitedListUrl;
 const items:{q:string;a:string;link?:ReactNode}[]=[
  {q:c.faq.timesQuestion,a:known.length?c.faq.timesKnown(known.join(', ')):c.faq.timesUnknown,link:<a href="#tariffs">{c.faq.timesLink}</a>},
  {...c.faq.items.customs(formatUsd(pricing.customsAllowanceUsd??courierAllowanceUsd,locale)),link:<Link href="/customs">{c.faq.customsLink}</Link>},
  c.faq.items.returns,
  {...c.faq.items.prohibited,link:prohibitedUrl?<a href={prohibitedUrl} target="_blank" rel="noopener noreferrer">{c.faq.prohibitedOfficial}</a>:<Link href="/legal#offer">{c.faq.prohibitedRules}</Link>},
  c.faq.items.weight,
  c.faq.items.account,
 ];
 return <section id="faq" className="home-section" data-chapter="faq" aria-labelledby="faq-title">
  <div className="home-faq-head"><h2 id="faq-title">{c.faq.title}</h2>
   {/* Wide screens only (owner, 7.10.2026: "add something to sheet 6", "add more"): a little support chat under the title.
       The six questions are asked in turn (5s each); Atlas types, then answers with the first sentence of the real
       answer. Decoration: the full answers are the list. */}
   <div className="hw-faq-chat" aria-hidden="true">
    <div className="hw-chat-row"><span className="hw-chat-face"><CircleHelp size={19} strokeWidth={2}/></span>
     <span className="hw-chat-stack">{items.map((item,index)=><span key={item.q} className="hw-chat-bubble hw-chat-q" style={chatTiming(index,items.length)}>{item.q}</span>)}</span></div>
    <div className="hw-chat-row hw-chat-answer"><span className="hw-chat-stack">{items.map((item,index)=><Fragment key={item.q}>
      <span className="hw-chat-bubble hw-chat-typing" style={chatTiming(index,items.length)}><i/><i/><i/></span>
      <span className="hw-chat-bubble hw-chat-a" style={chatTiming(index,items.length)}>{firstSentence(item.a)}</span></Fragment>)}</span>
     <span className="hw-chat-face hw-chat-atlas"><MessagesSquare size={18} strokeWidth={2}/></span></div>
   </div>
   {/* Wide screens only: where to go when the six answers are not enough (existing page names). */}
   <div className="hw-faq-more"><p>{c.wide.faqMore} <Link href="/support">{routeTitle(locale,'support')}</Link></p><ul><li><Link href="/customs">{c.faq.customsLink}</Link></li><li><Link href="/legal">{c.footer.rules}</Link></li></ul></div>
  </div>
  {/* One answer open at a time (name): the sheet keeps to one screen. */}
  <JsonLd data={faqPage(items)}/>
  <div className="home-faq">{items.map(item=><details key={item.q} name="home-faq"><summary>{item.q}</summary><div><p>{item.a}</p>{item.link}</div></details>)}</div>
 </section>;
}

/** Desktop close of the page: one line and the action that brings the link field back. Phones have the sticky button. */
export function HomeClosing(){
 const {c}=useHomeCopy();
 return <section className="home-section home-closing" aria-labelledby="closing-title">
  <h2 id="closing-title">{c.closing.title}</h2>
  <p>{c.closing.text}</p>
  <button type="button" className="btn primary home-cta" onClick={focusLinkInput}><ClipboardPaste size={18} aria-hidden="true"/>{c.sticky.paste}</button>
  {/* Wide screens only: the hero's stores again, without the "field above" hint. */}
  <ClosingStores/>
 </section>;
}

/** Owner, 7.10.2026: the closing's stores were a plain row of chips ("too simple"). Now tiles: the logo on its plate, the
 * name, the home country and what the store sells; and the way to all stores with a stack of more logos. Wide screens only
 * (app/home-wide-content.css); each tile opens the store in a new tab, as the hero's chips do. */
const closingMore=storeBrands.filter(brand=>brand.logo&&!heroStores.includes(brand)&&popularBrandKeys.includes(brand.key)).slice(0,4);
function ClosingStores(){
 const {c,locale}=useHomeCopy();
 return <div className="hw-closing-stores">
  <p id="closing-stores-label" className="hw-closing-stores-label">{c.hero.popular}</p>
  <ul className="hw-cs-grid" aria-labelledby="closing-stores-label">{heroStores.map(store=><li key={store.key}>
   <a className="hw-cs-tile" href={storefrontUrl(store)} target="_blank" rel="noopener noreferrer">
    <StoreLogo brand={store} size={36}/>
    <span className="hw-cs-text"><span className="hw-cs-name">{store.name}</span><span className="hw-cs-meta"><CountryFlag code={store.country} className="hw-cs-flag"/><span className="hw-cs-kind">{storeFocusNames[store.focus][locale]}</span></span></span>
    <ArrowUpRight className="hw-cs-go" size={16} aria-hidden="true"/><span className="sr-only"> ({c.hero.openStore})</span>
   </a>
  </li>)}</ul>
  <Link className="hw-cs-all" href="/stores"><span className="hw-cs-stack" aria-hidden="true">{closingMore.map(brand=><StoreLogo key={brand.key} brand={brand} size={32}/>)}</span><span className="hw-cs-all-text">{c.hero.allStores(storeBrands.length)}</span><ArrowRight size={18} aria-hidden="true"/></Link>
 </div>;
}

/** Mobile: once the hero form scrolls away, a sticky button brings it back and focuses the input. */
export function StickyLinkCta({aboveNav}:{aboveNav:boolean}){
 const {c}=useHomeCopy();
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  const form=document.getElementById('home-link-form');
  if(!form||!('IntersectionObserver' in window))return;
  const observer=new IntersectionObserver(([entry])=>setVisible(!entry.isIntersecting));
  observer.observe(form);
  return ()=>observer.disconnect();
 },[]);
 if(!visible)return null;
 return <div className={'home-sticky'+(aboveNav?' above-nav':'')}>
  <button type="button" className="btn primary home-cta" onClick={focusLinkInput}><ClipboardPaste size={18} aria-hidden="true"/>{c.sticky.paste}</button>
 </div>;
}
