'use client';
import {Suspense,lazy,useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowRight,ArrowUpRight,Check,ChevronDown,Link2,Loader2,ReceiptText,Scale,Search,SearchCheck,ShieldCheck} from 'lucide-react';
import {useRouter} from 'next/navigation';
import Link from '@/components/site-link';
import {PasteButton} from '@/components/paste-button';
import {InfoTip} from '@/components/info-tip';
import {useClipboardLink} from './use-clipboard-link';
import {useMarket} from '@/lib/market/store';
import {deliveryPerKgUsdFor,deliverySpeeds,price,validateSource} from '@/lib/market/domain';
import {atlasServiceBreakdown} from '@/lib/market/quote-presentation';
import {courierAllowanceUsd} from '@/lib/market/customs';
import {combinedShipmentWeight,packagingKg} from '@/lib/market/world';
import {homeCopy} from '@/lib/market/home-copy';
import {formatKg,formatPercent,formatPriceUsd,formatSum,formatUsd,groupDigits} from '@/lib/market/format';
import {expressLead,factPrice,speedDaysRange,speedPriceRange,tariffRows} from '@/lib/market/home-facts';
import {catalogSearchFor,looksLikeLink,normalizeProductLink,storeNamedIn} from '@/lib/market/shared-link';
import {startNavigationFeedback} from '@/lib/market/navigation-feedback';
import {loadChunk} from '@/lib/market/stale-build';
import {deliveryDaysFor,deliveryRegions,paymentLabels} from '@/lib/market/site-content';
import type {Locale} from '@/lib/market/i18n';
import {pickLocale} from '@/lib/market/uz-cyrl';
import {storeBrands,storefrontUrl,type StoreBrand} from '@/lib/market/store-brands';
import {StoreLogo,StoreMark} from './store-logo';
import {Money} from './money';
import {JsonLd} from './json-ld';
import {faqPage} from '@/lib/seo/structured-data';
import {MissingContent} from './site-footer';

/**
 * The worked example on the home page, priced by the same function as a real order (owner, 14.10.2026): $69 sneakers,
 * standard delivery, 0.7 kg in the box, so with the packaging allowance the bill weighs the usual 1 kg.
 */
const exampleUsd=69,exampleBoxedKg=.7,exampleSpeed='standard' as const;

export function useHomeCopy(){
 const {state}=useMarket();
 const locale=state.communication.language as Locale;
 return {locale,c:homeCopy[locale]};
}

/** After plain words in the field: the store they name and a catalog search that finds something (either may be missing). */
type LinkHelp={store:StoreBrand|null;search:string};

/**
 * A product link field. A link opens the order by link in place, the button waiting meanwhile: a link inside shared text,
 * a bare "nike.com/t/…" and an http link count too (normalizeProductLink). Anything else shows a hint; plain words get
 * their own, with the store they name and a catalog search for the forms that show them (owner's review, 14.10.2026).
 */
function useLinkSubmit(){
 const {c,locale}=useHomeCopy();
 const {catalogProducts}=useMarket();
 const router=useRouter();
 const [url,setUrl]=useState('');
 const [error,setError]=useState('');
 const [help,setHelp]=useState<LinkHelp|null>(null);
 const [busy,setBusy]=useState(false);
 const prefetched=useRef(false);
 // A navigation that never finishes, or a page brought back from history, leaves the button usable again.
 useEffect(()=>{
  if(!busy)return;
  const reset=()=>setBusy(false);
  const timer=window.setTimeout(reset,15000);
  window.addEventListener('pagehide',reset);
  window.addEventListener('pageshow',reset);
  return ()=>{window.clearTimeout(timer);window.removeEventListener('pagehide',reset);window.removeEventListener('pageshow',reset)};
 },[busy]);
 function submit(event:FormEvent){
  event.preventDefault();
  open(url);
 }
 function open(value:string){
  if(busy)return;
  const raw=value.trim();
  let target:string;
  try{target=validateSource(normalizeProductLink(raw)||raw)}
  catch{
   const words=Boolean(raw)&&!looksLikeLink(raw);
   setError(words?c.hero.notLink:c.hero.invalid);
   setHelp(words?{store:storeNamedIn(raw,storeBrands),search:catalogSearchFor(raw,catalogProducts,locale)}:null);
   return;
  }
  setError('');setHelp(null);setBusy(true);
  // In place, as SiteLink does: the order page reads ?url= on arrival and starts loading the product (app/global-link-order.tsx).
  startNavigationFeedback();
  router.push('/order-by-link?url='+encodeURIComponent(target));
 }
 const change=useCallback((value:string)=>{setUrl(value);setError('');setHelp(null)},[]);
 // A pasted store link goes straight to its calculation (the order page starts loading it on arrival); other text just pastes.
 function pasted(value:string){
  change(value);
  try{validateSource(normalizeProductLink(value.trim())||value.trim())}catch{return}
  open(value);
 }
 // The order page's code and data are fetched while the link is being pasted.
 const prefetch=useCallback(()=>{
  if(prefetched.current)return;
  prefetched.current=true;
  try{router.prefetch('/order-by-link')}catch{/* the submit still loads the page */}
 },[router]);
 return {url,error,help,busy,submit,change,pasted,prefetch};
}

