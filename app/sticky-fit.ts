'use client';
import {useCallback} from 'react';

/**
 * A sticky column taller than the window sticks by its bottom instead of its top, so its last button (the cart's
 * "Place order") stays in reach while the page scrolls. The CSS reads `--sticky-top` with its own top as the fallback.
 * Returns a ref callback: the column may appear only once the cart has loaded.
 * The height comes from the ResizeObserver entry (measured after layout, and it also reports once on observe), never
 * from `offsetHeight` at mount: reading it there forced a layout of the whole page in the middle of React's commit
 * (~400 ms on a slow phone, 26.10.2026). The property is written only when the value changes.
 */
export function useStickyFit(top=88,gap=16){
 return useCallback((element:HTMLElement|null)=>{
  if(!element)return;
  let height=-1,written='';
  const fit=()=>{
   if(height<0)return;
   const next=`${Math.min(top,window.innerHeight-height-gap)}px`;
   if(next!==written){written=next;element.style.setProperty('--sticky-top',next)}
  };
  const observer=new ResizeObserver((entries)=>{
   const entry=entries[entries.length-1];
   height=entry.borderBoxSize?.[0]?.blockSize??entry.contentRect.height;
   fit();
  });
  observer.observe(element);
  window.addEventListener('resize',fit);
  return()=>{observer.disconnect();window.removeEventListener('resize',fit)};
 },[top,gap]);
}
