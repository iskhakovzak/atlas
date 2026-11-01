'use client';
import {useEffect} from 'react';

/**
 * The on-screen keyboard's height as `--keyboard-inset` on <html>: iOS Safari (and in-app browsers) keep the layout
 * viewport under the keyboard, so a bottom sheet or sticky bar at `bottom: 0` would sit behind it. Android with
 * `interactive-widget=resizes-content` (app/layout.tsx) already shrinks the layout and measures 0 here.
 */
export function useKeyboardInset(){
 useEffect(()=>{
  const viewport=window.visualViewport;
  if(!viewport)return;
  const root=document.documentElement;
  let frame=0;
  const update=()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{
    const inset=Math.max(0,Math.round(window.innerHeight-viewport.height-viewport.offsetTop));
    // Less than 80px is browser chrome moving, not a keyboard.
    root.style.setProperty('--keyboard-inset',(inset>=80?inset:0)+'px');
   });
  };
  update();
  viewport.addEventListener('resize',update);
  viewport.addEventListener('scroll',update);
  return()=>{cancelAnimationFrame(frame);viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);root.style.removeProperty('--keyboard-inset')};
 },[]);
}
