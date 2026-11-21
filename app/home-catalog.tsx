'use client';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {homeCatalogTeaserSize} from '@/lib/market/catalog-summary';
import type {HomeCatalogPreview} from '@/lib/market/catalog-teaser';
import type {Product} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {DeliveryTariffs,HomeExample,HomeFaq,HomeHero,HowItWorks,TrustSection} from './home-sections';
import {LazyProductSheet} from './product-sheet-lazy';
import {loadChunk} from '@/lib/market/stale-build';

/** The home page shows a rail from this many catalog products; the full list lives on /catalog. */
const teaserMinimum=4;
/** Placeholder cards while the catalog loads (the rail shows up to 8). */
const skeletonCards=6;
// The rail's cards (with their tooltips and popovers) are a separate chunk loaded once the catalog has enough products.
const loadTeaser=()=>import('./catalog-teaser');
const CatalogTeaser=lazy(()=>loadChunk(loadTeaser).then(module=>({default:module.CatalogTeaser})));

/** The rail's shape while the catalog or its chunk loads, so the sections below do not jump when the cards arrive. */
function RailSkeleton(){
 return <section className="home-rail is-loading" aria-hidden="true">
  <div className="home-rail-head"><span className="home-skeleton home-skeleton-title"/></div>
  <div className="home-rail-track">{Array.from({length:skeletonCards},(_,index)=><span key={index} className="home-rail-ghost"><span className="home-skeleton home-skeleton-photo"/><span className="home-skeleton home-skeleton-line"/><span className="home-skeleton home-skeleton-sum"/></span>)}</div>
 </section>;
}

/** Sections the header, the footer and other pages link to (/#how, /#tariffs, /#faq…). */
const anchors=new Set(['how','tariffs','trust','faq','bill','example']);

// Home order (owner, 1.11.2026, plan stage 3): the first screen holds the hero with the link field, the example bill beside
// it on wide screens, and a rail of real catalog products with their sums in soum. Then how it works (3 steps), rates in
// short, money and guarantees (3 cards) and five questions. The atmosphere stays behind the first screen only.
export function HomeCatalog(){
 const {catalogProducts,catalogReady,catalogError,loadCatalog,applyPublicPricing}=useMarket();
 const [preview,setPreview]=useState<HomeCatalogPreview|null>(null);
 const fullReady=catalogReady&&!catalogError;
 useEffect(()=>{
  if(fullReady)return;
  const controller=new AbortController();
  async function loadPreview(){
   try{
    const response=await fetch('/api/catalog?view=home',{signal:controller.signal});
    if(!response.ok)throw Error('Home catalog load failed');
    const data=await response.json() as HomeCatalogPreview;
    if(!Array.isArray(data.products)||!Number.isSafeInteger(data.total)||data.total<0||data.products.length!==Math.min(data.total,homeCatalogTeaserSize))throw Error('Home catalog response is invalid');
    if(controller.signal.aborted)return;
    applyPublicPricing(data.pricing);
    setPreview(data);
   }catch{
    if(!controller.signal.aborted)void loadCatalog();
   }
  }
  void loadPreview();
  return ()=>controller.abort();
 },[fullReady,loadCatalog,applyPublicPricing]);
 const [selected,setSelected]=useState<Product|null>(null);
 const previewForRail=fullReady?null:preview;
 const railReady=catalogReady||previewForRail!==null;
 const showTeaser=railReady&&(previewForRail?.total??catalogProducts.length)>=teaserMinimum;
 // The rail's chunk has arrived (or no rail comes), so the sections below it are in their final place.
 const [teaserLoaded,setTeaserLoaded]=useState(false);
 useEffect(()=>{if(!showTeaser)return;let live=true;void loadTeaser().then(()=>{if(live)setTeaserLoaded(true)},()=>{if(live)setTeaserLoaded(true)});return ()=>{live=false}},[showTeaser]);
 // The rail can differ from its placeholder by a few pixels: once it is in place (or known not to come), go back to the
 // section named in the address once, without animation.
 const rescrolled=useRef(false);
 useEffect(()=>{
  if(rescrolled.current||!railReady||(showTeaser&&!teaserLoaded))return;
  rescrolled.current=true;
  let id:string;
  try{id=decodeURIComponent(window.location.hash.slice(1))}catch{return}
  if(!anchors.has(id))return;
  const frame=requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:'start',behavior:'instant'}));
  return ()=>cancelAnimationFrame(frame);
 },[railReady,showTeaser,teaserLoaded]);
 return <>
  <div className="home-top">
   <HomeHero/>
   {/* No products (an empty catalog) — no rail and no gap. */}
   {!railReady?<RailSkeleton/>:showTeaser&&<Suspense fallback={<RailSkeleton/>}><CatalogTeaser select={setSelected} preview={previewForRail}/></Suspense>}
   <HomeExample/>
  </div>
  <HowItWorks/><DeliveryTariffs/><TrustSection/><HomeFaq/>
  <LazyProductSheet product={selected} onClose={()=>setSelected(null)}/>
 </>;
}
