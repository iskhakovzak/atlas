'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,Loader2,Mail,Send,Smartphone} from 'lucide-react';
import {useMarket} from '@/lib/market/store';
import {safeReturnTo} from '@/lib/auth/return-to';
import type {Locale} from '@/lib/market/i18n';

type Methods={email:boolean;phone:boolean;telegram:string|null;telegramBot?:boolean;google:boolean;devCodes:boolean};
type Tab='telegram'|'phone'|'email'|'google';

const copy={
 ru:{eyebrow:'Вход в Atlas',title:'Войдите или создайте аккаунт',intro:'Аккаунт создаётся автоматически при первом входе. После входа вернём вас к выбранному действию.',telegram:'Telegram',phone:'Телефон',email:'Email',google:'Google',phoneLabel:'Номер телефона',phoneHint:'Пришлём SMS с кодом. Только номера Узбекистана (+998).',emailLabel:'Электронная почта',emailHint:'Пришлём письмо с кодом.',sendCode:'Получить код',sending:'Отправляем…',codeLabel:'Код из сообщения',codeSentPhone:'Код отправлен на',codeSentEmail:'Код отправлен на',verify:'Войти',verifying:'Проверяем…',resend:'Отправить код ещё раз',resendIn:'Повторная отправка через',sec:'с',change:'Изменить',telegramHint:'Нажмите кнопку и подтвердите вход в Telegram.',googleHint:'Войдите с помощью аккаунта Google.',googleButton:'Продолжить с Google',devCode:'Режим разработки: код',loading:'Загружаем способы входа…',none:'Вход временно недоступен. Попробуйте позже.',signedIn:'Вы вошли. Возвращаем вас…',legal:'Продолжая, вы принимаете правила Atlas.',errors:{invalid_email:'Проверьте адрес почты.',invalid_phone:'Введите номер в формате +998 90 123 45 67.',invalid_code:'Неверный код. Проверьте и попробуйте ещё раз.',code_expired:'Код устарел или попыток слишком много. Запросите новый код.',too_many_requests:'Слишком много попыток. Подождите немного и попробуйте снова.',delivery_failed:'Не удалось отправить код. Попробуйте позже или выберите другой способ.',method_unavailable:'Этот способ входа сейчас недоступен.',telegram_invalid:'Не удалось подтвердить вход через Telegram. Попробуйте ещё раз.',google:'Не удалось войти через Google. Попробуйте ещё раз.',unavailable:'Сервис входа временно недоступен.',link_same:'Этот способ уже открывает ваш аккаунт.',link_taken:'Этот способ входа уже привязан к другому аккаунту.',link_has_account:'У этого способа входа уже есть свой аккаунт с данными. Войдите через него, чтобы ими воспользоваться.',signed_out:'Сессия закончилась. Войдите снова.',fallback:'Не удалось войти. Попробуйте ещё раз.'},linkVerify:'Привязать'},
 uz:{eyebrow:'Atlasga kirish',title:'Kiring yoki akkaunt yarating',intro:'Akkaunt birinchi kirishda avtomatik yaratiladi. Kirgandan so‘ng tanlangan amalga qaytasiz.',telegram:'Telegram',phone:'Telefon',email:'Email',google:'Google',phoneLabel:'Telefon raqami',phoneHint:'Kod bilan SMS yuboramiz. Faqat O‘zbekiston raqamlari (+998).',emailLabel:'Elektron pochta',emailHint:'Kod bilan xat yuboramiz.',sendCode:'Kod olish',sending:'Yuborilmoqda…',codeLabel:'Xabardagi kod',codeSentPhone:'Kod yuborildi:',codeSentEmail:'Kod yuborildi:',verify:'Kirish',verifying:'Tekshirilmoqda…',resend:'Kodni qayta yuborish',resendIn:'Qayta yuborish',sec:'s',change:'O‘zgartirish',telegramHint:'Tugmani bosing va Telegramda kirishni tasdiqlang.',googleHint:'Google akkaunti orqali kiring.',googleButton:'Google orqali davom etish',devCode:'Ishlab chiqish rejimi: kod',loading:'Kirish usullari yuklanmoqda…',none:'Kirish vaqtincha mavjud emas. Keyinroq urinib ko‘ring.',signedIn:'Siz kirdingiz. Qaytarmoqdamiz…',legal:'Davom etib, Atlas qoidalarini qabul qilasiz.',errors:{invalid_email:'Pochta manzilini tekshiring.',invalid_phone:'Raqamni +998 90 123 45 67 formatida kiriting.',invalid_code:'Kod noto‘g‘ri. Tekshirib, qayta urinib ko‘ring.',code_expired:'Kod eskirgan yoki urinishlar ko‘p. Yangi kod so‘rang.',too_many_requests:'Urinishlar juda ko‘p. Biroz kuting va qayta urinib ko‘ring.',delivery_failed:'Kodni yuborib bo‘lmadi. Keyinroq urinib ko‘ring yoki boshqa usulni tanlang.',method_unavailable:'Bu kirish usuli hozir mavjud emas.',telegram_invalid:'Telegram orqali kirishni tasdiqlab bo‘lmadi. Qayta urinib ko‘ring.',google:'Google orqali kirib bo‘lmadi. Qayta urinib ko‘ring.',unavailable:'Kirish xizmati vaqtincha mavjud emas.',link_same:'Bu usul allaqachon akkauntingizni ochadi.',link_taken:'Bu kirish usuli boshqa akkauntga bog‘langan.',link_has_account:'Bu kirish usulining ma’lumotlari bor alohida akkaunti mavjud. Ulardan foydalanish uchun u orqali kiring.',signed_out:'Sessiya tugadi. Qaytadan kiring.',fallback:'Kirib bo‘lmadi. Qayta urinib ko‘ring.'},linkVerify:'Bog‘lash'},
 en:{eyebrow:'Sign in to Atlas',title:'Sign in or create an account',intro:'Your account is created automatically the first time you sign in. Afterwards you’ll return to your selected action.',telegram:'Telegram',phone:'Phone',email:'Email',google:'Google',phoneLabel:'Phone number',phoneHint:'We’ll text you a code. Uzbekistan numbers (+998) only.',emailLabel:'Email',emailHint:'We’ll email you a code.',sendCode:'Get code',sending:'Sending…',codeLabel:'Code from the message',codeSentPhone:'Code sent to',codeSentEmail:'Code sent to',verify:'Sign in',verifying:'Checking…',resend:'Send the code again',resendIn:'Resend in',sec:'s',change:'Change',telegramHint:'Press the button and confirm sign-in in Telegram.',googleHint:'Sign in with your Google account.',googleButton:'Continue with Google',devCode:'Development mode: code',loading:'Loading sign-in options…',none:'Sign-in is temporarily unavailable. Please try later.',signedIn:'You’re signed in. Taking you back…',legal:'By continuing you accept the Atlas terms.',errors:{invalid_email:'Check the email address.',invalid_phone:'Enter the number as +998 90 123 45 67.',invalid_code:'Wrong code. Check it and try again.',code_expired:'The code expired or had too many attempts. Request a new one.',too_many_requests:'Too many attempts. Wait a little and try again.',delivery_failed:'Could not send the code. Try later or choose another method.',method_unavailable:'This sign-in method is unavailable right now.',telegram_invalid:'Could not confirm the Telegram sign-in. Try again.',google:'Could not sign in with Google. Try again.',unavailable:'Sign-in is temporarily unavailable.',link_same:'This method already opens your account.',link_taken:'This sign-in method is already attached to another account.',link_has_account:'This sign-in method has its own account with data. Sign in with it to use that data.',signed_out:'Your session ended. Sign in again.',fallback:'Could not sign in. Try again.'},linkVerify:'Attach'},
} satisfies Record<Locale,unknown>;