/**
 * The hero's link form, the only one on the page (1.11.2026: the closing copy and the phone's sticky button went; the
 * bottom bar's «Ссылка» opens the same calculation). A 56px field: on wide screens the button sits inside it, on phones
 * it is full width under it (app/styles/home-only.css). A store link already in the clipboard lights up «Вставить»;
 * a paste of a store link ("Вставить" or Ctrl+V, 29 October 2026) opens its calculation at once.
 */
function HomeLinkForm(){
 const {status}=useMarket();
 const {c,locale}=useHomeCopy();
 const {url,error,help,busy,submit,change,pasted,prefetch}=useLinkSubmit();
 const clip=useClipboardLink();
 const points=status==='authenticated'?c.hero.memberPoints:c.hero.guestPoints;
 return <>
  <form id="home-link-form" className="home-link-form" onSubmit={submit} noValidate>
   <label className="sr-only" htmlFor="finds-product-url">{c.hero.label}</label>
   <span className="home-link-field"><Link2 size={20} aria-hidden="true"/><input id="finds-product-url" name="url" type="url" inputMode="url" autoComplete="off" spellCheck={false} enterKeyHint="go" value={url} placeholder={c.hero.placeholder} aria-invalid={!!error} aria-describedby={error?'home-link-error':'home-link-note'} onFocus={prefetch} onChange={event=>change(event.target.value)} onPaste={event=>{const text=event.clipboardData.getData('text');if(!text.trim())return;event.preventDefault();pasted(text)}}/><PasteButton targetId="finds-product-url" locale={locale} ready={clip.ready} onPaste={text=>{clip.used();pasted(text)}}/></span>
   {/* While the order page opens: a spinner over the hidden label, so the button keeps its width. */}
   <button type="submit" className="btn primary home-cta" aria-busy={busy||undefined}><span className="home-cta-label">{c.hero.calculate}</span>{busy&&<Loader2 className="home-cta-spinner spin" size={20} aria-hidden="true"/>}</button>
  </form>
  {error?<>
   <p id="home-link-error" className="home-link-error" role="alert">{error}</p>
   {help&&(help.store||help.search)&&<div className="home-link-help">
    {help.store&&<a className="btn secondary" href={storefrontUrl(help.store)} target="_blank" rel="noopener noreferrer"><StoreLogo brand={help.store} size={18}/>{c.hero.openStoreNamed(help.store.name)}<ArrowUpRight size={16} aria-hidden="true"/><span className="sr-only"> ({c.hero.openStore})</span></a>}
    {help.search&&<Link className="btn secondary" href={'/catalog?q='+encodeURIComponent(help.search)}><Search size={16} aria-hidden="true"/>{c.hero.searchCatalog(help.search)}</Link>}
   </div>}
  </>:<div className="home-link-meta"><ul id="home-link-note" className="home-link-points">{points.map(point=><li key={point}><Check size={14} aria-hidden="true"/>{point}</li>)}</ul><Link className="home-link-batch" href="/batch-import">{c.hero.batch}</Link></div>}
 </>;
}

/** The signed-in customer's "continue" card: its own chunk (order grouping and attention rules), never loaded for a guest. */
const HomeResume=lazy(()=>loadChunk(()=>import('./home-resume')).then(module=>({default:module.HomeResume})));

