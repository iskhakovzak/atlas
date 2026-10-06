'use client';
import {useState} from 'react';
import {ArrowUpRight,ArrowRight,Info,ShieldCheck,ShoppingBag,X} from 'lucide-react';
import {Sheet,SheetContent,SheetTitle,SheetDescription,SheetClose} from '@/components/ui/sheet';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {cartDeliverySpeed,deliveryPerKgUsdFor,deliverySpeeds,price,money,storeDiscount,storeShippingHoldUsd,storeShippingUsd,type DeliverySpeed,type Product} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {findOrderUrl} from '@/lib/market/catalog';
import {countryName} from '@/lib/market/world';
import type {Locale} from '@/lib/market/i18n';
import {deliverySpeedCopy} from '@/lib/market/delivery-speed';
import {deliveryDaysFor} from '@/lib/market/site-content';
import {regionForCountryLabel} from '@/lib/market/store-geo';
import {catalogCopy,countryLabel,shortDate} from '@/lib/market/catalog-copy';
import {formatDayMonth,formatSum,formatUsd} from '@/lib/market/home-copy';
import {Choice,CostLines,WasPrice} from './market-ui';
import {ProductGallery} from './product-gallery';
import {marketplaceWords} from './marketplace-words';
import {useSheetSide} from './use-sheet-side';
const navigate=(href:string)=>window.location.assign(href);

/** Product details for a catalog card: gallery, description, delivered estimate at either speed and the next step.
 * A bottom sheet on phones (handle, sticky total), a side panel elsewhere. */
export function ProductSheet({product,onClose}:{product:Product|null;onClose:()=>void}){
  const side=useSheetSide();
  return <Sheet open={!!product} onOpenChange={open=>{if(!open)onClose()}}><SheetContent side={side} showCloseButton={false} className={'product-sheet product-sheet-'+side}>{side==='bottom'&&<span className="sheet-handle" aria-hidden="true"/>}{product&&<ProductDetails key={product.id+(product.sourceUrl??'')} product={product} onClose={onClose}/>}</SheetContent></Sheet>;
}

