'use client';
import {Fragment,useEffect,useId,useState,type FormEvent,type ReactNode} from 'react';
import { ArrowRight, ArrowUpRight, BadgeCheck, Check, CircleHelp, ClipboardPaste, Info, Landmark, Link2, MessagesSquare, Plane, ReceiptText, Store, Truck } from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {deliveryPerKgUsdFor,deliverySpeeds,price,validateSource} from '@/lib/market/domain';
import {atlasServiceBreakdown} from '@/lib/market/quote-presentation';
import {courierAllowanceUsd} from '@/lib/market/customs';
import {combinedShipmentWeight,packagingKg} from '@/lib/market/world';
import {formatKg,formatPercent,formatPriceUsd,formatSum,formatUsd,groupDigits,homeCopy} from '@/lib/market/home-copy';
import {tariffRows} from '@/lib/market/home-facts';
import {deliveryDaysFor,deliveryRegions,paymentLabels} from '@/lib/market/site-content';
import {localizedStatuses,routeTitle,type Locale} from '@/lib/market/i18n';
import {popularBrandKeys,storeBrands,storeFocusNames} from '@/lib/market/store-brands';
import {StoreLogo,StoreMark,hasStoreMark} from './store-logo';
import {StoreMarquee} from './store-marquee';
import {CountryFlag,Flag} from './flags';
import {Money} from './money';
import {JsonLd} from './json-ld';
import {faqPage} from '@/lib/seo/structured-data';

const isDev=(import.meta as {env?:{DEV?:boolean}}).env?.DEV===true;
/** The hero's popular stores; the wide-screen facts row and closing card show the same list (app/home-facts.tsx, HomeClosing). */
export const heroStores=['nike','zara','amazon','apple','iherb','adidas','hm','sephora'].map(key=>storeBrands.find(brand=>brand.key===key)!).filter(Boolean);
/** The worked example on the home page: $100 sneakers, 1 kg in the box, priced by the same function as a real order. */
const exampleUsd=100,exampleBoxedKg=1;
/** The step the tracking example stands at ("In transit"): the money sheet and the wide-screen step example agree. */
export const trackingCurrent=4;

export function useHomeCopy(){
 const {state}=useMarket();
 const locale=state.communication.language as Locale;
 return {locale,c:homeCopy[locale]};
}

/** Dev-only marker for business data that is not filled yet; production renders nothing. */
export function MissingContent({what}:{what:string}){
 if(!isDev)return null;
 return <p className="home-missing" role="note">Нужно заполнить: {what} — в админке, раздел «Контент сайта»</p>;
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
 return <ul aria-label={label} aria-labelledby={labelledBy}>{heroStores.map(store=><li key={store.key}><a href={'https://'+store.storefronts[0].root} target="_blank" rel="noopener noreferrer"><StoreLogo brand={store} size={20}/>{store.name}<span className="sr-only"> ({c.hero.openStore})</span></a></li>)}<li><Link className="home-stores-all" href="/stores">{c.hero.allStores(storeBrands.length)}</Link></li></ul>;
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
 const {c}=useHomeCopy();
 const {url,error,submit,change}=useLinkSubmit();
 return <section className="home-hero" aria-labelledby="home-title">
  <h1 id="home-title">{c.hero.title}</h1>
  <p className="home-hero-lead">{c.hero.lead}</p>
  <form id="home-link-form" className="home-link-form" onSubmit={submit} noValidate>
   <label className="sr-only" htmlFor="finds-product-url">{c.hero.label}</label>
   <span className="home-link-field"><Link2 size={20} aria-hidden="true"/><input id="finds-product-url" name="url" type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.hero.placeholder} aria-invalid={!!error} aria-describedby={error?'home-link-error':'home-link-note'} onChange={event=>change(event.target.value)}/></span>
   <button type="submit" className="btn primary home-cta">{c.hero.calculate}</button>
  </form>
  {error?<p id="home-link-error" className="home-link-error" role="alert">{error}</p>:<p id="home-link-note" className="home-link-note">{status==='authenticated'?c.hero.memberNote:c.hero.guestNote}</p>}
  <div className="home-stores home-stores-marquee">
   <StoreMarquee label={c.hero.popular} openStore={c.hero.openStore} allStores={c.hero.allStores(storeBrands.length)}/>
   <p className="home-stores-hint">{c.hero.storesHint}</p>
  </div>
  <div className="home-hero-links"><Link href="/batch-import">{c.hero.batch}</Link>{showCatalogLink&&<Link href="/catalog">{c.hero.catalog}</Link>}</div>
 </section>;
}

