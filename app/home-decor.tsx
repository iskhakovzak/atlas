'use client';
import {useEffect,useRef} from 'react';
import {useMarket} from '@/lib/market/store';
import {homeCopy} from '@/lib/market/home-copy';
import {deliveryRegions,type DeliveryRegion} from '@/lib/market/site-content';
import type {Locale} from '@/lib/market/i18n';
import {homeChapters,homeWideLayoutEvent,homeWideMedia,homeWideZoom,type HomeChapter} from '@/lib/market/home-wide';
import {landDots,quadArc,routeBulge,routeLabelSide,routeOrigins,tashkent} from '@/lib/market/world-land';
import {decorMedal,decorOrbit2,type DecorArt} from './home-decor-art';

// Wide-screen decor behind the home sheets, loaded by HomeDecorSlot (app/home-wide.tsx) only at homeWideMedia.wide:
// a soft mint pool on every sheet, a medallion in the right field where the field is wide enough (hero, rates,
// "your money", FAQ) and, on the closing sheet, a dot map with routes from the delivery regions to Tashkent — an
// illustration (approximate country centres, no times, no statuses). React owns only the root; the layers, SVG and
// parcels are drawn imperatively from the sheets' geometry. All sizes are window pixels: main itself is never zoomed
// (the 27"+ zoom sits on the sheets), so the root's CSS pixels are window pixels. Styles: app/home-wide-decor.css.

type Box={left:number;right:number;top:number;bottom:number;width:number;height:number};
type Labels={regions:Record<DeliveryRegion,string>;to:string};
type Layer={el:HTMLDivElement;glow:HTMLDivElement;anims:Animation[];mapKey:string;glowKey:string;near:boolean};
type Engine={setLabels:(labels:Labels)=>void;stop:()=>void};

const NS='http://www.w3.org/2000/svg';
const sheetArt:Partial<Record<HomeChapter,DecorArt>>={top:'globe',tariffs:'box',trust:'bill',faq:'ask'};
/** The blocks a sheet's medallion and mint pool line up with; on the closing sheet, the card the map stands on. */
const sheetTarget:Record<HomeChapter,string>={top:'.home-example',how:'.home-steps',finds:'.finds-grid',tariffs:'.tariff-grid',trust:'.home-trust-money, .home-trust-proof',faq:'.home-faq',end:'.home-closing'};
/** The map's anchor: this longitude sits over the content column's centre, this latitude just above the card. */
const mapLon=12,mapLat=33;

// A mint pool: a radial gradient with a long soft fall-off (alpha in % of the colour at each stop).
const fall=[[0,100],[8,97],[16,90],[24,80],[32,68],[40,55],[48,43],[56,32],[64,22],[72,14],[80,8],[88,4],[94,1.5]];
const pool=(color:string,w:number,h:number,x:number,y:number)=>`radial-gradient(${w.toFixed(0)}px ${h.toFixed(0)}px at ${x.toFixed(0)}px ${y.toFixed(0)}px, ${fall.map(([p,a])=>`color-mix(in srgb, ${color} ${a}%, transparent) ${p}%`).join(', ')}, transparent 100%)`;
// cubic-bezier(.45, .05, .35, 1): a parcel's pace along its arc
const ease=(()=>{
 const x1=.45,y1=.05,x2=.35,y2=1;
 const bx=(t:number)=>3*(1-t)*(1-t)*t*x1+3*(1-t)*t*t*x2+t*t*t,by=(t:number)=>3*(1-t)*(1-t)*t*y1+3*(1-t)*t*t*y2+t*t*t;
 return (x:number)=>{let lo=0,hi=1;for(let i=0;i<22;i++){const m=(lo+hi)/2;if(bx(m)<x)lo=m;else hi=m}return by((lo+hi)/2)};
})();
const svgEl=(tag:string,attrs:Record<string,string|number>,parent:Element)=>{const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,String(attrs[k]));parent.appendChild(n);return n};
/** A direct child of a layer by class, created once. */
function part<T extends Element>(layer:Layer,cls:string,make:()=>T):T{
 let n=layer.el.querySelector<T>(`:scope > .${cls}`);
 if(!n){n=make();n.classList.add(cls);layer.el.appendChild(n)}
 return n;
}
const svgPart=(layer:Layer,cls:string)=>part(layer,cls,()=>{const s=document.createElementNS(NS,'svg');s.setAttribute('focusable','false');s.setAttribute('aria-hidden','true');return s});
const dropParts=(layer:Layer,...cls:string[])=>{for(const c of cls)layer.el.querySelector(`:scope > .${c}`)?.remove()};
const stopAnims=(layer:Layer)=>{for(const a of layer.anims)a.cancel();layer.anims=[]};

