'use client';
import {useCallback,useEffect,useState} from 'react';
import {BellRing,Loader2} from 'lucide-react';
import type {Locale} from '@/lib/market/i18n';
import {withCyrillic} from '@/lib/market/uz-cyrl';
import {toast} from '@/lib/market/toast';

const copy=/*@__PURE__*/withCyrillic({
  ru:{bell:'Присылать уведомления в браузер',row:'Уведомления в этом браузере',on:'включены',off:'выключены',turnOn:'Включить',turnOff:'Выключить',denied:'Браузер запретил уведомления для Atlas: разрешите их в настройках сайта.',done:'Уведомления в этом браузере включены',failed:'Не удалось включить уведомления. Попробуйте ещё раз.'},
  uz:{bell:'Bildirishnomalarni brauzerga yuborish',row:'Shu brauzerdagi bildirishnomalar',on:'yoqilgan',off:'o‘chirilgan',turnOn:'Yoqish',turnOff:'O‘chirish',denied:'Brauzer Atlas uchun bildirishnomalarni taqiqlagan: ularni sayt sozlamalarida ruxsat bering.',done:'Shu brauzerda bildirishnomalar yoqildi',failed:'Bildirishnomalarni yoqib bo‘lmadi. Qayta urinib ko‘ring.'},
  en:{bell:'Send notifications to this browser',row:'Notifications in this browser',on:'on',off:'off',turnOn:'Turn on',turnOff:'Turn off',denied:'The browser blocked notifications for Atlas: allow them in the site settings.',done:'Notifications are on in this browser',failed:'Could not turn notifications on. Please try again.'},
});

type Push={kind:'hidden'}|{kind:'ready';publicKey:string;on:boolean;denied:boolean};
const workerUrl='/push-sw.js';

/** Web Push where it works: a browser with a service worker and PushManager, not the app shell (its WebView has none). */
function supported(){
  return typeof window!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window&&!(window as {Capacitor?:unknown}).Capacitor;
}
function keyBytes(base64Url:string){
  const normal=base64Url.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(normal+'='.repeat((4-normal.length%4)%4)),char=>char.charCodeAt(0));
}

/** This browser's push state: hidden while the site has no VAPID key, the browser cannot push or the visitor is a guest. */
function usePush(){
  const [push,setPush]=useState<Push>({kind:'hidden'});
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!supported())return;
    let live=true;
    void (async()=>{
      try{
        const response=await fetch('/api/push',{credentials:'same-origin'});
        const data=await response.json().catch(()=>({})) as {publicKey?:string|null};
        if(!response.ok||!data.publicKey)return;
        const registration=await navigator.serviceWorker.getRegistration(workerUrl);
        const subscription=await registration?.pushManager.getSubscription();
        if(live)setPush({kind:'ready',publicKey:data.publicKey,on:Boolean(subscription),denied:Notification.permission==='denied'});
      }catch{/* no button: the bell and Telegram still work */}
    })();
    return()=>{live=false};
  },[]);
  const turnOn=useCallback(async(locale:Locale)=>{
    if(push.kind!=='ready'||busy)return;
    setBusy(true);
    try{
      const permission=await Notification.requestPermission();
      if(permission!=='granted'){setPush({...push,denied:permission==='denied'});if(permission==='denied')toast.error(copy[locale].denied);return}
      const registration=await navigator.serviceWorker.register(workerUrl,{scope:'/'});
      await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(push.publicKey)});
      const response=await fetch('/api/push',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(subscription.toJSON())});
      if(!response.ok){await subscription.unsubscribe().catch(()=>undefined);throw Error('save')}
      setPush({...push,on:true,denied:false});
      toast.success(copy[locale].done);
    }catch{toast.error(copy[locale].failed)}
    finally{setBusy(false)}
  },[push,busy]);
  const turnOff=useCallback(async()=>{
    if(push.kind!=='ready'||busy)return;
    setBusy(true);
    try{
      const registration=await navigator.serviceWorker.getRegistration(workerUrl);
      const subscription=await registration?.pushManager.getSubscription();
      if(subscription){
        await fetch('/api/push',{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:subscription.endpoint})}).catch(()=>undefined);
        await subscription.unsubscribe();
      }
      setPush({...push,on:false});
    }finally{setBusy(false)}
  },[push,busy]);
  return {push,busy,turnOn,turnOff};
}

/** A quiet line in the bell's footer while this browser does not get Atlas notifications. */
export function PushBellLink({locale}:{locale:Locale}){
  const {push,busy,turnOn}=usePush();
  if(push.kind!=='ready'||push.on||push.denied)return null;
  return <button type="button" className="notice-panel-tg notice-panel-push" disabled={busy} aria-busy={busy} onClick={()=>void turnOn(locale)}>{busy?<Loader2 className="spin" size={15} aria-hidden="true"/>:<BellRing size={15} aria-hidden="true"/>}{copy[locale].bell}</button>;
}

/** The settings row on /notifications: on or off in this browser, with the switch. */
export function PushSettingsRow({locale}:{locale:Locale}){
  const {push,busy,turnOn,turnOff}=usePush();
  if(push.kind!=='ready')return null;
  const c=copy[locale];
  return <div className="notice-tg-row">
    <span className="notice-tg-row-label"><BellRing size={17} aria-hidden="true"/>{c.row}: {push.on?c.on:c.off}</span>
    {push.denied&&!push.on?<small className="micro">{c.denied}</small>
      :<button type="button" className="notice-tg-row-link" disabled={busy} aria-busy={busy} onClick={()=>void (push.on?turnOff():turnOn(locale))}>{push.on?c.turnOff:c.turnOn}</button>}
  </div>;
}
