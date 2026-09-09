'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {toast} from 'sonner';
import {blank,parseState,type State} from './domain';
import type {Action} from './actions';
export type AccountUser={name:string;email:string;operator:boolean;createdAt:number};
type Store={state:State;ready:boolean;error:string|null;user:AccountUser|null;act:(action:Action)=>Promise<boolean>;refresh:()=>Promise<void>};
const Context=createContext<Store|null>(null);
export function MarketProvider({children}:{children:ReactNode}) {
 const [state,setState]=useState<State>(blank),[ready,setReady]=useState(false),[error,setError]=useState<string|null>(null),[user,setUser]=useState<AccountUser|null>(null);const revision=useRef(0),busy=useRef(false);
 const refresh=useCallback(async()=>{try{const res=await fetch('/api/account',{cache:'no-store'});const data=await res.json() as {state?:unknown;revision:number;user:AccountUser;error?:string};if(!res.ok){setReady(false);setError(res.status===401?'Войдите в личный кабинет, чтобы сохранять покупки.':(data.error??'Сервер недоступен.'));return}setState(parseState(JSON.stringify(data.state)));revision.current=data.revision;setUser(data.user);setReady(true);setError(null)}catch{setReady(false);setError('Нет связи с сервером. Заказы не изменены. Попробуйте обновить страницу.')}},[]);
 useEffect(()=>{void refresh();const focus=()=>{if(!busy.current)void refresh()};window.addEventListener('focus',focus);return()=>window.removeEventListener('focus',focus)},[refresh]);
 const act=useCallback(async(action:Action)=>{if(!ready){toast.error('Сначала войдите в личный кабинет.');return false}if(busy.current){toast.message('Дождитесь сохранения предыдущего действия.');return false}busy.current=true;try{const res=await fetch('/api/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,revision:revision.current})});const data=await res.json() as {state?:unknown;revision:number;user:AccountUser;error?:string};if(data.state){setState(parseState(JSON.stringify(data.state)));revision.current=data.revision}if(!res.ok){toast.error(data.error??'Не удалось сохранить изменения.');if(res.status===409&&!data.state)await refresh();return false}return true}catch{toast.error('Ответ сервера не получен. Проверьте состояние заказа перед повтором.');await refresh();return false}finally{busy.current=false}},[ready,refresh]);
 return <Context.Provider value={{state,ready,error,user,act,refresh}}>{children}</Context.Provider>;
}
export function useMarket(){const c=useContext(Context);if(!c)throw Error('MarketProvider missing');return c}
