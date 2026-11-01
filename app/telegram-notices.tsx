'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUpRight,Send,X} from 'lucide-react';
import {useMarket} from '@/lib/market/store';
import type {Locale} from '@/lib/market/i18n';
import {formatLongDate} from '@/lib/market/customer-copy';
import {telegramNotifyLink,telegramView} from '@/lib/market/telegram-state';
import {telegramUiCopy} from '@/lib/market/telegram-ui-copy';
import {toast} from '@/lib/market/toast';
import {isNative,openExternal} from '@/lib/native/bridge';
import {Modal} from './modal';
import {TelegramBotLogin,loginCopy} from './login-view';
import {dismissNudge,nudgeDismissed,signInMethodsChanged,useTelegramBot,useTelegramLink} from './telegram-notices-data';
import './telegram-notices.css';

/**
 * Turns Telegram order notices on or off: the customer's own consent, saved by the server only after the bot
 * proved it can write (POST /api/actions telegram-notify). No optimistic switch: it shows what the server saved.
 */
function useTelegramToggle(locale:Locale){
 const {act}=useMarket();
 const [busy,setBusy]=useState(false);
 const toggle=useCallback(async(enabled:boolean)=>{
  const t=telegramUiCopy[locale];
  setBusy(true);
  try{
   // The screen's language goes along: the messages arrive in it.
   const ok=await act({type:'telegram-notify',enabled,language:locale});
   if(ok)toast.success(enabled?t.toastOn:t.toastOff);
   return ok;
  }finally{setBusy(false)}
 },[act,locale]);
 return {busy,toggle};
}

/** In the apps the t.me link opens outside the app's web view (Telegram itself, or the browser). */
function openTelegram(event:React.MouseEvent<HTMLAnchorElement>,url:string){
 if(!isNative())return;
 event.preventDefault();
 void openExternal(url);
}

/** The first row of "Настройки" in the account (/account#telegram-notices). Hidden while the bot is not set up. */
export function TelegramNoticesSetting({locale}:{locale:Locale}){
 const {state,ready}=useMarket();
 const bot=useTelegramBot();
 const {link,reload}=useTelegramLink(!!bot);
 const {busy,toggle}=useTelegramToggle(locale);
 const [connecting,setConnecting]=useState(false),[connectError,setConnectError]=useState<string|null>(null);
 const [now,setNow]=useState(()=>Date.now());
 const row=useRef<HTMLDetailsElement>(null);
 const view=telegramView(state.communication,link.linkedAt,now);
 // The bell, /notifications and the nudge lead to #telegram-notices: the row opens and comes into view.
 useEffect(()=>{
  const element=row.current;
  if(!element)return;
  const reveal=()=>{if(window.location.hash!=='#telegram-notices')return;element.open=true;window.setTimeout(()=>element.scrollIntoView({block:'center'}),60)};
  reveal();
  window.addEventListener('hashchange',reveal);
  return()=>window.removeEventListener('hashchange',reveal);
 },[bot]);
 // "Waiting for Start" lasts 30 minutes: the row looks at the clock again each minute while it shows it.
 useEffect(()=>{
  if(view.kind!=='pending')return;
  const timer=window.setInterval(()=>setNow(Date.now()),60_000);
  return()=>window.clearInterval(timer);
 },[view.kind]);
 if(!bot)return null;
 const t=telegramUiCopy[locale],lc=loginCopy(locale);
 const on=view.kind==='on';
 const switchTo=(enabled:boolean)=>void toggle(enabled).then(()=>setNow(Date.now()));
 const reason=view.kind==='off'?view.reason:undefined;
 const status=busy?t.checking
  :link.failed?t.linkFailed
  :view.kind==='on'?`${link.name?t.onTo(link.name):t.onToBot(bot)} · ${t.onSince(formatLongDate(view.since,locale))}`
  :view.kind==='changed'?t.changed
  :view.kind==='pending'?t.pendingText(bot)
  :reason==='bot-stop'?t.offBotStop:reason==='blocked'?t.offBlocked:reason==='unlinked'?t.offUnlinked:'';
 const summary=view.kind==='on'?t.statusOn:view.kind==='pending'?t.statusPending:t.statusOff;
 const linkError=(code?:string)=>setConnectError(code?(code in lc.errors?lc.errors[code as keyof typeof lc.errors]:lc.errors.fallback):null);
 return <>
  <details ref={row} id="telegram-notices" className="cabinet-setting-more tg-notices" open={view.kind==='pending'||view.kind==='changed'||undefined}>
   <summary className="cabinet-setting">
    <span className="cabinet-setting-label"><Send size={18} aria-hidden="true"/>{t.title}</span>
    <small className={on?'tg-notices-on':view.kind==='pending'||view.kind==='changed'?'cabinet-setting-need':undefined}>{summary}</small>
   </summary>
   <div className="cabinet-setting-more-body tg-notices-body">
    <p>{t.lead}</p>
    {link.loaded&&!link.linked?<>
     {/* Turned off by unlinking: said once, so it does not look like "never turned on". */}
     {reason==='unlinked'&&<p className="tg-notices-status">{t.offUnlinked}</p>}
     <p className="cabinet-muted">{t.notLinked}</p>
     <button type="button" className="btn primary tg-notices-connect" disabled={!ready||busy} onClick={()=>{setConnectError(null);setConnecting(true)}}><Send size={16} aria-hidden="true"/>{t.connect}</button>
    </>:<>
     <button type="button" role="switch" aria-checked={on} aria-busy={busy||undefined} aria-describedby={status?'tg-notices-status':undefined} className="tg-switch" disabled={!ready||busy||!link.loaded} onClick={()=>switchTo(!on)}>
      <span className="tg-switch-label">{t.switchLabel}</span>
      <span className="tg-switch-track" aria-hidden="true"><span className="tg-switch-thumb"/></span>
     </button>
     {view.kind==='pending'&&!busy&&<p className="tg-notices-step"><b>{t.pendingTitle}</b></p>}
     <p id="tg-notices-status" className={'tg-notices-status'+(reason==='blocked'||view.kind==='changed'||(link.failed&&!busy)?' warn':'')} aria-live="polite">{status}</p>
     {link.failed&&<div className="tg-notices-actions"><button type="button" className="btn secondary" onClick={()=>void reload()}>{t.retry}</button></div>}
     {view.kind==='pending'&&<div className="tg-notices-actions">
      <a className="btn primary" href={telegramNotifyLink(bot)} target="_blank" rel="noopener noreferrer" onClick={event=>openTelegram(event,telegramNotifyLink(bot))}>{t.openTg}<ArrowUpRight size={16} aria-hidden="true"/></a>
      <button type="button" className="btn secondary" disabled={!ready||busy} onClick={()=>switchTo(true)}>{t.recheck}</button>
      {/* Changed one's mind while waiting: the request is withdrawn, nothing is sent. */}
      <button type="button" className="cabinet-text-btn" disabled={!ready||busy} onClick={()=>switchTo(false)}>{t.cancel}</button>
     </div>}
    </>}
    <p className="cabinet-muted">{t.hint} {t.quiet}</p>
   </div>
  </details>
  {/* Telegram not attached yet: attach it through the bot here, then turn the notices on in the same step. */}
  <Modal open={connecting} onClose={()=>setConnecting(false)} title={t.connectTitle} description={t.connectHint} locale={locale}>
   {connectError&&<div className="notice error" role="alert">{connectError}</div>}
   {connecting&&<TelegramBotLogin link locale={locale} onError={linkError} onDone={()=>{
    setConnecting(false);
    window.dispatchEvent(new Event(signInMethodsChanged));
    void reload().then(()=>switchTo(true));
   }}/>}
  </Modal>
 </>;
}

