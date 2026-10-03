'use client';
import {useEffect,useId,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowRight,Calculator,Check,ClipboardPaste,CreditCard,Info,Link2,PackageCheck,ShieldCheck,Truck} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {price,pricingForCountry,validateSource,type Pricing} from '@/lib/market/domain';
import {atlasServiceBreakdown} from '@/lib/market/quote-presentation';
import {formatSum,groupDigits,homeCopy} from '@/lib/market/home-copy';
import {deliveryRegions,paymentLabels,siteContent} from '@/lib/market/site-content';
import {localizedStatuses,type Locale} from '@/lib/market/i18n';

const isDev=(import.meta as {env?:{DEV?:boolean}}).env?.DEV===true;
const heroStores=[
 {name:'Nike',url:'https://www.nike.com/'},{name:'Zara',url:'https://www.zara.com/'},{name:'Amazon',url:'https://www.amazon.com/'},
 {name:'Apple',url:'https://www.apple.com/'},{name:'iHerb',url:'https://www.iherb.com/'},{name:'Adidas',url:'https://www.adidas.com/'},
 {name:'H&M',url:'https://www.hm.com/'},{name:'Sephora',url:'https://www.sephora.com/'},
];

export function useHomeCopy(){
 const {state}=useMarket();
 const locale=state.communication.language as Locale;
 return {locale,c:homeCopy[locale]};
}

/** Dev-only marker for business data that is not filled yet; production renders nothing. */
export function MissingContent({what}:{what:string}){
 if(!isDev)return null;
 return <p className="home-missing" role="note">Нужно заполнить: {what} — <code>lib/market/site-content.ts</code></p>;
}

/** Delivery price per kg as the customer pays it: base tariff plus the delivery margin. */
function perKgFor(pricing:Pricing,country?:string){
 const p=pricingForCountry(pricing,country);
 return Math.round(p.perKg*(1+p.deliveryMargin));
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

export function HomeHero({showCatalogLink}:{showCatalogLink:boolean}){
 const {status}=useMarket();
 const {c}=useHomeCopy();
 const [url,setUrl]=useState('');
 const [error,setError]=useState('');
 function submit(event:FormEvent){
  event.preventDefault();
  try{const target=validateSource(url.trim());setError('');window.location.assign('/order-by-link?url='+encodeURIComponent(target))}
  catch{setError(c.hero.invalid)}
 }
 return <section className="home-hero" aria-labelledby="home-title">
  <h1 id="home-title">{c.hero.title}</h1>
  <p className="home-hero-lead">{c.hero.lead}</p>
  <form id="home-link-form" className="home-link-form" onSubmit={submit} noValidate>
   <label className="sr-only" htmlFor="finds-product-url">{c.hero.label}</label>
   <span className="home-link-field"><Link2 size={20} aria-hidden="true"/><input id="finds-product-url" name="url" type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.hero.placeholder} aria-invalid={!!error} aria-describedby={error?'home-link-error':'home-link-note'} onChange={event=>{setUrl(event.target.value);setError('')}}/></span>
   <button type="submit" className="btn primary home-cta">{c.hero.calculate}<ArrowRight size={18} aria-hidden="true"/></button>
  </form>
  {error?<p id="home-link-error" className="home-link-error" role="alert">{error}</p>:<p id="home-link-note" className="home-link-note">{status==='authenticated'?c.hero.memberNote:c.hero.guestNote}</p>}
  <div className="home-stores">
   <p className="home-stores-label">{c.hero.popular}</p>
   <ul>{heroStores.map(store=><li key={store.name}><a href={store.url} target="_blank" rel="noopener noreferrer"><span className="home-store-mark" aria-hidden="true">{store.name[0]}</span>{store.name}<span className="sr-only"> ({c.hero.openStore})</span></a></li>)}</ul>
  </div>
  <div className="home-hero-links"><Link href="/batch-import">{c.hero.batch}<ArrowRight size={16} aria-hidden="true"/></Link>{showCatalogLink&&<Link href="/catalog">{c.hero.catalog}<ArrowRight size={16} aria-hidden="true"/></Link>}</div>
 </section>;
}

