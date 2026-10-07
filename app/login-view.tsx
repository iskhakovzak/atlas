'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowLeft,ArrowRight,Loader2,Mail,Send,Smartphone} from 'lucide-react';
import {useMarket} from '@/lib/market/store';
import {safeReturnTo} from '@/lib/auth/return-to';
import {appleSignInNative,isNative,nativePlatform,openExternal} from '@/lib/native/bridge';
import {beginHandoff} from '@/lib/native/pkce';
import type {Locale} from '@/lib/market/i18n';
import {withCyrillic} from '@/lib/market/uz-cyrl';

type Methods={email:boolean;phone:boolean;telegram:string|null;telegramBot?:boolean;google:boolean;apple?:boolean;appleNative?:boolean;devCodes:boolean};
type Tab='telegram'|'phone'|'email'|'google'|'apple';

const copy=withCyrillic({
 ru:{eyebrow:'Вход в Atlas',title:'Войдите или создайте аккаунт',intro:'Аккаунт создаётся автоматически при первом входе. После входа вернём вас к выбранному действию.',telegram:'Telegram',phone:'Телефон',email:'Email',google:'Google',apple:'Apple',appleHint:'Войдите с помощью Apple ID.',appleButton:'Продолжить с Apple',phoneLabel:'Номер телефона',phoneHint:'Пришлём SMS с кодом. Только номера Узбекистана (+998).',emailLabel:'Электронная почта',emailHint:'Пришлём письмо с кодом.',sendCode:'Получить код',sending:'Отправляем…',codeLabel:'Код из сообщения',codeSentPhone:'Код отправлен на',codeSentEmail:'Код отправлен на',verify:'Войти',verifying:'Проверяем…',resend:'Отправить код ещё раз',resendIn:'Повторная отправка через',sec:'с',change:'Изменить',telegramHint:'Нажмите кнопку и подтвердите вход в Telegram.',googleHint:'Войдите с помощью аккаунта Google.',googleButton:'Продолжить с Google',devCode:'Режим разработки: код',loading:'Загружаем способы входа…',none:'Вход временно недоступен. Попробуйте позже.',signedIn:'Вы вошли. Возвращаем вас…',legal:{before:'Продолжая, вы принимаете ',terms:'условия использования',and:' и ',privacy:'политику конфиденциальности',after:'.'},errors:{invalid_email:'Проверьте адрес почты.',invalid_phone:'Введите номер в формате +998 90 123 45 67.',invalid_code:'Неверный код. Проверьте и попробуйте ещё раз.',code_expired:'Код устарел или попыток слишком много. Запросите новый код.',too_many_requests:'Слишком много попыток. Подождите немного и попробуйте снова.',delivery_failed:'Не удалось отправить код. Попробуйте позже или выберите другой способ.',method_unavailable:'Этот способ входа сейчас недоступен.',telegram_invalid:'Не удалось подтвердить вход через Telegram. Попробуйте ещё раз.',google:'Не удалось войти через Google. Попробуйте ещё раз.',apple:'Не удалось войти через Apple. Попробуйте ещё раз.',unavailable:'Сервис входа временно недоступен.',link_same:'Этот способ уже открывает ваш аккаунт.',link_telegram_one:'К аккаунту уже привязан Telegram. Сначала отвяжите его, потом привяжите другой.',link_taken:'Этот способ входа уже привязан к другому аккаунту.',link_has_account:'У этого способа входа уже есть свой аккаунт с данными. Войдите через него, чтобы ими воспользоваться.',signed_out:'Сессия закончилась. Войдите снова.',link_current:'Нельзя отвязать способ, которым вы сейчас вошли. Войдите другим способом и повторите.',fallback:'Не удалось войти. Попробуйте ещё раз.'},linkVerify:'Привязать'},
 uz:{eyebrow:'Atlasga kirish',title:'Kiring yoki akkaunt yarating',intro:'Akkaunt birinchi kirishda avtomatik yaratiladi. Kirgandan so‘ng tanlangan amalga qaytasiz.',telegram:'Telegram',phone:'Telefon',email:'Email',google:'Google',apple:'Apple',appleHint:'Apple ID orqali kiring.',appleButton:'Apple orqali davom etish',phoneLabel:'Telefon raqami',phoneHint:'Kod bilan SMS yuboramiz. Faqat O‘zbekiston raqamlari (+998).',emailLabel:'Elektron pochta',emailHint:'Kod bilan xat yuboramiz.',sendCode:'Kod olish',sending:'Yuborilmoqda…',codeLabel:'Xabardagi kod',codeSentPhone:'Kod yuborildi:',codeSentEmail:'Kod yuborildi:',verify:'Kirish',verifying:'Tekshirilmoqda…',resend:'Kodni qayta yuborish',resendIn:'Qayta yuborish',sec:'s',change:'O‘zgartirish',telegramHint:'Tugmani bosing va Telegramda kirishni tasdiqlang.',googleHint:'Google akkaunti orqali kiring.',googleButton:'Google orqali davom etish',devCode:'Ishlab chiqish rejimi: kod',loading:'Kirish usullari yuklanmoqda…',none:'Kirish vaqtincha mavjud emas. Keyinroq urinib ko‘ring.',signedIn:'Siz kirdingiz. Qaytarmoqdamiz…',legal:{before:'Davom etib, siz ',terms:'foydalanish shartlari',and:' va ',privacy:'maxfiylik siyosati',after:'ni qabul qilasiz.'},errors:{invalid_email:'Pochta manzilini tekshiring.',invalid_phone:'Raqamni +998 90 123 45 67 formatida kiriting.',invalid_code:'Kod noto‘g‘ri. Tekshirib, qayta urinib ko‘ring.',code_expired:'Kod eskirgan yoki urinishlar ko‘p. Yangi kod so‘rang.',too_many_requests:'Urinishlar juda ko‘p. Biroz kuting va qayta urinib ko‘ring.',delivery_failed:'Kodni yuborib bo‘lmadi. Keyinroq urinib ko‘ring yoki boshqa usulni tanlang.',method_unavailable:'Bu kirish usuli hozir mavjud emas.',telegram_invalid:'Telegram orqali kirishni tasdiqlab bo‘lmadi. Qayta urinib ko‘ring.',google:'Google orqali kirib bo‘lmadi. Qayta urinib ko‘ring.',apple:'Apple orqali kirib bo‘lmadi. Qayta urinib ko‘ring.',unavailable:'Kirish xizmati vaqtincha mavjud emas.',link_same:'Bu usul allaqachon akkauntingizni ochadi.',link_telegram_one:'Akkauntga Telegram allaqachon bog‘langan. Avval uni uzing, keyin boshqasini bog‘lang.',link_taken:'Bu kirish usuli boshqa akkauntga bog‘langan.',link_has_account:'Bu kirish usulining ma’lumotlari bor alohida akkaunti mavjud. Ulardan foydalanish uchun u orqali kiring.',signed_out:'Sessiya tugadi. Qaytadan kiring.',link_current:'Hozir kirgan usulingizni uzib bo‘lmaydi. Boshqa usul bilan kiring va qayta urinib ko‘ring.',fallback:'Kirib bo‘lmadi. Qayta urinib ko‘ring.'},linkVerify:'Bog‘lash'},
 en:{eyebrow:'Sign in to Atlas',title:'Sign in or create an account',intro:'Your account is created automatically the first time you sign in. Afterwards you’ll return to your selected action.',telegram:'Telegram',phone:'Phone',email:'Email',google:'Google',apple:'Apple',appleHint:'Sign in with your Apple ID.',appleButton:'Continue with Apple',phoneLabel:'Phone number',phoneHint:'We’ll text you a code. Uzbekistan numbers (+998) only.',emailLabel:'Email',emailHint:'We’ll email you a code.',sendCode:'Get code',sending:'Sending…',codeLabel:'Code from the message',codeSentPhone:'Code sent to',codeSentEmail:'Code sent to',verify:'Sign in',verifying:'Checking…',resend:'Send the code again',resendIn:'Resend in',sec:'s',change:'Change',telegramHint:'Press the button and confirm sign-in in Telegram.',googleHint:'Sign in with your Google account.',googleButton:'Continue with Google',devCode:'Development mode: code',loading:'Loading sign-in options…',none:'Sign-in is temporarily unavailable. Please try later.',signedIn:'You’re signed in. Taking you back…',legal:{before:'By continuing you accept the ',terms:'terms of use',and:' and ',privacy:'privacy policy',after:'.'},errors:{invalid_email:'Check the email address.',invalid_phone:'Enter the number as +998 90 123 45 67.',invalid_code:'Wrong code. Check it and try again.',code_expired:'The code expired or had too many attempts. Request a new one.',too_many_requests:'Too many attempts. Wait a little and try again.',delivery_failed:'Could not send the code. Try later or choose another method.',method_unavailable:'This sign-in method is unavailable right now.',telegram_invalid:'Could not confirm the Telegram sign-in. Try again.',google:'Could not sign in with Google. Try again.',apple:'Could not sign in with Apple. Try again.',unavailable:'Sign-in is temporarily unavailable.',link_same:'This method already opens your account.',link_telegram_one:'A Telegram account is already attached. Remove it first, then attach another one.',link_taken:'This sign-in method is already attached to another account.',link_has_account:'This sign-in method has its own account with data. Sign in with it to use that data.',signed_out:'Your session ended. Sign in again.',link_current:'You can’t remove the method you are signed in with. Sign in another way and try again.',fallback:'Could not sign in. Try again.'},linkVerify:'Attach'},
}) satisfies Record<Locale,unknown>;

