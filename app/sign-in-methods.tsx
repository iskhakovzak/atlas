'use client';

import {useCallback,useEffect,useState} from 'react';
import {KeyRound,Mail,MessageCircle,Plus,Smartphone} from 'lucide-react';
import {toast} from 'sonner';
import type {Locale} from '@/lib/market/i18n';
import {Modal} from './market-ui';
import {isNative} from '@/lib/native/bridge';
import {AppleButton,AppleMark,OtpLogin,TelegramBotLogin,TelegramLogin,appleOffered,loginCopy,openProvider} from './login-view';

type Method='email'|'phone'|'telegram'|'google'|'apple';
type Available={email:boolean;phone:boolean;telegram:string|null;telegramBot?:boolean;google:boolean;apple?:boolean;appleNative?:boolean;devCodes:boolean};
type Links={own:{method:Method;contact:string};linked:Array<{subject:string;method:Method;contact:string;createdAt:number}>;current:Method};

const copy={
 ru:{title:'Способы входа',lead:'Входите любым из них — откроется этот же кабинет с вашими заказами.',own:'основной',add:'Добавить',remove:'Отвязать',names:{telegram:'Telegram',phone:'Телефон',email:'Почта',google:'Google',apple:'Apple'},attach:(name:string)=>`Привязать: ${name}`,attachHint:'Подтвердите, что это ваш способ входа. Потом он будет открывать этот кабинет.',linked:'Способ входа привязан.',removed:'Способ входа отвязан.',failed:'Не удалось загрузить способы входа.'},
 uz:{title:'Kirish usullari',lead:'Istalganidan foydalaning — buyurtmalaringiz bilan shu kabinet ochiladi.',own:'asosiy',add:'Qo‘shish',remove:'Uzish',names:{telegram:'Telegram',phone:'Telefon',email:'Pochta',google:'Google',apple:'Apple'},attach:(name:string)=>`Bog‘lash: ${name}`,attachHint:'Bu sizning kirish usulingiz ekanini tasdiqlang. Keyin u shu kabinetni ochadi.',linked:'Kirish usuli bog‘landi.',removed:'Kirish usuli uzildi.',failed:'Kirish usullarini yuklab bo‘lmadi.'},
 en:{title:'Sign-in methods',lead:'Use any of them — the same account with your orders opens.',own:'main',add:'Add',remove:'Remove',names:{telegram:'Telegram',phone:'Phone',email:'Email',google:'Google',apple:'Apple'},attach:(name:string)=>`Attach ${name}`,attachHint:'Confirm this sign-in method is yours. It will then open this account.',linked:'Sign-in method attached.',removed:'Sign-in method removed.',failed:'Could not load sign-in methods.'},
} satisfies Record<Locale,unknown>;
const icons={telegram:MessageCircle,phone:Smartphone,email:Mail,google:KeyRound,apple:AppleMark};

