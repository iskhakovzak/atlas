'use client';
import {useEffect,useRef} from 'react';
import type {Locale} from '@/lib/market/i18n';
import {withCyrillic} from '@/lib/market/uz-cyrl';

const copy=/*@__PURE__*/withCyrillic({
 ru:{title:'Возвращаемся в приложение Atlas…',hint:'Если приложение не открылось само, нажмите кнопку.',open:'Открыть Atlas',invalid:'Ссылка для входа устарела. Вернитесь в приложение и войдите ещё раз.'},
 uz:{title:'Atlas ilovasiga qaytmoqdamiz…',hint:'Ilova o‘zi ochilmasa, tugmani bosing.',open:'Atlasni ochish',invalid:'Kirish havolasi eskirgan. Ilovaga qaytib, qaytadan kiring.'},
 en:{title:'Returning to the Atlas app…',hint:'If the app did not open by itself, press the button.',open:'Open Atlas',invalid:'This sign-in link has expired. Go back to the app and sign in again.'},
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
   <span className="wordmark" aria-hidden="true">Atlas</span>
   {appUrl?<>
    <span className="atlas-loader" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg></span>
    <h1>{c.title}</h1>
    <p className="login-intro">{c.hint}</p>
    <a className="btn primary" href={appUrl}>{c.open}</a>
   </>:<>
    <h1>Atlas</h1>
    <p className="login-intro">{c.invalid}</p>
   </>}
  </section>
 </main>;
}
