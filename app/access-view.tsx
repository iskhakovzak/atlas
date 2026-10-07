'use client';
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {ArrowRight,LockKeyhole,ShieldCheck} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {hasStaffAccess,signInPath,viewAccess} from '@/lib/market/access';
import {withCyrillic} from '@/lib/market/uz-cyrl';
import {LoadingCards} from './market-ui';

const copy=withCyrillic({
 ru:{loading:'Проверяем вход…',title:'Ваши покупки — в одном кабинете',intro:'Войдите, чтобы сохранять товары, оформлять заказы и управлять документами.',signin:'Войти или зарегистрироваться',back:'Смотреть находки',denied:'Этот раздел доступен сотрудникам Atlas',deniedHint:'В вашем аккаунте доступны покупки, заказы и личные документы.',roleDenied:'У вашей роли нет доступа к этому разделу',roleDeniedHint:'Доступ к разделам задаёт администратор во вкладке «Команда». Если раздел нужен для работы, попросите расширить роль.',retry:'Повторить',error:'Не удалось открыть кабинет',session:'Вход в Atlas',hint:'После входа вернём вас к выбранному действию.'},
 uz:{loading:'Kirish tekshirilmoqda…',title:'Xaridlaringiz bitta kabinetda',intro:'Mahsulotlarni saqlash, buyurtma berish va hujjatlarni boshqarish uchun kiring.',signin:'Kirish yoki ro‘yxatdan o‘tish',back:'Topilmalarni ko‘rish',denied:'Bu bo‘lim Atlas xodimlari uchun',deniedHint:'Siz xaridlar, buyurtmalar va shaxsiy hujjatlarni boshqarishingiz mumkin.',roleDenied:'Sizning rolingizda bu bo‘limga ruxsat yo‘q',roleDeniedHint:'Bo‘limlarga ruxsatni administrator «Jamoa» bo‘limida belgilaydi. Bo‘lim ish uchun kerak bo‘lsa, rolni kengaytirishni so‘rang.',retry:'Qayta urinish',error:'Kabinet ochilmadi',session:'Atlasga kirish',hint:'Kirgandan so‘ng tanlangan amalga qaytasiz.'},
 en:{loading:'Checking your session…',title:'Your purchases, all in one account',intro:'Sign in to save finds, place orders and manage your documents.',signin:'Sign in or sign up',back:'Explore finds',denied:'This area is for Atlas staff',deniedHint:'Your account provides access to purchases, orders and your personal documents.',roleDenied:'Your role does not include this section',roleDeniedHint:'An administrator sets section access in the Team tab. Ask to extend your role if you need it for work.',retry:'Try again',error:'Could not open your account',session:'Sign in to Atlas',hint:'After signing in, you’ll return to your selected action.'},
});
export function AccessView({view,children}:{view:string;children:ReactNode}){
 const {status,user,state,error,refresh}=useMarket(),c=copy[state.communication.language];
 const access=viewAccess(view,status,{operator:!!user?.operator,permissions:user?.permissions});
 // A staff member whose role lacks this section sees a role message, not "administrators only".
 const roleDenied=access==='forbidden'&&hasStaffAccess({operator:!!user?.operator,permissions:user?.permissions});
 const [returnTo,setReturnTo]=useState('/account');
 useEffect(()=>{queueMicrotask(()=>setReturnTo(window.location.pathname+window.location.search))},[]);
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
 if(access==='allow')return children;
 // Page-shaped placeholders instead of a "checking your session" card; they only show if the answer takes a moment.
 if(access==='loading')return view==='account'?<AccountSkeleton label={c.loading}/>:<div className="access-loading"><LoadingCards label={c.loading} rows={4}/></div>;
 return <section className="surface access-card" data-access={access}>
  <span className="access-icon">{access==='forbidden'?<ShieldCheck/>:<LockKeyhole/>}</span>
  <span className="eyebrow">{c.session}</span><h1>{access==='error'?c.error:access==='forbidden'?(roleDenied?c.roleDenied:c.denied):c.title}</h1>
  <p>{access==='error'?error:access==='forbidden'?(roleDenied?c.roleDeniedHint:c.deniedHint):c.intro}</p>
  <div className="access-actions">{access==='signin'?<a className="btn primary" href={signInPath(returnTo)} target="_top">{c.signin}<ArrowRight size={18}/></a>:access==='error'?<button type="button" className="btn primary" onClick={()=>void refresh()}>{c.retry}</button>:null}<Link className="btn secondary" href="/">{c.back}</Link></div>
  {access==='signin'&&<small>{c.hint}</small>}
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
