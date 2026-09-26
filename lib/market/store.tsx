'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {toast} from 'sonner';
import {blank,parseState,pricingSchema,tariff,type Pricing,type State} from './domain';
import {defaultPolicy,policySchema,type Policy} from './policy';
import type {Action} from './actions';
import {serverError,supportedLocale,type Locale} from './i18n';
import type {SessionStatus} from './access';
import {visibleMerchantFinds,type MerchantFind} from './catalog';
import type {CatalogCollection} from './catalog-editor';
export type AccountUser={name:string;email:string;operator:boolean;createdAt:number};
type Store={catalogProducts:MerchantFind[];collections:Array<CatalogCollection&{productIds:string[]}>;catalogError:string;state:State;pricing:Pricing;policy:Policy;ready:boolean;status:SessionStatus;error:string|null;user:AccountUser|null;setLocale:(locale:Locale)=>void;act:(action:Action)=>Promise<boolean>;refresh:()=>Promise<void>};
const Context=createContext<Store|null>(null);
const marketMessages:Record<Locale,{catalogLoad:string;accountLoad:string;connection:string;signin:string;busy:string;sessionEnded:string;saveFailed:string;actionConnection:string}>={
 ru:{catalogLoad:'Не удалось загрузить витрину. Обновите страницу.',accountLoad:'Не удалось загрузить кабинет. Повторите попытку.',connection:'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.',signin:'Войдите, чтобы сохранить изменения.',busy:'Дождитесь сохранения предыдущего действия.',sessionEnded:'Сессия завершилась. Войдите снова, чтобы продолжить.',saveFailed:'Не удалось сохранить изменения.',actionConnection:'Ответ сервера не получен. Проверяем состояние заказа.'},
 uz:{catalogLoad:'Katalog yuklanmadi. Sahifani yangilang.',accountLoad:'Kabinet yuklanmadi. Qayta urinib ko‘ring.',connection:'Server bilan bog‘lanib bo‘lmadi. Ulanishni tekshirib, qayta urinib ko‘ring.',signin:'O‘zgarishlarni saqlash uchun kiring.',busy:'Oldingi amal saqlanishini kuting.',sessionEnded:'Sessiya tugadi. Davom etish uchun qayta kiring.',saveFailed:'O‘zgarishlarni saqlab bo‘lmadi.',actionConnection:'Serverdan javob olinmadi. Buyurtma holatini tekshiramiz.'},
 en:{catalogLoad:'Could not load the catalog. Refresh the page.',accountLoad:'Could not load your account. Try again.',connection:'Could not reach the server. Check your connection and try again.',signin:'Sign in to save changes.',busy:'Wait for the previous change to finish saving.',sessionEnded:'Your session ended. Sign in again to continue.',saveFailed:'Could not save changes.',actionConnection:'No response from the server. Checking your order state.'},
};
export function MarketProvider({children}:{children:ReactNode}) {
 const [catalogProducts,setCatalogProducts]=useState<MerchantFind[]>(()=>visibleMerchantFinds()),[collections,setCollections]=useState<Array<CatalogCollection&{productIds:string[]}>>([]),[catalogError,setCatalogError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch('/api/catalog',{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('Catalog load failed');const data=await response.json() as {products:MerchantFind[];collections:Array<CatalogCollection&{productIds:string[]}>};setCatalogProducts(data.products);setCollections(data.collections)}).catch(error=>{if(error.name!=='AbortError')setCatalogError(marketMessages[localeRef.current].catalogLoad)});return()=>controller.abort()},[]);
 const [state,setState]=useState<State>(blank),[pricing,setPricing]=useState<Pricing>(tariff),[policy,setPolicy]=useState<Policy>(defaultPolicy),[status,setStatus]=useState<SessionStatus>('loading'),[error,setError]=useState<string|null>(null),[user,setUser]=useState<AccountUser|null>(null);
 const revision=useRef(0),busy=useRef(false),generation=useRef(0),localeRef=useRef<Locale>('ru'),serverLocaleRef=useRef<Locale>('ru'),localeSyncRef=useRef<Locale|null>(null);
 const readStoredLocale=useCallback(()=>{try{return supportedLocale(localStorage.getItem('atlas-language'))}catch{return null}},[]);
 const ready=status==='authenticated';
 const clearPrivate=useCallback(()=>{setUser(null);revision.current=0;setState({...blank(),communication:{...blank().communication,language:localeRef.current}});setPolicy(defaultPolicy)},[]);
 const refresh=useCallback(async()=>{
  const current=++generation.current;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
   const res=await fetch('/api/account',{cache:'no-store',signal:controller.signal});
   const data=await res.json() as {state?:unknown;pricing?:unknown;policy?:unknown;revision:number;user:AccountUser;error?:string; errorCode?:string};
   if(current!==generation.current)return;
   if(!res.ok){
    clearPrivate();
    if(res.status===401){setStatus('guest');setError(null);return}
     setStatus('error');setError((data.errorCode ? serverError(localeRef.current, data.errorCode) : undefined) ?? marketMessages[localeRef.current].accountLoad);return;
   }
   const parsed=parseState(JSON.stringify(data.state));
   serverLocaleRef.current=parsed.communication.language;
   const stored=readStoredLocale();
   const next=stored?{...parsed,communication:{...parsed.communication,language:stored}}:parsed;
   // Keep asynchronous request fallbacks in the locale the customer just selected.
   // eslint-disable-next-line react-hooks/immutability
   localeRef.current=next.communication.language;
   setState(next);
   const parsedPricing=pricingSchema.safeParse(data.pricing);setPricing(parsedPricing.success?parsedPricing.data:tariff);
   const parsedPolicy=policySchema.safeParse(data.policy);setPolicy(parsedPolicy.success?parsedPolicy.data:defaultPolicy);
   revision.current=data.revision;setUser(data.user);setStatus('authenticated');setError(null);
  }catch{if(current===generation.current){clearPrivate();setStatus('error');setError(marketMessages[localeRef.current].connection)}}
  finally{clearTimeout(timeout)}
 },[clearPrivate,readStoredLocale]);
 useEffect(()=>{
  const locale=readStoredLocale();
  if(locale){
   // This ref is intentionally updated outside render for callbacks that outlive this effect.
   // eslint-disable-next-line react-hooks/immutability
   localeRef.current=locale;
   queueMicrotask(()=>setState(s=>({...s,communication:{...s.communication,language:locale}})))
  }
  queueMicrotask(()=>void refresh());
  const focus=()=>{if(!busy.current)void refresh()};window.addEventListener('focus',focus);
  return()=>{window.removeEventListener('focus',focus)};
 },[readStoredLocale,refresh]);
 useEffect(()=>{document.documentElement.lang=state.communication.language},[state.communication.language]);
 const act=useCallback(async(action:Action)=>{
  if(!ready){toast.error(marketMessages[localeRef.current].signin);return false}
  if(busy.current){toast.message(marketMessages[localeRef.current].busy);return false}
  busy.current=true;
  // A pending read must not overwrite the result of this newer mutation.
  const current=++generation.current;
  try{
   const res=await fetch('/api/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:revision.current})});
   const data=await res.json() as {state?:unknown;revision:number;error?:string; errorCode?:string};
   if(current!==generation.current)return false;
   if(res.status===401){clearPrivate();setStatus('guest');setError(null);toast.message(marketMessages[localeRef.current].sessionEnded);return false}
   if(data.state){const next=parseState(JSON.stringify(data.state));serverLocaleRef.current=next.communication.language;setState(next);revision.current=data.revision}
   if(!res.ok){toast.error((data.errorCode ? serverError(localeRef.current, data.errorCode) : undefined) ?? marketMessages[localeRef.current].saveFailed);if(res.status===409&&!data.state)await refresh();return false}
   return true;
  }catch{toast.error(marketMessages[localeRef.current].actionConnection);await refresh();return false}
  finally{busy.current=false}
 },[ready,refresh,clearPrivate]);
 useEffect(()=>{
  if(status!=='authenticated')return;
  const preferred=readStoredLocale();
  if(!preferred||preferred===serverLocaleRef.current||localeSyncRef.current===preferred)return;
  localeSyncRef.current=preferred;
  void act({type:'communication-save',value:{...state.communication,language:preferred}}).then(ok=>{if(ok)localeSyncRef.current=null});
 },[status,state.communication,act,readStoredLocale]);
 const setLocale=useCallback((locale:Locale)=>{
  const next=supportedLocale(locale);if(!next)return;
  // Toasts and failed requests can resolve after a locale switch, so they read this latest value.
  // eslint-disable-next-line react-hooks/immutability
  localeRef.current=next;
  setState(s=>({...s,communication:{...s.communication,language:next}}));
  try{localStorage.setItem('atlas-language',next)}catch{}
 },[]);
 return <Context.Provider value={{catalogProducts,collections,catalogError,state,pricing,policy,ready,status,error,user,setLocale,act,refresh}}>{children}</Context.Provider>;
}
export function useMarket(){const c=useContext(Context);if(!c)throw Error('MarketProvider missing');return c}