export function HomeHero(){
 const {status,ready,sessionHint}=useMarket();
 const {c}=useHomeCopy();
 return <section className="home-hero" aria-labelledby="home-title">
  <h1 id="home-title">{c.hero.title}</h1>
  <p className="home-hero-lead">{c.hero.lead}</p>
  <HomeLinkForm/>
  {/* A signed-in visitor (session cookie) keeps the card's place while the account loads, so the products below do not
      jump down when it arrives (mobile CLS, 26 October 2026). */}
  {ready&&status==='authenticated'?<Suspense fallback={<div className="home-resume-slot" aria-hidden="true"/>}><HomeResume/></Suspense>:sessionHint&&!ready&&<div className="home-resume-slot" aria-hidden="true"/>}
 </section>;
}

/**
 * The worked example as a compact bill: the item, one «Atlas service» line with its parts folded under it (as the real
 * bill groups them, app/cost-lines.tsx), the total and the monthly duty-free allowance. Every amount comes from price()
 * with the packed weight, as in a real order. Wide screens show it beside the hero; phones fold it under a button.
 */
function ExampleQuote(){
 const {pricing}=useMarket();
 const {locale,c}=useHomeCopy();
 const quote=price(exampleUsd,combinedShipmentWeight(exampleBoxedKg),1,0,pricing,exampleSpeed);
 const parts=atlasServiceBreakdown(quote);
 const packed=combinedShipmentWeight(exampleBoxedKg);
 const fee=formatPercent(pricing.margin+pricing.buyoutFee+pricing.conversionFee,locale);
 const days=deliveryDaysFor(pricing,'us',exampleSpeed);
 const allowance=pricing.customsAllowanceUsd??courierAllowanceUsd;
 const usd=formatUsd(exampleUsd,locale);
 // The whole bill in dollars at the same Atlas rate: the store's $69 next to what reaches Tashkent.
 const totalUsd=pricing.fx>0?formatUsd(Math.round(quote.total/pricing.fx),locale):null;
 return <aside id="example" className="home-bill" aria-labelledby="example-title">
  <p className="home-bill-head"><span className="home-bill-mark" aria-hidden="true"><StoreMark brandKey="nike" height={14} maxWidth={28}/></span><span className="home-bill-product" aria-hidden="true"><b>{c.trust.trackingProduct}</b><small>nike.com · {usd}</small></span><b id="example-title" className="home-bill-tag">{c.example.title}<span className="sr-only">: {c.example.product(usd)}</span></b></p>
  <dl className="home-bill-lines">
   <div><dt>{c.example.item}<small>{c.example.itemNote(usd)}</small></dt><dd>{formatSum(quote.merchandise,locale)}</dd></div>
   <div><dt>{c.example.service}<small>{c.example.serviceNote(fee)}</small></dt><dd>{formatSum(parts.service+parts.international,locale)}</dd></div>
   {/* A reserve on top of delivery only while the tariff sets one (none since 5 October 2026). */}
   {quote.reserve>0&&<div><dt><span>{c.example.reserve}<InfoTip locale={locale}>{c.example.reserveHelp}</InfoTip></span><small>{c.example.reserveNote(formatKg(packagingKg,locale))}</small></dt><dd>{formatSum(quote.reserve,locale)}</dd></div>}
  </dl>
  <details className="home-bill-parts"><summary>{c.example.serviceParts}</summary><ul>
   <li><span>{c.example.fee(fee)}</span><span>{formatSum(parts.service,locale)}</span></li>
   <li><span>{c.example.delivery} <small>{c.example.deliveryNote(formatKg(packed,locale),formatUsd(deliveryPerKgUsdFor(pricing,undefined,exampleSpeed),locale))}</small></span><span>{formatSum(parts.international,locale)}</span></li>
  </ul></details>
  <p className="home-bill-total"><span>{c.example.total}</span><strong><Money value={quote.total} locale={locale}/></strong></p>
  {(totalUsd||days)&&<p className="home-bill-note">{[totalUsd&&c.example.totalUsd(totalUsd),days&&c.example.days(days[0],days[1])].filter(Boolean).join(' · ')}</p>}
  <p className="home-bill-duty"><ShieldCheck size={16} aria-hidden="true"/><span><b>{c.example.dutyTitle(formatUsd(allowance,locale))}</b>{c.example.dutyUsed(usd,formatUsd(Math.max(0,allowance-exampleUsd),locale))}</span></p>
 </aside>;
}

