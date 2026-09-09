'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {toast} from 'sonner';
import {blank,parseState,type State} from './domain';
const KEY='atlas-market-demo-v1';
type Store={state:State;ready:boolean;error:string|null;commit:(fn:(s:State)=>State)=>Promise<boolean>};
const Context=createContext<Store|null>(null);
export function MarketProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState<State>(blank),[ready,setReady]=useState(false),[error,setError]=useState<string|null>(null);
  const ref=useRef(state);
  useEffect(()=>{
    const read=()=>{try{const raw=localStorage.getItem(KEY);const next=raw?parseState(raw):blank();ref.current=next;setState(next);setError(null);setReady(true)}catch{setError('Не удалось прочитать сохранённые данные. Они не перезаписаны. Проверьте доступ к хранилищу браузера.');setReady(false)}};
    read();const listen=(e:StorageEvent)=>{if(e.key===KEY||e.key===null)read()};window.addEventListener('storage',listen);return()=>window.removeEventListener('storage',listen);
  },[]);
  const commit=useCallback(async(fn:(s:State)=>State)=>{
    if(!ready){toast.error('Хранилище ещё недоступно.');return false}
    const write=()=>{const raw=localStorage.getItem(KEY);const current=raw?parseState(raw):ref.current;const next=fn(current);localStorage.setItem(KEY,JSON.stringify(next));ref.current=next;setState(next);return true};
    try {return navigator.locks?await navigator.locks.request('atlas-demo-state',write):write()}catch(e){toast.error(e instanceof Error?e.message:'Не удалось сохранить изменения.');return false}
  },[ready]);
  return <Context.Provider value={{state,ready,error,commit}}>{children}</Context.Provider>;
}
export function useMarket(){const c=useContext(Context);if(!c)throw Error('MarketProvider missing');return c}
