'use client';
import {Suspense,lazy,useEffect,useLayoutEffect,useMemo,useState,useSyncExternalStore,type ReactNode} from 'react';
import Link,{useWarmLinks} from '@/components/site-link';
import {ArrowUpRight,ArrowRight,Package,Wallet,ShoppingBag,Heart,LayoutGrid,Settings2,House,Store,LogIn,UserRound,MessageCircle} from 'lucide-react';
import {ToasterSlot} from './toaster-slot';
import {money,balanceOf} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {loadChunk} from '@/lib/market/stale-build';
import {AccessView} from './access-view';
import {navCopy,routeTitle,ui,type Locale} from '@/lib/market/i18n';
import {useTheme} from 'next-themes';
import {ThemeToggle} from './theme-control';
import {HeaderLanguage} from './header-language';
import {NotificationsPanel} from './notifications-panel';
import {SiteFooter} from './site-footer';
import {HomeDecorSlot,HomeRailSlot} from './home-wide';
import {HomeMagnet} from './home-magnet';
import {marketplaceWords} from './marketplace-words';
import {signInPath} from '@/lib/market/access';
import {pickLocale,uzText,withCyrillic} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';
import {breadcrumbs,publicViewPaths} from '@/lib/seo/structured-data';
import {JsonLd} from './json-ld';

const breadcrumbLabel:Record<Locale,string>=/*@__PURE__*/withCyrillic({uz:'Sahifa yo‘li',ru:'Путь по сайту',en:'Breadcrumb'});
const returnPath=()=>typeof window==='undefined'?'/':window.location.pathname+window.location.search;

// Page shell shared by every route: header, breadcrumb, footer and the members' bottom bar.
// Each page passes its own view as children, so a route only loads the code it renders and
// the server HTML carries the view in place (no lazy chunk, no hidden Suspense segment).
/** The page's view on <html data-view>, so page-wide CSS can be scoped to a page without html:has(main…): Chrome
 * re-checks such a :has() on every DOM insertion, and the home's ~350 rules cost 10–40 ms per change (7.10.2026).
 * The inline script sets it while the server HTML is parsed (before the first paint); the effect keeps it right
 * across client navigations, and lets the next page rise in when it replaces the previous one in place
 * (#main.view-entered, app/motion.css); the first page of a visit is drawn by the browser as it comes. */
let shownView:string|null=null;
function ViewMark({view}:{view:string}){
 useLayoutEffect(()=>{
  const html=document.documentElement;html.dataset.view=view;
  const changed=shownView!==null&&shownView!==view;shownView=view;
  const main=changed?document.getElementById('main'):null;
  let timer=0;
  // Every page renders its own <main>, so the class is new on it: no forced reflow to restart the animation.
  if(main){main.classList.add('view-entered');timer=window.setTimeout(()=>main.classList.remove('view-entered'),700)}
  return ()=>{window.clearTimeout(timer);main?.classList.remove('view-entered');if(html.dataset.view===view)delete html.dataset.view};
 },[view]);
 return <script dangerouslySetInnerHTML={{__html:`document.documentElement.dataset.view=${JSON.stringify(view)}`}}/>;
}

/** The header's last balance and cart count of this tab; read only on the client (the server renders without it). */
const subscribeNever=()=>()=>{};
// The closing card is home-only: a separate chunk, so other pages do not load the home sections and their copy.
// On the home page the chunk is already loaded by the page itself (app/home-catalog.tsx).
const HomeClosing=lazy(()=>loadChunk(()=>import('./home-sections')).then(module=>({default:module.HomeClosing})));
function readSavedHeader(){try{return sessionStorage.getItem('atlas-header')}catch{return null}}