function ProductDetails({product:selected,onClose}:{product:Product;onClose:()=>void}){
  const {state,pricing,ready,status,act,catalogProducts}=useMarket();
  const locale=state.communication.language as Locale,modalWords=marketplaceWords(locale),cc=catalogCopy[locale],sc=deliverySpeedCopy[locale];
  const [variant,setVariant]=useState(selected.variants[0]),[adding,setAdding]=useState(false);
  // The cart's speed for a customer (one speed for the whole cart), express for a guest; the switch only previews the other.
  const [speed,setSpeed]=useState<DeliverySpeed>(()=>ready?cartDeliverySpeed(state.cart):'express');
  const curated=catalogProducts.find(item=>item.id===selected.id&&item.sourceUrl===selected.sourceUrl);
  const country=countryName(selected);
  const label=countryLabel(country,locale);
  const region=regionForCountryLabel(country);
  const stale=selected.priceNeedsConfirmation===true;
  // A stale snapshot without a recorded price has nothing to estimate from until the order flow fetches it.
  const priced=!stale||(selected.sourcePrice!==undefined&&Boolean(selected.sourceCurrency));
  const checkedAt=curated?.sourceCheckedAt??(curated?Date.parse(curated.observedOn)||0:selected.sourceCheckedAt??0);
  // Unknown store delivery is held apart (or free above $50), never in the total.
  const holdUsd=storeShippingHoldUsd(selected,selected.usd,pricing);
  const quoteAt=(at:DeliverySpeed)=>({...price(selected.usd,selected.weight,1,storeShippingUsd(selected),pricing,at),storeShippingHold:selected.sourceShippingEstimated?Math.ceil(holdUsd*pricing.fx):undefined});
  const estimate=quoteAt(speed);
  const saving=quoteAt('express').total-quoteAt('standard').total;
  const daysOf=(at:DeliverySpeed)=>{const range=region?deliveryDaysFor(pricing,region,at):null;return range?sc.days(range[0],range[1]):sc.daysUnknown;};
  const rateOf=(at:DeliverySpeed)=>sc.perKg(formatUsd(deliveryPerKgUsdFor(pricing,country,at),locale));
  async function add(){if(adding)return;if(curated){navigate(findOrderUrl(selected));return}setAdding(true);const ok=await act({type:'cart-add',product:selected,variant});setAdding(false);if(ok){onClose();navigate('/cart')}}
  return <><SheetClose asChild><button className="icon-btn sheet-close" aria-label={modalWords.close}><X size={20}/></button></SheetClose>
   <div className={'detail-image detail-'+selected.id}><ProductGallery product={selected} locale={locale}/><span className="floating-label">{selected.sourceUrl?label:modalWords.item}</span></div>
   <div className="sheet-body"><div className="eyebrow">{selected.brand.includes(country)?selected.brand:selected.brand+' · '+label}</div><SheetTitle className="product-title">{selected.name}</SheetTitle>
    {(()=>{
     // Store price with its discount: the catalog's "before" price for a current card, or the one kept on the product.
     if(stale)return null;
     const now=selected.sourcePrice??selected.usd,currency=selected.sourceCurrency??'USD';
     const off=storeDiscount({usd:selected.usd,sourcePrice:now,sourceReferencePrice:currency==='USD'?curated?.referenceUsd??selected.sourceReferencePrice:selected.sourceReferencePrice});
     const format=(value:number)=>{try{return new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{style:'currency',currency,maximumFractionDigits:2}).format(value)}catch{return `${value} ${currency}`}};
     return <p className="sheet-store-price">{modalWords.storePrice}: <b>{format(now)}</b>{off&&<WasPrice was={off.was} percent={off.percent} format={format}/>}</p>;
    })()}
    {stale&&<div className="notice sheet-stale" role="note"><Info size={19}/><span>{cc.staleNotice(checkedAt?shortDate(checkedAt,locale):curated?.observedOn??'')}</span></div>}
    <SheetDescription>{curated?`${modalWords.offerFrom} ${curated.store}. ${modalWords.priceOn} ${checkedAt?formatDayMonth(checkedAt,locale):curated.observedOn}. ${modalWords.checkOption}`:modalWords.review}</SheetDescription>
    <Tabs defaultValue="about" className="detail-tabs"><TabsList variant="line"><TabsTrigger value="about">{modalWords.about}</TabsTrigger><TabsTrigger value="price">{modalWords.price}</TabsTrigger></TabsList>
     <TabsContent value="about"><p>{selected.description??modalWords.manual}</p>{selected.sourceUrl&&<a className="text-link" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{modalWords.source}<ArrowUpRight size={16}/></a>}<div className="product-facts"><span>{modalWords.storePrice} <b>{priced?`${selected.sourcePrice??selected.usd} ${selected.sourceCurrency??'USD'}`:cc.checkPrice}</b></span></div></TabsContent>
     <TabsContent value="price">
      <p className="micro">{modalWords.weight}: {selected.weight} {modalWords.kg}.{selected.boxedWeight!==undefined&&<> {modalWords.box} {selected.boxedWeight} {modalWords.kg} + 0.3 {modalWords.kg} {modalWords.packaging}.</>}</p>
      <div className="sheet-speed" role="group" aria-label={sc.title}>
       {/* A country Atlas has no region for gets no rate: the storefront never prints the base tariff as that country's. */}
       {deliverySpeeds.map(at=><button type="button" key={at} aria-pressed={speed===at} onClick={()=>setSpeed(at)}><b>{sc.names[at]}</b><small>{daysOf(at)}{region&&<> · {rateOf(at)}</>}</small></button>)}
      </div>
      {/* No saving figure without a recorded price: the estimate exists only once the order flow fetches it. */}
      <p className="micro sheet-speed-note">{priced&&<>{saving>0?sc.cheaperBy(formatSum(saving,locale)):sc.samePrice}. </>}{cc.speedNote}</p>
      {curated&&<p className="micro">{modalWords.estimate}</p>}
      {priced&&<CostLines q={estimate} storeReserveWaived={selected.sourceShippingEstimated===true} locale={locale}/>}
      <small className="muted">{modalWords.rate}: {money(pricing.fx)} / USD</small>
     </TabsContent>
    </Tabs>
    {!curated&&<div className="field"><label>{modalWords.variant}</label><Choice label={modalWords.variant} value={variant} onChange={setVariant} options={selected.variants}/></div>}
    <div className="notice"><ShieldCheck size={19}/><span>{modalWords.delivery}</span></div>
    <div className="sheet-total"><span>{stale?cc.totalStale:modalWords.withDelivery}<strong>{priced?money(estimate.total):cc.afterCheck}</strong></span>{status==='guest'?<a className="btn primary" href={curated?findOrderUrl(selected):'/order-by-link'}>{modalWords.continue}<ArrowRight size={18}/></a>:<button className="btn primary" disabled={!ready||adding} onClick={add}><ShoppingBag size={18}/>{adding?modalWords.adding:curated?modalWords.continue:modalWords.add}</button>}</div>
   </div></>;
}
