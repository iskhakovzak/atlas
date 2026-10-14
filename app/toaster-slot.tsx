'use client';
import {Suspense,lazy,useEffect,useState} from 'react';
import {loadSonner,toasterHost} from '@/lib/market/toast';
const Toaster=lazy(()=>loadSonner().then(module=>({default:module.Toaster})));
/** Signals after sonner's Toaster (an earlier sibling) has subscribed: sibling effects run in order. */
function Mounted(){useEffect(()=>toasterHost.mounted(),[]);return null}
/** The shell's Toaster, mounted in the browser once the page is idle, or at once when a toast is raised first. */
export function ToasterSlot({theme,label}:{theme:'dark'|'light'|'system';label:string}){
  const [on,setOn]=useState(false);
  useEffect(()=>{
    toasterHost.onRequest(()=>setOn(true));
    const show=()=>setOn(true);
    if('requestIdleCallback' in window){const id=window.requestIdleCallback(show,{timeout:4000});return()=>window.cancelIdleCallback(id)}
    const id=setTimeout(show,2500);return()=>clearTimeout(id);
  },[]);
  // Wide screens: under the 80px header, so a toast after a cart action does not cover the cart and the account. Phones
  // keep sonner's own top offset (the bottom holds the sticky totals, the paste dock and the consent banner).
  // The toast region's screen-reader name in the page language (sonner's default is the English "Notifications").
  return on?<Suspense fallback={null}><Toaster position="top-right" richColors theme={theme} offset={{top:88,right:24}} containerAriaLabel={label}/><Mounted/></Suspense>:null;
}
