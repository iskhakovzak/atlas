'use client';
import {useState,type MouseEvent} from 'react';
import {ArrowUpRight,ArrowRight,Heart,Info,ShieldCheck,ShoppingBag,X} from 'lucide-react';
import {Sheet,SheetContent,SheetTitle,SheetDescription,SheetClose} from '@/components/ui/sheet';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {cartDeliverySpeed,price,storeDiscount,storeShippingHoldUsd,storeShippingUsd,tariff,unknownStoreShippingUsd,type Product} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {findOrderUrl} from '@/lib/market/catalog';
import {countryName,packagingKg} from '@/lib/market/world';
import type {Locale} from '@/lib/market/i18n';
import {catalogCopy,countryLabel,shortDate} from '@/lib/market/catalog-copy';
import {formatDayMonth,formatKg,formatPriceUsd,formatSum,formatUsd} from '@/lib/market/format';
import {dealCopy} from '@/lib/market/deal-copy';
import {browserStorage,catalogItemHref,rememberPendingFavorite,withoutItemParam} from '@/lib/market/catalog-links';
import {loginPath} from '@/lib/auth/return-to';
import {WasPrice} from './market-ui';
import {Choice} from './choice';
import {CostLines} from './cost-lines';
import {ProductGallery} from './product-gallery';
import {marketplaceWords} from './marketplace-words';
import {useSheetSide} from './use-sheet-side';
import {InfoTip} from '@/components/info-tip';
const navigate=(href:string)=>window.location.assign(href);

/** Product details for a catalog card: gallery, description, delivered estimate at either speed and the next step.
 * A bottom sheet on phones (handle, sticky total), a side panel elsewhere. */
export function ProductSheet({product,onClose}:{product:Product|null;onClose:()=>void}){
  const side=useSheetSide();
  return <Sheet open={!!product} onOpenChange={open=>{if(!open)onClose()}}><SheetContent side={side} showCloseButton={false} className={'product-sheet product-sheet-'+side}>{side==='bottom'&&<span className="sheet-handle" aria-hidden="true"/>}{product&&<ProductDetails key={product.id+(product.sourceUrl??'')} product={product} onClose={onClose}/>}</SheetContent></Sheet>;
}

