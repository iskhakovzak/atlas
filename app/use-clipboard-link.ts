'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {peekClipboard} from '@/lib/native/bridge';
import {storeLinkIn} from '@/lib/market/clipboard-link';

const warmKey='atlas-clipboard-warmed';
const warmed=()=>{try{return JSON.parse(sessionStorage.getItem(warmKey)??'[]') as string[]}catch{return []}};
const remember=(link:string)=>{try{sessionStorage.setItem(warmKey,JSON.stringify([link,...warmed().filter(item=>item!==link)].slice(0,20)))}catch{/* private mode */}};

/**
 * Whether the clipboard already holds a store link, learned without any prompt where the platform allows it
 * (lib/native/bridge.ts peekClipboard: Android app; iOS app "looks like a link"; Chrome/Edge with the permission given).
 * The "Вставить" button lights up then (components/paste-button.tsx `ready`), and the product is asked for in the
 * background once per link, so the tap opens an answer the server already keeps. Nothing starts by itself: a copied
 * link may not be meant for Atlas. Checked on arrival and whenever the page comes back to the front.
 */
export function useClipboardLink(current?:string,enabled=true){
 const [ready,setReady]=useState(false);
 const currentRef=useRef(current);
 useEffect(()=>{currentRef.current=current},[current]);
 const check=useCallback(async()=>{
  if(document.visibilityState==='hidden')return;
  const peek=await peekClipboard();
  if(!peek){setReady(false);return}
  if('tap' in peek){setReady(true);return}
  const link=storeLinkIn(peek.text);
  setReady(Boolean(link)&&link!==currentRef.current);
  if(link&&link!==currentRef.current&&!warmed().includes(link)){
   remember(link);
   void fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({url:link})}).then(response=>response.body?.cancel()).catch(()=>undefined);
  }
 },[]);
 useEffect(()=>{
  if(!enabled)return;
  const timer=window.setTimeout(()=>void check(),300);
  const again=()=>void check();
  window.addEventListener('focus',again);document.addEventListener('visibilitychange',again);
  return()=>{window.clearTimeout(timer);window.removeEventListener('focus',again);document.removeEventListener('visibilitychange',again)};
 },[check,enabled]);
 // After the link was used the button goes back to its quiet look.
 const used=useCallback(()=>setReady(false),[]);
 return {ready,used};
}