export default function Marketplace({view,children}:{view:string;children?:ReactNode}) {
  const {state,ready,status,error,user,refresh,setLocale,sessionHint,siteContent}=useMarket();
  const supportBot=siteContent.contacts.telegramSupport;
  const {theme}=useTheme();
  const locale=state.communication.language as Locale,words=ui(locale);
  const modalWords=marketplaceWords(locale);
  const count=state.cart.reduce((s,i)=>s+i.quantity,0),balance=balanceOf(state);
  const hc={nav:navCopy[locale]};
  // The notifications panel belongs to the page it was opened on: moving to another page closes it.
  const [noticesFor,setNoticesFor]=useState<string|null>(null);
  const noticesOpen=noticesFor===view,setNoticesOpen=(open:boolean)=>setNoticesFor(open?view:null);
  // A new tab or a full page load gets the account a moment after the page appears. Until it does, the header keeps
  // the member items with the last balance and cart count of this tab (sessionStorage), instead of blinking them out.
  const savedHeader=useSyncExternalStore(subscribeNever,readSavedHeader,()=>null);
  const snapshot=useMemo(()=>{try{const saved=JSON.parse(savedHeader??'null');return saved&&typeof saved.balance==='number'&&typeof saved.count==='number'?saved as {balance:number;count:number}:null}catch{return null}},[savedHeader]);
  useEffect(()=>{try{if(ready)sessionStorage.setItem('atlas-header',JSON.stringify({balance,count}));else if(status==='guest')sessionStorage.removeItem('atlas-header')}catch{}},[ready,status,balance,count]);
  // A session cookie alone (a new tab) gives the member header too, just without the numbers until the account answers.
  const member=ready||(status==='loading'&&(!!snapshot||sessionHint)),known=ready||!!snapshot;
  const shownBalance=ready?balance:snapshot?.balance??0,shownCount=ready?count:snapshot?.count??0;
  // On phones the amount is hidden and the icon alone named nothing for screen readers.
  const walletAmount=known?(locale==='ru'?money(shownBalance):new Intl.NumberFormat(isUzbek(locale)?uzText(locale, 'uz-UZ'):'en-US').format(shownBalance)+(isUzbek(locale)?uzText(locale, ' so‘m'):' UZS')):'';
  const walletLabel=(locale==='ru'?'Баланс':locale==='en'?'Balance':uzText(locale, 'Balans'))+(walletAmount?`: ${walletAmount}`:'');
  const tabs=member?[['/','catalog',House,words.home],['/catalog','products',LayoutGrid,words.catalog],['/orders','orders',Package,pickLocale({ru:'Заказы',uz:'Buyurtmalar',en:'Orders'}, locale)],['/cart','cart',ShoppingBag,words.cart],['/account','account',UserRound,words.account]]:[['/','catalog',House,words.home],['/catalog','products',LayoutGrid,words.catalog],['/stores','stores',Store,hc.nav.stores],[signInPath(view==='login'?'/':returnPath()),'login',LogIn,hc.nav.signin]];
  // The other tabs are fetched while the phone is idle, so a tap on one opens it at once.
  useWarmLinks(tabs.filter(tab=>tab[1]!==view&&tab[1]!=='login').map(tab=>tab[0] as string));
  const navItems:[string,string,string][]=[['/catalog','products',hc.nav.catalog],['/stores','stores',hc.nav.stores],['/#how','how',hc.nav.how],['/#tariffs','tariffs',hc.nav.tariffs],...(member?[['/orders','orders',hc.nav.orders] as [string,string,string]]:[])];
  return <><ViewMark view={view}/><a className="skip-link" href="#main">{modalWords.skip}</a><ToasterSlot theme={theme==='dark'?'dark':theme==='light'?'light':'system'}/>
  <header className="site-header"><Link className="wordmark" href="/" aria-label={modalWords.homeLabel}>atlas<ArrowUpRight aria-hidden="true"/></Link><nav className="desktop-nav" aria-label={modalWords.navigation}>{navItems.map(([href,key,label])=><Link key={key} data-nav={key} className={key===view?'active':''} aria-current={key===view?'page':undefined} href={href}>{label}</Link>)}</nav><div className="header-actions">{(user?.operator||!!user?.permissions?.length)&&<Link className="operator-entry text-link" href="/admin"><Settings2 size={16}/>{modalWords.manage}</Link>}<HeaderLanguage locale={locale} label={hc.nav.language} onChange={setLocale}/><span className="header-theme"><ThemeToggle locale={locale}/></span>{/* Help in one tap, only once the owner has set the support bot (admin, «Контент сайта»). */}{supportBot&&<a className="header-help" href={`https://t.me/${supportBot}`} target="_blank" rel="noopener noreferrer" aria-label={`${hc.nav.help} — Telegram`}><MessageCircle size={18} aria-hidden="true"/><span>{hc.nav.help}</span></a>}{member&&<><Link href="/balance" className="wallet-link" aria-label={walletLabel}><Wallet size={19} aria-hidden="true"/><span>{walletAmount}</span></Link><NotificationsPanel open={noticesOpen} onOpenChange={setNoticesOpen} label={modalWords.notifications} active={view==='notifications'}/><Link aria-label={modalWords.favorites} href="/favorites" className={'icon-btn desktop-only '+(view==='favorites'?'active':'')}><Heart size={20}/></Link><Link href="/cart" className="cart-link" aria-label={modalWords.cart+(known?shownCount:'')}><ShoppingBag size={19}/><span className="desktop-only">{words.cart}</span>{known&&<b>{shownCount}</b>}</Link></>}{user||member?<Link className="header-account member" href="/account">{hc.nav.account}</Link>
   // A guest goes straight to sign-in and comes back to this page (the href is set on click, so the server and the browser render the same link).
   :<a className="header-account" href={signInPath('/account')} onClick={event=>{event.currentTarget.href=signInPath(view==='login'?'/':returnPath())}}>{hc.nav.signin}</a>}</div></header>
  {/* Wide screens: the chapter rail after the header (Tab: header → rail → main; the skip link passes it), lazily loaded. */}
  {view==='catalog'&&<HomeRailSlot/>}{view==='catalog'&&<HomeMagnet/>}
  <main className={view==='catalog'?'site-main catalog-home':'site-main'} id="main" data-view={view}>{publicViewPaths[view]&&<JsonLd data={breadcrumbs(locale,publicViewPaths[view],routeTitle(locale,view))}/>}{view!=='catalog'&&<nav className="breadcrumb" aria-label={breadcrumbLabel[locale]}><Link href="/">{words.home}</Link><span aria-hidden="true">/</span><span aria-current="page">{routeTitle(state.communication.language,view)}</span></nav>}{error&&view==='catalog'&&<div className="notice error account-error" role="alert"><span>{error}</span><div><button type="button" className="text-button" onClick={()=>void refresh()}>{words.retry}</button>{!user&&<Link className="text-link" href="/account">{words.openSignIn}<ArrowRight size={15}/></Link>}</div></div>}
  <AccessView view={view}>{children}</AccessView>
   {/* Home: the closing call and the footer share the last sheet (app/home-chapters.css). */}
   {view==='catalog'?<div className="home-end" data-chapter="end"><Suspense fallback={null}><HomeClosing/></Suspense><SiteFooter/></div>:<SiteFooter/>}
   {/* Wide screens: the decor behind the sheets (app/home-decor.tsx), the last child of main. */}
   {view==='catalog'&&<HomeDecorSlot/>}</main>
  {/* Phones: one bottom bar for everyone (guests get sign-in in it); hidden while the session is checked. */}
  {(status!=='loading'||member)&&<nav className={'mobile-nav '+(member?'member':'guest')} aria-label={modalWords.navigation}>{tabs.map(([href,key,Icon,label])=>{const I=Icon as typeof LayoutGrid;return <Link href={href as string} key={key as string} className={key===view?'active':''} aria-current={key===view?'page':undefined}><I size={21} aria-hidden="true"/><span>{label as string}</span>{key==='cart'&&shownCount>0&&<b>{shownCount}</b>}</Link>})}</nav>}
</>;
}