type PostResult={ok:boolean;data:{error?:string;challengeId?:string;devCode?:string}};
async function post(url:string,body:unknown):Promise<PostResult>{
 try{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});
  return {ok:response.ok,data:await response.json().catch(()=>({})) as PostResult['data']};
 }catch{return {ok:false,data:{error:'unavailable'}}}
}

const choiceCopy={
 ru:{or:'или',phone:'По номеру телефона',email:'По электронной почте',back:'Все способы входа'},
 uz:{or:'yoki',phone:'Telefon raqami orqali',email:'Elektron pochta orqali',back:'Barcha kirish usullari'},
 en:{or:'or',phone:'With a phone number',email:'With email',back:'All sign-in methods'},
} satisfies Record<Locale,unknown>;
/** Google's "G" in its four colours, as Google asks sign-in buttons to show it. */
function GoogleMark(){return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>}

export function LoginView(){
 const {status,state}=useMarket();
 const c=copy[state.communication.language as Locale]??copy.ru;
 const [returnTo,setReturnTo]=useState('/');
 const [methods,setMethods]=useState<Methods|null>(null);
 const [failed,setFailed]=useState(false);
 const [tab,setTab]=useState<Tab|null>(null);
 const [error,setError]=useState<string|null>(null);
 const showError=useCallback((code?:string)=>setError(code?(code in c.errors?c.errors[code as keyof typeof c.errors]:c.errors.fallback):null),[c]);

 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);
  queueMicrotask(()=>{setReturnTo(safeReturnTo(params.get('return_to')));if(params.get('error')==='google')setError(c.errors.google)});
  fetch('/api/auth/methods',{credentials:'same-origin'}).then(response=>response.ok?response.json() as Promise<Methods>:Promise.reject(new Error(String(response.status)))).then(value=>{
   setMethods(value);
   // With Telegram off and a single other method, its form opens at once.
   const others=(['phone','email'] as const).filter(key=>value[key]);
   setTab(!value.telegram&&!value.google&&others.length===1?others[0]:null);
  }).catch(()=>setFailed(true));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const done=useCallback(()=>window.location.replace(returnTo),[returnTo]);
 useEffect(()=>{if(status==='authenticated')done()},[status,done]);

 if(status==='authenticated')return <section className="surface access-card" role="status"><span className="access-spinner"/>{c.signedIn}</section>;
 const tabs=methods?([['telegram',!!methods.telegram],['phone',methods.phone],['email',methods.email],['google',methods.google]] as const).filter(([,enabled])=>enabled):[];
 const locale=(state.communication.language as Locale)??'ru',w=choiceCopy[locale]??choiceCopy.ru;
 return <section className="surface login-card">
  <span className="eyebrow">{c.eyebrow}</span><h1>{c.title}</h1><p className="login-intro">{c.intro}</p>
  {error&&<div className="notice error" role="alert">{error}</div>}
  {!methods&&!failed&&<div className="login-status" role="status"><span className="access-spinner"/>{c.loading}</div>}
  {(failed||(methods&&!tabs.length))&&<div className="notice" role="status">{c.none}</div>}
  {/* One method at a time: Telegram on top, the others as a column of buttons; phone and email open their form. */}
  {methods&&(tab===null||tab==='telegram'||tab==='google')?<div className="login-panel">
   {methods.telegram&&(methods.telegramBot?<TelegramBotLogin locale={locale} onDone={done} onError={showError}/>:<TelegramLogin bot={methods.telegram} hint={c.telegramHint} onDone={done} onError={showError}/>)}
   {methods.telegram&&tabs.length>1&&<div className="login-or" role="separator"><span>{w.or}</span></div>}
   <div className="login-choices">
    {methods.phone&&<button type="button" className="btn secondary login-choice" onClick={()=>{setTab('phone');setError(null)}}><Smartphone size={18} aria-hidden="true"/>{w.phone}</button>}
    {methods.email&&<button type="button" className="btn secondary login-choice" onClick={()=>{setTab('email');setError(null)}}><Mail size={18} aria-hidden="true"/>{w.email}</button>}
    {methods.google&&<a className="btn secondary login-choice" href={'/api/auth/google?return_to='+encodeURIComponent(returnTo)}><GoogleMark/>{c.googleButton}</a>}
   </div>
  </div>:methods&&(tab==='phone'||tab==='email')&&<div className="login-panel">
   <button type="button" className="text-button login-back" onClick={()=>{setTab(null);setError(null)}}><ArrowLeft size={16} aria-hidden="true"/>{w.back}</button>
   <OtpLogin key={tab} channel={tab} c={c} dev={!!methods.devCodes} onDone={done} onError={showError}/>
  </div>}
  <small className="login-legal">{c.legal}</small>
 </section>;
}