/** The worked example's amounts, priced like a real order: the bill card and the wide-screen step example show the same numbers. */
export function useExampleBill(){
 const {pricing}=useMarket();
 const quote=price(exampleUsd,combinedShipmentWeight(exampleBoxedKg),1,0,pricing);
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
 const fee=formatPercent(pricing.margin+pricing.buyoutFee+pricing.conversionFee,locale);
 const markup=formatPercent((pricing.fxMarkup??1.012)-1,locale);
 const cbu=pricing.fxSource==='cbu'&&Boolean(pricing.fxCbuRate);
 const days=deliveryDaysFor(pricing,'us');
 const allowance=pricing.customsAllowanceUsd??courierAllowanceUsd;
 const usd=formatUsd(exampleUsd,locale);
 return <aside id="example" className="folio home-folio" aria-labelledby="example-title">
  <p className="folio-cap"><b id="example-title">{c.example.title}</b><span>{c.example.product}</span></p>
  <div className="folio-sheet home-quote">
   <p className="bill-route"><span><span className="sr-only">{c.example.routeLabel}: </span>{c.tariffs.regions.us}</span><span className="bill-route-line" aria-hidden="true"/><span>{c.example.to}</span></p>
   {days&&<p className="bill-days">{c.example.days(days[0],days[1])}</p>}
   <dl className="bill">
    <div><dt>{c.example.item}</dt><dd>{formatSum(quote.merchandise,locale)}</dd><dd className="bill-note">{cbu?c.example.itemNoteCbu(usd,groupDigits(pricing.fx),markup):c.example.itemNoteSet(usd,groupDigits(pricing.fx))}</dd></div>
    <div><dt>{c.example.service}</dt><dd>{formatSum(parts.service,locale)}</dd><dd className="bill-note">{c.example.serviceDetail(fee)}</dd></div>
    <div><dt>{c.example.delivery}</dt><dd>{formatSum(parts.international,locale)}</dd><dd className="bill-note">{c.example.deliveryNote(formatKg(exampleBoxedKg,locale),formatKg(packagingKg,locale),formatUsd(deliveryPerKgUsdFor(pricing),locale))}</dd></div>
    {/* A reserve on top of delivery only while the tariff sets one (none since 5 October 2026). */}
    {quote.reserve>0&&<div><dt><span className="home-dt-with-tip">{c.example.reserve}<InfoTip label={c.example.reserveHelpLabel}>{c.example.reserveHelp}</InfoTip></span></dt><dd>{formatSum(quote.reserve,locale)}</dd><dd className="bill-note">{c.example.reserveNote}</dd></div>}
   </dl>
   <p className="bill-total home-quote-total"><span>{c.example.total}</span><strong><Money value={quote.total} locale={locale}/></strong></p>
  </div>
  <section className="folio-outside" aria-labelledby="example-outside">
   <h3 id="example-outside">{c.example.outsideTitle}</h3>
   <p className="outside-row"><span>{c.example.dutyLabel}</span><b className="ok">{c.example.dutyStatus}</b><small>{c.example.dutyNote(formatUsd(allowance,locale))}</small></p>
  </section>
 </aside>;
}

const stepIcons=[Link2,ReceiptText,BadgeCheck,Truck];
/** Step 1's example: a few of the catalogue's popular stores that have a mark, and how many more there are. */
const stepStores=popularBrandKeys.filter(key=>hasStoreMark(key)&&storeBrands.some(brand=>brand.key===key)).slice(0,4);