/** The example bill: beside the hero on wide screens, folded under «Пример счёта» on phones and tablets. */
export function HomeExample(){
 const {c}=useHomeCopy();
 const [open,setOpen]=useState(false);
 return <div className="home-example" id="bill" data-open={open||undefined}>
  <button type="button" className="home-example-toggle" aria-expanded={open} aria-controls="example" onClick={()=>setOpen(value=>!value)}><ReceiptText size={18} aria-hidden="true"/>{c.example.title}<ChevronDown className="home-example-chevron" size={18} aria-hidden="true"/></button>
  <ExampleQuote/>
 </div>;
}

export function HowItWorks(){
 const {c,locale}=useHomeCopy();
 const {siteContent}=useMarket();
 // TODO(owner): crypto payments — confirm their legal status in Uzbekistan before keeping them on the site. Until then
 // crypto goes last and quieter than the card and local payment methods.
 const payments=[...siteContent.paymentMethods].sort((a,b)=>Number(a==='crypto')-Number(b==='crypto'));
 const courierNote=siteContent.courierNote?pickLocale(siteContent.courierNote,locale):undefined;
 const extra:ReactNode[]=[
  <Link key="stores" className="home-step-link" href="/stores">{c.how.allStores(storeBrands.length)}<ArrowRight size={16} aria-hidden="true"/></Link>,
  siteContent.paymentMethods.length?<ul key="pay" className="home-payments" aria-label={c.how.paymentsLabel}>{payments.map(method=><li key={method} className={method==='crypto'?'home-payment-minor':undefined}>{paymentLabels[method]}</li>)}</ul>:<MissingContent key="pay" what="способы оплаты — только реально подключённые провайдеры"/>,
  // Owner, 7.10.2026: the parcel goes to the door by courier. Price and coverage are the owner's words (admin, «Контент сайта»).
  <div key="courier"><ul className="home-payments" aria-label={c.how.deliveryLabel}><li>{c.how.courier}</li></ul>{courierNote?<p className="home-courier-note">{courierNote}</p>:<MissingContent what="курьер по Ташкенту: цена и зона доставки"/>}</div>,
 ];
 return <section id="how" className="home-section" aria-labelledby="how-title">
  <h2 id="how-title">{c.how.title}</h2>
  <ol className="home-steps">{c.how.steps.map((step,index)=><li key={step.title} className="home-step">
   <span className="home-step-number" aria-hidden="true">{index+1}</span>
   <h3>{step.title}</h3><p>{step.text}</p>
   {extra[index]}
  </li>)}</ol>
 </section>;
}

/**
 * Rates in short: one card per speed (price per kg, "from" when the countries differ, and the days range), then a link
 * to /delivery, which has the rates of every country and the weight calculator (stage 8, 1 November 2026). Old links to
 * /#tariffs still land on this block.
 */
export function DeliveryTariffs(){
 const {pricing}=useMarket();
 const {locale,c}=useHomeCopy();
 const rows=tariffRows(pricing);
 const missingDays=deliveryRegions.some(region=>deliverySpeeds.some(speed=>!deliveryDaysFor(pricing,region.id,speed)));
 // How much sooner express arrives, per country; no line when it is not sooner everywhere (lib/market/home-facts.ts).
 const lead=expressLead(rows);
 return <section id="tariffs" className="home-section home-tariffs" aria-labelledby="tariffs-title">
  <h2 id="tariffs-title">{c.tariffs.title}</h2>
  <p className="home-section-lead">{c.tariffs.lead}</p>
  <ul className="home-speeds" aria-label={c.tariffs.speedsLabel}>{deliverySpeeds.map(speed=>{
   const value=factPrice(rows,speed,locale),range=speedPriceRange(rows,speed),days=speedDaysRange(rows,speed);
   if(!value||!range)return null;
   return <li key={speed} className="home-speed" data-speed={speed}>
    <span className="home-speed-name">{c.tariffs.speeds[speed]}</span>
    <span className="home-speed-price"><b>{value}</b><span>{c.tariffs.perKgUnit}</span></span>
    <span className="home-speed-meta">{days?c.tariffs.days(days.min,days.max):c.tariffs.pending} · {c.tariffs.per100g(formatPriceUsd(range.min/10,locale))}</span>
    {speed==='express'&&lead&&<span className="home-speed-faster">{c.tariffs.faster(lead.min===lead.max?String(lead.max):`${lead.min}–${lead.max}`,lead.max)}</span>}
   </li>;
  })}</ul>
  <p className="home-note">{c.tariffs.weightNote} {c.tariffs.rateNote}</p>
  <Link className="home-tariff-all" href="/delivery">{c.tariffs.all}<ArrowRight size={18} aria-hidden="true"/></Link>
  {missingDays&&<MissingContent what="сроки доставки по странам и скоростям (дни, от–до)"/>}
 </section>;
}

