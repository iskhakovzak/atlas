'use client';
import {useState} from 'react';
import {ArrowRight,ClipboardPaste,House,LayoutGrid,Search,Store,Truck} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {notFoundCopy} from '@/lib/market/not-found-copy';
import {headerSearchTarget} from '@/lib/market/shell-search';

/**
 * Unknown addresses (redesign stage 8, 1 November 2026): what happened in one line, a search that takes words to the
 * catalog and a pasted store link to its calculation (the header search's rule, lib/market/shell-search.ts), and the
 * main sections as links. A full page load on submit: the 404 response is not a page the client router can leave from.
 */
export function NotFoundView(){
  const {state}=useMarket(),t=notFoundCopy[state.communication.language];
  const [text,setText]=useState('');
  const links=[{href:'/',Icon:House,label:t.home},{href:'/catalog',Icon:LayoutGrid,label:t.catalog},{href:'/stores',Icon:Store,label:t.stores},{href:'/order-by-link',Icon:ClipboardPaste,label:t.paste},{href:'/delivery',Icon:Truck,label:t.delivery}];
  return <section className="not-found" aria-labelledby="not-found-title">
    <p className="not-found-code" aria-hidden="true">404</p>
    <h1 id="not-found-title">{t.title}</h1>
    <p className="not-found-text">{t.text}</p>
    <form role="search" className="not-found-search" action="/catalog" onSubmit={event=>{event.preventDefault();const href=headerSearchTarget(text);if(href)window.location.assign(href)}}>
      <label className="sr-only" htmlFor="not-found-q">{t.search}</label>
      <Search size={20} aria-hidden="true"/>
      <input id="not-found-q" name="q" type="search" enterKeyHint="search" autoComplete="off" spellCheck={false} maxLength={2048} value={text} placeholder={t.searchPlaceholder} onChange={event=>setText(event.target.value)}/>
      <button type="submit" className="btn primary">{t.find}</button>
    </form>
    <nav className="not-found-links" aria-label={t.linksLabel}>
      <ul>{links.map(({href,Icon,label})=><li key={href}><Link href={href}><Icon size={20} aria-hidden="true"/><span>{label}</span><ArrowRight size={16} aria-hidden="true"/></Link></li>)}</ul>
    </nav>
  </section>;
}
