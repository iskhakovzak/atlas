'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,ChevronDown,FileText,Heart,LogOut,Package,UserRound,Wallet} from 'lucide-react';
import Link from '@/components/site-link';
import type {NavCopy,Locale} from '@/lib/market/i18n';
import {ThemeToggle} from './theme-control';

/**
 * The signed-in header's profile button (wide screens): the account, orders, balance, notifications, saved items, the
 * theme and sign-out in one menu, so the header itself keeps only the catalog, the search, the cart and this button.
 * A disclosure, as the language menu (app/header-language.tsx): Escape or a click outside closes it.
 */
export function ProfileMenu({nav,locale,balance,attention,view}:{nav:NavCopy;locale:Locale;balance:string;attention:boolean;view:string}){
  // The menu belongs to the page it was opened on: a page change (a link in it) closes it.
  const [openFor,setOpenFor]=useState<string|null>(null);
  const open=openFor===view,setOpen=(next:boolean)=>setOpenFor(next?view:null);
  const wrap=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),fromKeyboard=useRef(false),listId='atlas-profile-menu';
  useEffect(()=>{
    if(!open)return;
    // Opened from the keyboard: the first item takes the focus (a pointer leaves it on the button).
    if(fromKeyboard.current)wrap.current?.querySelector<HTMLElement>('.shell-menu-list a')?.focus();
    const outside=(event:PointerEvent)=>{if(!wrap.current?.contains(event.target as Node))setOpenFor(null)};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpenFor(null);trigger.current?.focus()}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)};
  },[open]);
  const move=(event:React.KeyboardEvent<HTMLDivElement>)=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    const items=[...event.currentTarget.querySelectorAll<HTMLElement>('a, button')],at=items.indexOf(document.activeElement as HTMLElement);
    const next=event.key==='Home'?0:event.key==='End'?items.length-1:(at+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
    event.preventDefault();items[next]?.focus();
  };
  async function signOut(){
    await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'}).catch(()=>undefined);
    window.location.assign('/');
  }
  const mine=['account','orders','balance','notifications','favorites','identity','declaration'].includes(view);
  const items:[string,string,typeof Package,string,string?][]=[
    ['/account','account',UserRound,nav.account],
    ['/orders','orders',Package,nav.orders],
    ['/balance','balance',Wallet,nav.balance,balance],
    ['/notifications','notifications',Bell,nav.notifications],
    ['/favorites','favorites',Heart,nav.favorites],
    // The passport and the declaration: /identity, which links on to the declaration.
    ['/identity','identity',FileText,nav.documents],
  ];
  return <div className="shell-profile" ref={wrap} onBlur={event=>{if(open&&event.relatedTarget&&!wrap.current?.contains(event.relatedTarget as Node))setOpen(false)}}>
    <button type="button" ref={trigger} className={'shell-profile-trigger'+(mine?' active':'')} aria-expanded={open} aria-controls={listId} aria-label={nav.profile+(attention?' — '+nav.needsAction:'')} onClick={event=>{fromKeyboard.current=event.detail===0;setOpen(!open)}} onKeyDown={event=>{if(event.key==='ArrowDown'){event.preventDefault();fromKeyboard.current=true;setOpen(true)}}}>
      <span className="shell-profile-icon"><UserRound size={19} aria-hidden="true"/>{attention&&<i className="shell-dot" aria-hidden="true"/>}</span><span className="shell-profile-label">{nav.profile}</span><ChevronDown size={14} aria-hidden="true" className="shell-chevron"/>
    </button>
    <div className="shell-menu-list" id={listId} role="group" aria-label={nav.profileMenu} hidden={!open} onKeyDown={move}>
      {items.map(([href,key,Icon,label,extra])=><Link key={key} href={href} className={key===view||(key==='identity'&&view==='declaration')?'active':''} aria-current={key===view?'page':undefined} onClick={()=>setOpen(false)}><Icon size={18} aria-hidden="true"/><span>{label}</span>{extra&&<small>{extra}</small>}</Link>)}
      <div className="shell-menu-row"><span>{nav.theme}</span><ThemeToggle locale={locale}/></div>
      <button type="button" className="shell-menu-signout" onClick={()=>void signOut()}><LogOut size={18} aria-hidden="true"/><span>{nav.signOut}</span></button>
    </div>
  </div>;
}
