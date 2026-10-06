'use client';
import {useState} from 'react';
import {ArrowUpRight,ArrowRight,ShieldCheck,ShoppingBag,X} from 'lucide-react';
import {Sheet,SheetContent,SheetTitle,SheetDescription,SheetClose} from '@/components/ui/sheet';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {price,money,storeDiscount,storeShippingHoldUsd,storeShippingUsd,type Product} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {findOrderUrl} from '@/lib/market/catalog';
import {countryName} from '@/lib/market/world';
import type {Locale} from '@/lib/market/i18n';
import {daysRangeFor,deliverySpeedCopy} from '@/lib/market/delivery-speed';
import {Choice,CostLines,WasPrice} from './market-ui';
import {ProductGallery} from './product-gallery';
import {marketplaceWords} from './marketplace-words';
const navigate=(href:string)=>window.location.assign(href);
const countries:Record<string,[string,string]>={'США':['AQSh','United States'],'Испания':['Ispaniya','Spain'],'Германия':['Germaniya','Germany'],'Великобритания':['Buyuk Britaniya','United Kingdom'],'Франция':['Fransiya','France'],'Италия':['Italiya','Italy'],'Румыния':['Ruminiya','Romania'],'Китай':['Xitoy','China'],'Турция':['Turkiya','Turkey'],'Япония':['Yaponiya','Japan'],'Южная Корея':['Janubiy Koreya','South Korea'],'ОАЭ':['BAA','United Arab Emirates'],'Канада':['Kanada','Canada'],'Австралия':['Avstraliya','Australia']};

/** Product details for a catalog card with a current price: gallery, description, delivered estimate and the next step. */
export function ProductSheet({product,onClose}:{product:Product|null;onClose:()=>void}){
  return <Sheet open={!!product} onOpenChange={open=>{if(!open)onClose()}}><SheetContent showCloseButton={false} className="product-sheet">{product&&<ProductDetails key={product.id+(product.sourceUrl??'')} product={product} onClose={onClose}/>}</SheetContent></Sheet>;
}

function ProductDetails({product:selected,onClose}:{product:Product;onClose:()=>void}){
  const {state,pricing,ready,status,act,catalogProducts}=useMarket();
  const locale=state.communication.language as Locale,modalWords=marketplaceWords(locale);
  const [variant,setVariant]=useState(selected.variants[0]),[adding,setAdding]=useState(false);
  const curated=catalogProducts.find(item=>item.id===selected.id&&item.sourceUrl===selected.sourceUrl);
  const country=countryName(selected);
  const countryLabel=locale==='ru'?country:countries[country]?.[locale==='uz'?0:1]??country;
  // Unknown store delivery is held apart (or free above $50), never in the total.
  const holdUsd=storeShippingHoldUsd(selected,selected.usd,pricing);
  const estimate={...price(selected.usd,selected.weight,1,storeShippingUsd(selected),pricing),storeShippingHold:selected.sourceShippingEstimated?Math.ceil(holdUsd*pricing.fx):undefined};
  async function add(){if(adding)return;if(curated){navigate(findOrderUrl(selected));return}setAdding(true);const ok=await act({type:'cart-add',product:selected,variant});setAdding(false);if(ok){onClose();navigate('/cart')}}
  return <><SheetClose asChild><button className="icon-btn sheet-close" aria-label={modalWords.close}><X size={20}/></button></SheetClose>
   <div className={'detail-image detail-'+selected.id}><ProductGallery product={selected} locale={locale}/><span className="floating-label">{selected.sourceUrl?countryLabel:modalWords.item}</span></div>
   <div className="sheet-body"><div className="eyebrow">{selected.brand.includes(country)?selected.brand:selected.brand+' · '+countryLabel}</div><SheetTitle className="product-title">{selected.name}</SheetTitle>
    {(()=>{
     // Store price with its discount: the catalog's "before" price for a current card, or the one kept on the product.
     if(selected.priceNeedsConfirmation)return null;
     const now=selected.sourcePrice??selected.usd,currency=selected.sourceCurrency??'USD';
     const off=storeDiscount({usd:selected.usd,sourcePrice:now,sourceReferencePrice:currency==='USD'?curated?.referenceUsd??selected.sourceReferencePrice:selected.sourceReferencePrice});
     const format=(value:number)=>{try{return new Intl.NumberFormat(locale==='en'?'en-US':'ru-RU',{style:'currency',currency,maximumFractionDigits:2}).format(value)}catch{return `${value} ${currency}`}};
     return <p className="sheet-store-price">{modalWords.storePrice}: <b>{format(now)}</b>{off&&<WasPrice was={off.was} percent={off.percent} format={format}/>}</p>;
    })()}
    <SheetDescription>{curated?`${modalWords.offerFrom} ${curated.store}. ${modalWords.priceOn} ${curated.observedOn}. ${modalWords.checkOption}`:modalWords.review}</SheetDescription>
    <Tabs defaultValue="about" className="detail-tabs"><TabsList variant="line"><TabsTrigger value="about">{modalWords.about}</TabsTrigger><TabsTrigger value="price">{modalWords.price}</TabsTrigger></TabsList>
     <TabsContent value="about"><p>{selected.description??modalWords.manual}</p>{selected.sourceUrl&&<a className="text-link" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{modalWords.source}<ArrowUpRight size={16}/></a>}<div className="product-facts"><span>{modalWords.storePrice} <b>{selected.sourcePrice??selected.usd} {selected.sourceCurrency??'USD'}</b></span></div></TabsContent>
     <TabsContent value="price"><p className="micro">{modalWords.weight}: {selected.weight} {modalWords.kg}.{selected.boxedWeight!==undefined&&<> {modalWords.box} {selected.boxedWeight} {modalWords.kg} + 0.3 {modalWords.kg} {modalWords.packaging}.</>}</p>{(()=>{const sc=deliverySpeedCopy[locale];const range=daysRangeFor(pricing,[countryName(selected)],'express');return <p className="micro">{sc.names.express}: {range?sc.days(range[0],range[1]):sc.daysUnknown}.</p>;})()}{curated&&<p className="micro">{modalWords.estimate}</p>}<CostLines q={estimate} storeReserveWaived={selected.sourceShippingEstimated===true} locale={locale}/><small className="muted">{modalWords.rate}: {money(pricing.fx)} / USD</small></TabsContent>
    </Tabs>
    {!curated&&<div className="field"><label>{modalWords.variant}</label><Choice label={modalWords.variant} value={variant} onChange={setVariant} options={selected.variants}/></div>}
    <div className="notice"><ShieldCheck size={19}/><span>{modalWords.delivery}</span></div>
    <div className="sheet-total"><span>{modalWords.withDelivery}<strong>{money(estimate.total)}</strong></span>{status==='guest'?<a className="btn primary" href={curated?findOrderUrl(selected):'/order-by-link'}>{modalWords.continue}<ArrowRight size={18}/></a>:<button className="btn primary" disabled={!ready||adding} onClick={add}><ShoppingBag size={18}/>{adding?modalWords.adding:curated?modalWords.continue:modalWords.add}</button>}</div>
   </div></>;
}
