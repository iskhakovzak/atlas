'use client';
import {useEffect} from 'react';
import {magnetStops,magnetTarget,wheelPixels} from '@/lib/market/home-magnet';

// The wheel magnet of the home sheets (lib/market/home-magnet.ts): on a mouse or touchpad, while the page snaps
// (app/home-chapters.css: mandatory where every sheet fits, no reduced motion), one wheel gesture moves exactly one
// sheet. The touchpad's inertia after the move is swallowed until the wheel is quiet. Keys, the scrollbar, touch, a
// scrolling list or an open dialog under the pointer and ctrl+wheel zoom are left to the browser.
const QUIET=180,THRESHOLD=24;

export function HomeMagnet(){
 useEffect(()=>{
  const html=document.documentElement,main=document.querySelector<HTMLElement>('main.catalog-home');
  if(!main)return;
  const pointer=matchMedia('(hover: hover) and (pointer: fine)');
  let stops:number[]=[],on=false,dirty=true,target:number|null=null,lockUntil=0,acc=0,lastDir=0,lastAt=0,frame=0;
  const measure=()=>{
   dirty=false;
   on=pointer.matches&&getComputedStyle(html).scrollSnapType.includes('mandatory');
   if(!on)return;
   const y=window.scrollY,vh=window.innerHeight;
   // The snap edges the CSS declares: the header (sheet 1) and the sheets (direct children of main or one level down)
   const candidates=[document.querySelector<HTMLElement>('.site-header'),...main.querySelectorAll<HTMLElement>(':scope > *, :scope > * > *')];
   const sheets=candidates.flatMap(el=>{
    if(!el||!getComputedStyle(el).scrollSnapAlign.includes('start'))return [];
    const r=el.getBoundingClientRect();return r.height?[{top:r.top+y,height:r.height}]:[];
   });
   stops=magnetStops(sheets,vh,html.scrollHeight-vh);
  };
  const modalOpen=()=>!!document.querySelector('dialog[open], [aria-modal="true"]')||getComputedStyle(document.body).overflowY==='hidden';
  // A scroller under the pointer that can still move this way keeps the wheel
  const scrollsInside=(start:EventTarget|null,dir:number)=>{
   for(let el=start instanceof Element?start:null;el&&el!==html&&el!==document.body;el=el.parentElement){
    if(el.scrollHeight<=el.clientHeight+1)continue;
    if(!/(auto|scroll|overlay)/.test(getComputedStyle(el).overflowY))continue;
    if(dir>0?el.scrollTop+el.clientHeight<el.scrollHeight-1:el.scrollTop>0)return true;
   }
   return false;
  };
  const land=()=>{target=null;lockUntil=performance.now()+QUIET};
  const go=(to:number)=>{
   target=to;
   window.scrollTo({top:to,behavior:'smooth'});
   const started=performance.now();let last=window.scrollY,still=0;
   const watch=()=>{
    const y=window.scrollY;still=Math.abs(y-last)<.5?still+1:0;last=y;
    // Arrived, stopped (another scroll took over) or too long: the move is over
    if(Math.abs(y-to)<1.5||still>8||performance.now()-started>1600){frame=0;land();return}
    frame=requestAnimationFrame(watch);
   };
   cancelAnimationFrame(frame);frame=requestAnimationFrame(watch);
  };
  const onWheel=(e:WheelEvent)=>{
   if(dirty)measure();
   if(!on||e.defaultPrevented||e.ctrlKey||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
   const dy=wheelPixels(e.deltaY,e.deltaMode,window.innerHeight);if(!dy)return;
   const dir=dy>0?1:-1,now=performance.now();
   if(modalOpen()||scrollsInside(e.target,dir))return;
   // Moving, or the tail of the gesture that started the move: swallow it (the tail keeps the lock while it lasts)
   if(target!==null){e.preventDefault();return}
   if(now<lockUntil){e.preventDefault();lockUntil=now+QUIET;return}
   const next=magnetTarget(stops,window.scrollY,dir as 1|-1);
   if(next===null)return;
   e.preventDefault();
   // A touchpad sends small deltas: gather a few before moving, from this gesture and this direction only
   if(dir!==lastDir||now-lastAt>300)acc=0;
   lastDir=dir;lastAt=now;acc+=Math.abs(dy);
   if(acc<THRESHOLD)return;
   acc=0;go(next);
  };
  const stale=()=>{dirty=true};
  const ac=new AbortController();
  window.addEventListener('wheel',onWheel,{passive:false,signal:ac.signal});
  window.addEventListener('resize',stale,{passive:true,signal:ac.signal});
  pointer.addEventListener('change',stale,{signal:ac.signal});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',stale,{signal:ac.signal});
  const ro=new ResizeObserver(stale);ro.observe(main);
  return ()=>{ac.abort();ro.disconnect();cancelAnimationFrame(frame)};
 },[]);
 return null;
}