/** The closing sheet: land dots around the card, arcs from the delivery regions to Tashkent, parcels on the arcs. */
function drawMap(layer:Layer,W:number,H:number,col:Box,card:Box,foot:number,clipL:number,zoom:number,labels:Labels,still:boolean){
 const sky=card.top;
 if(sky<300){stopAnims(layer);dropParts(layer,'hw-decor-map','hw-decor-routes','hw-decor-parcels');return}
 const routes=deliveryRegions.flatMap(({id})=>{const at=routeOrigins[id];return at?[{id,lon:at[0],lat:at[1]}]:[]});
 const west=Math.min(mapLon,...routes.map(r=>r.lon)),east=Math.max(mapLon,...routes.map(r=>r.lon));
 const z=Math.max(1,zoom),zl=Math.max(1,zoom*.92);
 // Scale: the column holds ~240 degrees of longitude; a tall sky grows the map a little; the countries and their labels
 // fit in the sky; the westmost and eastmost labels (~70px) stay clear of the rail and the window edge.
 const s0=col.width/240;
 let s=Math.min(s0,(sky-130)/20);
 s=Math.max(s,Math.min((1.15+Math.min(.2,Math.max(0,(sky-700)/1500)))*s0,(sky-70)/56));
 s=Math.min(s,(W-24-70-(clipL+20+70))/Math.max(1,east-west));
 const la=mapLat-Math.max(64,sky*.15)/s;
 let cx=(col.left+col.right)/2;
 const xW=cx+(west-mapLon)*s-70,xE=cx+(east-mapLon)*s+70;
 if(xW<clipL+20)cx+=clipL+20-xW;
 else if(xE>W-24)cx-=xE-(W-24);
 const X=(lon:number)=>cx+(lon-mapLon)*s,Y=(lat:number)=>sky-(lat-la)*s;
 const box=(svg:SVGSVGElement)=>{svg.setAttribute('viewBox',`0 0 ${W} ${H}`);Object.assign(svg.style,{left:'0px',top:'0px',width:`${W}px`,height:`${H}px`});svg.replaceChildren()};

 const map=svgPart(layer,'hw-decor-map');box(map);
 const padQ=24,halo=48*z,levels=8,buckets:string[][]=Array.from({length:levels},()=>[]),r=Math.max(1.4,s*.3);
 for(const [lon,lat] of landDots()){
  const x=X(lon),y=Y(lat);
  if(x<clipL||x>W+4||y<-4||y>H)continue;
  const dx=Math.max(card.left-padQ-x,0,x-(card.right+padQ)),dy=Math.max(card.top-padQ-y,0,y-(card.bottom+padQ));
  if(dx===0&&dy===0)continue;
  let f=Math.min(1,Math.hypot(dx,dy)/halo);   // a narrow quiet edge around the closing card
  f*=Math.min(1,y/90);                         // fade in from the sheet top
  f*=Math.min(1,Math.max(0,(foot-40-y)/170));  // fade out above the footer
  f*=Math.min(1,(x-clipL)/150);                // fade in from the content edge (never under the rail)
  f*=Math.min(1,(W-x)/(W*.07));                // soft right edge
  if(f<=.04)continue;
  buckets[Math.min(levels-1,Math.floor(f*levels))].push(`M${x.toFixed(1)} ${y.toFixed(1)}h0`);
 }
 const dots=svgEl('g',{},map);
 buckets.forEach((b,i)=>{if(b.length)svgEl('path',{class:'hw-decor-land',d:b.join(''),'stroke-width':(r*2).toFixed(2),style:`opacity:calc(var(--hwd-dot-a) * ${((i+1)/levels).toFixed(3)})`},dots)});

 const tx=X(tashkent[0]),ty=Y(tashkent[1]);
 const rs=svgPart(layer,'hw-decor-routes');box(rs);
 rs.style.setProperty('--hwd-lbl',`${(Math.min(14.5,Math.max(12.5,W/180))*zl).toFixed(1)}px`);
 const arcs=svgEl('g',{},rs),marks=svgEl('g',{},rs),names=svgEl('g',{},rs);
 // Parcels and the pulse are HTML nodes animated on transform and opacity only
 stopAnims(layer);
 const parcels=part(layer,'hw-decor-parcels',()=>document.createElement('div'));
 parcels.replaceChildren();
 Object.assign(parcels.style,{width:`${W}px`,height:`${H}px`});
 routes.forEach(({id,lon,lat},i)=>{
  const x=X(lon),y=Y(lat);
  const chord=Math.hypot(tx-x,ty-y),h=Math.max(0,Math.min(chord*(routeBulge[id]??.36),Math.min(y,ty)-40));
  // The parcels walk the same rounded curve the path draws, measured in JS (no getPointAtLength: a layout per call)
  const [x0,y0,qx,qy,x1,y1]=[x,y,(x+tx)/2,Math.min(y,ty)-h,tx,ty].map(v=>Math.round(v*10)/10);
  svgEl('path',{class:'hw-decor-arc',d:`M${x0} ${y0}Q${qx} ${qy} ${x1} ${y1}`},arcs);
  const arc=quadArc(x0,y0,qx,qy,x1,y1),L=arc.length;
  const at=(len:number)=>{const p=arc.at(len);return `translate(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px) rotate(${p.angle.toFixed(1)}deg)`};
  const parcel=document.createElement('i');parcel.className='hw-decor-parcel';parcels.appendChild(parcel);
  if(still){parcel.style.transform=at(L*.55);parcel.style.opacity='1'}
  else if(typeof parcel.animate==='function'){
   const frames:Keyframe[]=[],steps=36;
   for(let k=0;k<=steps;k++){const tau=k/steps,off=tau*.72;frames.push({offset:off,transform:at(ease(tau)*L),opacity:off<.06?off/.06:off<.64?1:Math.max(0,1-(off-.64)/.08)})}
   frames.push({offset:1,transform:frames[frames.length-1].transform,opacity:0});
   const a=parcel.animate(frames,{duration:6400,iterations:Infinity,easing:'linear'});
   a.currentTime=(i*1.07+.6)*1000;
   if(layer.el.dataset.live!=='1')a.pause();
   layer.anims.push(a);
  }
  svgEl('circle',{class:'hw-decor-from-halo',cx:x,cy:y,r:9},marks);svgEl('circle',{class:'hw-decor-from',cx:x,cy:y,r:3.6},marks);
  const name=labels.regions[id];if(!name)return;
  const side=routeLabelSide[id]??'l';
  const t=svgEl('text',{class:'hw-decor-lbl',x:side==='l'?x-12:side==='r'?x+12:x,y:side==='b'?y+22*zl:y+4.5,'text-anchor':side==='l'?'end':side==='r'?'start':'middle'},names);
  t.textContent=name;
 });
 const pulse=document.createElement('i');pulse.className='hw-decor-pulse';Object.assign(pulse.style,{left:`${tx.toFixed(2)}px`,top:`${ty.toFixed(2)}px`});parcels.appendChild(pulse);
 svgEl('circle',{class:'hw-decor-to-ring',cx:tx,cy:ty,r:12},marks);svgEl('circle',{class:'hw-decor-to',cx:tx,cy:ty,r:5.5},marks);
 if(labels.to){const t=svgEl('text',{class:'hw-decor-lbl hw-decor-lbl-to',x:tx,y:ty+30*zl,'text-anchor':'middle'},names);t.textContent=labels.to}
}

