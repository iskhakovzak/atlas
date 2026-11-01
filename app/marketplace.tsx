'use client';
import {Suspense,lazy,useEffect,useLayoutEffect,useMemo,useState,useSyncExternalStore,type MouseEvent,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import Link,{useWarmLinks} from '@/components/site-link';
import {ArrowUpRight,ArrowRight,ShoppingBag,Heart,LayoutGrid,Settings2,House,UserRound,MessageCircle,Plus,Search} from 'lucide-react';
import {ToasterSlot} from './toaster-slot';
import {money,balanceOf} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {loadChunk} from '@/lib/market/stale-build';
import {AccessView} from './access-view';
import {navCopy,routeTitle,ui,type Locale,type NavCopy} from '@/lib/market/i18n';
import {useTheme} from 'next-themes';
import {HeaderLanguage} from './header-language';
import {NotificationsPanel} from './notifications-panel';
import {SiteFooter} from './site-footer';
import {HomeDecorSlot,HomeRailSlot} from './home-wide';
import {HomeMagnet} from './home-magnet';
import {marketplaceWords} from './marketplace-words';
import {signInPath} from '@/lib/market/access';
import {signInReturn} from '@/lib/auth/return-to';
import {pickLocale,uzText,withCyrillic} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';
import {breadcrumbs,publicViewPaths} from '@/lib/seo/structured-data';
import {JsonLd} from './json-ld';
import {CartAnnouncer} from './cart-announcer';
import {ProfileMenu} from './profile-menu';
import {orderAttention} from '@/lib/market/notice-panel';
import {startNavigationFeedback} from '@/lib/market/navigation-feedback';
import {focusSearchKey,headerSearchLink,headerSearchTarget} from '@/lib/market/shell-search';

const breadcrumbLabel:Record<Locale,string>=/*@__PURE__*/withCyrillic({uz:'Sahifa yo‘li',ru:'Путь по сайту',en:'Breadcrumb'});
const returnPath=()=>typeof window==='undefined'?'/':window.location.pathname+window.location.search;

// Page shell shared by every route: header, breadcrumb, footer and the phone's bottom bar (the same for everyone).
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
// The bottom bar's "Ссылка" sheet (app/link-sheet.tsx): its own chunk, asked for when a finger lands on the button.
const loadLinkSheet=()=>import('./link-sheet');
const LinkSheet=lazy(()=>loadChunk(loadLinkSheet).then(module=>({default:module.LinkSheet})));
const preloadLinkSheet=()=>{loadLinkSheet().catch(()=>undefined)};
/** Views reached through the profile: its tab and its menu button stay lit on them. */
const profileViews=new Set(['account','orders','balance','notifications','favorites','identity','declaration']);

/** Wide screens: one field for the catalog search and for a pasted store link (a pasted link opens its calculation). */
function HeaderSearch({nav}:{nav:NavCopy}){
  const router=useRouter();
  const [text,setText]=useState('');
  function go(value:string){
    const href=headerSearchTarget(value);
    if(!href)return;
    // The same page with another query is a full load, as SiteLink does (those pages read the address once).
    if(window.location.pathname===href.split('?')[0]){window.location.assign(href);return}
    startNavigationFeedback();
    router.push(href);
    setText('');
  }
  return <form role="search" className="shell-search" onSubmit={event=>{event.preventDefault();go(text)}}>
    {/* The magnifier is the field's submit button (Enter does the same); no word button, so long languages keep the field. */}
    <label className="sr-only" htmlFor="shell-search-input">{nav.search}</label>
    <input id="shell-search-input" type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} maxLength={2048} value={text} placeholder={nav.searchPlaceholder}
      onChange={event=>setText(event.target.value)}
      onPaste={event=>{const pasted=event.clipboardData.getData('text');if(!headerSearchLink(pasted))return;event.preventDefault();setText(pasted.trim());go(pasted)}}/>
    {/* After the field in the tab order; drawn before it (order: -1, app/shell.css). */}
    <button type="submit" className="shell-search-submit" aria-label={nav.searchShort} title={nav.searchShort}><Search size={18} aria-hidden="true"/></button>
  </form>;
}