/** Opens the settings row (its own hash listener reveals and scrolls to it), also when the hash is already there. */
function showSettingsRow(){
 if(window.location.hash==='#telegram-notices')window.dispatchEvent(new HashChangeEvent('hashchange'));
 else window.location.hash='telegram-notices';
}

/**
 * A soft line in "Сейчас важно": only with a paid order still on its way, notices never turned on (any reason
 * for "off" — the switch, /stop, a block, unlinking — means the customer has already decided) and no "Not now"
 * in the last 30 days. "Turn on" with Telegram attached is the consent itself; otherwise, or when the bot still
 * needs Start, it leads to the settings row, where the next step is.
 */
export function TelegramNudge({locale}:{locale:Locale}){
 const {state,ready}=useMarket();
 const bot=useTelegramBot();
 const {link}=useTelegramLink(!!bot);
 const {busy,toggle}=useTelegramToggle(locale);
 const [now]=useState(()=>Date.now());
 const [hidden,setHidden]=useState(true);
 useEffect(()=>{queueMicrotask(()=>setHidden(nudgeDismissed(now)))},[now]);
 const waiting=state.orders.some(order=>!order.cancelled&&order.status<5&&order.payment?.status==='paid');
 const view=telegramView(state.communication,link.linkedAt,now);
 if(!bot||!link.loaded||hidden||!waiting||view.kind!=='off'||state.communication.telegramOff!==undefined)return null;
 const t=telegramUiCopy[locale];
 const later=()=>{dismissNudge(Date.now());setHidden(true)};
 const turnOn=async()=>{
  if(!link.linked){showSettingsRow();return}
  // Not done (the bot needs Start, Telegram did not answer): the row below shows "Open Telegram" and "Check again".
  if(!await toggle(true))showSettingsRow();
 };
 return <div className="tg-nudge" role="group" aria-label={t.title}>
  <span className="tg-nudge-icon" aria-hidden="true"><Send size={18}/></span>
  <p>{t.nudge}</p>
  <div className="tg-nudge-actions">
   <button type="button" className="btn secondary" disabled={!ready||busy} aria-busy={busy||undefined} onClick={()=>void turnOn()}>{busy?t.checking:t.nudgeOn}</button>
   <button type="button" className="cabinet-text-btn" onClick={later}><X size={16} aria-hidden="true"/>{t.nudgeLater}</button>
  </div>
 </div>;
}