function startDecor(root:HTMLDivElement):Engine{
 const main=root.closest<HTMLElement>('main.catalog-home');
 const ac=new AbortController(),on={signal:ac.signal,passive:true};
 const layers=new Map<HomeChapter,Layer>(),byEl=new WeakMap<Element,Layer>(),watched=new Set<Element>();
 const wide=matchMedia(homeWideMedia.wide),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 let raf=0,stopped=false,labels:Labels={regions:homeCopy.ru.tariffs.regions,to:homeCopy.ru.example.to};
 const schedule=()=>{if(!stopped&&!raf)raf=requestAnimationFrame(render)};
 // Parcels and the pulse run only while their sheet is on screen
 const io=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries){
  const layer=byEl.get(e.target);if(!layer)continue;
  layer.el.dataset.live=e.isIntersecting?'1':'0';
  for(const a of layer.anims){if(e.isIntersecting)a.play();else a.pause()}
 }}):null;
 // The map is drawn only within half a window of the screen: a load, a theme or language switch or a resize up top
 // never pays for it, and it is ready before the closing sheet scrolls in.
 const nearIo=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{for(const e of entries){
  const layer=byEl.get(e.target);if(!layer)continue;
  layer.near=e.isIntersecting;if(layer.near)schedule();
 }},{rootMargin:'50% 0px'}):null;
 const ro=new ResizeObserver(schedule);
 const layerFor=(chapter:HomeChapter)=>{
  let layer=layers.get(chapter);if(layer)return layer;
  const el=document.createElement('div');el.className='hw-decor-layer';el.dataset.chapter=chapter;el.dataset.live=io?'0':'1';
  const glow=document.createElement('div');glow.className='hw-decor-glow';el.appendChild(glow);root.appendChild(el);
  layer={el,glow,anims:[],mapKey:'',glowKey:'',near:!nearIo};layers.set(chapter,layer);byEl.set(el,layer);io?.observe(el);
  if(chapter==='end')nearIo?.observe(el);
  return layer;
 };
 const dropLayer=(chapter:HomeChapter,layer:Layer)=>{stopAnims(layer);io?.unobserve(layer.el);nearIo?.unobserve(layer.el);layer.el.remove();layers.delete(chapter)};
 const setGlow=(layer:Layer,value:string)=>{if(layer.glowKey!==value){layer.glowKey=value;layer.glow.style.background=value}};

 function render(){
  raf=0;
  if(stopped||!main||!wide.matches)return;
  // Reads first (one layout), then writes
  const vw=document.documentElement.clientWidth,m=main.getBoundingClientRect(),zoom=homeWideZoom(),z=Math.max(1,zoom);
  const rail=document.querySelector<HTMLElement>('[data-home-rail]');
  const railBox=rail&&getComputedStyle(rail).display!=='none'?rail.getBoundingClientRect():null;
  const seen=new Set<HomeChapter>(),sheets:{chapter:HomeChapter;el:HTMLElement}[]=[];
  for(const el of main.querySelectorAll<HTMLElement>('[data-chapter]')){
   const chapter=el.dataset.chapter as HomeChapter;
   if(root.contains(el)||!homeChapters.includes(chapter)||seen.has(chapter))continue;
   seen.add(chapter);sheets.push({chapter,el});
  }
  const plans=sheets.map(({chapter,el})=>{
   const S=el.getBoundingClientRect();
   const rel=(r:DOMRect):Box=>({left:r.left,right:r.right,top:r.top-S.top,bottom:r.bottom-S.top,width:r.width,height:r.height});
   const targets=[...el.querySelectorAll<HTMLElement>(sheetTarget[chapter])];
   const blocks=targets.map(n=>rel(n.getBoundingClientRect())).filter(b=>b.width&&b.height);
   const foot=chapter==='end'?el.querySelector<HTMLElement>('.home-footer'):null;
   // A sheet keeps its height while its blocks change size (logos and fonts load, the theme changes, an answer opens)
   // and move inside it: the blocks are watched too.
   return {chapter,S,col:rel(S),blocks,foot:foot?rel(foot.getBoundingClientRect()).top:S.height,watch:[el,...targets,...(foot?[foot]:[])]};
  });
  const rootTop=m.top+main.clientTop,still=reduce.matches;

  // Watch the sheets present now and their blocks (the selection arrives later, an FAQ answer opens), forget the ones that are gone
  const want=new Set<Element>(plans.flatMap(plan=>plan.watch));
  for(const el of watched)if(!want.has(el)){ro.unobserve(el);watched.delete(el)}
  for(const el of want)if(!watched.has(el)){watched.add(el);ro.observe(el)}
  root.style.left=`${-(m.left+main.clientLeft)}px`;root.style.width=`${vw}px`;
  for(const [chapter,layer] of layers)if(!seen.has(chapter))dropLayer(chapter,layer);
  for(const {chapter,S,col,blocks,foot} of plans){
   const layer=layerFor(chapter),W=vw,H=S.height;
   layer.el.style.top=`${(S.top-rootTop).toFixed(2)}px`;layer.el.style.height=`${H.toFixed(2)}px`;
   if(!W||!H)continue;
   if(chapter==='end'){
    const card=blocks[0];
    if(!card){stopAnims(layer);dropParts(layer,'hw-decor-map','hw-decor-routes','hw-decor-parcels');layer.mapKey='';setGlow(layer,'');continue}
    const clipL=railBox&&railBox.width?Math.max(railBox.right+24,col.left-40):0;
    const key=[W,H,col.left,col.right,card.left,card.right,card.top,card.bottom,foot,clipL].map(v=>Math.round(v)).join()+`|${zoom}|${still}|${labels.to}|${Object.values(labels.regions).join()}`;
    // Redraw (and restart the parcels) only when the geometry, the labels or the motion setting changed, and only near
    // the screen: far off it the old drawing (or none) waits, and nearIo schedules the redraw on the way in.
    if(layer.mapKey!==key&&layer.near){layer.mapKey=key;drawMap(layer,W,H,col,card,foot,clipL,zoom,labels,still)}
    const gx=(col.left+col.right)/2;
    setGlow(layer,[pool('var(--hwd-mint)',W*.5,H*.36,gx,Math.max(0,card.top-H*.16)),pool('var(--hwd-mint-2)',W*.44,H*.26,gx,card.bottom)].join(','));
    continue;
   }
   // A medallion centred in the right field: full (two orbits) with 64px to the content and the window edge,
   // compact (one orbit) with 36px where the field is narrower, or none — then only the mint pool.
   const mr=W-col.right,art=sheetArt[chapter];
   const bt=blocks.length?Math.min(...blocks.map(b=>b.top)):col.top,bb=blocks.length?Math.max(...blocks.map(b=>b.bottom)):col.bottom;
   let kind:''|'full'|'compact'='',size=0;
   if(art){
    const full=Math.min(220*z,(mr-128)*200/(decorOrbit2*2)),compact=Math.min(170*z,(mr-72)*200/197);
    if(full>=150){kind='full';size=full}else if(compact>=116){kind='compact';size=compact}
   }
   const mx=col.right+mr/2,reach=kind?size*(kind==='full'?decorOrbit2*2:197)/200:0;
   const my=Math.min(Math.max((bt+bb)/2,reach/2+8),H-reach/2-8);
   if(art&&kind){
    const medal=svgPart(layer,'hw-decor-medal');
    medal.setAttribute('viewBox','0 0 200 200');medal.classList.add('hw-decor-art');
    if(medal.dataset.art!==art+kind){medal.innerHTML=decorMedal(art,kind==='full');medal.dataset.art=art+kind}
    Object.assign(medal.style,{left:`${(mx-size/2).toFixed(1)}px`,top:`${(my-size/2).toFixed(1)}px`,width:`${size.toFixed(1)}px`,height:`${size.toFixed(1)}px`});
   }else dropParts(layer,'hw-decor-medal');
   // One soft pool in the right field (behind the medallion, if any), a fainter one behind the content
   setGlow(layer,[pool('var(--hwd-mint)',W*.3,H*.5,mx,my),pool('var(--hwd-mint-2)',W*.26,H*.4,col.left+col.width*.3,bt+(bb-bt)*.4)].join(','));
  }
 }

 if(main)ro.observe(main);
 window.addEventListener('resize',schedule,on);
 window.addEventListener(homeWideLayoutEvent,schedule,on);
 reduce.addEventListener('change',schedule,on);
 wide.addEventListener('change',schedule,on);
 void document.fonts?.ready.then(schedule);
 schedule();
 return {
  setLabels(next){labels=next;schedule()},
  stop(){
   stopped=true;ac.abort();cancelAnimationFrame(raf);raf=0;ro.disconnect();io?.disconnect();nearIo?.disconnect();watched.clear();
   for(const layer of layers.values())stopAnims(layer);
   layers.clear();root.replaceChildren();root.style.removeProperty('left');root.style.removeProperty('width');
  },
 };
}

/** The decor root, the last child of main.catalog-home; mounted only on wide screens (homeWideMedia.wide). */
export function HomeDecor(){
 const {state}=useMarket();
 const locale=state.communication.language as Locale;
 const root=useRef<HTMLDivElement>(null),engine=useRef<Engine|null>(null);
 useEffect(()=>{
  const el=root.current;if(!el)return;
  const decor=startDecor(el);engine.current=decor;
  return ()=>{engine.current=null;decor.stop()};
 },[]);
 // Map labels come from the copy (not the page): the tariff country names and the example's destination
 useEffect(()=>{const c=homeCopy[locale]??homeCopy.ru;engine.current?.setLabels({regions:c.tariffs.regions,to:c.example.to})},[locale]);
 return <div className="hw-decor" aria-hidden="true" ref={root}/>;
}