export type LoginCopy=(typeof copy)['ru'];
export const loginCopy=(locale:Locale):LoginCopy=>copy[locale]??copy.ru;
/** Email or phone code. With `link` the verified address is attached to the signed-in account instead of signing in. */
export function OtpLogin({channel,c,dev,onDone,onError,link=false}:{channel:'phone'|'email';c:LoginCopy;dev:boolean;onDone:()=>void;onError:(code?:string)=>void;link?:boolean}){
 const [target,setTarget]=useState(channel==='phone'?'+998 ':'');
 const [challenge,setChallenge]=useState<string|null>(null);
 const [code,setCode]=useState('');
 const [devCode,setDevCode]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [wait,setWait]=useState(0);
 const codeInput=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(wait<=0)return;const timer=setTimeout(()=>setWait(value=>value-1),1000);return ()=>clearTimeout(timer)},[wait]);
 async function send(event?:FormEvent){
  event?.preventDefault();if(busy)return;setBusy(true);onError();
  const {ok,data}=await post('/api/auth/otp',{step:'start',channel,target});
  setBusy(false);
  if(!ok||!data.challengeId){onError(data.error);return}
  setChallenge(data.challengeId);setDevCode(data.devCode??null);setCode('');setWait(60);
  setTimeout(()=>codeInput.current?.focus(),0);
 }
 async function verify(event:FormEvent){
  event.preventDefault();if(busy||!challenge)return;setBusy(true);onError();
  const {ok,data}=await post('/api/auth/otp',{step:'verify',channel,challengeId:challenge,code,...(link?{link:true}:{})});
  if(ok){onDone();return}
  setBusy(false);onError(data.error);
  if(data.error==='code_expired')setChallenge(null);
 }
 if(!challenge)return <form className="login-form" onSubmit={send}>
  <div className="field"><label htmlFor={'login-'+channel}>{channel==='phone'?c.phoneLabel:c.emailLabel}</label>
   <input id={'login-'+channel} type={channel==='phone'?'tel':'email'} inputMode={channel==='phone'?'tel':'email'} autoComplete={channel==='phone'?'tel':'email'} required maxLength={channel==='phone'?20:254} value={target} onChange={event=>setTarget(event.target.value)} placeholder={channel==='phone'?'+998 90 123 45 67':'name@example.com'}/>
   <small>{channel==='phone'?c.phoneHint:c.emailHint}</small></div>
  <button className="btn primary" type="submit" disabled={busy}>{busy?c.sending:c.sendCode}<ArrowRight size={18}/></button>
 </form>;
 return <form className="login-form" onSubmit={verify}>
  <p className="login-sent">{channel==='phone'?c.codeSentPhone:c.codeSentEmail} <b>{target.trim()}</b> <button type="button" className="text-button" onClick={()=>{setChallenge(null);onError()}}><ArrowLeft size={14}/>{c.change}</button></p>
  {dev&&devCode&&<div className="notice" role="status">{c.devCode}: <b>{devCode}</b></div>}
  <div className="field"><label htmlFor={'code-'+channel}>{c.codeLabel}</label>
   <input ref={codeInput} id={'code-'+channel} className="login-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/></div>
  <button className="btn primary" type="submit" disabled={busy||code.length!==6}>{busy?c.verifying:link?c.linkVerify:c.verify}<ArrowRight size={18}/></button>
  <button type="button" className="text-button login-resend" disabled={busy||wait>0} onClick={()=>void send()}>{wait>0?`${c.resendIn} ${wait} ${c.sec}`:c.resend}</button>
 </form>;
}

