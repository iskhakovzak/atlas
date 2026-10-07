'use client';
import {ArrowRight,ClipboardPaste,Compass} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {notFoundCopy} from '@/lib/market/customer-copy';

export function NotFoundView(){
  const {state}=useMarket(),t=notFoundCopy[state.communication.language];
  return <section className="surface access-card not-found-card">
    <span className="access-icon" aria-hidden="true"><Compass/></span>
    <span className="eyebrow">404</span>
    <h1>{t.title}</h1>
    <p>{t.text}</p>
    <div className="access-actions">
      <Link className="btn primary" href="/">{t.home}<ArrowRight size={18} aria-hidden="true"/></Link>
      <Link className="btn secondary" href="/order-by-link"><ClipboardPaste size={18} aria-hidden="true"/>{t.paste}</Link>
      <Link className="btn secondary" href="/stores">{t.stores}</Link>
    </div>
  </section>;
}
