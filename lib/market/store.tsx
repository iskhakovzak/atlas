'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {toast} from 'sonner';
import {blank,parseState,pricingSchema,tariff,type Pricing,type State} from './domain';
import {defaultPolicy,policySchema,type Policy} from './policy';
import type {Action} from './actions';
import {serverError,setLocaleCookie,supportedLocale,type Locale} from './i18n';
import type {SessionStatus} from './access';
import {keepCatalogVisible,visibleMerchantFinds,type MerchantFind} from './catalog';
import type {CatalogCollection} from './catalog-editor';
import {nextPricing} from './pricing-equal';
import {mergeSiteContent,type SiteContentView} from './site-content-schema';
/** "operator" = full admin access. "role" and "permissions" come from the staff directory for other staff (lib/market/access.ts). */
export type AccountUser={name:string;email:string;contact?:string;method?:'email'|'phone'|'telegram'|'google'|'apple';operator:boolean;role?:string;permissions?:string[];createdAt:number};
type Store={catalogProducts:MerchantFind[];/** The public catalog request finished (with or without data). */catalogReady:boolean;collections:Array<CatalogCollection&{productIds:string[]}>;catalogError:string;loadCatalog:(force?:boolean)=>Promise<void>;state:State;pricing:Pricing;policy:Policy;/** Contacts, legal entity, payment methods, reviews, parcel photos: the admin document merged with the code defaults (server-rendered, no flicker). */siteContent:SiteContentView;/** The admin form replaces the document after a successful save so the footer updates without a reload. */setSiteContent:(next:SiteContentView)=>void;ready:boolean;status:SessionStatus;error:string|null;user:AccountUser|null;setLocale:(locale:Locale)=>void;act:(action:Action)=>Promise<boolean>;/** Why the last refused action was refused (server error code and text), until the next success. */lastActionError:()=>{code?:string;message?:string}|null;refresh:()=>Promise<void>};
const Context=createContext<Store|null>(null);
const marketMessages:Record<Locale,{catalogLoad:string;accountLoad:string;connection:string;signin:string;sessionEnded:string;saveFailed:string;actionConnection:string}>={
  ru:{catalogLoad:'Не удалось обновить витрину. Сохранённые ссылки остаются доступны; актуальную цену нужно подтвердить перед заказом.',accountLoad:'Не удалось загрузить кабинет. Повторите попытку.',connection:'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.',signin:'Войдите, чтобы сохранить изменения.',sessionEnded:'Сессия завершилась. Войдите снова, чтобы продолжить.',saveFailed:'Не удалось сохранить изменения.',actionConnection:'Ответ сервера не получен. Проверяем состояние заказа.'},
  uz:{catalogLoad:'Vitrinani yangilab bo‘lmadi. Saqlangan havolalar mavjud; buyurtmadan oldin joriy narxni tasdiqlang.',accountLoad:'Kabinet yuklanmadi. Qayta urinib ko‘ring.',connection:'Server bilan bog‘lanib bo‘lmadi. Ulanishni tekshirib, qayta urinib ko‘ring.',signin:'O‘zgarishlarni saqlash uchun kiring.',sessionEnded:'Sessiya tugadi. Davom etish uchun qayta kiring.',saveFailed:'O‘zgarishlarni saqlab bo‘lmadi.',actionConnection:'Serverdan javob olinmadi. Buyurtma holatini tekshiramiz.'},
  en:{catalogLoad:'The storefront could not refresh. Saved links remain available; confirm the current price before ordering.',accountLoad:'Could not load your account. Try again.',connection:'Could not reach the server. Check your connection and try again.',signin:'Sign in to save changes.',sessionEnded:'Your session ended. Sign in again to continue.',saveFailed:'Could not save changes.',actionConnection:'No response from the server. Checking your order state.'},
};
// initialLocale comes from the server (saved cookie, Accept-Language, then the Uzbek default),
// so the first render already matches the server HTML.
// initialPricing is the tariff the server rendered with (lib/market/initial-data.ts); the client keeps it
// until the API returns a different one, so the example bill and tariffs do not change numbers on hydration.
export function MarketProvider({children,initialLocale='uz',initialPricing=null,initialSiteContent=null}:{children:ReactNode;initialLocale?:Locale;initialPricing?:Pricing|null;initialSiteContent?:SiteContentView|null}) {
 const [catalogProducts,setCatalogProducts]=useState<MerchantFind[]>(()=>visibleMerchantFinds()),[collections,setCollections]=useState<Array<CatalogCollection&{productIds:string[]}>>([]),[catalogError,setCatalogError]=useState(''),[catalogReady,setCatalogReady]=useState(false);
 const [state,setState]=useState<State>(()=>{const initial=blank();return {...initial,communication:{...initial.communication,language:initialLocale}}}),[pricing,setPricing]=useState<Pricing>(()=>initialPricing??tariff),[policy,setPolicy]=useState<Policy>(defaultPolicy),[siteContent,setSiteContent]=useState<SiteContentView>(()=>initialSiteContent??mergeSiteContent(null)),[status,setStatus]=useState<SessionStatus>('loading'),[error,setError]=useState<string|null>(null),[user,setUser]=useState<AccountUser|null>(null);
 const revision=useRef(0),busy=useRef(false),generation=useRef(0),localeRef=useRef<Locale>(initialLocale),serverLocaleRef=useRef<Locale>('ru'),localeSyncRef=useRef<Locale|null>(null);
 const catalogLoaded=useRef(false),catalogRequest=useRef<Promise<void>|null>(null);
 const lastError=useRef<{code?:string;message?:string}|null>(null);
 // Signed in as of the last successful read. A network or server hiccup must not sign the customer out.
 const signedIn=useRef(false),retryTimer=useRef<ReturnType<typeof setTimeout>|null>(null),lastRefresh=useRef(0);
 const lastActionError=useCallback(()=>lastError.current,[]);
 const loadCatalog=useCallback((force=false)=>{
  if(force)catalogLoaded.current=false;
  if(catalogLoaded.current)return Promise.resolve();
  if(catalogRequest.current)return catalogRequest.current;
  const request=(async()=>{
   try{
    const response=await fetch('/api/catalog',{cache:'no-store'});
    if(!response.ok)throw Error('Catalog load failed');
    const data=await response.json() as {products:MerchantFind[];collections:Array<CatalogCollection&{productIds:string[]}>;pricing?:unknown};
    if(!Array.isArray(data.products)||!Array.isArray(data.collections))throw Error('Catalog response is invalid');
    catalogLoaded.current=true;
    setCatalogProducts(keepCatalogVisible(data.products));
    setCatalogError(data.products.length?'':marketMessages[localeRef.current].catalogLoad);
    setCollections(data.collections);
    const publicPricing=pricingSchema.safeParse(data.pricing);
    if(publicPricing.success)setPricing(previous=>nextPricing(previous,publicPricing.data));
   }catch{setCatalogError(marketMessages[localeRef.current].catalogLoad)}
   finally{catalogRequest.current=null;setCatalogReady(true)}
  })();
  catalogRequest.current=request;
  return request;
 },[]);
 const readStoredLocale=useCallback(()=>{try{return supportedLocale(localStorage.getItem('atlas-language'))}catch{return null}},[]);
 const ready=status==='authenticated';
 const clearPrivate=useCallback(()=>{setUser(null);revision.current=0;setState({...blank(),communication:{...blank().communication,language:localeRef.current}});setPolicy(defaultPolicy)},[]);
 const refresh=useCallback(async function load(retry?:unknown):Promise<void>{
  // Only the internal retries pass a number; a click or event handler calling refresh starts over.
  const attempt=typeof retry==='number'?retry:0;
  const current=++generation.current;
  lastRefresh.current=Date.now();
  if(retryTimer.current){clearTimeout(retryTimer.current);retryTimer.current=null}
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  // While signed in, a failed read keeps what is on screen and quietly tries again.
  const keepAndRetry=()=>{if(attempt<5)retryTimer.current=setTimeout(()=>void load(attempt+1),Math.min(30000,2000*2**attempt))};
  try{
   const res=await fetch('/api/account',{cache:'no-store',credentials:'same-origin',signal:controller.signal});
   const data=await res.json().catch(()=>({})) as {state?:unknown;pricing?:unknown;policy?:unknown;revision:number;user:AccountUser;error?:string; errorCode?:string};
   if(current!==generation.current)return;
   if(!res.ok){
    if(res.status===401){
     // A session that worked a moment ago is asked once more before the customer is shown as signed out.
     if(signedIn.current&&attempt===0){retryTimer.current=setTimeout(()=>void load(1),1500);return}
     signedIn.current=false;clearPrivate();setStatus('guest');setError(null);return;
    }
    if(signedIn.current){keepAndRetry();return}
    clearPrivate();
    setStatus('error');setError((data.errorCode ? serverError(localeRef.current, data.errorCode) : undefined) ?? marketMessages[localeRef.current].accountLoad);return;
   }
   const parsed=parseState(JSON.stringify(data.state));
   serverLocaleRef.current=parsed.communication.language;
   // Keep the language this device already shows; signing in must not switch it.
   const display=readStoredLocale()??localeRef.current;
   const next={...parsed,communication:{...parsed.communication,language:display}};
   // Keep asynchronous request fallbacks in the locale the customer just selected.
   localeRef.current=next.communication.language;
   setLocaleCookie(next.communication.language);
   setState(next);
   const parsedPricing=pricingSchema.safeParse(data.pricing);setPricing(previous=>nextPricing(previous,parsedPricing.success?parsedPricing.data:tariff));
   const parsedPolicy=policySchema.safeParse(data.policy);setPolicy(parsedPolicy.success?parsedPolicy.data:defaultPolicy);
   revision.current=data.revision;setUser(data.user);setStatus('authenticated');setError(null);signedIn.current=true;
  }catch{
   if(current!==generation.current)return;
   if(signedIn.current){keepAndRetry();return}
   clearPrivate();setStatus('error');setError(marketMessages[localeRef.current].connection);
  }
  finally{clearTimeout(timeout)}
 },[clearPrivate,readStoredLocale]);
 useEffect(()=>{
  // ?lang=uz|ru|en (hreflang URLs) is an explicit choice and is saved; otherwise a
  // locally saved choice wins over the server's pick.
  const fromQuery=supportedLocale(new URLSearchParams(window.location.search).get('lang'));
  if(fromQuery)try{localStorage.setItem('atlas-language',fromQuery)}catch{}
  const locale=fromQuery??readStoredLocale()??initialLocale;
  // The server reads this cookie to render pages and localized errors in the same language.
  setLocaleCookie(locale);
  if(locale!==localeRef.current){
   // This ref is intentionally updated outside render for callbacks that outlive this effect.
   localeRef.current=locale;
   queueMicrotask(()=>setState(s=>({...s,communication:{...s.communication,language:locale}})))
  }
  queueMicrotask(()=>void refresh());
  // Coming back to the tab or back online reloads the account, at most every 10 seconds.
  const wake=()=>{if(!busy.current&&document.visibilityState!=='hidden'&&Date.now()-lastRefresh.current>10000)void refresh()};
  window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);
  return()=>{window.removeEventListener('focus',wake);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake);if(retryTimer.current)clearTimeout(retryTimer.current)};
 },[readStoredLocale,refresh,initialLocale]);
 useEffect(()=>{document.documentElement.lang=state.communication.language},[state.communication.language]);
 const act=useCallback(async(action:Action)=>{
  if(!ready){toast.error(marketMessages[localeRef.current].signin);return false}
  if(busy.current)return false;
  busy.current=true;
  // A pending read must not overwrite the result of this newer mutation.
  const current=++generation.current;
  try{
   const res=await fetch('/api/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:revision.current})});
   const data=await res.json() as {state?:unknown;revision:number;error?:string; errorCode?:string};
   if(current!==generation.current)return false;
   if(res.status===401){signedIn.current=false;clearPrivate();setStatus('guest');setError(null);toast.message(marketMessages[localeRef.current].sessionEnded);return false}
   if(data.state){const next=parseState(JSON.stringify(data.state));serverLocaleRef.current=next.communication.language;setState(next);revision.current=data.revision}
   // The server's reason ("the price changed…") is the useful part; the generic text is only a fallback.
   if(!res.ok){lastError.current={code:data.errorCode,message:data.error};toast.error((data.errorCode ? serverError(localeRef.current, data.errorCode) : undefined) ?? data.error ?? marketMessages[localeRef.current].saveFailed);if(res.status===409&&!data.state)await refresh();return false}
   lastError.current=null;
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
  localeRef.current=next;
  setState(s=>({...s,communication:{...s.communication,language:next}}));
  try{localStorage.setItem('atlas-language',next)}catch{}
  setLocaleCookie(next);
 },[]);
 return <Context.Provider value={{catalogProducts,catalogReady,collections,catalogError,loadCatalog,state,pricing,policy,siteContent,setSiteContent,ready,status,error,user,setLocale,act,lastActionError,refresh}}>{children}</Context.Provider>;
}
export function useMarket(){const c=useContext(Context);if(!c)throw Error('MarketProvider missing');return c}
