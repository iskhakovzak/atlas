'use client';
import {Clock,Globe,Store,Weight} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {factDays,factDaysNote,factPrice,tariffRows} from '@/lib/market/home-facts';
import {deliveryRegions} from '@/lib/market/site-content';
import {storeBrands} from '@/lib/market/store-brands';
import {heroStores,useHomeCopy} from './home-sections';
import {Flag} from './flags';

/**
 * Wide and tall screens only (app/home-wide-content.css shows it from 1440 x 1000): one row of facts under the hero.
 * Every number comes from the code the page already shows — the store list, the rates rows, the express days —
 * so it is the same on the server and in the browser and never says more than the table below.
 */
export function HomeFacts(){
 const {pricing}=useMarket();
 const {locale,c}=useHomeCopy();
 const rows=tariffRows(pricing);
 const standard=factPrice(rows,'standard',locale),express=factPrice(rows,'express',locale);
 const days=factDays(rows),daysNote=days?factDaysNote(days,locale):'';
 const lower=(text:string)=>text.toLocaleLowerCase(locale);
 const countries=deliveryRegions.map(region=>c.tariffs.regions[region.id]).join(', ');
 return <ul className="hw-facts" aria-label={c.wide.factsLabel}>
  <li><Link className="hw-fact" href="/stores">
   <span className="hw-fact-icon" aria-hidden="true"><Store size={21} strokeWidth={1.8}/></span>
   <span className="hw-fact-body"><span className="hw-fact-value"><b>{storeBrands.length}</b><span>{c.wide.storesUnit(storeBrands.length)}</span></span>
    {heroStores.length>=3&&<span className="hw-fact-sub">{`${heroStores.slice(0,3).map(store=>store.name).join(', ')} ${c.wide.andMore}`}</span>}</span>
  </Link></li>
  <li><a className="hw-fact" href="#tariffs">
   <span className="hw-fact-icon" aria-hidden="true"><Globe size={21} strokeWidth={1.8}/></span>
   <span className="hw-fact-body"><span className="hw-fact-value"><b>{deliveryRegions.length}</b><span>{c.wide.countriesUnit(deliveryRegions.length)}</span>
    {/* The flags are aria-hidden: the countries are read out from the text next to them */}
    <span className="hw-fact-flags" title={countries}>{deliveryRegions.map(region=><Flag key={region.id} region={region.id}/>)}<span className="sr-only">{countries}</span></span></span>
    <span className="hw-fact-sub">{c.wide.countriesSub}</span></span>
  </a></li>
  {standard&&express&&<li><a className="hw-fact" href="#tariffs">
   <span className="hw-fact-icon" aria-hidden="true"><Weight size={21} strokeWidth={1.8}/></span>
   <span className="hw-fact-body"><span className="hw-fact-value is-tight"><b>{standard}</b><span>{c.tariffs.perKgUnit}</span></span>
    <span className="hw-fact-sub">{`${lower(c.tariffs.speeds.standard)}, ${lower(c.tariffs.speeds.express)} — ${express}`}</span></span>
  </a></li>}
  {/* The fastest express days stand apart from the six flags: they hold only for their own countries. */}
  {days&&<li><a className="hw-fact" href="#tariffs">
   <span className="hw-fact-icon" aria-hidden="true"><Clock size={21} strokeWidth={1.8}/></span>
   <span className="hw-fact-body"><span className="hw-fact-value">{days.lead&&<span className="hw-fact-lead"><Flag region={days.lead}/></span>}<b>{`${days.days[0]}–${days.days[1]}`}</b><span>{c.wide.daysUnit(days.days[1])}</span></span>
    <span className="hw-fact-sub" title={daysNote}>{daysNote}</span></span>
  </a></li>}
 </ul>;
}