type PostResult={ok:boolean;data:{error?:string;challengeId?:string;devCode?:string;nonce?:string;ticket?:string}};
async function post(url:string,body:unknown):Promise<PostResult>{
 try{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'same-origin'});
  return {ok:response.ok,data:await response.json().catch(()=>({})) as PostResult['data']};
 }catch{return {ok:false,data:{error:'unavailable'}}}
}

const choiceCopy=withCyrillic({
 ru:{or:'или',phone:'По номеру телефона',email:'По электронной почте',back:'Все способы входа'},
 uz:{or:'yoki',phone:'Telefon raqami orqali',email:'Elektron pochta orqali',back:'Barcha kirish usullari'},
 en:{or:'or',phone:'With a phone number',email:'With email',back:'All sign-in methods'},
}) satisfies Record<Locale,unknown>;
/** Google's "G" in its four colours, as Google asks sign-in buttons to show it. */
function GoogleMark(){return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>}
/** Apple is offered through the system sheet inside the iOS app, otherwise through the web flow when it is configured. */
export function appleOffered(methods:Methods){return nativePlatform()==='ios'&&!!methods.appleNative?true:!!methods.apple}

/**
 * The URL of a Google/Apple web flow. Inside the apps it must open in the system browser, with the result handed
 * back, and carries the PKCE challenge of this app instance (`pkce`, from lib/native/pkce.ts beginHandoff).
 */
