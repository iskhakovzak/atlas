'use client';

import {useEffect,useRef} from 'react';
import {nativePlatform} from '@/lib/native/bridge';
import {startImpactTracking,type ImpactWindow} from '@/lib/market/impact-tracking';
import {cookieAllowed,partnerCookieNames,type CookieChoice} from '@/lib/market/cookie-consent';

/** Removes Impact's first-party cookies on this host and its parent domain. */
function clearPartnerCookies(){
  const host=window.location.hostname,parent=host.split('.').slice(-2).join('.');
  for(const name of partnerCookieNames(document.cookie)){
    for(const domain of ['',`; Domain=${host}`,`; Domain=.${parent}`])document.cookie=`${name}=; Max-Age=0; Path=/${domain}`;
  }
}

/**
 * The owner's Impact partner tag, only with the "partner links" consent (lib/market/cookie-consent.ts) and never in the
 * app shell. Withdrawn on a page where it already ran: its cookies are deleted and the page reloads once, because a
 * loaded script and the links it rewrote cannot be taken back otherwise.
 */
export function ImpactTracking({choice,known}:{choice:CookieChoice|null;known:boolean}) {
  const allowed=known&&cookieAllowed(choice,'partners');
  const started=useRef(false);
  useEffect(()=>{
    if(!known)return;
    if(allowed){
      if(!nativePlatform()){startImpactTracking(window as ImpactWindow,document);started.current=true;}
      return;
    }
    if(partnerCookieNames(document.cookie).length)clearPartnerCookies();
    if(started.current||document.getElementById('atlas-impact-partner-tag')){started.current=false;window.location.reload();}
  },[allowed,known]);
  return null;
}