export function HowItWorks(){
 const {locale,c}=useHomeCopy();
 const icons=[Link2,Calculator,CreditCard,PackageCheck];
 const pickup=siteContent.contacts.pickupAddress?.[locale];
 return <section id="how" className="home-section" aria-labelledby="how-title">
  <h2 id="how-title">{c.how.title}</h2>
  <ol className="home-steps">{c.how.steps.map((step,index)=>{const Icon=icons[index];return <li key={step.title} className="home-step">
   <span className="home-step-icon" aria-hidden="true"><Icon size={22}/></span>
   <span className="home-step-number" aria-hidden="true">{index+1}</span>
   <h3>{step.title}</h3><p>{step.text}</p>
   {index===2&&(siteContent.paymentMethods.length?<ul className="home-payments" aria-label={c.how.paymentsLabel}>{siteContent.paymentMethods.map(method=><li key={method}>{paymentLabels[method]}</li>)}</ul>:<MissingContent what="способы оплаты — только реально подключённые провайдеры"/>)}
   {index===3&&(pickup?<p className="home-step-extra"><b>{c.how.pickupLabel}:</b> {pickup}</p>:<MissingContent what="адрес пункта выдачи в Ташкенте"/>)}
  </li>})}</ol>
 </section>;
}

export function ExampleQuote(){
 const {pricing}=useMarket();
 const {locale,c}=useHomeCopy();
 const quote=price(100,1,1,0,pricing);
 const parts=atlasServiceBreakdown(quote);
 const percent=new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{maximumFractionDigits:1}).format((pricing.margin+pricing.buyoutFee+pricing.conversionFee)*100);
 const kg=locale==='ru'?'1 кг':'1 kg';
 return <section id="example" className="home-section home-example" aria-labelledby="example-title">
  <div className="home-example-copy"><h2 id="example-title">{c.example.title}</h2><p>{c.example.lead}</p></div>
  <article className="home-quote" aria-label={c.example.title}>
   <header><b>{c.example.product}</b><span>{c.example.meta}</span></header>
   <dl>
    <div><dt>{c.example.item}<small>$100 × {formatSum(pricing.fx,locale)}</small></dt><dd>{formatSum(quote.merchandise,locale)}</dd></div>
    <div><dt>{c.example.service}<small>{c.example.serviceDetail(percent)}</small></dt><dd>{formatSum(parts.service,locale)}</dd></div>
    <div><dt>{c.example.delivery}<small>{kg} × {formatSum(perKgFor(pricing),locale)}</small></dt><dd>{formatSum(parts.international,locale)}</dd></div>
    <div><dt><span className="home-dt-with-tip">{c.example.reserve}<InfoTip label={c.example.reserveHelpLabel}>{c.example.reserveHelp}</InfoTip></span></dt><dd>{formatSum(quote.reserve,locale)}</dd></div>
   </dl>
   <div className="home-quote-total"><span>{c.example.total}</span><strong>{formatSum(quote.total,locale)}</strong></div>
   <p className="home-note">{c.example.note}</p>
  </article>
 </section>;
}

export function DeliveryTariffs(){
 const {pricing}=useMarket();
 const {locale,c}=useHomeCopy();
 const missingDays=deliveryRegions.some(region=>!siteContent.deliveryDays[region.id]);
 return <section id="tariffs" className="home-section" aria-labelledby="tariffs-title">
  <h2 id="tariffs-title">{c.tariffs.title}</h2>
  <p className="home-section-lead">{c.tariffs.lead}</p>
  <div className="home-table-wrap"><table className="home-tariffs">
   <thead><tr><th scope="col">{c.tariffs.from}</th><th scope="col">{c.tariffs.time}</th><th scope="col">{c.tariffs.perKg}</th></tr></thead>
   <tbody>{deliveryRegions.map(region=>{
    const days=siteContent.deliveryDays[region.id];
    const country=region.countries.find(name=>pricing.countryOverrides?.[name])??region.countries[0];
    return <tr key={region.id}><th scope="row">{c.tariffs.regions[region.id]}</th><td className={days?undefined:'home-pending'}>{days?c.tariffs.days(days[0],days[1]):c.tariffs.pending}</td><td>{formatSum(perKgFor(pricing,country),locale)}</td></tr>;
   })}</tbody>
  </table></div>
  {missingDays&&<MissingContent what="сроки доставки по странам (дни, от–до)"/>}
  <p className="home-note">{c.tariffs.weightNote} {c.tariffs.rateNote}</p>
 </section>;
}