/** `crumb`: a page under its section (a catalog product): the breadcrumb then reads Home / section / this page. */
export default function Marketplace({view,children,crumb}:{view:string;children?:ReactNode;crumb?:string}) {
  const {state,ready,status,error,user,refresh,setLocale,sessionHint,siteContent}=useMarket();
  const supportBot=siteContent.contacts.telegramSupport;
  const {theme}=useTheme();
  const locale=state.communication.language as Locale,words=ui(locale);
  const modalWords=marketplaceWords(locale);
  const count=state.cart.reduce((s,i)=>s+i.quantity,0),balance=balanceOf(state);
  const nav=navCopy[locale];
  // The notifications panel belongs to the page it was opened on: moving to another page closes it.
  const [noticesFor,setNoticesFor]=useState<string|null>(null);
  const noticesOpen=noticesFor===view,setNoticesOpen=(open:boolean)=>setNoticesFor(open?view:null);
  // The "Ссылка" sheet: mounted on the first tap and kept, so it can animate its closing.
  const [linkOpen,setLinkOpen]=useState(false),[linkUsed,setLinkUsed]=useState(false);
  // A new tab or a full page load gets the account a moment after the page appears. Until it does, the header keeps
  // the member items with the last balance and cart count of this tab (sessionStorage), instead of blinking them out.
  const savedHeader=useSyncExternalStore(subscribeNever,readSavedHeader,()=>null);
  // The page to come back to after sign-in: '/' in the server HTML and while hydrating (so the bottom bar's link matches),
  // the real path right after. On /login the tab keeps that page's own return_to (signInReturn), not '/'.
  const here=useSyncExternalStore(subscribeNever,returnPath,()=>'/');
  const snapshot=useMemo(()=>{try{const saved=JSON.parse(savedHeader??'null');return saved&&typeof saved.balance==='number'&&typeof saved.count==='number'?saved as {balance:number;count:number}:null}catch{return null}},[savedHeader]);
  useEffect(()=>{try{if(ready)sessionStorage.setItem('atlas-header',JSON.stringify({balance,count}));else if(status==='guest')sessionStorage.removeItem('atlas-header')}catch{}},[ready,status,balance,count]);
  // A session cookie alone (a new tab) gives the member header too, just without the numbers until the account answers.
  const member=ready||(status==='loading'&&(!!snapshot||sessionHint)),known=ready||!!snapshot;
  const shownBalance=ready?balance:snapshot?.balance??0,shownCount=ready?count:snapshot?.count??0;
  const walletAmount=known?(locale==='ru'?money(shownBalance):new Intl.NumberFormat(isUzbek(locale)?uzText(locale, 'uz-UZ'):'en-US').format(shownBalance)+(isUzbek(locale)?uzText(locale, ' so‘m'):' UZS')):'';
  // An order waits for the customer (an extra payment, a change to answer, a payment to finish): a dot on the profile.
  const attention=ready&&state.orders.some(order=>orderAttention(order)!==null);
  // The count is in the cart's name (a polite status line says each change, app/cart-announcer.tsx).
  const cartLabel=known?modalWords.cart+shownCount:words.cart;
  // A guest's cart and saved items need an account for now: their links sign in first and come back there.
  const cartHref=member?'/cart':signInPath('/cart'),favoritesHref=member?'/favorites':signInPath('/favorites');
  // A guest sent to sign-in by the cart tab still sees that tab lit (return_to=/cart), not the profile.
  const cartReturn=view==='login'&&signInReturn(here).startsWith('/cart');
  // Phones: one bottom bar for everyone. The centre "Ссылка" opens the paste-a-link sheet; without script it is the order page.
  const tabs:{href:string;key:string;Icon:typeof LayoutGrid;label:string;active:boolean}[]=[
    {href:'/',key:'catalog',Icon:House,label:words.home,active:view==='catalog'},
    {href:'/catalog',key:'products',Icon:LayoutGrid,label:words.catalog,active:view==='products'},
    {href:'/order-by-link',key:'link',Icon:Plus,label:nav.link,active:view==='link'||view==='batch'},
    {href:cartHref,key:'cart',Icon:ShoppingBag,label:words.cart,active:view==='cart'||(view==='login'&&cartReturn)},
    member?{href:'/account',key:'account',Icon:UserRound,label:nav.profile,active:profileViews.has(view)}
     :{href:signInPath(signInReturn(here)),key:'login',Icon:UserRound,label:nav.profile,active:view==='login'&&!cartReturn},
  ];
  // The other tabs are fetched while the phone is idle, so a tap on one opens it at once.
  useWarmLinks(tabs.filter(tab=>!tab.active&&tab.key!=='link'&&!tab.href.startsWith('/login')).map(tab=>tab.href));
  const navItems:[string,string,string][]=[['/catalog','products',nav.catalog],['/stores','stores',nav.stores],['/order-by-link','link',nav.buyByLink],['/#tariffs','tariffs',nav.delivery]];
  function openLinkSheet(event:MouseEvent<HTMLAnchorElement>){
    if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
    event.preventDefault();
    // On the order page with its own field in view, the button takes the visitor to that field instead of a second one.
    const field=view==='link'?document.getElementById('source-url'):null;
    if(field instanceof HTMLInputElement&&field.offsetParent){field.scrollIntoView({block:'center',behavior:'smooth'});field.focus({preventScroll:true});return}
    preloadLinkSheet();setLinkUsed(true);setLinkOpen(true);
  }
  function openSearch(event:MouseEvent<HTMLAnchorElement>){
    if(view==='products'){
      const field=document.getElementById('catalog-search-input');
      if(field){event.preventDefault();field.scrollIntoView({block:'center',behavior:'smooth'});field.focus({preventScroll:true});return}
    }
    try{sessionStorage.setItem(focusSearchKey,'1')}catch{/* private mode: the catalog opens without the focus */}
  }
  return <><ViewMark view={view}/><a className="skip-link" href="#main">{modalWords.skip}</a><ToasterSlot theme={theme==='dark'?'dark':theme==='light'?'light':'system'} label={pickLocale({ru:'Сообщения',uz:'Xabarlar',en:'Messages'},locale)}/>
  {/* Wide screens: logo · Каталог · Магазины · Купить по ссылке · Доставка · search · language · ♥ · cart · profile.
      Phones: logo · search · language (and the bell); the bottom bar carries the rest (app/shell.css). */}
  <header className="site-header shell-header">
   <Link className="wordmark" href="/" aria-label={modalWords.homeLabel}>atlas<ArrowUpRight aria-hidden="true"/></Link>
   <nav className="shell-nav" aria-label={modalWords.navigation}>{navItems.map(([href,key,label])=><Link key={key} data-nav={key} className={key===view?'active':''} aria-current={key===view?'page':undefined} href={href}>{label}</Link>)}</nav>
   <HeaderSearch nav={nav}/>
   <div className="shell-actions">
    {(user?.operator||!!user?.permissions?.length)&&<Link className="operator-entry shell-operator" href="/admin" aria-label={modalWords.manage}><Settings2 size={18} aria-hidden="true"/><span>{modalWords.manage}</span></Link>}
    <Link className="shell-icon shell-search-icon" href="/catalog" aria-label={nav.search} onClick={openSearch}><Search size={21} aria-hidden="true"/></Link>
    <HeaderLanguage locale={locale} label={nav.language} themeLabel={nav.theme} onChange={setLocale}/>
    {/* Help in one tap, only once the owner has set the support bot (admin, «Контент сайта»). */}
    {supportBot&&<a className="header-help shell-help" href={`https://t.me/${supportBot}`} target="_blank" rel="noopener noreferrer" aria-label={`${nav.help} — Telegram`}><MessageCircle size={18} aria-hidden="true"/><span>{nav.help}</span></a>}
    {member&&<NotificationsPanel open={noticesOpen} onOpenChange={setNoticesOpen} label={modalWords.notifications} active={view==='notifications'}/>}
    <Link aria-label={modalWords.favorites} href={favoritesHref} className={'shell-icon shell-wide'+(view==='favorites'?' active':'')}><Heart size={20} aria-hidden="true"/></Link>
    <Link href={cartHref} className={'shell-cart shell-wide'+(view==='cart'?' active':'')} aria-label={cartLabel}><ShoppingBag size={19} aria-hidden="true"/><span className="shell-cart-label">{words.cart}</span>{known&&shownCount>0&&<b>{shownCount}</b>}</Link>
    {member?<span className="shell-wide"><ProfileMenu nav={nav} locale={locale} balance={walletAmount} attention={attention} view={view}/></span>
     // A guest goes straight to sign-in and comes back to this page (the href is set on click, so the server and the browser render the same link).
     // On the sign-in page itself the button would lead to the same page: it is left out there.
     :view==='login'?null:<a className="shell-signin shell-wide" href={signInPath('/account')} onClick={event=>{event.currentTarget.href=signInPath(returnPath())}}>{nav.signin}</a>}
   </div>
  </header>
  {/* Wide screens: the chapter rail after the header (Tab: header → rail → main; the skip link passes it), lazily loaded. */}
  {view==='catalog'&&<HomeRailSlot/>}{view==='catalog'&&<HomeMagnet/>}
  <CartAnnouncer count={count} ready={ready} locale={locale}/>
  {/* Phones hide the breadcrumb (app/shell.css); its JSON-LD stays for search engines. */}
  <main className={view==='catalog'?'site-main catalog-home':'site-main'} id="main" data-view={view}>{publicViewPaths[view]&&<JsonLd data={breadcrumbs(locale,publicViewPaths[view],routeTitle(locale,view))}/>}{view!=='catalog'&&<nav className="breadcrumb" aria-label={breadcrumbLabel[locale]}><Link href="/">{words.home}</Link><span aria-hidden="true">/</span>{crumb&&publicViewPaths[view]?<><Link href={publicViewPaths[view]}>{routeTitle(state.communication.language,view)}</Link><span aria-hidden="true">/</span><span className="breadcrumb-leaf" aria-current="page">{crumb}</span></>:<span aria-current="page">{routeTitle(state.communication.language,view)}</span>}</nav>}{error&&view==='catalog'&&<div className="notice error account-error" role="alert"><span>{error}</span><div><button type="button" className="text-button" onClick={()=>void refresh()}>{words.retry}</button>{!user&&<Link className="text-link" href="/account">{words.openSignIn}<ArrowRight size={15}/></Link>}</div></div>}
  <AccessView view={view}>{children}</AccessView>
   {/* Home: the closing call and the footer share the last sheet (app/home-chapters.css). */}
   {view==='catalog'?<div className="home-end" data-chapter="end"><Suspense fallback={null}><HomeClosing/></Suspense><SiteFooter/></div>:<SiteFooter/>}
   {/* Wide screens: the decor behind the sheets (app/home-decor.tsx), the last child of main. */}
   {view==='catalog'&&<HomeDecorSlot/>}</main>
  {/* Phones: one bottom bar for everyone, in the server HTML too: Главная · Каталог · Ссылка · Корзина · Профиль.
      A guest's profile tab signs in and comes back to this page; a session cookie gives the member's tab while the account loads. */}
  <nav className={'mobile-nav '+(member?'member':'guest')} aria-label={modalWords.navigation}>{tabs.map(({href,key,Icon,label,active})=>{
   const centre=key==='link',dot=key==='account'&&attention;
   return <Link href={href} key={key} data-tab={key} className={(centre?'mobile-nav-link':'')+(active?' active':'')} aria-current={active?'page':undefined}
    aria-label={key==='cart'?cartLabel:dot?`${label} — ${nav.needsAction}`:undefined} aria-haspopup={centre?'dialog':undefined}
    onClick={centre?openLinkSheet:undefined} onPointerDown={centre?preloadLinkSheet:undefined}>
    <span className="mobile-nav-icon"><Icon size={centre?24:22} strokeWidth={centre?2.4:1.9} aria-hidden="true"/>{dot&&<i className="shell-dot" aria-hidden="true"/>}</span><span className="mobile-nav-label">{label}</span>{key==='cart'&&known&&shownCount>0&&<b aria-hidden="true">{shownCount}</b>}</Link>})}</nav>
  {linkUsed&&<Suspense fallback={null}><LinkSheet open={linkOpen} onOpenChange={setLinkOpen} locale={locale} member={!!member}/></Suspense>}
</>;
}
