'use client';
import {useEffect} from 'react';
import {Check,X} from 'lucide-react';
import {toast} from '@/lib/market/toast';
import {sizedImage} from '@/lib/market/image-size';

type CartToastProps = {
  id: string | number;
  title: string;
  name: string;
  detail?: string;
  image?: string;
  action: string;
  close: string;
  onAction: () => void;
};

/**
 * "Added to cart" as a small mini-cart card (2 November 2026; the pattern of Nike, Zara and the Apple Store): the photo,
 * what was added on one line, one filled action and ×. Esc closes it; it is a polite status, so a screen reader says it
 * without moving the focus.
 */
function CartToast({id,title,name,detail,image,action,close,onAction}:CartToastProps){
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')toast.dismiss(id)};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[id]);
  return <div className="cart-toast" role="status" aria-live="polite">
    <span className="cart-toast-photo" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 48px store photo through sizedImage, as on the cards */}
      {image?<img src={sizedImage(image,120)} alt="" width={48} height={48} decoding="async"/>:null}
      <i><Check size={12} strokeWidth={3}/></i>
    </span>
    <span className="cart-toast-text"><b>{title}</b><span>{[name,detail].filter(Boolean).join(' · ')}</span></span>
    <button type="button" className="cart-toast-action" onClick={()=>{toast.dismiss(id);onAction()}}>{action}</button>
    <button type="button" className="cart-toast-close" aria-label={close} onClick={()=>toast.dismiss(id)}><X size={16} aria-hidden="true"/></button>
  </div>;
}

/** Shows the "added to cart" card; the header and bottom-bar cart icons bump with it (app/marketplace.tsx). */
export function showCartAdded(props:Omit<CartToastProps,'id'>){
  window.dispatchEvent(new Event('atlas:cart-bump'));
  toast.custom(id=><CartToast id={id} {...props}/>,{duration:4000,className:'atlas-toast atlas-toast-cart'});
}
