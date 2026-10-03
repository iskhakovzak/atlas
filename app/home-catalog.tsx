'use client';
import {useEffect,useState} from 'react';
import type {Product} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {CatalogTeaser,teaserMinimum} from './catalog-teaser';
import {DeliveryTariffs,ExampleQuote,HomeFaq,HomeHero,HowItWorks,StickyLinkCta,TrustSection} from './home-sections';
import {ProductSheet} from './product-sheet';

// Home order follows the brief: hero, how it works, example estimate, product selection
// (a teaser once the catalog has enough products; the full list is /catalog), delivery
// times and rates, trust, FAQ; footer is shared.
export function HomeCatalog(){
  const {ready,catalogProducts,catalogReady,loadCatalog}=useMarket();
  useEffect(()=>{void loadCatalog()},[loadCatalog]);
  const [selected,setSelected]=useState<Product|null>(null);
  const showTeaser=catalogReady&&catalogProducts.length>=teaserMinimum;
  return <><HomeHero showCatalogLink={catalogProducts.length>0}/><HowItWorks/><ExampleQuote/>{showTeaser&&<CatalogTeaser select={setSelected}/>}<DeliveryTariffs/><TrustSection/><HomeFaq/><StickyLinkCta aboveNav={ready}/>
  <ProductSheet product={selected} onClose={()=>setSelected(null)}/></>;
}
