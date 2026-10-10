'use client';
import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {ArrowDown,ChevronDown} from 'lucide-react';
import type {Product} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {HomeFacts} from './home-facts';
import {DeliveryTariffs,ExampleQuote,HomeFaq,HomeHero,HowItWorks,StickyLinkCta,TrustSection,useHomeCopy} from './home-sections';
import {LazyProductSheet} from './product-sheet-lazy';

/** The home page shows a teaser from this many catalog products; the full list lives on /catalog. */
const teaserMinimum=4;
// The teaser (cards with their tooltips and popovers) is a separate chunk loaded once the catalog has enough products:
// it sits below the first screen and needs the catalog anyway.
const loadTeaser=()=>import('./catalog-teaser');
const CatalogTeaser=lazy(()=>loadTeaser().then(module=>({default:module.CatalogTeaser})));

// Home order: the hero with the example bill beside it, how it works, product selection
// (a teaser once the catalog has enough products; the full list is /catalog), delivery
// times and rates, how money is handled, FAQ. The closing call and the footer form the end
// sheet in app/marketplace.tsx. app/home-chapters.css turns these parts into full-screen sheets.
const sheetAnchors=new Set(['how','finds','tariffs','trust','faq','example','bill']);
export function HomeCatalog(){
  const {status,catalogProducts,catalogReady,loadCatalog}=useMarket();
  useEffect(()=>{void loadCatalog()},[loadCatalog]);
  const [selected,setSelected]=useState<Product|null>(null);
  const {c}=useHomeCopy();
  const showTeaser=catalogReady&&catalogProducts.length>=teaserMinimum;
  // The teaser's chunk has arrived (or no teaser comes), so the sheets below it are in their final place.
  const [teaserLoaded,setTeaserLoaded]=useState(false);
  useEffect(()=>{if(!showTeaser)return;let live=true;void loadTeaser().then(()=>{if(live)setTeaserLoaded(true)},()=>{if(live)setTeaserLoaded(true)});return ()=>{live=false}},[showTeaser]);
  // The teaser loads after the first paint and pushes the later sheets down: once it is in place
  // (or known not to come), go back to the sheet named in the address once, without animation.
  const rescrolled=useRef(false);
  useEffect(()=>{
   if(rescrolled.current||!catalogReady||(showTeaser&&!teaserLoaded))return;
   rescrolled.current=true;
   const id=decodeURIComponent(window.location.hash.slice(1));
   if(!sheetAnchors.has(id))return;
   const frame=requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:'start',behavior:'instant'}));
   return ()=>cancelAnimationFrame(frame);
  },[catalogReady,showTeaser,teaserLoaded]);
  return <><div className="home-top" data-chapter="top"><HomeHero showCatalogLink={catalogProducts.length>0}/><div className="home-example" id="bill"><ExampleQuote/></div><HomeFacts/>
   <a className="home-next home-next-how" href="#how">{c.nav.how}<ArrowDown size={18} aria-hidden="true"/></a>
   <a className="home-next home-next-bill" href="#bill">{c.example.title}<ChevronDown size={18} aria-hidden="true"/></a></div>
  <HowItWorks/>{showTeaser&&<Suspense fallback={null}><CatalogTeaser select={setSelected}/></Suspense>}<DeliveryTariffs/><TrustSection/><HomeFaq/><StickyLinkCta aboveNav={status!=='loading'}/>
  <LazyProductSheet product={selected} onClose={()=>setSelected(null)}/></>;
}
