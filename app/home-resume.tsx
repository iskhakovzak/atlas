'use client';
import {AlertCircle,ChevronRight,ShoppingBag,Wallet} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import {homeCopy} from '@/lib/market/home-copy';
import {nextStepOf} from '@/lib/market/next-step';
import type {Locale} from '@/lib/market/i18n';

const icons={approval:AlertCircle,payment:Wallet,cart:ShoppingBag};

/**
 * The hero's "continue" card for a signed-in customer: the one thing that waits for them (a decision on an
 * order, the checkout's payment, the cart). Loaded lazily from HomeHero only once the account is known, so the
 * guest's home and its main chunk stay as they were. Only the account's real state, no sums or timers.
 */
export function HomeResume(){
 const {state}=useMarket();
 const step=nextStepOf(state);
 if(!step)return null;
 const c=(homeCopy[state.communication.language as Locale]??homeCopy.ru).resume;
 const Icon=icons[step.kind];
 const title=step.kind==='approval'?c.approval:step.kind==='payment'?c.payment:c.cart(step.items);
 const hint=step.kind==='cart'?c.cartNote:step.name??c.items(step.items);
 const href=step.kind==='cart'||!step.orderId?'/cart':'/orders#'+encodeURIComponent(step.orderId);
 return <Link className="home-resume" data-kind={step.kind} href={href}>
  <span className="home-resume-icon" aria-hidden="true"><Icon size={20}/></span>
  <span className="home-resume-text"><b>{title}</b><small>{hint}</small></span>
  <ChevronRight className="home-resume-arrow" size={18} aria-hidden="true"/>
 </Link>;
}
