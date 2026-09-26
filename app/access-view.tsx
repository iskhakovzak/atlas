'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {ArrowRight,ArrowUpRight,LockKeyhole,ShieldCheck} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {signInPath,viewAccess} from '@/lib/market/access';
import {defaultDealFilters,filterDeals} from '@/lib/market/deals';
import {ProductImage} from './market-ui';
import type {Product} from '@/lib/market/domain';

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
export function GuestIntro({select}:{select:(product:Product)=>void}){
 const {status,state,catalogProducts,pricing}=useMarket();if(status!=='guest')return null;
 const c={ru:{tag:'ЗАРУБЕЖНЫЕ МАГАЗИНЫ · ДОСТАВКА В УЗБЕКИСТАН',title:'Покупки за рубежом. Итог виден заранее.',text:'Выберите товар в каталоге или добавьте ссылку из магазина. Предварительный расчёт с доставкой увидите до оформления.',explore:'Смотреть каталог',link:'Добавить свою ссылку',showcase:'Из каталога',fallback:'Найдите товар в каталоге или добавьте ссылку из зарубежного магазина.'},uz:{tag:'XORIJIY DO‘KONLAR · O‘ZBEKISTONGA YETKAZISH',title:'Chet eldan xarid. Umumiy narx oldindan ko‘rinadi.',text:'Katalogdan tanlang yoki do‘kon havolasini qo‘shing. Yetkazish bilan dastlabki hisobni rasmiylashtirishdan oldin ko‘ring.',explore:'Katalogni ko‘rish',link:'O‘z havolangizni qo‘shing',showcase:'Katalogdan',fallback:'Katalogdan tovar toping yoki xorijiy do‘kon havolasini qo‘shing.'},en:{tag:'GLOBAL STORES · DELIVERY TO UZBEKISTAN',title:'Shop abroad. See the full estimate.',text:'Choose from the catalog or add a store link. Review the delivery estimate before ordering.',explore:'Explore catalog',link:'Add your own link',showcase:'From the catalog',fallback:'Find a product in the catalog or add a link from an international store.'}}[state.communication.language];
 const choices=filterDeals(catalogProducts.filter(product=>product.image&&product.sourceUrl),pricing,defaultDealFilters,catalogProducts).map(({product})=>product).reduce<Product[]>((picked,product)=>{if(picked.length<2&&!picked.some(item=>item.category===product.category))picked.push(product);return picked},[]);
 return <section className="guest-intro"><div className="guest-intro-copy"><span className="eyebrow">{c.tag}</span><h1>{c.title}</h1><p>{c.text}</p><div className="guest-intro-actions"><a className="btn primary" href="#finds">{c.explore}<ArrowRight size={18}/></a><Link className="guest-intro-link" href="/order-by-link">{c.link}<ArrowUpRight size={16}/></Link></div></div><div className="guest-intro-showcase" aria-label={c.showcase}>{choices.length?choices.map(product=><button type="button" key={product.id} className="guest-intro-product" onClick={()=>select(product)}><span className="guest-intro-photo"><ProductImage product={product} decorative locale={state.communication.language}/></span><span className="guest-intro-product-info"><strong>{product.brand||product.name}</strong><span>{product.name}</span></span><ArrowUpRight size={17} aria-hidden="true"/></button>):<div className="guest-intro-fallback">{c.fallback}</div>}</div></section>;
}