export function providerPath(provider:'google'|'apple',returnTo:string,options:{link?:boolean;ticket?:string;pkce?:string}={}){
 let path=`/api/auth/${provider}?return_to=${encodeURIComponent(returnTo)}`;
 if(options.link)path+='&link=1';
 if(isNative())path+='&native=1'+(options.ticket?'&ticket='+encodeURIComponent(options.ticket):'')+(options.pkce?'&pkce='+encodeURIComponent(options.pkce):'');
 return path;
}
/** Opens the flow: a plain navigation in a browser, the system browser inside the apps (a link needs a ticket first). Returns an error code. */
export async function openProvider(provider:'google'|'apple',returnTo:string,link=false):Promise<string|undefined>{
 if(!isNative()){window.location.assign(providerPath(provider,returnTo,{link}));return}
 let ticket:string|undefined;
 if(link){
  const {ok,data}=await post('/api/auth/handoff',{ticket:true});
  if(!ok||!data.ticket)return data.error??'unavailable';
  ticket=data.ticket;
 }
 // The verifier stays in this web view; only its challenge travels with the flow, and the handoff code is
 // worth nothing without the verifier (native-shell.tsx sends both to /api/auth/handoff).
 const pkce=await beginHandoff();
 await openExternal(window.location.origin+providerPath(provider,returnTo,{link,ticket,pkce}));
}
export function ProviderLink({provider,returnTo,className,children}:{provider:'google'|'apple';returnTo:string;className:string;children:ReactNode}){
 if(!isNative())return <a className={className} href={providerPath(provider,returnTo)}>{children}</a>;
 return <button type="button" className={className} onClick={()=>void openProvider(provider,returnTo)}>{children}</button>;
}

