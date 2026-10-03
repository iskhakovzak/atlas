'use client';
import {useEffect,useState} from 'react';
import {ArrowUpRight,ArrowRight,ShieldCheck,ShoppingBag,X} from 'lucide-react';
import {Sheet,SheetContent,SheetTitle,SheetDescription,SheetClose} from '@/components/ui/sheet';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {price,money,type Product} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {findOrderUrl} from '@/lib/market/catalog';
import {countryName} from '@/lib/market/world';
import type {Locale} from '@/lib/market/i18n';
import {Choice,CostLines} from './market-ui';
import {ProductGallery} from './product-gallery';
import {DealsFeed,homeCatalogMinimum} from './deals-feed';
import {DeliveryTariffs,ExampleQuote,HomeFaq,HomeHero,HowItWorks,StickyLinkCta,TrustSection} from './home-sections';
import {marketplaceWords} from './marketplace-words';
const navigate=(href:string)=>window.location.assign(href);

// Home order follows the brief: hero, how it works, example estimate, product selection
// (only with enough products), delivery times and rates, trust, FAQ; footer is shared.
// Favorites reuse the product grid and the same product sheet.
export function HomeCatalog({favorites=false}:{favorites?:boolean}){
  const {state,pricing,ready,status,act,catalogProducts,loadCatalog}=useMarket();
  useEffect(()=>{if(!favorites||ready)void loadCatalog()},[favorites,ready,loadCatalog]);
  const locale=state.communication.language as Locale,modalWords=marketplaceWords(locale);
  const [selected,setSelected]=useState<Product|null>(null),[variant,setVariant]=useState(''),[adding,setAdding]=useState(false);
  const curated=selected?catalogProducts.find(item=>item.id===selected.id&&item.sourceUrl===selected.sourceUrl):undefined;
  const countryLabel=(product:Product)=>{const country=countryName(product);if(locale==='ru')return country;return ({'США':locale==='uz'?'AQSh':'United States','Испания':locale==='uz'?'Ispaniya':'Spain','Германия':locale==='uz'?'Germaniya':'Germany','Великобритания':locale==='uz'?'Buyuk Britaniya':'United Kingdom','Франция':locale==='uz'?'Fransiya':'France','Италия':locale==='uz'?'Italiya':'Italy','Румыния':locale==='uz'?'Ruminiya':'Romania','Китай':locale==='uz'?'Xitoy':'China','Турция':locale==='uz'?'Turkiya':'Turkey','Япония':locale==='uz'?'Yaponiya':'Japan','Южная Корея':locale==='uz'?'Janubiy Koreya':'South Korea','ОАЭ':locale==='uz'?'BAA':'United Arab Emirates','Канада':locale==='uz'?'Kanada':'Canada','Австралия':locale==='uz'?'Avstraliya':'Australia'} as Record<string,string>)[country]??country};
  function select(p:Product){setSelected(p);setVariant(p.variants[0])}
  async function add(){if(!selected||adding)return;if(curated){navigate(findOrderUrl(selected));return;}setAdding(true);const ok=await act({type:'cart-add',product:selected,variant});setAdding(false);if(ok){setSelected(null);navigate('/cart')}}
  const showCatalog=catalogProducts.length>=homeCatalogMinimum;
  return <>{favorites?<DealsFeed favorites select={select}/>:<><HomeHero showCatalogLink={showCatalog}/><HowItWorks/><ExampleQuote/>{showCatalog&&<DealsFeed favorites={false} select={select}/>}<DeliveryTariffs/><TrustSection/><HomeFaq/><StickyLinkCta aboveNav={ready}/></>}
  <Sheet open={!!selected} onOpenChange={v=>{if(!v)setSelected(null)}}><SheetContent showCloseButton={false} className="product-sheet"><SheetClose asChild><button className="icon-btn sheet-close" aria-label={modalWords.close}><X size={20}/></button></SheetClose>{selected&&<><div className={'detail-image detail-'+selected.id}><ProductGallery key={selected.id} product={selected} locale={locale}/><span className="floating-label">{selected.sourceUrl?countryLabel(selected):modalWords.item}</span></div><div className="sheet-body"><div className="eyebrow">{selected.brand.includes(countryName(selected))?selected.brand:selected.brand+' · '+countryLabel(selected)}</div><SheetTitle className="product-title">{selected.name}</SheetTitle><SheetDescription>{curated?`${modalWords.offerFrom} ${curated.store}. ${modalWords.priceOn} ${curated.observedOn}. ${modalWords.checkOption}`:modalWords.review}</SheetDescription><Tabs defaultValue="about" className="detail-tabs"><TabsList variant="line"><TabsTrigger value="about">{modalWords.about}</TabsTrigger><TabsTrigger value="price">{modalWords.price}</TabsTrigger></TabsList><TabsContent value="about"><p>{selected.description??modalWords.manual}</p>{selected.sourceUrl&&<a className="text-link" href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">{modalWords.source}<ArrowUpRight size={16}/></a>}<div className="product-facts"><span>{modalWords.storePrice} <b>{selected.sourcePrice??selected.usd} {selected.sourceCurrency??'USD'}</b></span></div></TabsContent><TabsContent value="price"><p className="micro">{modalWords.weight}: {selected.weight} {modalWords.kg}.{selected.boxedWeight!==undefined&&<> {modalWords.box} {selected.boxedWeight} {modalWords.kg} + 0.3 {modalWords.kg} {modalWords.packaging} + 0.2 {modalWords.kg} {modalWords.allowance}.</>}</p>{curated&&<p className="micro">{modalWords.estimate}</p>}<CostLines q={price(selected.usd,selected.weight,1,selected.sourceShippingUsd??0,pricing)} locale={locale}/><small className="muted">{modalWords.rate}: {money(pricing.fx)} / USD</small></TabsContent></Tabs>{!curated&&<div className="field"><label>{modalWords.variant}</label><Choice label={modalWords.variant} value={variant} onChange={setVariant} options={selected.variants}/></div>}<div className="notice"><ShieldCheck size={19}/><span>{modalWords.delivery}</span></div><div className="sheet-total"><span>{modalWords.withDelivery}<strong>{money(price(selected.usd,selected.weight,1,selected.sourceShippingUsd??0,pricing).total)}</strong></span>{status==='guest'?<a className="btn primary" href={curated?findOrderUrl(selected):'/order-by-link'}>{modalWords.continue}<ArrowRight size={18}/></a>:<button className="btn primary" disabled={!ready||adding} onClick={add}><ShoppingBag size={18}/>{adding?modalWords.adding:curated?modalWords.continue:modalWords.add}</button>}</div></div></>}</SheetContent></Sheet></>;
}
