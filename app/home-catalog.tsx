'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowDown,ChevronDown} from 'lucide-react';
import type {Product} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {CatalogTeaser,teaserMinimum} from './catalog-teaser';
import {HomeFacts} from './home-facts';
import {DeliveryTariffs,ExampleQuote,HomeFaq,HomeHero,HowItWorks,StickyLinkCta,TrustSection,useHomeCopy} from './home-sections';
import {ProductSheet} from './product-sheet';

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
  // The teaser loads after the first paint and pushes the later sheets down: once it is in place
  // (or known not to come), go back to the sheet named in the address once, without animation.
  const rescrolled=useRef(false);
  useEffect(()=>{
   if(rescrolled.current||!catalogReady)return;
   rescrolled.current=true;
   const id=decodeURIComponent(window.location.hash.slice(1));
   if(!sheetAnchors.has(id))return;
   const frame=requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({block:'start',behavior:'instant'}));
   return ()=>cancelAnimationFrame(frame);
  },[catalogReady,showTeaser]);
  return <><div className="home-top" data-chapter="top"><HomeHero showCatalogLink={catalogProducts.length>0}/><div className="home-example" id="bill"><ExampleQuote/></div><HomeFacts/>
   <a className="home-next home-next-how" href="#how">{c.nav.how}<ArrowDown size={18} aria-hidden="true"/></a>
   <a className="home-next home-next-bill" href="#bill">{c.example.title}<ChevronDown size={18} aria-hidden="true"/></a></div>
  <HowItWorks/>{showTeaser&&<CatalogTeaser select={setSelected}/>}<DeliveryTariffs/><TrustSection/><HomeFaq/><StickyLinkCta aboveNav={status!=='loading'}/>
  <ProductSheet product={selected} onClose={()=>setSelected(null)}/></>;
}
