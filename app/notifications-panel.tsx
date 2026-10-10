'use client';
import {Suspense,lazy,useRef,useState} from 'react';
import {Bell} from 'lucide-react';
import {useMarket} from '@/lib/market/store';
import {noticePanel} from '@/lib/market/notice-panel';

// The sheet itself (texts, history renderer, order grouping) is its own chunk: app/notifications-sheet.tsx.
const load=()=>import('./notifications-sheet');
const NotificationsSheet=lazy(()=>load().then(module=>({default:module.NotificationsSheet})));
const preload=()=>{void load()};

/** The bell in the header with the unread count. A pointer over it or focus on it starts loading the sheet, so the
 *  click usually finds it ready; the sheet stays mounted after its first opening so it can animate its closing. */
export function NotificationsPanel({open,onOpenChange,label,active}:{open:boolean;onOpenChange:(open:boolean)=>void;label:string;active:boolean}){
  const {state}=useMarket();
  const unread=noticePanel(state).unread;
  const bell=useRef<HTMLButtonElement>(null);
  const [used,setUsed]=useState(false);
  if(open&&!used)setUsed(true);
  return <>
    <button ref={bell} type="button" aria-label={label+unread} aria-haspopup="dialog" aria-expanded={open} data-state={open?'open':'closed'} className={'icon-btn notice-link'+(active||open?' active':'')+(unread>0?' has-unread':'')} onPointerEnter={preload} onFocus={preload} onClick={()=>{preload();onOpenChange(!open)}}><Bell size={20} strokeWidth={1.85} aria-hidden="true" key={unread>0?'ring':'still'}/>{unread>0&&<b key={unread}>{Math.min(unread,99)}</b>}</button>
    {used&&<Suspense fallback={null}><NotificationsSheet open={open} onOpenChange={onOpenChange} bell={bell}/></Suspense>}
  </>;
}