declare global{interface Window{atlasTelegramAuth?:(user:Record<string,unknown>)=>void}}
/** The Telegram Login Widget. With `link` the Telegram account is attached to the signed-in account instead of signing in. */
export function TelegramLogin({bot,hint,onDone,onError,link=false}:{bot:string;hint:string;onDone:()=>void;onError:(code?:string)=>void;link?:boolean}){
 const holder=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  window.atlasTelegramAuth=user=>{void post('/api/auth/telegram',link?{...user,link:true}:user).then(({ok,data})=>ok?onDone():onError(data.error))};
  const script=document.createElement('script');
  script.async=true;script.src='https://telegram.org/js/telegram-widget.js?22';
  script.setAttribute('data-telegram-login',bot);script.setAttribute('data-size','large');script.setAttribute('data-radius','8');
  script.setAttribute('data-onauth','atlasTelegramAuth(user)');
  const target=holder.current;target?.replaceChildren(script);
  return ()=>{target?.replaceChildren();delete window.atlasTelegramAuth};
 },[bot,onDone,onError,link]);
 return <div className="login-telegram"><p>{hint}</p><div ref={holder} className="login-telegram-widget"/></div>;
}

const botCopy={
 ru:{button:'Войти через Telegram',linkButton:'Привязать Telegram',hint:'Откроется Telegram — подтвердите вход в чате с ботом Atlas.',waiting:'Подтвердите вход в Telegram и вернитесь сюда — страница откроется сама.',again:'Открыть Telegram ещё раз',web:'Не открылось? Открыть в браузере',preparing:'Готовим вход…'},
 uz:{button:'Telegram orqali kirish',linkButton:'Telegramni bog‘lash',hint:'Telegram ochiladi — Atlas boti bilan chatda kirishni tasdiqlang.',waiting:'Telegramda kirishni tasdiqlang va bu yerga qayting — sahifa o‘zi ochiladi.',again:'Telegramni yana ochish',web:'Ochilmadimi? Brauzerda ochish',preparing:'Kirish tayyorlanmoqda…'},
 en:{button:'Sign in with Telegram',linkButton:'Attach Telegram',hint:'Telegram opens — confirm in the chat with the Atlas bot.',waiting:'Confirm in Telegram and come back — this page opens by itself.',again:'Open Telegram again',web:'Did not open? Open in the browser',preparing:'Preparing sign-in…'},
} satisfies Record<Locale,unknown>;
type BotStart={token:string;expiresAt:number;links:{app:string;web:string}};
/**
 * Sign-in through the Atlas bot: one tap opens the Telegram app (t.me on phones, which opens the app;
 * tg:// on computers, which opens Telegram Desktop), the person confirms in the chat, and this page signs
 * in by itself. With `link` the Telegram account is attached to the signed-in account instead.
 */