export function HowItWorks(){
 const {c}=useHomeCopy();
 const {siteContent}=useMarket();
 return <section id="how" className="home-section" data-chapter="how" aria-labelledby="how-title">
  <h2 id="how-title">{c.how.title}</h2>
  <ol className="home-steps">{c.how.steps.map((step,index)=><li key={step.title} className="home-step">
   <span className="home-step-station" aria-hidden="true">{index+1}</span>
   {/* Wide screens only: the stage's icon in the card's corner (owner, 7.10.2026: "fill the cards a little"). */}
   <span className="hw-step-icon" aria-hidden="true">{(()=>{const Icon=stepIcons[index];return <Icon size={22} strokeWidth={1.9}/>})()}</span>
   <h3>{step.title}</h3><p>{step.text}</p>
   {index===2&&(siteContent.paymentMethods.length?<ul className="home-payments" aria-label={c.how.paymentsLabel}>{siteContent.paymentMethods.map(method=><li key={method}>{paymentLabels[method]}</li>)}</ul>:<MissingContent what="способы оплаты — только реально подключённые провайдеры"/>)}
   {/* Owner, 7.10.2026: the parcel goes to the door by courier. */}
   {index===3&&<ul className="home-payments home-delivery" aria-label={c.how.deliveryLabel}><li>{c.how.courier}</li></ul>}
   {/* Wide screens only (app/home-wide-content.css): a small picture of the step, built from the page's own copy and numbers.
       The first one is a working link field (owner, 7.10.2026), the rest are pictures. */}
   <div className="hw-demo-wrap" aria-hidden={index===0?undefined:true}><StepDemo index={index}/></div>
  </li>)}</ol>
 </section>;
}