/** The three money rules in the order of homeCopy.trust.facts: price check, one service line, weighing. */
const factIcons=[SearchCheck,ReceiptText,Scale];

export function TrustSection(){
 const {pricing,siteContent}=useMarket();
 const {locale,c}=useHomeCopy();
 const {reviews,parcelPhotos,completedOrders}=siteContent;
 const facts=c.trust.facts({fee:formatPercent(pricing.margin+pricing.buyoutFee+pricing.conversionFee,locale)});
 // Real orders, reviews and parcel photos only, when the owner has filled them in (admin, «Контент сайта»): never invented.
 return <section id="trust" className="home-section" aria-labelledby="trust-title">
  <h2 id="trust-title">{c.trust.title}</h2>
  {completedOrders!==null&&<p className="home-counter"><strong>{groupDigits(completedOrders)}</strong> {c.trust.ordersDone}</p>}
  <ul className="home-trust-cards">{facts.map((fact,index)=>{const Icon=factIcons[index]??Check;return <li key={fact.title}><span className="home-trust-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.9}/></span><h3>{fact.title}</h3><p>{fact.text}</p></li>;})}</ul>
  {reviews.length>0&&<div className="home-reviews"><h3>{c.trust.reviewsTitle}</h3>{reviews.map(review=><figure key={review.name+review.text.ru}><blockquote>{pickLocale(review.text,locale)}</blockquote><figcaption>{review.name}{review.city?`, ${review.city}`:''}</figcaption></figure>)}</div>}
  {parcelPhotos.length>0&&<div className="home-parcels"><h3>{c.trust.photosTitle}</h3><ul>{parcelPhotos.map(photo=><li key={photo.src}>
   {/* Static photos from public/ are small and lazy-loaded; next/image is not used in this app. */}
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={photo.src} alt={pickLocale(photo.alt,locale)} loading="lazy" decoding="async" width={320} height={240}/>
  </li>)}</ul></div>}
 </section>;
}

/** Five questions (1.11.2026: was six); the weight question and the contacts are on /support, linked under the list. */
export function HomeFaq(){
 const {locale,c}=useHomeCopy();
 const {pricing,siteContent}=useMarket();
 // One range per speed across the countries (shortest to longest); the table under #tariffs has them per country.
 const rows=tariffRows(pricing);
 const known=deliverySpeeds.flatMap(speed=>{const days=speedDaysRange(rows,speed);return days?[`${c.tariffs.speeds[speed].toLocaleLowerCase(locale)} ${c.tariffs.days(days.min,days.max)}`]:[];});
 const prohibitedUrl=siteContent.prohibitedListUrl;
 const items:{q:string;a:string;link?:ReactNode}[]=[
  {q:c.faq.timesQuestion,a:known.length?c.faq.timesKnown(known.join(', ')):c.faq.timesUnknown,link:<a href="#tariffs">{c.faq.timesLink}</a>},
  {...c.faq.items.customs(formatUsd(pricing.customsAllowanceUsd??courierAllowanceUsd,locale)),link:<Link href="/customs">{c.faq.customsLink}</Link>},
  c.faq.items.returns,
  {...c.faq.items.prohibited,link:prohibitedUrl?<a href={prohibitedUrl} target="_blank" rel="noopener noreferrer">{c.faq.prohibitedOfficial}</a>:<Link href="/legal#offer-limits">{c.faq.prohibitedRules}</Link>},
  c.faq.items.account,
 ];
 return <section id="faq" className="home-section" aria-labelledby="faq-title">
  <h2 id="faq-title">{c.faq.title}</h2>
  <JsonLd data={faqPage(items)}/>
  {/* One answer open at a time (name). */}
  <div className="home-faq">{items.map(item=><details key={item.q} name="home-faq"><summary>{item.q}</summary><div><p>{item.a}</p>{item.link}</div></details>)}</div>
  <p className="home-faq-more"><Link href="/support#support-faq">{c.faq.more}<ArrowRight size={16} aria-hidden="true"/></Link></p>
 </section>;
}