/** Cabinet card: the account's sign-in methods, and attaching Telegram, phone, email or Google to the same account. */
export function SignInMethods({locale}:{locale:Locale}){
 const c=copy[locale],lc=loginCopy(locale);
 const [links,setLinks]=useState<Links|null>(null),[available,setAvailable]=useState<Available|null>(null),[failed,setFailed]=useState(false);
 const [adding,setAdding]=useState<Method|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null);
 const errorText=useCallback((code?:string)=>code?(code in lc.errors?lc.errors[code as keyof typeof lc.errors]:lc.errors.fallback):'',[lc]);
 const load=useCallback(async()=>{
  try{
   const [l,a]=await Promise.all([fetch('/api/auth/links',{credentials:'same-origin',cache:'no-store'}),fetch('/api/auth/methods',{credentials:'same-origin'})]);
   if(!l.ok||!a.ok)throw Error(String(l.status));
   setLinks(await l.json() as Links);setAvailable(await a.json() as Available);setFailed(false);
  }catch{setFailed(true)}
 },[]);
 useEffect(()=>{
  queueMicrotask(()=>void load());
  // Back from Google or Apple with ?linked=google|apple or ?link_error=<code>: say what happened, then tidy the address.
  const params=new URLSearchParams(window.location.search);
  if(params.has('linked')||params.has('link_error')){
   if(params.has('linked'))toast.success(c.linked);else toast.error(errorText(params.get('link_error')??undefined));
   params.delete('linked');params.delete('link_error');
   window.history.replaceState(null,'',window.location.pathname+(params.size?'?'+params:''));
  }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const attached=useCallback(()=>{setAdding(null);setError(null);toast.success(c.linked);void load()},[c.linked,load]);
 const showError=useCallback((code?:string)=>setError(code?errorText(code):null),[errorText]);
 async function remove(subject:string){
  setBusy(subject);
  try{
   const response=await fetch('/api/auth/links',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({remove:subject})});
   if(!response.ok){
    // A stable code from the server (for example link_current) explains the refusal; anything else is the generic message.
    const failure=await response.json().catch(()=>null) as {error?:unknown}|null;
    toast.error(typeof failure?.error==='string'?errorText(failure.error):lc.errors.fallback);
    return;
   }
   setLinks(await response.json() as Links);toast.success(c.removed);
  }catch{toast.error(lc.errors.fallback)}
  finally{setBusy(null)}
 }
 const items=links?[{subject:'',method:links.own.method,contact:links.own.contact,own:true},...links.linked.map(item=>({...item,own:false}))]:[];
 const has=(method:Method)=>items.some(item=>item.method===method);
 const addable=available?(['telegram','phone','email','google','apple'] as const).filter(method=>!has(method)&&(method==='telegram'?!!available.telegram:method==='apple'?appleOffered(available):available[method])):[];
 const returnTo=typeof window==='undefined'?'/account':window.location.pathname;
 return <section className="cabinet-card" aria-labelledby="cabinet-signin-methods-title">
  <h2 id="cabinet-signin-methods-title">{c.title}</h2>
  <p className="cabinet-lead">{c.lead}</p>
  {failed&&<p className="cabinet-note" role="status">{c.failed}</p>}
  {!!items.length&&<ul className="signin-methods">{items.map(item=>{const Icon=icons[item.method];return <li key={item.subject||'own'} className="signin-method">
   <span className="signin-method-icon" aria-hidden="true"><Icon size={18}/></span>
   <span className="signin-method-body"><b>{c.names[item.method]}</b><small>{item.contact}</small></span>
   {item.own&&<em className="signin-method-tag">{c.own}</em>}
   {!item.own&&<button type="button" className="text-button signin-method-remove" disabled={busy===item.subject} onClick={()=>void remove(item.subject)}>{c.remove}</button>}
  </li>})}</ul>}
  {!!addable.length&&<div className="signin-add">{addable.map(method=>{const Icon=icons[method];return method==='apple'&&available
   ?<AppleButton key={method} link methods={available} returnTo={returnTo} label={c.names.apple} onDone={attached} onError={code=>{if(code)toast.error(errorText(code))}}/>
   :method==='google'
   // Inside the apps the Google flow runs in the system browser (Google refuses web views) and comes back through a handoff.
   ?isNative()?<button key={method} type="button" className="btn secondary" onClick={()=>void openProvider('google',returnTo,true).then(code=>{if(code)toast.error(errorText(code))})}><Plus size={16} aria-hidden="true"/><Icon size={16} aria-hidden="true"/>{c.names.google}</button>
   :<a key={method} className="btn secondary" href={'/api/auth/google?link=1&return_to='+encodeURIComponent(returnTo)}><Plus size={16} aria-hidden="true"/><Icon size={16} aria-hidden="true"/>{c.names.google}</a>
   :<button key={method} type="button" className="btn secondary" onClick={()=>{setError(null);setAdding(method)}}><Plus size={16} aria-hidden="true"/><Icon size={16} aria-hidden="true"/>{c.names[method]}</button>})}</div>}
  <Modal open={adding!==null} onClose={()=>setAdding(null)} title={adding?c.attach(c.names[adding]):''} description={c.attachHint} locale={locale}>
   {error&&<div className="notice error" role="alert">{error}</div>}
   {adding==='telegram'&&available?.telegram&&(available.telegramBot?<TelegramBotLogin link locale={locale} onDone={attached} onError={showError}/>:<TelegramLogin link bot={available.telegram} hint={lc.telegramHint} onDone={attached} onError={showError}/>)}
   {(adding==='phone'||adding==='email')&&<OtpLogin link key={adding} channel={adding} c={lc} dev={!!available?.devCodes} onDone={attached} onError={showError}/>}
  </Modal>
 </section>;
}
