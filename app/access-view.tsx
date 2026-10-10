'use client';
import {useEffect,useLayoutEffect,useRef,type ReactNode} from 'react';
import {LockKeyhole,ShieldCheck} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {hasStaffAccess,signInPath,viewAccess} from '@/lib/market/access';
import {withCyrillic} from '@/lib/market/uz-cyrl';
import {LoadingCards} from './market-ui';

const copy=/*@__PURE__*/withCyrillic({
 ru:{loading:'Проверяем вход…',back:'На главную',denied:'Этот раздел доступен сотрудникам Atlas',deniedHint:'В вашем аккаунте доступны покупки, заказы и личные документы.',roleDenied:'У вашей роли нет доступа к этому разделу',roleDeniedHint:'Доступ к разделам задаёт администратор во вкладке «Команда». Если раздел нужен для работы, попросите расширить роль.',retry:'Повторить',error:'Не удалось открыть кабинет',session:'Вход в Atlas'},
 uz:{loading:'Kirish tekshirilmoqda…',back:'Bosh sahifaga',denied:'Bu bo‘lim Atlas xodimlari uchun',deniedHint:'Siz xaridlar, buyurtmalar va shaxsiy hujjatlarni boshqarishingiz mumkin.',roleDenied:'Sizning rolingizda bu bo‘limga ruxsat yo‘q',roleDeniedHint:'Bo‘limlarga ruxsatni administrator «Jamoa» bo‘limida belgilaydi. Bo‘lim ish uchun kerak bo‘lsa, rolni kengaytirishni so‘rang.',retry:'Qayta urinish',error:'Kabinet ochilmadi',session:'Atlasga kirish'},
 en:{loading:'Checking your session…',back:'Go to the home page',denied:'This area is for Atlas staff',deniedHint:'Your account provides access to purchases, orders and your personal documents.',roleDenied:'Your role does not include this section',roleDeniedHint:'An administrator sets section access in the Team tab. Ask to extend your role if you need it for work.',retry:'Try again',error:'Could not open your account',session:'Sign in to Atlas'},
});
export function AccessView({view,children}:{view:string;children:ReactNode}){
 const {status,user,state,error,refresh,sessionHint}=useMarket(),c=copy[state.communication.language];
 const access=viewAccess(view,status,{operator:!!user?.operator,permissions:user?.permissions});
 // A staff member whose role lacks this section sees a role message, not "administrators only".
 const roleDenied=access==='forbidden'&&hasStaffAccess({operator:!!user?.operator,permissions:user?.permissions});
 // When the page arrives after the account loads, its blocks rise in once (#main.access-arrived, app/motion.css).
 const before=useRef(access);
 useLayoutEffect(()=>{
  const was=before.current;before.current=access;
  if(access!=='allow'||was!=='loading')return;
  const main=document.getElementById('main');if(!main)return;
  main.classList.add('access-arrived');
  const timer=window.setTimeout(()=>main.classList.remove('access-arrived'),1000);
  return ()=>{window.clearTimeout(timer);main.classList.remove('access-arrived')};
 },[access]);
 // A guest on a private page goes straight to sign-in (and comes back here after it) instead of a "please sign in" card.
 // Without a session cookie (sign-in is cookie-only) there is nothing to wait for, so it goes before /api/account answers.
 const toSignIn=access==='signin'||(access==='loading'&&!sessionHint);
 useEffect(()=>{if(toSignIn)window.location.replace(signInPath(window.location.pathname+window.location.search+window.location.hash))},[toSignIn]);
 if(access==='allow')return children;
 // Page-shaped placeholders instead of a "checking your session" card; they only show if the answer takes a moment.
 if(access==='loading'||access==='signin')return view==='account'?<AccountSkeleton label={c.loading}/>:<div className="access-loading"><LoadingCards label={c.loading} rows={4}/></div>;
 // Only a failed session check or a role without access gets a card; a guest has already been sent to sign-in.
 return <section className="surface access-card" data-access={access}>
  <span className="access-icon">{access==='forbidden'?<ShieldCheck/>:<LockKeyhole/>}</span>
  <span className="eyebrow">{c.session}</span><h1>{access==='error'?c.error:roleDenied?c.roleDenied:c.denied}</h1>
  <p>{access==='error'?error:roleDenied?c.roleDeniedHint:c.deniedHint}</p>
  <div className="access-actions">{access==='error'&&<button type="button" className="btn primary" onClick={()=>void refresh()}>{c.retry}</button>}<Link className="btn secondary" href="/">{c.back}</Link></div>
 </section>;
}

/** The account's outline (title, the "needs attention" card, four tiles, the side column) while the session is checked. */
function AccountSkeleton({label}:{label:string}){
 const lines=<><b/><b/><b/></>;
 return <div className="access-loading account-skeleton" role="status" aria-live="polite"><span className="sr-only">{label}</span>
  <div className="sk-head" aria-hidden="true"><i/><span><b/><b/></span></div>
  <div className="sk-grid" aria-hidden="true">
   <div className="sk-col"><div className="sk-card tall">{lines}</div><div className="sk-tiles">{[0,1,2,3].map(key=><div key={key} className="sk-card"><i/><b/></div>)}</div><div className="sk-card">{lines}</div></div>
   <div className="sk-col"><div className="sk-card tall">{lines}</div><div className="sk-card">{lines}</div></div>
  </div>
 </div>;
}
