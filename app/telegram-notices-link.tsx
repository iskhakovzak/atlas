'use client';
import {ArrowRight,Send} from 'lucide-react';
import Link from '@/components/site-link';
import {useMarket} from '@/lib/market/store';
import type {Locale} from '@/lib/market/i18n';
import {telegramView} from '@/lib/market/telegram-state';
import {telegramUiCopy} from '@/lib/market/telegram-ui-copy';
import {useTelegramBot,useTelegramLink} from './telegram-notices-data';
import './telegram-notices-link.css';

// Light links to the Telegram setting in the account, for the bell sheet and /notifications (no sign-in code here).

const settingsHref='/account#telegram-notices';

/**
 * What the account's notices really are: "on" only while the Telegram they were turned on for is still the one
 * attached (a re-link shows "changed", which sends nothing). /api/auth/links is asked only when the saved
 * state says "on" — the one case where the answer can differ.
 */
function useTelegramOn(){
 const {state}=useMarket();
 const bot=useTelegramBot();
 const saidOn=state.communication.telegramEnabled===true;
 const {link}=useTelegramLink(!!bot&&saidOn);
 // Unknown only while the links are being read; if they cannot be read, the saved state is trusted.
 const known=!saidOn||link.loaded||link.failed===true;
 const on=saidOn&&telegramView(state.communication,link.linkedAt).kind==='on';
 return {bot,known,on};
}

/** A quiet line in the bell's footer while the notices are not on; nothing without the bot. */
export function TelegramBellLink({locale,onNavigate}:{locale:Locale;onNavigate?:()=>void}){
 const {ready}=useMarket();
 const {bot,known,on}=useTelegramOn();
 // While the attached Telegram is still being read, an "on" account shows nothing rather than a flicker.
 if(!ready||!bot||!known||on)return null;
 return <Link className="notice-panel-tg" href={settingsHref} onClick={onNavigate}><Send size={15} aria-hidden="true"/>{telegramUiCopy[locale].bellLink}</Link>;
}

/**
 * Under the operator's free texts (customer notice, change reason, decline reason, extra charge, claim note): whether
 * the words may also go to the customer's Telegram. They go untranslated and exactly as typed. `on` is the saved
 * consent; the server still checks the attached Telegram before sending (a re-link, a block), hence "may".
 */
export function OperatorTelegramHint({on,locale}:{on:boolean;locale:Locale}){
 const t=telegramUiCopy[locale];
 return <p className={'micro operator-tg-hint'+(on?' on':'')}>{on&&<Send size={13} aria-hidden="true"/>}{on?t.operatorOn:t.operatorOff}</p>;
}

/** The first row of the notification settings on /notifications: on or off, and where to change it. */
export function TelegramSettingsRow({locale}:{locale:Locale}){
 const {bot,on}=useTelegramOn();
 if(!bot)return null;
 // "Changed" (Telegram re-linked after the consent) sends nothing, so it reads "off" here; the account says why.
 const t=telegramUiCopy[locale];
 return <div className="notice-tg-row">
  <span className="notice-tg-row-label"><Send size={17} aria-hidden="true"/>{on?t.rowOn:t.rowOff}</span>
  <Link className="notice-tg-row-link" href={settingsHref}>{t.setUp}<ArrowRight size={15} aria-hidden="true"/></Link>
 </div>;
}
