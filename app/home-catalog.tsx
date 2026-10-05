'use client';
import {useEffect,useState} from 'react';
import type {Product} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {CatalogTeaser,teaserMinimum} from './catalog-teaser';
import {DeliveryTariffs,ExampleQuote,HomeClosing,HomeFaq,HomeHero,HowItWorks,StickyLinkCta,TrustSection} from './home-sections';
import {ProductSheet} from './product-sheet';

// Home order: the hero with the example bill beside it, how it works, product selection
// (a teaser once the catalog has enough products; the full list is /catalog), delivery
// times and rates, how money is handled, FAQ, a closing call to paste a link; footer is shared.
export function HomeCatalog(){
  const {status,catalogProducts,catalogReady,loadCatalog}=useMarket();
  useEffect(()=>{void loadCatalog()},[loadCatalog]);
  const [selected,setSelected]=useState<Product|null>(null);
  const showTeaser=catalogReady&&catalogProducts.length>=teaserMinimum;
  return <><div className="home-top"><HomeHero showCatalogLink={catalogProducts.length>0}/><ExampleQuote/></div><HowItWorks/>{showTeaser&&<CatalogTeaser select={setSelected}/>}<DeliveryTariffs/><TrustSection/><HomeFaq/><HomeClosing/><StickyLinkCta aboveNav={status!=='loading'}/>
  <ProductSheet product={selected} onClose={()=>setSelected(null)}/></>;
}
