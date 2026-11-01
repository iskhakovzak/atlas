'use client';
import {useState} from 'react';
import {useMarket} from '@/lib/market/store';
import {nextStepOf} from '@/lib/market/next-step';
import {actionCopy} from '@/lib/market/action-copy';
import {putOffLater,readLater} from '@/lib/market/action-session';
import type {Locale} from '@/lib/market/i18n';
import {ActionCard} from './action-card';
// Styles of this lazily loaded part: they arrive with its chunk, before it renders.
import './styles/home-resume.css';

/**
 * The hero's "continue" card for a signed-in customer: the one thing that waits for them, most urgent first — a decision
 * on an order, a payment, a recipient's passport, then the cart (lib/market/next-step.ts). Since 1 November 2026 it is the
 * place for "action needed" instead of a strip under the header on every page. «Позже» hides that step for this tab.
 * Loaded lazily from HomeHero only once the account is known, so the guest's home and its main chunk stay as they were.
 */
export function HomeResume(){
 const {state}=useMarket();
 // Client only (the hero renders it once the account has loaded), so sessionStorage can be read on the first render.
 const [later,setLater]=useState(readLater);
 const step=nextStepOf(state,later);
 if(!step)return null;
 const locale=state.communication.language as Locale;
 const t=actionCopy[locale]??actionCopy.ru;
 return <section className="home-resume" aria-label={t.region}>
  <ActionCard key={step.key} step={step} locale={locale} onLater={()=>setLater(putOffLater(step.key))}/>
 </section>;
}
