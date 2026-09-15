'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {ArrowRight,LockKeyhole,ShieldCheck} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {signInPath,viewAccess} from '@/lib/market/access';

const copy={
 ru:{loading:'Проверяем вход…',title:'Ваши покупки — в одном кабинете',intro:'Войдите, чтобы сохранять товары, оформлять заказы и управлять документами.',signin:'Продолжить с ChatGPT',back:'Смотреть находки',denied:'Этот раздел доступен администратору',deniedHint:'В вашем аккаунте доступны покупки, заказы и личные документы.',retry:'Повторить',error:'Не удалось открыть кабинет',session:'Вход в Atlas',hint:'После входа вернём вас к выбранному действию.'},
 uz:{loading:'Kirish tekshirilmoqda…',title:'Xaridlaringiz bitta kabinetda',intro:'Mahsulotlarni saqlash, buyurtma berish va hujjatlarni boshqarish uchun kiring.',signin:'ChatGPT orqali davom etish',back:'Topilmalarni ko‘rish',denied:'Bu bo‘lim administrator uchun',deniedHint:'Siz xaridlar, buyurtmalar va shaxsiy hujjatlarni boshqarishingiz mumkin.',retry:'Qayta urinish',error:'Kabinet ochilmadi',session:'Atlasga kirish',hint:'Kirgandan so‘ng tanlangan amalga qaytasiz.'},
 en:{loading:'Checking your session…',title:'Your purchases, all in one account',intro:'Sign in to save finds, place orders and manage your documents.',signin:'Continue with ChatGPT',back:'Explore finds',denied:'This area is for administrators',deniedHint:'Your account provides access to purchases, orders and your personal documents.',retry:'Try again',error:'Could not open your account',session:'Sign in to Atlas',hint:'After signing in, you’ll return to your selected action.'},
};
export function AccessView({view,children}:{view:string;children:ReactNode}){
 const {status,user,state,error,refresh}=useMarket(),c=copy[state.communication.language];
 const access=viewAccess(view,status,!!user?.operator);
 const [returnTo,setReturnTo]=useState('/account');
 useEffect(()=>{queueMicrotask(()=>setReturnTo(window.location.pathname+window.location.search))},[]);
 if(access==='allow')return children;
 if(access==='loading')return <section className="surface access-card" role="status" aria-live="polite"><span className="access-spinner"/>{c.loading}</section>;
 return <section className="surface access-card" data-access={access}>
  <span className="access-icon">{access==='forbidden'?<ShieldCheck/>:<LockKeyhole/>}</span>
  <span className="eyebrow">{c.session}</span><h1>{access==='error'?c.error:access==='forbidden'?c.denied:c.title}</h1>
  <p>{access==='error'?error:access==='forbidden'?c.deniedHint:c.intro}</p>
  <div className="access-actions">{access==='signin'?<a className="btn primary" href={signInPath(returnTo)} target="_top">{c.signin}<ArrowRight size={18}/></a>:access==='error'?<button type="button" className="btn primary" onClick={()=>void refresh()}>{c.retry}</button>:null}<Link className="btn secondary" href="/">{c.back}</Link></div>
  {access==='signin'&&<small>{c.hint}</small>}
 </section>;
}
export function GuestIntro(){
 const {status,state}=useMarket();if(status!=='guest')return null;
 const c={ru:{tag:'ПОКУПКИ ИЗ ЗАРУБЕЖНЫХ МАГАЗИНОВ',title:'Находите выгоднее. Считайте с доставкой.',text:'Зарубежные магазины с расчётом доставки в Узбекистан.',explore:'Посмотреть предложения',signin:'Войти в Atlas'},uz:{tag:'XORIJIY DO‘KONLARDAN XARIDLAR',title:'Foydali toping. Yetkazish bilan hisoblang.',text:'Xorijiy do‘konlar, O‘zbekistonga yetkazish hisobi bilan.',explore:'Takliflarni ko‘rish',signin:'Atlasga kirish'},en:{tag:'SHOPPING FROM STORES ABROAD',title:'Find better value. Include delivery.',text:'Shop international stores with delivery estimates to Uzbekistan.',explore:'Explore offers',signin:'Sign in to Atlas'}}[state.communication.language];
 return <section className="guest-intro"><span className="eyebrow">{c.tag}</span><h1>{c.title}</h1><p>{c.text}</p></section>;
}
