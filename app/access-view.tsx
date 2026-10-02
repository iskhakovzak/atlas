'use client';
import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowDown,ArrowRight,ArrowUpRight,LockKeyhole,ShieldCheck} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {signInPath,viewAccess} from '@/lib/market/access';
import {defaultDealFilters,filterDeals} from '@/lib/market/deals';
import {ProductImage} from './market-ui';
import {validateSource,type Product} from '@/lib/market/domain';

const copy={
 ru:{loading:'Проверяем вход…',title:'Ваши покупки — в одном кабинете',intro:'Войдите, чтобы сохранять товары, оформлять заказы и управлять документами.',signin:'Войти или зарегистрироваться',back:'Смотреть находки',denied:'Этот раздел доступен администратору',deniedHint:'В вашем аккаунте доступны покупки, заказы и личные документы.',retry:'Повторить',error:'Не удалось открыть кабинет',session:'Вход в Atlas',hint:'После входа вернём вас к выбранному действию.'},
 uz:{loading:'Kirish tekshirilmoqda…',title:'Xaridlaringiz bitta kabinetda',intro:'Mahsulotlarni saqlash, buyurtma berish va hujjatlarni boshqarish uchun kiring.',signin:'Kirish yoki ro‘yxatdan o‘tish',back:'Topilmalarni ko‘rish',denied:'Bu bo‘lim administrator uchun',deniedHint:'Siz xaridlar, buyurtmalar va shaxsiy hujjatlarni boshqarishingiz mumkin.',retry:'Qayta urinish',error:'Kabinet ochilmadi',session:'Atlasga kirish',hint:'Kirgandan so‘ng tanlangan amalga qaytasiz.'},
 en:{loading:'Checking your session…',title:'Your purchases, all in one account',intro:'Sign in to save finds, place orders and manage your documents.',signin:'Sign in or sign up',back:'Explore finds',denied:'This area is for administrators',deniedHint:'Your account provides access to purchases, orders and your personal documents.',retry:'Try again',error:'Could not open your account',session:'Sign in to Atlas',hint:'After signing in, you’ll return to your selected action.'},
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
// Home hero for every visitor: the main scenario is "paste a store link → see the total".
// It renders on the server too, so the first screen and crawlers both get it.
export function HomeIntro({select}:{select:(product:Product)=>void}){
 const {status,state,catalogProducts,pricing}=useMarket();
 const [url,setUrl]=useState('');
 const [urlError,setUrlError]=useState('');
 const c={ru:{tag:'ЗАРУБЕЖНЫЕ МАГАЗИНЫ · ДОСТАВКА В УЗБЕКИСТАН',title:'Покупки в зарубежных магазинах с доставкой в Узбекистан',text:'Вставьте ссылку на товар из Amazon, Nike, Zara или другого магазина — покажем итог в сумах. Товар, сервис и доставка отдельными строками.',label:'Ссылка на товар',placeholder:'Вставьте ссылку на товар',calculate:'Рассчитать',guestNote:'Расчёт бесплатный и без входа. Войти понадобится только для оформления заказа.',memberNote:'Расчёт бесплатный и ни к чему не обязывает.',explore:'Или выберите товар в каталоге',batch:'Несколько ссылок сразу',showcase:'Из каталога',fallback:'Найдите товар в каталоге или вставьте ссылку из зарубежного магазина.'},uz:{tag:'XORIJIY DO‘KONLAR · O‘ZBEKISTONGA YETKAZISH',title:'Xorijiy do‘konlardan O‘zbekistonga yetkazib berish bilan xaridlar',text:'Amazon, Nike, Zara yoki boshqa do‘kondagi tovar havolasini qo‘ying — yakuniy narxni so‘mda ko‘rsatamiz. Tovar, xizmat va yetkazish alohida satrlarda.',label:'Tovar havolasi',placeholder:'Tovar havolasini qo‘ying',calculate:'Hisoblash',guestNote:'Hisoblash bepul va kirishsiz. Kirish faqat buyurtma berishda kerak bo‘ladi.',memberNote:'Hisoblash bepul va hech narsaga majburlamaydi.',explore:'Yoki katalogdan tanlang',batch:'Bir nechta havola',showcase:'Katalogdan',fallback:'Katalogdan tovar toping yoki xorijiy do‘kon havolasini qo‘ying.'},en:{tag:'GLOBAL STORES · DELIVERY TO UZBEKISTAN',title:'Shop international stores with delivery to Uzbekistan',text:'Paste a product link from Amazon, Nike, Zara or another store — we show the total in soum. Item, service and delivery on separate lines.',label:'Product link',placeholder:'Paste a product link',calculate:'Calculate',guestNote:'The estimate is free and needs no sign-in. You only sign in to place the order.',memberNote:'The estimate is free and commits you to nothing.',explore:'Or choose from the catalog',batch:'Several links at once',showcase:'From the catalog',fallback:'Find a product in the catalog or paste a link from an international store.'}}[state.communication.language];
 const choices=filterDeals(catalogProducts.filter(product=>product.image&&product.sourceUrl),pricing,defaultDealFilters,catalogProducts).map(({product})=>product).reduce<Product[]>((picked,product)=>{if(picked.length<2&&!picked.some(item=>item.category===product.category))picked.push(product);return picked},[]);
 function submit(event:FormEvent){
  event.preventDefault();
  try{const target=validateSource(url);setUrlError('');window.location.assign('/order-by-link?url='+encodeURIComponent(target))}
  catch(error){setUrlError((error as Error).message)}
 }
 return <section className="guest-intro"><div className="guest-intro-copy"><span className="eyebrow">{c.tag}</span><h1>{c.title}</h1><p>{c.text}</p>
  <form className="hero-link-form" onSubmit={submit}><label className="sr-only" htmlFor="finds-product-url">{c.label}</label><input id="finds-product-url" type="url" inputMode="url" required value={url} aria-invalid={!!urlError} aria-describedby={urlError?'hero-url-error':'hero-url-note'} placeholder={c.placeholder} onChange={event=>{setUrl(event.target.value);setUrlError('')}}/><button className="btn primary" type="submit">{c.calculate}<ArrowRight size={18}/></button></form>
  {urlError?<p id="hero-url-error" className="hero-link-error" role="alert">{urlError}</p>:<p id="hero-url-note" className="hero-link-note">{status==='authenticated'?c.memberNote:c.guestNote}</p>}
  <div className="guest-intro-actions"><a className="guest-intro-link" href="#finds">{c.explore}<ArrowDown size={16}/></a>{status==='authenticated'&&<Link className="guest-intro-link" href="/batch-import">{c.batch}<ArrowUpRight size={16}/></Link>}</div>
 </div><div className="guest-intro-showcase" aria-label={c.showcase}>{choices.length?choices.map(product=><button type="button" key={product.id} className="guest-intro-product" onClick={()=>select(product)}><span className="guest-intro-photo"><ProductImage product={product} decorative locale={state.communication.language}/></span><span className="guest-intro-product-info"><strong>{product.brand||product.name}</strong><span>{product.name}</span></span><ArrowUpRight size={17} aria-hidden="true"/></button>):<div className="guest-intro-fallback">{c.fallback}</div>}</div></section>;
}
