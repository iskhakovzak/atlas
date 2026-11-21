'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {peekClipboard} from '@/lib/native/bridge';
import {storeLinkIn} from '@/lib/market/clipboard-link';

const warmUntil=new Map<string,number>();
const warming=new Set<string>();

function warmLink(link:string){
 if(warming.has(link)||warming.size>=2||(warmUntil.get(link)??0)>Date.now())return;
 warming.add(link);
 void (async()=>{
  let complete=false;
  const controller=new AbortController();
  const timer=window.setTimeout(()=>controller.abort(),30_000);
  try{
   const response=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({url:link,warm:true}),signal:controller.signal});
   complete=response.status===200;
   await response.body?.cancel();
  }catch{/* The next foreground check may retry after a short cooldown. */}
  finally{
   window.clearTimeout(timer);
   warming.delete(link);
   warmUntil.delete(link);
   warmUntil.set(link,Date.now()+(complete?120_000:15_000));
   const oldest=warmUntil.keys().next().value;
   if(warmUntil.size>20&&oldest!==undefined)warmUntil.delete(oldest);
  }
 })();
}

/**
 * Whether the clipboard already holds a store link, learned without any prompt where the platform allows it
 * (lib/native/bridge.ts peekClipboard: Android app; iOS app "looks like a link"; Chrome/Edge with the permission given).
 * The "Вставить" button lights up then (components/paste-button.tsx `ready`), and the product is asked for in the
 * background without opening the order form. Checked on arrival and whenever the page comes back to the front.
 */
export function useClipboardLink(current?:string,enabled=true){
 const [ready,setReady]=useState(false);
 const currentRef=useRef(current);
 const checkSeq=useRef(0);
 useEffect(()=>{currentRef.current=current},[current]);
 const check=useCallback(async()=>{
  const seq=++checkSeq.current;
  if(document.hidden)return;
  const peek=await peekClipboard();
  if(seq!==checkSeq.current||document.hidden)return;
  if(!peek){setReady(false);return}
  if('tap' in peek){setReady(true);return}
  const link=storeLinkIn(peek.text);
  setReady(Boolean(link)&&link!==currentRef.current);
  if(link&&link!==currentRef.current)warmLink(link);
 },[]);
 useEffect(()=>{
  if(!enabled)return;
  const timer=window.setTimeout(()=>void check(),300);
  const again=()=>void check();
  window.addEventListener('focus',again);document.addEventListener('visibilitychange',again);
  return()=>{checkSeq.current+=1;window.clearTimeout(timer);window.removeEventListener('focus',again);document.removeEventListener('visibilitychange',again)};
 },[check,enabled]);
 // After the link was used the button goes back to its quiet look.
 const used=useCallback(()=>{checkSeq.current+=1;setReady(false)},[]);
 return {ready:enabled&&ready,used};
}
