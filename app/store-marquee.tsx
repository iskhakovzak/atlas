'use client';
import type {CSSProperties,FocusEvent} from 'react';
import Link from '@/components/site-link';
import {popularBrandKeys,storeBrands,type StoreBrand} from '@/lib/market/store-brands';
import {StoreMark,hasStoreMark,storeWordmarks} from './store-logo';
import {DeliverySky,type Spark} from './delivery-sky';

/**
 * The stores in the hero: the popular ones first (Nike, Zara, Amazon…), then every other store of the catalog with a
 * vector mark. Owner, 7.10.2026: a moving ribbon — two rows going opposite ways on a wide screen, one on a phone.
 * It keeps moving under the pointer (owner, 7.10.2026) and stops only while a link in it has keyboard focus;
 * no pause button. Behind it: dotted delivery routes with light running along them and a few faint sparks.
 * With reduced motion it is a still row that scrolls by hand.
 */
const popular=popularBrandKeys.map(key=>storeBrands.find(brand=>brand.key===key)).filter((brand):brand is StoreBrand=>Boolean(brand));
export const marqueeStores=[...popular,...storeBrands.filter(brand=>!popularBrandKeys.includes(brand.key)&&hasStoreMark(brand.key))];

function Item({store,hidden,openStore}:{store:StoreBrand;hidden:boolean;openStore:string}){
 const mark=hasStoreMark(store.key);
 return <li>
  <a href={'https://'+store.storefronts[0].root} target="_blank" rel="noopener noreferrer" tabIndex={hidden?-1:undefined} aria-label={mark&&storeWordmarks.has(store.key)?`${store.name} (${openStore})`:undefined}>
   {mark&&<StoreMark brandKey={store.key} height={30} maxWidth={140}/>}
   {(!mark||!storeWordmarks.has(store.key))&&<span className="store-marquee-name">{store.name}</span>}
   {!(mark&&storeWordmarks.has(store.key))&&<span className="sr-only"> ({openStore})</span>}
  </a>
 </li>;
}

/** One row: the list and an inert copy right after it, so the loop has no seam (the track moves by half its width). */
function Row({stores,reverse,openStore,className}:{stores:StoreBrand[];reverse?:boolean;openStore:string;className:string}){
 return <div className={'store-marquee-row '+className+(reverse?' reverse':'')} style={{'--marquee-s':`${Math.max(30,stores.length*2.6)}s`} as CSSProperties}>
  <div className="store-marquee-track">
   <ul>{stores.map(store=><Item key={store.key} store={store} hidden={false} openStore={openStore}/>)}</ul>
   <ul className="store-marquee-copy" aria-hidden="true" inert>{stores.map(store=><Item key={store.key} store={store} hidden openStore={openStore}/>)}</ul>
  </div>
 </div>;
}

/** Sparks behind the ribbon: [left %, top %, size px, delay s, gold?]. Fixed, so the server and client agree. */
const sparks:Spark[]=[[6,20,7,0,false],[23,82,5,2.2,true],[41,14,6,4.1,false],[58,86,7,1.1,true],[74,18,5,3.3,false],[91,78,6,5,true]];
/** Delivery routes across the ribbon. */
const routes=['M-20 132 C 140 20, 380 10, 620 70','M-20 40 C 180 118, 420 128, 620 34','M60 150 C 200 60, 330 52, 470 -10'];

/** A link reached by keyboard pauses the ribbon (data-key-focus). Not CSS :has(a:focus-visible): Chrome re-checks such
 * a :has() whenever a link is inserted anywhere on the page (~30 ms each on the home page at 1920 px). */
const keyFocus=(event:FocusEvent<HTMLElement>)=>{
 let visible=false;try{visible=(event.target as HTMLElement).matches(':focus-visible')}catch{}
 if(visible)event.currentTarget.dataset.keyFocus='';
};
const keyBlur=(event:FocusEvent<HTMLElement>)=>{delete event.currentTarget.dataset.keyFocus};

export function StoreMarquee({label,openStore,allStores}:{label:string;openStore:string;allStores:string}){
 // Wide screen: popular stores spread over both rows, so Nike, Zara and Amazon are in view from the start.
 const top=marqueeStores.filter((_,index)=>index%2===0),bottom=marqueeStores.filter((_,index)=>index%2===1);
 return <section className="store-marquee" aria-label={label} onFocus={keyFocus} onBlur={keyBlur}>
  <DeliverySky className="store-marquee-sky" viewBox="0 0 600 150" routes={routes} sparks={sparks}/>
  <Row stores={marqueeStores} openStore={openStore} className="single"/>
  <Row stores={top} openStore={openStore} className="double"/>
  <Row stores={bottom} reverse openStore={openStore} className="double"/>
  <div className="store-marquee-foot">
   <Link className="home-stores-all" href="/stores">{allStores}</Link>
  </div>
 </section>;
}
