'use client';
import {useEffect,useRef} from 'react';
import {ArrowUpRight} from 'lucide-react';
import type {Locale} from '@/lib/market/i18n';
import {withCyrillic} from '@/lib/market/uz-cyrl';

const copy=/*@__PURE__*/withCyrillic({
 ru:{title:'Возвращаемся в приложение Atlas…',hint:'Если приложение не открылось само, нажмите кнопку.',open:'Открыть Atlas',invalidTitle:'Ссылка для входа устарела',invalid:'Вернитесь в приложение Atlas и войдите ещё раз — или войдите здесь, на сайте.',signin:'Войти на сайте'},
 uz:{title:'Atlas ilovasiga qaytmoqdamiz…',hint:'Ilova o‘zi ochilmasa, tugmani bosing.',open:'Atlasni ochish',invalidTitle:'Kirish havolasi eskirgan',invalid:'Atlas ilovasiga qaytib, qaytadan kiring — yoki shu yerda, saytda kiring.',signin:'Saytda kirish'},
 en:{title:'Returning to the Atlas app…',hint:'If the app did not open by itself, press the button.',open:'Open Atlas',invalidTitle:'This sign-in link has expired',invalid:'Go back to the Atlas app and sign in again — or sign in here on the website.',signin:'Sign in on the website'},
}) satisfies Record<Locale,unknown>;

/** Opens uz.atlasmarket.app://auth?code=… once and keeps a visible link as the fallback. */
export function AuthReturnView({locale,appUrl}:{locale:Locale;appUrl:string|null}){
 const c=copy[locale]??copy.ru;
 const opened=useRef(false);
 useEffect(()=>{
  if(!appUrl||opened.current)return;
  opened.current=true;
  const timer=setTimeout(()=>{window.location.href=appUrl},50);
  return ()=>clearTimeout(timer);
 },[appUrl]);
 return <main className="login-return">
  <section className="surface login-card login-return-card" role="status" aria-live="polite">
   <span className="wordmark" aria-hidden="true">atlas<ArrowUpRight aria-hidden="true"/></span>
   {appUrl?<>
    <span className="atlas-loader" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg></span>
    <h1>{c.title}</h1>
    <p className="login-intro">{c.hint}</p>
    <a className="btn primary" href={appUrl}>{c.open}</a>
   </>:<>
    <h1>{c.invalidTitle}</h1>
    <p className="login-intro">{c.invalid}</p>
    <a className="btn primary" href="/login">{c.signin}</a>
   </>}
  </section>
 </main>;
}
