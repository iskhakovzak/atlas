'use client';
// Mounted once in the root layout. Inside the Atlas apps (mobile/, Capacitor) it marks the document with
// data-native, keeps the status bar in the site theme, routes external links to the system browser,
// finishes sign-in handoffs from the system browser and handles the Android back button.
// In a browser it renders nothing and does nothing.
import {useEffect,useRef} from 'react';
import {useTheme} from 'next-themes';
import {toast} from 'sonner';
import {useMarket} from '@/lib/market/store';
import {closeExternal,hideSplash,nativePlatform,onAppUrlOpen,onBackButton,openExternal,setStatusBarTheme} from '@/lib/native/bridge';
import {isExternalHref,parseAppLink} from '@/lib/native/links';
import {takeVerifier} from '@/lib/native/pkce';

const messages={
 ru:{handoffFailed:'Не удалось завершить вход. Попробуйте войти ещё раз.',handoffConnection:'Нет связи с сервером. Проверьте интернет и войдите ещё раз.'},
 uz:{handoffFailed:'Kirishni yakunlab bo‘lmadi. Qayta kirib ko‘ring.',handoffConnection:'Server bilan aloqa yo‘q. Internetni tekshirib, qayta kiring.'},
 en:{handoffFailed:'Could not finish signing in. Please sign in again.',handoffConnection:'No connection to the server. Check your internet and sign in again.'},
};

export function NativeShell(){
 const {state,refresh}=useMarket();
 const {resolvedTheme}=useTheme();
 const locale=state.communication.language;
 // Handlers read these refs so the native listeners are registered once and never go stale.
 const localeRef=useRef(locale),refreshRef=useRef(refresh);
 useEffect(()=>{localeRef.current=locale;refreshRef.current=refresh},[locale,refresh]);
 const platform=nativePlatform();

 useEffect(()=>{
  if(!platform)return;
  document.documentElement.dataset.native=platform;
  void hideSplash();
  return()=>{delete document.documentElement.dataset.native};
 },[platform]);

 useEffect(()=>{
  if(!platform)return;
  void setStatusBarTheme(resolvedTheme==='dark'?'dark':'light');
 },[platform,resolvedTheme]);

 useEffect(()=>{
  if(!platform)return;
  // Store pages, Telegram, lex.uz and every target="_blank" link open in the system browser, not inside the shell.
  const onClick=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const anchor=(event.target as Element|null)?.closest?.('a[href]');
   if(!(anchor instanceof HTMLAnchorElement)||anchor.hasAttribute('download'))return;
   const href=anchor.href;
   if(!/^https?:/i.test(href))return;
   if(anchor.target==='_blank'||isExternalHref(href,window.location.host)){event.preventDefault();void openExternal(href)}
  };
  document.addEventListener('click',onClick,true);
  return()=>document.removeEventListener('click',onClick,true);
 },[platform]);

 useEffect(()=>{
  if(!platform)return;
  let handling=false;
  const finishHandoff=async(code:string,returnTo:string|null)=>{
   if(handling)return;
   handling=true;
   const words=messages[localeRef.current]??messages.ru;
   try{
    // The PKCE verifier kept when this instance opened the flow; without it the code cannot be claimed
    // (a link opened in an instance that never started a flow, or a replay of someone else's code).
    const verifier=takeVerifier();
    if(!verifier){toast.error(words.handoffFailed);window.location.assign('/login');return}
    const res=await fetch('/api/auth/handoff',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({code,verifier})});
    const data=await res.json().catch(()=>({})) as {ok?:boolean;returnTo?:string};
    if(!res.ok||!data.ok){toast.error(words.handoffFailed);window.location.assign('/login');return}
    await closeExternal();
    await refreshRef.current();
    const target=typeof data.returnTo==='string'&&data.returnTo.startsWith('/')?data.returnTo:returnTo;
    window.location.assign(target||'/account');
   }catch{toast.error(words.handoffConnection);window.location.assign('/login')}
   finally{handling=false}
  };
  return onAppUrlOpen(url=>{
   const link=parseAppLink(url);
   if(!link)return;
   if(link.kind==='auth'){void finishHandoff(link.code,link.returnTo);return}
   const current=window.location.pathname+window.location.search+window.location.hash;
   if(link.path!==current)window.location.assign(link.path);
  });
 },[platform]);

 useEffect(()=>{
  if(platform!=='android')return;
  // Android convention: back walks the history and leaves the app from the home page.
  return onBackButton(()=>{
   if(window.location.pathname==='/')return false;
   if(window.history.length>1){window.history.back();return true}
   window.location.assign('/');return true;
  });
 },[platform]);

 return null;
}
