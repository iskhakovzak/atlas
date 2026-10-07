'use client';
import {useState,type ReactNode} from 'react';
import Link from '@/components/site-link';
import {ArrowUpRight,ArrowRight,Package,Wallet,ShoppingBag,Heart,LayoutGrid,Settings2,House,Store,LogIn,UserRound} from 'lucide-react';
import {Toaster} from 'sonner';
import {money,balanceOf} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {AccessView} from './access-view';
import {routeTitle,ui,type Locale} from '@/lib/market/i18n';
import {homeCopy} from '@/lib/market/home-copy';
import {useTheme} from 'next-themes';
import {ThemeToggle} from './theme-control';
import {HeaderLanguage} from './header-language';
import {NotificationsPanel} from './notifications-panel';
import {SiteFooter} from './site-footer';
import {HomeClosing} from './home-sections';
import {HomeDecorSlot,HomeRailSlot} from './home-wide';
import {marketplaceWords} from './marketplace-words';
import {signInPath} from '@/lib/market/access';
import {pickLocale,uzText,withCyrillic} from '@/lib/market/uz-cyrl';
import {isUzbek} from '@/lib/market/i18n';
import {breadcrumbs,publicViewPaths} from '@/lib/seo/structured-data';
import {JsonLd} from './json-ld';

const breadcrumbLabel:Record<Locale,string>=withCyrillic({uz:'Sahifa yo‘li',ru:'Путь по сайту',en:'Breadcrumb'});
const returnPath=()=>typeof window==='undefined'?'/':window.location.pathname+window.location.search;

// Page shell shared by every route: header, breadcrumb, footer and the members' bottom bar.
// Each page passes its own view as children, so a route only loads the code it renders and
// the server HTML carries the view in place (no lazy chunk, no hidden Suspense segment).
export default function Marketplace({view,children}:{view:string;children?:ReactNode}) {
  const {state,ready,status,error,user,refresh,setLocale}=useMarket();
  const {theme}=useTheme();
  const locale=state.communication.language as Locale,words=ui(locale);
  const modalWords=marketplaceWords(locale);
  const count=state.cart.reduce((s,i)=>s+i.quantity,0),balance=balanceOf(state);
  const hc=homeCopy[locale];
  const navItems:[string,string,string][]=[['/catalog','products',hc.nav.catalog],['/stores','stores',hc.nav.stores],['/#how','how',hc.nav.how],['/#tariffs','tariffs',hc.nav.tariffs],...(ready?[['/orders','orders',hc.nav.orders] as [string,string,string]]:[])];
  const [noticesOpen,setNoticesOpen]=useState(false);
  return <><a className="skip-link" href="#main">{modalWords.skip}</a><Toaster position="top-right" richColors theme={theme==='dark'?'dark':theme==='light'?'light':'system'}/>
  <header className="site-header"><Link className="wordmark" href="/" aria-label={modalWords.homeLabel}>atlas<ArrowUpRight aria-hidden="true"/></Link><nav className="desktop-nav" aria-label={modalWords.navigation}>{navItems.map(([href,key,label])=><Link key={key} data-nav={key} className={key===view?'active':''} aria-current={key===view?'page':undefined} href={href}>{label}</Link>)}</nav><div className="header-actions">{(user?.operator||!!user?.permissions?.length)&&<Link className="operator-entry text-link" href="/admin"><Settings2 size={16}/>{modalWords.manage}</Link>}<HeaderLanguage locale={locale} label={hc.nav.language} onChange={setLocale}/><span className="header-theme"><ThemeToggle locale={locale}/></span>{ready&&<><Link href="/balance" className="wallet-link"><Wallet size={19}/><span>{locale==='ru'?money(balance):new Intl.NumberFormat(isUzbek(locale)?uzText(locale, 'uz-UZ'):'en-US').format(balance)+(isUzbek(locale)?uzText(locale, ' so‘m'):' UZS')}</span></Link><NotificationsPanel open={noticesOpen} onOpenChange={setNoticesOpen} label={modalWords.notifications} active={view==='notifications'}/><Link aria-label={modalWords.favorites} href="/favorites" className={'icon-btn desktop-only '+(view==='favorites'?'active':'')}><Heart size={20}/></Link><Link href="/cart" className="cart-link" aria-label={modalWords.cart+count}><ShoppingBag size={19}/><span className="desktop-only">{words.cart}</span><b>{count}</b></Link></>}<Link className={'header-account'+(ready?' member':'')} href="/account">{user?hc.nav.account:hc.nav.signin}</Link></div></header>
  {/* Wide screens: the chapter rail after the header (Tab: header → rail → main; the skip link passes it), lazily loaded. */}
  {view==='catalog'&&<HomeRailSlot/>}
  <main className={view==='catalog'?'site-main catalog-home':'site-main'} id="main" data-view={view}>{publicViewPaths[view]&&<JsonLd data={breadcrumbs(locale,publicViewPaths[view],routeTitle(locale,view))}/>}{view!=='catalog'&&<nav className="breadcrumb" aria-label={breadcrumbLabel[locale]}><Link href="/">{words.home}</Link><span aria-hidden="true">/</span><span aria-current="page">{routeTitle(state.communication.language,view)}</span></nav>}{error&&view==='catalog'&&<div className="notice error account-error" role="alert"><span>{error}</span><div><button type="button" className="text-button" onClick={()=>void refresh()}>{words.retry}</button>{!user&&<Link className="text-link" href="/account">{words.openSignIn}<ArrowRight size={15}/></Link>}</div></div>}
  <AccessView view={view}>{children}</AccessView>
   {/* Home: the closing call and the footer share the last sheet (app/home-chapters.css). */}
   {view==='catalog'?<div className="home-end" data-chapter="end"><HomeClosing/><SiteFooter/></div>:<SiteFooter/>}
   {/* Wide screens: the decor behind the sheets (app/home-decor.tsx), the last child of main. */}
   {view==='catalog'&&<HomeDecorSlot/>}</main>
  {/* Phones: one bottom bar for everyone (guests get sign-in in it); hidden while the session is checked. */}
  {status!=='loading'&&<nav className={'mobile-nav '+(ready?'member':'guest')} aria-label={modalWords.navigation}>{(ready?[['/','catalog',House,words.home],['/catalog','products',LayoutGrid,words.catalog],['/orders','orders',Package,pickLocale({ru:'Заказы',uz:'Buyurtmalar',en:'Orders'}, locale)],['/cart','cart',ShoppingBag,words.cart],['/account','account',UserRound,words.account]]:[['/','catalog',House,words.home],['/catalog','products',LayoutGrid,words.catalog],['/stores','stores',Store,hc.nav.stores],[signInPath(view==='login'?'/':returnPath()),'login',LogIn,hc.nav.signin]]).map(([href,key,Icon,label])=>{const I=Icon as typeof LayoutGrid;return <Link href={href as string} key={key as string} className={key===view?'active':''} aria-current={key===view?'page':undefined}><I size={21} aria-hidden="true"/><span>{label as string}</span>{key==='cart'&&count>0&&<b>{count}</b>}</Link>})}</nav>}
</>;
}