/** The Apple logo for the "Continue with Apple" button (Apple HIG: white mark on black). */
export function AppleMark({size=18}:{size?:number}){
 return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M16.37 12.74c-.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.77 2.28-1.61 2.79-.41 6.92 1.16 9.19.77 1.11 1.68 2.36 2.87 2.31 1.15-.05 1.59-.75 2.98-.75s1.78.75 3 .72c1.24-.02 2.03-1.13 2.78-2.25.88-1.28 1.24-2.53 1.26-2.59-.03-.01-2.41-.93-2.43-3.7zM14.1 5.98c.63-.77 1.06-1.84.94-2.9-.91.04-2.02.61-2.67 1.37-.58.68-1.1 1.77-.96 2.81 1.02.08 2.05-.52 2.69-1.28z"/></svg>;
}
/** Sign in with Apple through the iOS system sheet: start (nonce) → sheet → verify. With link the Apple ID joins the signed-in account. */
export async function appleNativeFlow(link=false):Promise<{ok:boolean;error?:string}>{
 const start=await post('/api/auth/apple',{step:'start'});
 if(!start.ok||!start.data.challengeId||!start.data.nonce)return {ok:false,error:start.data.error};
 const credential=await appleSignInNative({nonce:start.data.nonce});
 if(!credential)return {ok:false};
 const verify=await post('/api/auth/apple',{step:'verify',challengeId:start.data.challengeId,identityToken:credential.identityToken,authorizationCode:credential.authorizationCode,
  user:credential.givenName||credential.familyName?{givenName:credential.givenName,familyName:credential.familyName}:undefined,...(link?{link:true}:{})});
 return verify.ok?{ok:true}:{ok:false,error:verify.data.error};
}
/** "Continue with Apple": the system sheet on iOS inside the app, the web flow (system browser inside the Android app) elsewhere. */
export function AppleButton({methods,returnTo,label,link=false,className='btn apple',onDone,onError}:{methods:Methods;returnTo:string;label:string;link?:boolean;className?:string;onDone:()=>void;onError:(code?:string)=>void}){
 const [busy,setBusy]=useState(false);
 const native=nativePlatform()==='ios'&&!!methods.appleNative;
 async function run(){
  if(busy)return;setBusy(true);onError();
  if(native){
   const result=await appleNativeFlow(link);
   setBusy(false);
   if(result.ok)onDone();else if(result.error)onError(result.error);
   return;
  }
  const error=await openProvider('apple',returnTo,link);
  setBusy(false);
  if(error)onError(error);
 }
 if(!native&&!isNative())return <a className={className} href={providerPath('apple',returnTo,{link})}><AppleMark/>{label}</a>;
 return <button type="button" className={className} disabled={busy} onClick={()=>void run()}><AppleMark/>{label}</button>;
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
  queueMicrotask(()=>{setReturnTo(safeReturnTo(params.get('return_to')));const failed=params.get('error');if(failed==='google'||failed==='apple')setError(c.errors[failed])});
  fetch('/api/auth/methods',{credentials:'same-origin'}).then(response=>response.ok?response.json() as Promise<Methods>:Promise.reject(new Error(String(response.status)))).then(value=>{
   setMethods(value);
   // With Telegram, Google and Apple off and a single other method, its form opens at once.
   const others=(['phone','email'] as const).filter(key=>value[key]);
   setTab(!value.telegram&&!value.google&&!appleOffered(value)&&others.length===1?others[0]:null);
  }).catch(()=>setFailed(true));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 // Signed in by any method: the "signed in" screen shows at once while the page heads back.
 const [signedIn,setSignedIn]=useState(false);
 const done=useCallback(()=>{setSignedIn(true);window.location.replace(returnTo)},[returnTo]);
 useEffect(()=>{if(status==='authenticated')window.location.replace(returnTo)},[status,returnTo]);

 // Signed in: a check draws itself while the page heads back (app/motion.css, "Sign-in screens").
 if(status==='authenticated'||signedIn)return <section className="surface login-card login-done" role="status" aria-live="polite">
  <span className="login-done-mark" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="23"/><path d="M16 27l7 7 14-15"/></svg></span>
  <p>{c.signedIn}</p>
  <span className="login-done-bar" aria-hidden="true"/>
 </section>;
 const tabs=methods?([['telegram',!!methods.telegram],['phone',methods.phone],['email',methods.email],['google',methods.google],['apple',appleOffered(methods)]] as const).filter(([,enabled])=>enabled):[];
 const locale=(state.communication.language as Locale)??'ru',w=choiceCopy[locale]??choiceCopy.ru;
 return <section className="surface login-card">
  <span className="eyebrow">{c.eyebrow}</span><h1>{c.title}</h1><p className="login-intro">{c.intro}</p>
  {error&&<div className="notice error" role="alert">{error}</div>}
  {!methods&&!failed&&<div className="login-skeleton" role="status"><span className="sr-only">{c.loading}</span><i aria-hidden="true"/><b aria-hidden="true"/><i aria-hidden="true"/><i aria-hidden="true"/></div>}
  {(failed||(methods&&!tabs.length))&&<div className="notice" role="status">{c.none}</div>}
  {/* One method at a time: Telegram on top, the others as a column of buttons; phone and email open their form. */}
  {methods&&(tab===null||tab==='telegram'||tab==='google'||tab==='apple')?<div className="login-panel">
   {methods.telegram&&(methods.telegramBot?<TelegramBotLogin locale={locale} onDone={done} onError={showError}/>:<TelegramLogin bot={methods.telegram} hint={c.telegramHint} onDone={done} onError={showError}/>)}
   {methods.telegram&&tabs.length>1&&<div className="login-or" role="separator"><span>{w.or}</span></div>}
   <div className="login-choices">
    {methods.phone&&<button type="button" className="btn secondary login-choice" onClick={()=>{setTab('phone');setError(null)}}><Smartphone size={18} aria-hidden="true"/>{w.phone}</button>}
    {methods.email&&<button type="button" className="btn secondary login-choice" onClick={()=>{setTab('email');setError(null)}}><Mail size={18} aria-hidden="true"/>{w.email}</button>}
    {methods.google&&<ProviderLink provider="google" returnTo={returnTo} className="btn secondary login-choice"><GoogleMark/>{c.googleButton}</ProviderLink>}
    {appleOffered(methods)&&<AppleButton methods={methods} returnTo={returnTo} label={c.appleButton} className="btn login-choice apple" onDone={done} onError={showError}/>}
   </div>
  </div>:methods&&(tab==='phone'||tab==='email')&&<div className="login-panel">
   <button type="button" className="text-button login-back" onClick={()=>{setTab(null);setError(null)}}><ArrowLeft size={16} aria-hidden="true"/>{w.back}</button>
   <OtpLogin key={tab} channel={tab} c={c} dev={!!methods.devCodes} onDone={done} onError={showError}/>
  </div>}
  <small className="login-legal">{c.legal.before}<a href="/terms">{c.legal.terms}</a>{c.legal.and}<a href="/privacy">{c.legal.privacy}</a>{c.legal.after}</small>
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
  <button className="btn primary" type="submit" disabled={busy} aria-busy={busy}>{busy?c.sending:c.sendCode}{busy?<Loader2 className="spin" size={18} aria-hidden="true"/>:<ArrowRight size={18}/>}</button>
 </form>;
 return <form className="login-form" onSubmit={verify}>
  <p className="login-sent">{channel==='phone'?c.codeSentPhone:c.codeSentEmail} <b>{target.trim()}</b> <button type="button" className="text-button" onClick={()=>{setChallenge(null);onError()}}><ArrowLeft size={14}/>{c.change}</button></p>
  {dev&&devCode&&<div className="notice" role="status">{c.devCode}: <b>{devCode}</b></div>}
  <div className="field"><label htmlFor={'code-'+channel}>{c.codeLabel}</label>
   <input ref={codeInput} id={'code-'+channel} className="login-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} placeholder="000000"/></div>
  <button className="btn primary" type="submit" disabled={busy||code.length!==6} aria-busy={busy}>{busy?c.verifying:link?c.linkVerify:c.verify}{busy?<Loader2 className="spin" size={18} aria-hidden="true"/>:<ArrowRight size={18}/>}</button>
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

const botCopy=withCyrillic({
 ru:{button:'Войти через Telegram',linkButton:'Привязать Telegram',hint:'Откроется Telegram — подтвердите вход в чате с ботом Atlas.',waiting:'Подтвердите вход в Telegram и вернитесь сюда — страница откроется сама.',again:'Открыть Telegram ещё раз',web:'Не открылось? Открыть в браузере',preparing:'Готовим вход…'},
 uz:{button:'Telegram orqali kirish',linkButton:'Telegramni bog‘lash',hint:'Telegram ochiladi — Atlas boti bilan chatda kirishni tasdiqlang.',waiting:'Telegramda kirishni tasdiqlang va bu yerga qayting — sahifa o‘zi ochiladi.',again:'Telegramni yana ochish',web:'Ochilmadimi? Brauzerda ochish',preparing:'Kirish tayyorlanmoqda…'},
 en:{button:'Sign in with Telegram',linkButton:'Attach Telegram',hint:'Telegram opens — confirm in the chat with the Atlas bot.',waiting:'Confirm in Telegram and come back — this page opens by itself.',again:'Open Telegram again',web:'Did not open? Open in the browser',preparing:'Preparing sign-in…'},
}) satisfies Record<Locale,unknown>;
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