export function TelegramBotLogin({locale,onDone,onError,link=false}:{locale:Locale;onDone:()=>void;onError:(code?:string)=>void;link?:boolean}){
 const t=botCopy[locale]??botCopy.ru;
 const [start,setStart]=useState<BotStart|null>(null),[waiting,setWaiting]=useState(false);
 const [phone]=useState(()=>typeof navigator!=='undefined'&&(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1)));
 const finished=useRef(false);
 const begin=useCallback(async()=>{
  setStart(null);
  try{
   const response=await fetch('/api/auth/telegram/bot',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({step:'start',...(link?{link:true}:{})})});
   const data=await response.json().catch(()=>({})) as BotStart&{error?:string};
   if(!response.ok)throw Error(data.error??'unavailable');
   setStart(data);
  }catch(error){onError((error as Error).message||'unavailable')}
 },[link,onError]);
 useEffect(()=>{queueMicrotask(()=>void begin())},[begin]);
 useEffect(()=>{
  if(!waiting||!start)return;
  let busy=false;
  const check=async()=>{
   if(busy||finished.current)return;busy=true;
   try{
    const response=await fetch('/api/auth/telegram/bot',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({step:'check',token:start.token})});
    const data=await response.json().catch(()=>({})) as {status?:string;error?:string};
    if(!response.ok){setWaiting(false);onError(data.error);return}
    if(data.status==='done'||data.status==='linked'){finished.current=true;onDone();return}
    if(data.status==='expired'){setWaiting(false);void begin()}
   }catch{/* the next check tries again */}
   finally{busy=false}
  };
  const timer=window.setInterval(()=>void check(),2000);
  // Back from Telegram: check at once instead of waiting for the next tick.
  const back=()=>{if(document.visibilityState==='visible')void check()};
  document.addEventListener('visibilitychange',back);window.addEventListener('focus',back);
  return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',back);window.removeEventListener('focus',back)};
 },[waiting,start,begin,onDone,onError]);
 const href=start?(phone?start.links.web:start.links.app):undefined;
 return <div className="login-telegram">
  <a className={'btn tg-login'+(start?'':' is-busy')} href={href} aria-disabled={!start} onClick={event=>{if(!start){event.preventDefault();return}onError();setWaiting(true)}}>
   {start?<Send size={19} aria-hidden="true"/>:<Loader2 className="spin" size={19} aria-hidden="true"/>}{start?(link?t.linkButton:t.button):t.preparing}
  </a>
  {!waiting&&<small className="tg-login-hint">{t.hint}</small>}
  {waiting&&<div className="tg-login-wait" role="status"><Loader2 className="spin" size={16} aria-hidden="true"/><span>{t.waiting}</span></div>}
  {waiting&&start&&!phone&&<a className="text-button tg-login-web" href={start.links.web} target="_blank" rel="noopener noreferrer">{t.web}</a>}
 </div>;
}
