'use client';
import type {ReactNode} from 'react';
import Link from '@/components/site-link';
import {ArrowUpRight,ArrowRight,Package,Wallet,ShieldCheck,ShoppingBag,Heart,LayoutGrid,Settings2,Bell} from 'lucide-react';
import {Toaster} from 'sonner';
import {money,balanceOf} from '@/lib/market/domain';
import {useMarket} from '@/lib/market/store';
import {AccessView} from './access-view';
import {routeTitle,ui,type Locale} from '@/lib/market/i18n';
import {homeCopy} from '@/lib/market/home-copy';
import {useTheme} from 'next-themes';
import {ThemeToggle} from './theme-control';
import {SiteFooter} from './site-footer';
import {marketplaceWords} from './marketplace-words';

// Page shell shared by every route: header, breadcrumb, footer and the members' bottom bar.
// Each page passes its own view as children, so a route only loads the code it renders and
// the server HTML carries the view in place (no lazy chunk, no hidden Suspense segment).
export default function Marketplace({view,children}:{view:string;children?:ReactNode}) {
  const {state,ready,error,user,refresh,setLocale}=useMarket();
  const {theme}=useTheme();
  const locale=state.communication.language as Locale,words=ui(locale);
  const modalWords=marketplaceWords(locale);
  const count=state.cart.reduce((s,i)=>s+i.quantity,0),balance=balanceOf(state),unread=state.notifications.filter(item=>!item.read).length;
  const hc=homeCopy[locale];
  const navItems:[string,string,string][]=[['/catalog','products',hc.nav.catalog],['/stores','stores',hc.nav.stores],['/#how','how',hc.nav.how],['/#tariffs','tariffs',hc.nav.tariffs],...(ready?[['/orders','orders',hc.nav.orders] as [string,string,string]]:[])];
  const languages:[Locale,string][]=[['uz','O‘zbekcha'],['ru','Русский'],['en','English']];
  return <><a className="skip-link" href="#main">{modalWords.skip}</a><Toaster position="top-right" richColors theme={theme==='dark'?'dark':theme==='light'?'light':'system'}/>
  <header className="site-header"><Link className="wordmark" href="/" aria-label={modalWords.homeLabel}>atlas<ArrowUpRight aria-hidden="true"/></Link><nav className="desktop-nav" aria-label={modalWords.navigation}>{navItems.map(([href,key,label])=><Link key={key} data-nav={key} className={key===view?'active':''} aria-current={key===view?'page':undefined} href={href}>{label}</Link>)}</nav><div className="header-actions">{user?.operator&&<Link className="operator-entry text-link" href="/admin"><Settings2 size={16}/>{modalWords.manage}</Link>}<div className="lang-switch" role="group" aria-label={hc.nav.language}>{languages.map(([code,name])=><button type="button" key={code} lang={code} aria-label={name} aria-pressed={locale===code} onClick={()=>setLocale(code)}>{code.toUpperCase()}</button>)}</div><span className="header-theme"><ThemeToggle locale={locale}/></span>{ready&&<><Link href="/balance" className="wallet-link"><Wallet size={19}/><span>{locale==='ru'?money(balance):new Intl.NumberFormat(locale==='uz'?'uz-UZ':'en-US').format(balance)+(locale==='uz'?' so‘m':' UZS')}</span></Link><Link aria-label={modalWords.notifications+unread} href="/notifications" className={'icon-btn notice-link '+(view==='notifications'?'active':'')}><Bell size={20}/>{unread>0&&<b>{Math.min(unread,99)}</b>}</Link><Link aria-label={modalWords.favorites} href="/favorites" className={'icon-btn desktop-only '+(view==='favorites'?'active':'')}><Heart size={20}/></Link><Link href="/cart" className="cart-link" aria-label={modalWords.cart+count}><ShoppingBag size={19}/><span className="desktop-only">{words.cart}</span><b>{count}</b></Link></>}<Link className={'header-account'+(ready?' member':'')} href="/account">{user?hc.nav.account:hc.nav.signin}</Link></div></header>
  <main className={view==='catalog'?'site-main catalog-home':'site-main'} id="main" data-view={view}>{view!=='catalog'&&<div className="breadcrumb"><Link href="/">{words.home}</Link><span>/</span><span>{routeTitle(state.communication.language,view)}</span></div>}{error&&view==='catalog'&&<div className="notice error account-error" role="alert"><span>{error}</span><div><button type="button" className="text-button" onClick={()=>void refresh()}>{words.retry}</button>{!user&&<Link className="text-link" href="/account">{words.openSignIn}<ArrowRight size={15}/></Link>}</div></div>}
  <AccessView view={view}>{children}</AccessView>
   <SiteFooter/></main>
  {/* Guests already have "Sign in" in the header, so the bottom bar is for members only. */}
  {ready&&<nav className="mobile-nav member" aria-label={modalWords.navigation}>{[['/catalog','products',LayoutGrid,words.catalog],['/favorites','favorites',Heart,words.favorites],['/orders','orders',Package,words.orders],['/cart','cart',ShoppingBag,words.cart],['/account','account',ShieldCheck,words.account]].map(([href,key,Icon,label])=>{const I=Icon as typeof LayoutGrid;return <Link href={href as string} key={key as string} className={key===view?'active':''} aria-current={key===view?'page':undefined}><I size={21}/><span>{label as string}</span>{key==='cart'&&count>0&&<b>{count}</b>}</Link>})}</nav>}
</>;
}
