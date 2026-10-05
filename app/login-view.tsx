'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,KeyRound,Mail,MessageCircle,Smartphone} from 'lucide-react';
import {useMarket} from '@/lib/market/store';
import {safeReturnTo} from '@/lib/auth/return-to';
import type {Locale} from '@/lib/market/i18n';

type Methods={email:boolean;phone:boolean;telegram:string|null;google:boolean;devCodes:boolean};
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
   setMethods(value);setTab(value.telegram?'telegram':value.phone?'phone':value.email?'email':value.google?'google':null);
  }).catch(()=>setFailed(true));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const done=useCallback(()=>window.location.replace(returnTo),[returnTo]);
 useEffect(()=>{if(status==='authenticated')done()},[status,done]);

 if(status==='authenticated')return <section className="surface access-card" role="status"><span className="access-spinner"/>{c.signedIn}</section>;
 const tabs=methods?([['telegram',!!methods.telegram,MessageCircle],['phone',methods.phone,Smartphone],['email',methods.email,Mail],['google',methods.google,KeyRound]] as const).filter(([,enabled])=>enabled):[];
 return <section className="surface login-card">
  <span className="eyebrow">{c.eyebrow}</span><h1>{c.title}</h1><p className="login-intro">{c.intro}</p>
  {error&&<div className="notice error" role="alert">{error}</div>}
  {!methods&&!failed&&<div className="login-status" role="status"><span className="access-spinner"/>{c.loading}</div>}
  {(failed||(methods&&!tabs.length))&&<div className="notice" role="status">{c.none}</div>}
  {tabs.length>1&&<div className="login-tabs" role="tablist" aria-label={c.eyebrow}>{tabs.map(([key,,Icon])=><button key={key} type="button" role="tab" aria-selected={tab===key} className={tab===key?'active':''} onClick={()=>{setTab(key);setError(null)}}><Icon size={17} aria-hidden="true"/>{c[key]}</button>)}</div>}
  <div className="login-panel" role="tabpanel">
   {tab==='telegram'&&methods?.telegram&&<TelegramLogin bot={methods.telegram} hint={c.telegramHint} onDone={done} onError={showError}/>}
   {(tab==='phone'||tab==='email')&&<OtpLogin key={tab} channel={tab} c={c} dev={!!methods?.devCodes} onDone={done} onError={showError}/>}
   {tab==='google'&&<div className="login-google"><p>{c.googleHint}</p><a className="btn primary" href={'/api/auth/google?return_to='+encodeURIComponent(returnTo)}>{c.googleButton}<ArrowRight size={18}/></a></div>}
  </div>
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
