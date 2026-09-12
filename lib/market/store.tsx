'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {toast} from 'sonner';
import {blank,parseState,pricingSchema,tariff,type Pricing,type State} from './domain';
import {defaultPolicy,policySchema,type Policy} from './policy';
import type {Action} from './actions';
import type {Locale} from './i18n';
import type {SessionStatus} from './access';
import {visibleMerchantFinds,type MerchantFind} from './catalog';
import type {CatalogCollection} from './catalog-editor';
export type AccountUser={name:string;email:string;operator:boolean;createdAt:number};
type Store={catalogProducts:MerchantFind[];collections:Array<CatalogCollection&{productIds:string[]}>;catalogError:string;state:State;pricing:Pricing;policy:Policy;ready:boolean;status:SessionStatus;error:string|null;user:AccountUser|null;setLocale:(locale:Locale)=>void;act:(action:Action)=>Promise<boolean>;refresh:()=>Promise<void>};
const Context=createContext<Store|null>(null);
export function MarketProvider({children}:{children:ReactNode}) {
 const [catalogProducts,setCatalogProducts]=useState<MerchantFind[]>(()=>visibleMerchantFinds()),[collections,setCollections]=useState<Array<CatalogCollection&{productIds:string[]}>>([]),[catalogError,setCatalogError]=useState('');
 useEffect(()=>{const controller=new AbortController();fetch('/api/catalog',{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)throw Error('Не удалось загрузить витрину');const data=await response.json() as {products:MerchantFind[];collections:Array<CatalogCollection&{productIds:string[]}>};setCatalogProducts(data.products);setCollections(data.collections)}).catch(error=>{if(error.name!=='AbortError')setCatalogError('Не удалось загрузить витрину. Обновите страницу.')});return()=>controller.abort()},[]);
 const [state,setState]=useState<State>(blank),[pricing,setPricing]=useState<Pricing>(tariff),[policy,setPolicy]=useState<Policy>(defaultPolicy),[status,setStatus]=useState<SessionStatus>('loading'),[error,setError]=useState<string|null>(null),[user,setUser]=useState<AccountUser|null>(null);
 const revision=useRef(0),busy=useRef(false),generation=useRef(0),localeRef=useRef<Locale>('ru');
 const ready=status==='authenticated';
 const clearPrivate=useCallback(()=>{setUser(null);revision.current=0;setState({...blank(),communication:{...blank().communication,language:localeRef.current}});setPolicy(defaultPolicy)},[]);
 const refresh=useCallback(async()=>{
  const current=++generation.current;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{
   const res=await fetch('/api/account',{cache:'no-store',signal:controller.signal});
   const data=await res.json() as {state?:unknown;pricing?:unknown;policy?:unknown;revision:number;user:AccountUser;error?:string};
   if(current!==generation.current)return;
   if(!res.ok){
    clearPrivate();
    if(res.status===401){setStatus('guest');setError(null);return}
    setStatus('error');setError(data.error??'Не удалось загрузить кабинет. Повторите попытку.');return;
   }
   const next=parseState(JSON.stringify(data.state));
   localeRef.current=next.communication.language;
   setState(next);
   const parsedPricing=pricingSchema.safeParse(data.pricing);setPricing(parsedPricing.success?parsedPricing.data:tariff);
   const parsedPolicy=policySchema.safeParse(data.policy);setPolicy(parsedPolicy.success?parsedPolicy.data:defaultPolicy);
   revision.current=data.revision;setUser(data.user);setStatus('authenticated');setError(null);
  }catch{if(current===generation.current){clearPrivate();setStatus('error');setError('Не удалось связаться с сервером. Проверьте подключение и повторите попытку.')}}
  finally{clearTimeout(timeout)}
 },[clearPrivate]);
 useEffect(()=>{
  try{const locale=localStorage.getItem('atlas-language');if(locale==='ru'||locale==='uz'||locale==='en'){localeRef.current=locale;queueMicrotask(()=>setState(s=>({...s,communication:{...s.communication,language:locale}})))}}catch{}
  queueMicrotask(()=>void refresh());
  const focus=()=>{if(!busy.current)void refresh()};window.addEventListener('focus',focus);
  return()=>{window.removeEventListener('focus',focus)};
 },[refresh]);
 useEffect(()=>{document.documentElement.lang=state.communication.language},[state.communication.language]);
 const act=useCallback(async(action:Action)=>{
  if(!ready){toast.error('Войдите, чтобы сохранить изменения.');return false}
  if(busy.current){toast.message('Дождитесь сохранения предыдущего действия.');return false}
  busy.current=true;
  // A pending read must not overwrite the result of this newer mutation.
  const current=++generation.current;
  try{
   const res=await fetch('/api/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:revision.current})});
   const data=await res.json() as {state?:unknown;revision:number;error?:string};
   if(current!==generation.current)return false;
   if(res.status===401){clearPrivate();setStatus('guest');setError(null);toast.message('Сессия завершилась. Войдите снова, чтобы продолжить.');return false}
   if(data.state){setState(parseState(JSON.stringify(data.state)));revision.current=data.revision}
   if(!res.ok){toast.error(data.error??'Не удалось сохранить изменения.');if(res.status===409&&!data.state)await refresh();return false}
   return true;
  }catch{toast.error('Ответ сервера не получен. Проверяем состояние заказа.');await refresh();return false}
  finally{busy.current=false}
 },[ready,refresh,clearPrivate]);
 const setLocale=useCallback((locale:Locale)=>{
  if(!['ru','uz','en'].includes(locale))return;
  if(ready){void act({type:'communication-save',value:{...state.communication,language:locale}});return}
  localeRef.current=locale;setState(s=>({...s,communication:{...s.communication,language:locale}}));
  try{localStorage.setItem('atlas-language',locale)}catch{}
 },[ready,act,state.communication]);
 return <Context.Provider value={{catalogProducts,collections,catalogError,state,pricing,policy,ready,status,error,user,setLocale,act,refresh}}>{children}</Context.Provider>;
}
export function useMarket(){const c=useContext(Context);if(!c)throw Error('MarketProvider missing');return c}
