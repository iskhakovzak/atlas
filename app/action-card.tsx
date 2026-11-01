'use client';
import {IdCard,MessageCircleQuestion,Receipt,ShoppingBag,Wallet} from 'lucide-react';
import Link from '@/components/site-link';
import type {Locale} from '@/lib/market/i18n';
import type {NextStep} from '@/lib/market/next-step';
import {actionCopy,actionLines} from '@/lib/market/action-copy';
import {ProductImage} from './market-ui';
import './action-card.css';

const icons={extra:Receipt,change:MessageCircleQuestion,payment:Wallet,passport:IdCard,cart:ShoppingBag};

/**
 * One "what waits for you" card (owner, 1 November 2026, instead of the mint strip under the header): a tinted icon,
 * what is needed in plain words, the product by its photo and name, the order number small and grey, one 44 px button
 * straight to it, and on the home hero «Позже». The same card on the home hero and in the profile's «Требует действия».
 */
export function ActionCard({step,locale,onLater,as='div',titleId}:{step:NextStep;locale:Locale;onLater?:()=>void;as?:'div'|'li';titleId?:string}){
 const t=actionCopy[locale]??actionCopy.ru;
 const {title,hint,button}=actionLines(step,locale);
 const Icon=icons[step.kind];
 const meta=[step.kind==='passport'?step.recipientName:undefined,step.orderId].filter(Boolean).join(' · ');
 const Tag=as;
 return <Tag className="action-card" data-kind={step.kind}>
  <div className="action-card-top">
   <span className="action-card-icon" aria-hidden="true"><Icon size={20} strokeWidth={2}/></span>
   <div className="action-card-copy">
    <b id={titleId}>{title}</b>
    <p>{hint}</p>
    {meta&&<small>{meta}</small>}
   </div>
   {step.product&&<span className="action-card-thumb" aria-hidden="true"><ProductImage product={step.product} decorative locale={locale} size={96}/></span>}
  </div>
  <div className="action-card-buttons">
   <Link className="btn primary action-card-go" href={step.href}>{button}</Link>
   {onLater&&<button type="button" className="btn secondary action-card-later" onClick={onLater}>{t.later}</button>}
  </div>
 </Tag>;
}