/** The first step's working link field: the same check and destination as the hero's form. */
function StepLinkForm(){
 const {status}=useMarket();
 const {c}=useHomeCopy();
 const {url,error,submit,change}=useLinkSubmit();
 return <form className="hw-demo hw-demo-field" onSubmit={submit} noValidate>
  <label className="sr-only" htmlFor="how-product-url">{c.hero.label}</label>
  <span className="hw-demo-input"><Link2 size={15} strokeWidth={2} aria-hidden="true"/><input id="how-product-url" name="url" type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.hero.placeholder} aria-invalid={!!error} aria-describedby="how-link-note" onChange={event=>change(event.target.value)}/><button type="submit" aria-label={c.hero.calculate} title={c.hero.calculate}><ArrowRight size={15} strokeWidth={2.2} aria-hidden="true"/></button></span>
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
  const rows:[string,number][]=[[c.example.item,quote.merchandise],[c.example.service,parts.service],[c.example.delivery,parts.international],...(quote.reserve>0?[[c.example.reserve,quote.reserve] as [string,number]]:[])];
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
 // Every country shows its own prices: the owner changes rates per country and per speed.
 const cards=tariffRows(pricing);
 return <section id="tariffs" className="home-section tariff-section" data-chapter="tariffs" aria-labelledby="tariffs-title">
  <h2 id="tariffs-title">{c.tariffs.title}</h2>
  <p className="home-section-lead">{c.tariffs.lead}</p>
  <ul className="tariff-grid" aria-label={c.tariffs.from}>{cards.map(({region,options})=><li key={region.id} className="tariff-card">
   <h3 className="tariff-country"><Flag region={region.id}/><span>{c.tariffs.regions[region.id]}</span></h3>
   <dl className="tariff-options" aria-label={c.tariffs.speedsLabel}>{options.map(({speed,days,usd})=><div key={speed} className={`tariff-option tariff-${speed}`}>
    <dt className="tariff-speed">{c.tariffs.speeds[speed]}</dt>
    <dd className={days?'tariff-days':'tariff-days tariff-pending'}><span className="sr-only">{c.tariffs.time}: </span>{days?c.tariffs.days(days[0],days[1]):c.tariffs.pending}</dd>
    <dd className="tariff-price"><span className="sr-only">{c.tariffs.perKg}: </span><b>{formatUsd(usd,locale)}<small>{c.tariffs.perKgUnit}</small></b><span className="tariff-100g">{c.tariffs.per100g(formatPriceUsd(usd/10,locale))}</span></dd>
   </div>)}</dl>
  </li>)}</ul>
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
 const legalAddress=legal.address?.[locale];
 const facts=c.trust.facts({
  fee:formatPercent(pricing.margin+pricing.buyoutFee+pricing.conversionFee,locale),
  markup:formatPercent((pricing.fxMarkup??1.012)-1,locale),
  cbu:pricing.fxSource==='cbu'&&Boolean(pricing.fxCbuRate),
  freeFrom:formatUsd(pricing.storeShippingFreeFromUsd??50,locale),
  allowance:formatUsd(pricing.customsAllowanceUsd??courierAllowanceUsd,locale),
 });
 // Two parts so phones can show each as a sheet of its own: the money facts, then the proof (tracking, photos, legal).
 return <section id="trust" className="home-section" data-chapter="trust" aria-labelledby="trust-title">
  <div className="home-trust-money">
  <h2 id="trust-title">{c.trust.title}</h2>
  {completedOrders!==null?<p className="home-counter"><strong>{groupDigits(completedOrders)}</strong> {c.trust.ordersDone}</p>:<MissingContent what="число реально выполненных заказов"/>}
  <ul className="home-facts">{facts.map(fact=><li key={fact}>{fact}</li>)}</ul>
  </div>
  <div className="home-trust-proof">
  <div className={'home-trust-grid'+(reviews.length?'':' single')}>
   <article className="home-tracking" aria-labelledby="tracking-title">
    <header><h3 id="tracking-title">{c.trust.trackingTitle}</h3><span className="home-badge">{c.trust.example}</span></header>
    <p className="home-tracking-item"><b>{c.trust.trackingProduct}</b><span>{c.trust.trackingOrder}</span></p>
    <ol>{statuses.map((status,index)=><li key={status} data-state={index<current?'done':index===current?'current':'next'} aria-current={index===current?'step':undefined}><span className="home-tracking-dot" aria-hidden="true">{index<current&&<Check size={12}/>}</span>{status}</li>)}</ol>
    <p className="home-note">{c.trust.trackingNote}</p>
   </article>
   {reviews.length?<div className="home-reviews"><h3>{c.trust.reviewsTitle}</h3>{reviews.map(review=><figure key={review.name+review.text.ru}><blockquote>{review.text[locale]}</blockquote><figcaption>{review.name}{review.city?`, ${review.city}`:''}</figcaption></figure>)}</div>:<MissingContent what="отзывы реальных клиентов (с их согласия)"/>}
  </div>
  {parcelPhotos.length?<div className="home-parcels"><h3>{c.trust.photosTitle}</h3><ul>{parcelPhotos.map(photo=><li key={photo.src}>
   {/* Static photos from public/ are small and lazy-loaded; next/image is not used in this app. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={photo.src} alt={photo.alt[locale]} loading="lazy" decoding="async" width={320} height={240}/>
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
 const known=deliveryRegions.flatMap(region=>{
  const parts=deliverySpeeds.flatMap(speed=>{const days=deliveryDaysFor(pricing,region.id,speed);return days?[`${c.tariffs.speeds[speed].toLowerCase()} ${c.tariffs.days(days[0],days[1])}`]:[];});
  return parts.length?[`${c.tariffs.regions[region.id]}: ${parts.join(', ')}`]:[];
 });
 const prohibitedUrl=siteContent.prohibitedListUrl;
 const items:{q:string;a:string;link?:ReactNode}[]=[
  {q:c.faq.timesQuestion,a:known.length?c.faq.timesKnown(known.join('; ')):c.faq.timesUnknown},
  {...c.faq.items.customs,link:<Link href="/customs">{c.faq.customsLink}</Link>},
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
   <a className="hw-cs-tile" href={'https://'+store.storefronts[0].root} target="_blank" rel="noopener noreferrer">
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