export function TrustSection(){
 const {locale,c}=useHomeCopy();
 const statuses=localizedStatuses(locale);
 const current=4;
 const {legal,reviews,parcelPhotos,completedOrders}=siteContent;
 const legalAddress=legal.address?.[locale];
 return <section id="trust" className="home-section" aria-labelledby="trust-title">
  <h2 id="trust-title">{c.trust.title}</h2>
  {completedOrders!==null?<p className="home-counter"><strong>{groupDigits(completedOrders)}</strong> {c.trust.ordersDone}</p>:<MissingContent what="число реально выполненных заказов"/>}
  <ul className="home-trust-points">{c.trust.points.map((point,index)=>{const Icon=[Calculator,Truck,ShieldCheck][index];return <li key={point.title}><Icon size={22} aria-hidden="true"/><div><h3>{point.title}</h3><p>{point.text}</p></div></li>})}</ul>
  <div className="home-trust-grid">
   <article className="home-tracking" aria-labelledby="tracking-title">
    <header><h3 id="tracking-title">{c.trust.trackingTitle}</h3><span className="home-badge">{c.trust.example}</span></header>
    <p className="home-tracking-item">{c.trust.trackingItem}</p>
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
  <div className="home-legal">
   <h3>{c.trust.legalTitle}</h3>
   {legal.entityName||legal.inn||legalAddress?<dl>{legal.entityName&&<div><dt>{c.trust.entity}</dt><dd>{legal.entityName}</dd></div>}{legal.inn&&<div><dt>{c.trust.inn}</dt><dd>{legal.inn}</dd></div>}{legalAddress&&<div><dt>{c.trust.address}</dt><dd>{legalAddress}</dd></div>}</dl>:<MissingContent what="юрлицо, ИНН и адрес"/>}
   <Link href="/legal#offer">{c.trust.legalLink}<ArrowRight size={16} aria-hidden="true"/></Link>
  </div>
 </section>;
}

export function HomeFaq(){
 const {c}=useHomeCopy();
 const known=deliveryRegions.flatMap(region=>{const days=siteContent.deliveryDays[region.id];return days?[`${c.tariffs.regions[region.id]} — ${c.tariffs.days(days[0],days[1])}`]:[]});
 const prohibitedUrl=siteContent.prohibitedListUrl;
 const items:{q:string;a:string;link?:ReactNode}[]=[
  {q:c.faq.timesQuestion,a:known.length?c.faq.timesKnown(known.join('; ')):c.faq.timesUnknown},
  {...c.faq.items.customs,link:<Link href="/customs">{c.faq.customsLink}<ArrowRight size={15} aria-hidden="true"/></Link>},
  c.faq.items.returns,
  {...c.faq.items.prohibited,link:prohibitedUrl?<a href={prohibitedUrl} target="_blank" rel="noopener noreferrer">{c.faq.prohibitedOfficial}<ArrowRight size={15} aria-hidden="true"/></a>:<Link href="/legal#offer">{c.faq.prohibitedRules}<ArrowRight size={15} aria-hidden="true"/></Link>},
  c.faq.items.weight,
  c.faq.items.account,
 ];
 return <section id="faq" className="home-section" aria-labelledby="faq-title">
  <h2 id="faq-title">{c.faq.title}</h2>
  <div className="home-faq">{items.map(item=><details key={item.q}><summary>{item.q}</summary><div><p>{item.a}</p>{item.link}</div></details>)}</div>
 </section>;
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
  <button type="button" className="btn primary home-cta" onClick={()=>{
   const input=document.getElementById('finds-product-url') as HTMLInputElement|null;
   if(!input)return;
   const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   input.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});
   input.focus({preventScroll:true});
  }}><ClipboardPaste size={18} aria-hidden="true"/>{c.sticky.paste}</button>
 </div>;
}
