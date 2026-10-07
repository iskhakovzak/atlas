'use client';
import {useCallback} from 'react';

/**
 * A sticky column taller than the window sticks by its bottom instead of its top, so its last button (the cart's
 * "Place order") stays in reach while the page scrolls. The CSS reads `--sticky-top` with its own top as the fallback.
 * Returns a ref callback: the column may appear only once the cart has loaded.
 */
export function useStickyFit(top=88,gap=16){
 return useCallback((element:HTMLElement|null)=>{
  if(!element)return;
  const fit=()=>element.style.setProperty('--sticky-top',`${Math.min(top,window.innerHeight-element.offsetHeight-gap)}px`);
  fit();
  const observer=new ResizeObserver(fit);
  observer.observe(element);
  window.addEventListener('resize',fit);
  return()=>{observer.disconnect();window.removeEventListener('resize',fit)};
 },[top,gap]);
}
