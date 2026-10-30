'use client';
import {useEffect,useRef,useState} from 'react';
import type {Locale} from '@/lib/market/i18n';
import {cartAnnouncement} from '@/lib/market/cart-announcement';

/**
 * The cart count changes silently for a screen reader (the badge is a number in a link): one polite status line says
 * the new count when it changes, never on the first load (storefront practice, owner 30 October 2026).
 */
export function CartAnnouncer({count,ready,locale}:{count:number;ready:boolean;locale:Locale}){
  const previous=useRef<number|null>(null);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    if(!ready)return;
    if(previous.current!==null&&previous.current!==count)setMessage(cartAnnouncement(count,locale));
    previous.current=count;
  },[ready,count,locale]);
  return <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</p>;
}
