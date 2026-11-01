'use client';

import {useEffect,useState} from 'react';
import {useMarket} from '@/lib/market/store';
import {consentChangeEvent,cookieConsentKey,effectiveCookieChoice,readCookieChoice,type CookieChoice} from '@/lib/market/cookie-consent';

const deviceStorage=()=>{try{return typeof window!=='undefined'?window.localStorage:null}catch{return null}};

/**
 * The optional-cookie choice in force on this page: the newer of the device's and the signed-in account's
 * (lib/market/cookie-consent.ts). `known` stays false until the device was read after hydration and the session
 * is settled, so nothing optional starts on a guess.
 */
export function useCookieChoice():{choice:CookieChoice|null;known:boolean}{
  const {state,status}=useMarket();
  const [local,setLocal]=useState<{value:CookieChoice|null}|null>(null);
  useEffect(()=>{
    const update=()=>setLocal({value:readCookieChoice(deviceStorage())});
    const timer=window.setTimeout(update,0);
    const onStorage=(event:StorageEvent)=>{if(event.key===null||event.key===cookieConsentKey)update()};
    window.addEventListener(consentChangeEvent,update);
    window.addEventListener('storage',onStorage);
    return()=>{window.clearTimeout(timer);window.removeEventListener(consentChangeEvent,update);window.removeEventListener('storage',onStorage)};
  },[]);
  const known=local!==null&&status!=='loading';
  return {choice:known?effectiveCookieChoice(local.value,status==='authenticated'?state.cookieConsent:undefined):null,known};
}
