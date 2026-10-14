'use client';
import {useCallback,useEffect,useState} from 'react';

// What the Telegram order-notice controls need from the sign-in side: whether the bot (with its webhook) is
// there, and when the account's Telegram was attached. Small on purpose: the bell sheet uses it too.

type Methods={telegram:string|null;telegramBot?:boolean};
type Links={own:{method:string;contact:string};linked:Array<{subject:string;method:string;contact:string;createdAt:number}>};

/** Sign-in methods change (a method attached or detached in the account): the Telegram controls read them again. */
export const signInMethodsChanged='atlas:signin-methods-changed';

let methods:Promise<Methods|null>|null=null;
function loadMethods(){
 methods??=fetch('/api/auth/methods',{credentials:'same-origin'}).then(response=>response.ok?response.json() as Promise<Methods>:null).catch(()=>null).then(value=>{if(!value)methods=null;return value});
 return methods;
}

/** The bot's username when order notices can be offered (bot set up and its webhook connected), else null. */
export function useTelegramBot(){
 const [bot,setBot]=useState<string|null>(null);
 useEffect(()=>{
  let live=true;
  void loadMethods().then(value=>{if(live&&value?.telegramBot&&value.telegram)setBot(value.telegram)});
  return()=>{live=false};
 },[]);
 return bot;
}

// One request for the settings row and the nudge together; a change of sign-in methods asks again.
let links:Promise<Links|null>|null=null;
function loadLinks(){
 links??=fetch('/api/auth/links',{credentials:'same-origin',cache:'no-store'}).then(response=>response.ok?response.json() as Promise<Links>:null).catch(()=>null).then(value=>{if(!value)links=null;return value});
 return links;
}

export type TelegramLink={loaded:boolean;linked:boolean;/** When it was attached; undefined for an account created with Telegram. */linkedAt?:number;name?:string;
 /** /api/auth/links failed (network, 5xx): the row says so and offers to try again; a failure is never cached. */failed?:boolean};
/** The account's Telegram, read from /api/auth/links when `enabled` (only once the bot is known to be there). */
export function useTelegramLink(enabled:boolean){
 const [link,setLink]=useState<TelegramLink>({loaded:false,linked:false});
 const load=useCallback(async(fresh=false)=>{
  if(fresh){links=null;setLink(value=>value.failed?{loaded:false,linked:false}:value)}
  const data=await loadLinks();
  if(!data){setLink({loaded:false,linked:false,failed:true});return}
  const attached=data.linked.find(item=>item.method==='telegram');
  // The contact is "Name · Telegram" (or just "Telegram" without a name).
  const name=(value:string)=>{const shown=value.replace(/\s*·\s*Telegram$/,'').trim();return shown&&shown!=='Telegram'?{name:shown}:{}};
  setLink(data.own.method==='telegram'
   ?{loaded:true,linked:true,...name(data.own.contact)}
   :attached?{loaded:true,linked:true,linkedAt:attached.createdAt,...name(attached.contact)}:{loaded:true,linked:false});
 },[]);
 useEffect(()=>{
  if(!enabled)return;
  queueMicrotask(()=>void load());
  const again=()=>void load(true);
  window.addEventListener(signInMethodsChanged,again);
  return()=>window.removeEventListener(signInMethodsChanged,again);
 },[enabled,load]);
 return {link,reload:()=>load(true)};
}

/** "Not now" on the nudge in "Сейчас важно" is remembered for 30 days on this device. */
const nudgeKey='atlas-telegram-nudge';
export function nudgeDismissed(now:number){
 try{const at=Number(localStorage.getItem(nudgeKey));return Number.isFinite(at)&&at>0&&now-at<30*24*60*60*1000}catch{return false}
}
export function dismissNudge(now:number){try{localStorage.setItem(nudgeKey,String(now))}catch{/* private mode: shown again next time */}}
