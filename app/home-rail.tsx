'use client';
import {useEffect,useRef,useState,type MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import {ArrowDown,ClipboardPaste} from 'lucide-react';
import {useMarket} from '@/lib/market/store';
import {homeCopy} from '@/lib/market/home-copy';
import {catalogCopy} from '@/lib/market/catalog-copy';
import {homeRailCopy} from '@/lib/market/home-rail-copy';
import {currentChapterIndex,padChapter,railFill} from '@/lib/market/home-rail';
import {homeChapterHref,homeChapters,homeRailCtaChapters,homeWideLayoutEvent,type HomeChapter} from '@/lib/market/home-wide';
import type {Locale} from '@/lib/market/i18n';
import {focusLinkInput} from './home-sections';

// The home chapter rail on wide screens (>= 1680px): loaded lazily by app/home-wide.tsx, styled by app/home-wide-rail.css.
// One item per sheet that is on the page (the product selection may be missing, then the numbers close up), the current
// one marked, a progress line, and the quiet «Paste a link» button on sheets without main buttons of their own. Every
// sheet but the last also gets a numbered «next chapter» cue at its bottom (a portal, the sheet's last child).
// Geometry is read on mount, resize, size changes of main and font load; scrolling reads nothing but scrollY.
// Names and titles come from the copy objects, never from the page.

type Sheet={key:HomeChapter;el:HTMLElement};

/** The sheets on the page, in chapter order. Direct children of main only: the decor's layers carry data-chapter too. */
function findSheets():Sheet[]{
 const main=document.querySelector('main.catalog-home');
 if(!main)return [];
 return homeChapters.flatMap((key:HomeChapter):Sheet[]=>{const el=main.querySelector<HTMLElement>(`:scope > [data-chapter="${key}"]`);return el?[{key,el}]:[]});
}
const sameSheets=(a:Sheet[],b:Sheet[])=>a.length===b.length&&a.every((sheet,i)=>sheet.key===b[i].key&&sheet.el===b[i].el);
// 'instant', not 'auto': globals.css sets scroll-behavior:smooth on html, and 'auto' would follow it.
const scrollBehavior=():ScrollBehavior=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';

export function HomeRail(){
 const {state}=useMarket();
 const locale=state.communication.language as Locale;
 const c=homeCopy[locale],rc=homeRailCopy[locale];
 // Rendered on the client only (after the slot's media query matched), so the first paint may read the page.
 const [sheets,setSheets]=useState<Sheet[]>(()=>typeof document==='undefined'?[]:findSheets());
 const [cur,setCur]=useState(0);
 const navRef=useRef<HTMLElement>(null),fillRef=useRef<HTMLSpanElement>(null),headRef=useRef<HTMLSpanElement>(null),gliderRef=useRef<HTMLSpanElement>(null);
 const announced=useRef('');

 // The decor keeps its route map clear of the rail: tell it when the rail goes away.
 useEffect(()=>()=>{window.dispatchEvent(new Event(homeWideLayoutEvent))},[]);

 useEffect(()=>{
  const nav=navRef.current,fill=fillRef.current,head=headRef.current,glider=gliderRef.current,main=document.querySelector('main.catalog-home');
  if(!nav||!fill||!head||!glider||!main)return;
  const ac=new AbortController();
  let tops:number[]=[],centres:number[]=[],docH=0,shown=-1,drawn=-1,glided=-1,frame=0,scrollFrame=0,alive=true;
  const measure=()=>{
   const y=window.scrollY;
   tops=sheets.map(sheet=>sheet.el.getBoundingClientRect().top+y);
   docH=document.documentElement.scrollHeight;
   centres=Array.from(nav.querySelectorAll<HTMLElement>('.hw-rail-item'),item=>item.offsetTop+item.offsetHeight/2);
   if(centres.length>1){
    nav.style.setProperty('--hw-rail-t0',`${centres[0]}px`);
    nav.style.setProperty('--hw-rail-len',`${centres[centres.length-1]-centres[0]}px`);
   }
   drawn=-1;glided=-1;
   // Compact <-> full rail, zoom steps, a chapter more or less: the decor re-measures.
   const box=nav.getBoundingClientRect(),key=[box.left,box.top,box.width,box.height].map(Math.round).join();
   if(key!==announced.current){announced.current=key;window.dispatchEvent(new Event(homeWideLayoutEvent))}
  };
  const update=()=>{
   if(!tops.length)return;
   const y=window.scrollY,index=currentChapterIndex(tops,y,window.innerHeight,docH);
   // aria-current, data-state and data-cta change only when the chapter does.
   if(index!==shown){shown=index;setCur(index)}
   // One inline transform on one element: no layout and no style cascade through the rail while scrolling.
   const f=railFill(tops,centres,y,index);
   if(Math.abs(f-drawn)>0.004||(f!==drawn&&(f===0||f===1))){
    drawn=f;fill.style.transform=`scaleY(${f.toFixed(4)})`;
    // The ring rides the end of the progress line, so it slides from number to number with the scroll
    if(centres.length>1)head.style.transform=`translateY(${(centres[0]+f*(centres[centres.length-1]-centres[0])).toFixed(1)}px)`;
   }
   // The current chapter's card glides to its item (a CSS transition on transform); placed without one the first time
   if(index!==glided&&centres[index]!==undefined){
    if(glided<0)glider.style.transition='none';
    glider.style.transform=`translateY(${centres[index].toFixed(1)}px)`;
    if(glided<0){void glider.offsetWidth;glider.style.transition='';glider.dataset.on=''}
    glided=index;
   }
  };
  const refresh=()=>{
   const next=findSheets();
   // A sheet came or went: re-render, and the next run of this effect measures.
   if(!sameSheets(next,sheets)){setSheets(next);return}
   measure();update();
  };
  const again=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh)};
  window.addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;update()})},{passive:true,signal:ac.signal});
  window.addEventListener('resize',again,{passive:true,signal:ac.signal});
  // main grows when the product selection arrives or an answer opens. The first callback comes right after observe().
  const ro=new ResizeObserver(again);
  ro.observe(main);
  void document.fonts?.ready.then(()=>{if(alive)again()});
  return ()=>{alive=false;ac.abort();ro.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame)};
 },[sheets,locale]);

 const goTo=(index:number)=>{
  const sheet=sheets[index];
  if(!sheet)return;
  const behavior=scrollBehavior();
  if(sheet.key==='top')window.scrollTo({top:0,behavior});
  else sheet.el.scrollIntoView({block:'start',behavior});
  // As a followed anchor would: the next Tab starts in the chapter, not back in the rail. The heading takes focus
  // without becoming a tab stop (tabindex -1) and without a ring: the rail marks the chapter (app/home-wide-rail.css).
  const heading=sheet.el.querySelector<HTMLElement>('h1, h2');
  if(heading){if(!heading.hasAttribute('tabindex'))heading.tabIndex=-1;heading.focus({preventScroll:true})}
 };
 // Real hrefs stay for new tabs and copied links; a plain click scrolls.
 const follow=(index:number)=>(event:MouseEvent<HTMLAnchorElement>)=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  goTo(index);
 };
 const label:Record<HomeChapter,string>={top:rc.chapters.top,how:c.nav.how,finds:rc.chapters.finds,tariffs:c.nav.tariffs,trust:rc.chapters.trust,faq:rc.chapters.faq,end:rc.chapters.end};
 const title:Record<HomeChapter,string>={top:c.hero.title,how:c.how.title,finds:catalogCopy[locale].teaserTitle,tariffs:c.tariffs.title,trust:c.trust.title,faq:c.faq.title,end:c.closing.title};
 const at=Math.min(cur,sheets.length-1);
 const cta=at>=0&&homeRailCtaChapters.includes(sheets[at].key);

 return <>
  <nav ref={navRef} className="hw-rail" data-home-rail="" aria-label={rc.label} data-cta={cta?'':undefined}>
   <div className="hw-rail-inner">
    <div className="hw-rail-steps">
     <span className="hw-rail-track" aria-hidden="true"/><span ref={fillRef} className="hw-rail-fill" aria-hidden="true"/>
     <span ref={gliderRef} className="hw-rail-glider" aria-hidden="true"/><span ref={headRef} className="hw-rail-head" aria-hidden="true"/>
     <ol className="hw-rail-list">{sheets.map((sheet,i)=><li key={sheet.key}>
      <a className="hw-rail-item" href={homeChapterHref[sheet.key]} data-chapter={sheet.key} data-state={i<at?'done':i===at?'current':'next'} aria-current={i===at?'location':undefined} onClick={follow(i)}>
       <span className="hw-rail-dot" aria-hidden="true"/>
       <span className="hw-rail-card"><span className="hw-rail-num" aria-hidden="true">{padChapter(i+1)}</span><span className="hw-rail-label">{label[sheet.key]}</span></span>
      </a>
     </li>)}</ol>
    </div>
    <button type="button" className="btn secondary hw-rail-cta" onClick={focusLinkInput}><ClipboardPaste size={17} aria-hidden="true"/><span>{c.sticky.paste}</span></button>
   </div>
  </nav>
  {sheets.slice(0,-1).map((sheet,i)=>{
   const next=sheets[i+1];
   return createPortal(<a className="hw-next" href={homeChapterHref[next.key]} data-next={next.key} onClick={follow(i+1)}><b>{padChapter(i+2)}</b><span>{title[next.key]}</span><ArrowDown size={18} aria-hidden="true"/></a>,sheet.el,sheet.key);
  })}
 </>;
}
