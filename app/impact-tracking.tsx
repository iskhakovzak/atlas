'use client';

import {useEffect,useState} from 'react';
import {nativePlatform} from '@/lib/native/bridge';
import {startImpactTracking,type ImpactWindow} from '@/lib/market/impact-tracking';
import {useMarket} from '@/lib/market/store';
import {consentVersion,missingConsents} from '@/lib/market/account-delete';

export function ImpactTracking() {
  const {ready,status,state}=useMarket();
  const [guestAccepted,setGuestAccepted]=useState(false);
  useEffect(()=>{
    const update=()=>{try{setGuestAccepted(localStorage.getItem('atlas-consent-v1')===consentVersion);}catch{setGuestAccepted(false);}};
    const timer=window.setTimeout(update,0);
    window.addEventListener('atlas:consent-accepted',update);
    window.addEventListener('storage',update);
    return()=>{window.clearTimeout(timer);window.removeEventListener('atlas:consent-accepted',update);window.removeEventListener('storage',update);};
  },[]);
  const accepted=ready?missingConsents(state).length===0:status==='guest'&&guestAccepted;
  useEffect(() => {
    if (accepted&&!nativePlatform()) startImpactTracking(window as ImpactWindow, document);
  }, [accepted]);
  return null;
}