function ProductDetails({product:selected,onClose}:{product:Product;onClose:()=>void}){
  const {state,pricing,ready,status,act,catalogProducts}=useMarket();
  const locale=state.communication.language as Locale,modalWords=marketplaceWords(locale),cc=catalogCopy[locale];
  const [variant,setVariant]=useState(selected.variants[0]),[adding,setAdding]=useState(false);
  // The estimate follows the cart; this sheet never changes its delivery speed.
  const speed=ready?cartDeliverySpeed(state.cart):'express';
  const curated=catalogProducts.find(item=>item.id===selected.id&&item.sourceUrl===selected.sourceUrl);
  const country=countryName(selected);
  const label=countryLabel(country,locale);
  const stale=selected.priceNeedsConfirmation===true;
  // A stale snapshot without a recorded price has nothing to estimate from until the order flow fetches it.
  const priced=!stale||(selected.sourcePrice!==undefined&&Boolean(selected.sourceCurrency));
  const checkedAt=curated?.sourceCheckedAt??(curated?Date.parse(curated.observedOn)||0:selected.sourceCheckedAt??0);
  // Unknown store delivery is held apart (or free above $50), never in the total.
  const holdUsd=storeShippingHoldUsd(selected,selected.usd,pricing);
  const estimate={...price(selected.usd,selected.weight,1,storeShippingUsd(selected),pricing,speed),storeShippingHold:selected.sourceShippingEstimated?Math.ceil(holdUsd*pricing.fx):undefined};
  // One way to write a store price everywhere in the sheet, the card's: "$15,99" for dollars, "15,99 €" for the rest.
  const storeMoney=(value:number,currency=selected.sourceCurrency??'USD')=>{if(currency==='USD')return formatPriceUsd(value,locale);try{return new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{style:'currency',currency,maximumFractionDigits:2}).format(value)}catch{return `${value} ${currency}`}};
  async function add(){if(adding)return;if(curated){navigate(findOrderUrl(selected));return}setAdding(true);const ok=await act({type:'cart-add',product:selected,variant});setAdding(false);if(ok){onClose();navigate('/cart')}}
  // Saving is for catalog products (the saved page lists only those): the decision is made here, after the estimate.
  const dc=dealCopy(locale),saved=state.favorites.includes(selected.id);
  const [saving,setSaving]=useState(false);
  async function toggleSave(){if(saving)return;setSaving(true);try{await act({type:'favorite',id:selected.id})}finally{setSaving(false)}}
  // A guest's heart: sign in and come back to this product in the catalog, saved (the address is read on the tap).
  function guestSave(event:MouseEvent<HTMLAnchorElement>){rememberPendingFavorite(browserStorage(),selected.id,Date.now());const here=window.location.pathname==='/catalog'?withoutItemParam(window.location.pathname+window.location.search):'/catalog';event.currentTarget.href=loginPath(catalogItemHref(here,selected.id))}
  const save=!curated?null:ready?<button type="button" className="icon-btn sheet-save" aria-pressed={saved} aria-label={(saved?dc.remove:dc.save)+': '+selected.name} title={saved?dc.remove:dc.save} disabled={saving} onClick={()=>void toggleSave()}><Heart size={20} aria-hidden="true"/></button>:status==='guest'?<a className="icon-btn sheet-save" href={loginPath('/catalog')} aria-label={dc.signinToSave+': '+selected.name} title={dc.signinToSave} onClick={guestSave}><Heart size={20} aria-hidden="true"/></a>:null;
  // Close and heart ride a zero-height sticky bar (app/catalog.css .sheet-actions): over the photo at first, still in
  // reach once the details are scrolled (owner's review, 14.10.2026: on phones "×" went up with the content).
  return <><div className="sheet-actions"><SheetClose asChild><button className="icon-btn sheet-close" aria-label={modalWords.close}><X size={20}/></button></SheetClose>{save}</div>
   <div className={'detail-image detail-'+selected.id}><ProductGallery product={selected} locale={locale}/><span className="floating-label">{selected.sourceUrl?label:modalWords.item}</span></div>
   <div className="sheet-body">{/* The photo already carries the country for a store product: the line above the name says the store once. */}<div className="eyebrow">{selected.sourceUrl||selected.brand.includes(country)?selected.brand:selected.brand+' · '+label}</div><SheetTitle className="product-title">{selected.name}</SheetTitle>
    {(()=>{
     // Store price with its discount: the catalog's "before" price for a current card, or the one kept on the product.
     // A dated price shows too when it was recorded (the notice below gives its date); its discount, like the card's,
     // only for a recorded USD price (owner, 12 October 2026).
     if(stale&&!priced)return null;
     const now=selected.sourcePrice??selected.usd,currency=selected.sourceCurrency??'USD';
     const off=!stale||currency==='USD'?storeDiscount({usd:selected.usd,sourcePrice:now,sourceReferencePrice:currency==='USD'?curated?.referenceUsd??selected.sourceReferencePrice:selected.sourceReferencePrice}):null;
     const format=(value:number)=>storeMoney(value,currency);
     return <p className="sheet-store-price">{modalWords.storePrice}: <b>{format(now)}</b>{off&&<WasPrice was={off.was} percent={off.percent} format={format}/>}</p>;
    })()}
    {stale&&<div className="notice sheet-stale" role="note"><Info size={19}/><span>{cc.staleNotice(checkedAt?shortDate(checkedAt,locale):curated?.observedOn??'')}</span></div>}
    {/* Stale: the notice above gives the date and the check and the line above names the store, so the description is for screen readers only. */}
    <SheetDescription className={curated&&stale?'sr-only':undefined}>{curated?(stale?`${modalWords.offerFrom} ${curated.store}.`:`${modalWords.offerFrom} ${curated.store}. ${modalWords.priceOn} ${checkedAt?formatDayMonth(checkedAt,locale):curated.observedOn}. ${modalWords.checkOption}`):modalWords.review}</SheetDescription>
    <Tabs defaultValue="about" className="detail-tabs"><TabsList variant="line"><TabsTrigger value="about">{modalWords.about}</TabsTrigger><TabsTrigger value="price">{modalWords.price}</TabsTrigger></TabsList>
     <TabsContent value="about"><p>{selected.description??modalWords.manual}</p>{selected.sourceUrl&&<a className="text-link" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{modalWords.source}<ArrowUpRight size={16}/></a>}<div className="product-facts"><span>{modalWords.storePrice} <b>{priced?storeMoney(selected.sourcePrice??selected.usd):cc.checkPrice}</b></span></div></TabsContent>
     <TabsContent value="price">
      <p className="micro">{modalWords.weight}: {formatKg(selected.weight,locale)} {modalWords.kg}.{selected.boxedWeight!==undefined&&<> {modalWords.box} {formatKg(selected.boxedWeight,locale)} {modalWords.kg} + {formatKg(packagingKg,locale)} {modalWords.kg} {modalWords.packaging}.</>}{/* The store-delivery rule below sits behind this "?"; the speed note is printed once, under this line. */}{curated&&<InfoTip locale={locale}><p>{modalWords.estimate(formatUsd(pricing.storeShippingFreeFromUsd??tariff.storeShippingFreeFromUsd,locale),formatUsd(unknownStoreShippingUsd,locale))}</p></InfoTip>}</p>
      <p className="micro sheet-speed-note">{cc.speedNote}</p>
      {curated&&<p className="micro tip-text">{modalWords.estimate(formatUsd(pricing.storeShippingFreeFromUsd??tariff.storeShippingFreeFromUsd,locale),formatUsd(unknownStoreShippingUsd,locale))}</p>}
      {priced&&<CostLines q={estimate} storeReserveWaived={selected.sourceShippingEstimated===true} locale={locale}/>}
      <small className="muted">{modalWords.rate}: {formatSum(pricing.fx,locale)} / USD</small>
     </TabsContent>
    </Tabs>
    {!curated&&<div className="field"><label>{modalWords.variant}</label><Choice label={modalWords.variant} value={variant} onChange={setVariant} options={selected.variants}/></div>}
    <div className="notice tip-text"><ShieldCheck size={19}/><span>{modalWords.delivery}</span></div>
   </div>
   <div className="sheet-total"><span>{stale?cc.totalStale:modalWords.withDelivery}<InfoTip locale={locale}>{modalWords.delivery}</InfoTip><strong>{priced?formatSum(estimate.total,locale):cc.afterCheck}</strong></span>{status==='guest'?<a className="btn primary" href={curated?findOrderUrl(selected):'/order-by-link'}>{modalWords.continue}<ArrowRight size={18}/></a>:<button className="btn primary" disabled={!ready||adding} onClick={add}><ShoppingBag size={18}/>{adding?modalWords.adding:curated?modalWords.continue:modalWords.add}</button>}</div>
   </>;
}
