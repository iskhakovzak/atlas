'use client';
import {ArrowRight,Bell,CheckCheck,FileText,Inbox,Package,X} from 'lucide-react';
import Link from '@/components/site-link';
import {Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle} from '@/components/ui/sheet';
import type {RefObject} from 'react';
import {useMarket} from '@/lib/market/store';
import type {Locale} from '@/lib/market/i18n';
import {formatDateTime,noticesCopy} from '@/lib/market/notices-copy';
import {renderNotification} from '@/lib/market/history-copy';
import {noticePanel,noticeTarget,type OrderAttention} from '@/lib/market/notice-panel';
import {withCyrillic} from '@/lib/market/uz-cyrl';
import {formatSum} from '@/lib/market/format';
import {groupOrders,orderGroupCopy} from '@/lib/market/order-groups';
import './notice-panel.css';

const panelCopy=/*@__PURE__*/withCyrillic({
  ru:{action:'Нужно ваше действие',updates:'Последние обновления',reasons:{extra:'Нужна доплата',change:'Ответьте на изменение заказа',payment:'Завершите оплату'} as Record<OrderAttention,string>,order:'Позиция',open:'Открыть',document:'Открыть документ',all:'Все уведомления',close:'Закрыть уведомления',read:'Отметить все прочитанными',nothing:'Других обновлений нет.'},
  uz:{action:'Sizdan harakat kerak',updates:'So‘nggi yangilanishlar',reasons:{extra:'Qo‘shimcha to‘lov kerak',change:'Buyurtma o‘zgarishiga javob bering',payment:'To‘lovni yakunlang'} as Record<OrderAttention,string>,order:'Pozitsiya',open:'Ochish',document:'Hujjatni ochish',all:'Barcha bildirishnomalar',close:'Bildirishnomalarni yopish',read:'Hammasini o‘qilgan deb belgilash',nothing:'Boshqa yangilanishlar yo‘q.'},
  en:{action:'Your action is needed',updates:'Latest updates',reasons:{extra:'Extra payment needed',change:'Answer the order change',payment:'Complete the payment'} as Record<OrderAttention,string>,order:'Item',open:'Open',document:'Open document',all:'All notifications',close:'Close notifications',read:'Mark all as read',nothing:'No other updates.'},
});

/** The notifications sheet over the current page (left side; full screen on phones), opened by the bell in
 *  app/notifications-panel.tsx. It is a separate chunk: the notice texts, the history renderer and the order grouping
 *  load when a visitor reaches for the bell, not with every page. Radix moves focus into the sheet when it opens;
 *  without a Radix trigger, focus is handed back to the bell when it closes. /notifications stays the full inbox.
 *  Each card's link covers the whole card (header-panel.css), so a tap anywhere on it opens the order or document. */
export function NotificationsSheet({open,onOpenChange,bell}:{open:boolean;onOpenChange:(open:boolean)=>void;bell:RefObject<HTMLButtonElement|null>}){
  const {state,ready,act}=useMarket();
  const locale=state.communication.language as Locale,c=noticesCopy[locale],p=panelCopy[locale];
  const panel=noticePanel(state);
  // What an unfinished checkout waits for, by group key: the same sum as the pay card in "My orders".
  const waiting=new Map(panel.action.some(item=>item.reason==='payment')?groupOrders(state.orders).flatMap(group=>group.payment?[[group.key,group.payment.amount] as const]:[]):[]);
  const toPay=(order:{id:string;batchId?:string})=>waiting.get(order.batchId?'batch:'+order.batchId:'order:'+order.id);
  const close=()=>onOpenChange(false);
  // Stagger step for the opening animation (header-panel.css); rows past the tenth arrive together.
  const row=(index:number)=>({'--i':2+Math.min(index,8)}) as React.CSSProperties;
  const time=(at:number)=><time dateTime={new Date(at).toISOString()}>{formatDateTime(at,locale)}</time>;
  return <Sheet open={open} onOpenChange={onOpenChange}>
    {/* Focus lands on the sheet itself, not on the close button, so no focus ring flashes when it opens with a click. */}
    <SheetContent side="left" showCloseButton={false} className="notice-panel" overlayClassName="notice-panel-overlay" onOpenAutoFocus={event=>{event.preventDefault();(event.currentTarget as HTMLElement).focus({preventScroll:true})}} onCloseAutoFocus={event=>{event.preventDefault();bell.current?.focus({preventScroll:true})}}>
      <header className="notice-panel-head">
        <span className="notice-panel-mark" aria-hidden="true"><Bell size={20}/>{ready&&panel.unread>0&&<i/>}</span>
        <div className="notice-panel-heading">
          <SheetTitle>{c.title}</SheetTitle>
          <SheetDescription>{!ready?c.loading:panel.unread?c.unread(panel.unread):panel.total?c.allRead:c.emptyTitle}</SheetDescription>
          {ready&&panel.unread>0&&<button type="button" className="notice-panel-read" onClick={()=>void act({type:'notifications-read'})}><CheckCheck size={16} aria-hidden="true"/>{p.read}</button>}
        </div>
        <SheetClose asChild><button type="button" className="notice-panel-close" aria-label={p.close}><X size={19} aria-hidden="true"/></button></SheetClose>
      </header>
      <div className="notice-panel-scroll">
        {/* One item per checkout (notice-panel.ts), the same count as the "Нужно действие" tab of "My orders". */}
        {ready&&panel.action.length>0&&<section aria-labelledby="notice-panel-action"><h3 id="notice-panel-action">{p.action}<b>{panel.action.length}</b></h3><ul className="notice-panel-list">
          {panel.action.map(({order,reason,notice},index)=><li key={order.id} className="notice-panel-item attention" style={row(index)}>
            <span className="notice-panel-icon" aria-hidden="true"><Package size={18}/></span>
            <div className="notice-panel-body">
              <div className="notice-panel-top"><b>{p.reasons[reason]}</b>{notice&&time(notice.at)}</div>
              {/* The reason above is the headline; the message adds the amount and the step, without repeating a title. */}
              {notice?<p>{renderNotification(notice,locale).message}</p>:reason==='payment'&&toPay(order)!==undefined&&<p>{orderGroupCopy[locale].payable} {formatSum(toPay(order)!,locale)}</p>}
              <div className="notice-panel-foot"><span className="notice-panel-id">{reason==='payment'?'':`${p.order} ${order.id}`}</span><Link className="notice-panel-cta" href={'/orders#'+encodeURIComponent(order.id)} onClick={close}>{c.openOrder}<ArrowRight size={15} aria-hidden="true"/></Link></div>
            </div>
          </li>)}
        </ul></section>}
        {ready&&<section aria-labelledby="notice-panel-updates"><h3 id="notice-panel-updates">{p.updates}</h3>
          {!panel.updates.length?<div className="notice-panel-empty"><span aria-hidden="true"><Inbox size={24}/></span><b>{panel.total?p.nothing:c.emptyTitle}</b>{!panel.total&&<p>{c.emptyText}</p>}</div>:<ul className="notice-panel-list">
            {panel.updates.map((item,index)=>{const text=renderNotification(item,locale),target=noticeTarget(item);return <li key={item.id} className={'notice-panel-item'+(item.read?'':' unread')} style={row(panel.action.length+index)}>
              <span className="notice-panel-icon" aria-hidden="true">{target?.kind==='document'?<FileText size={18}/>:target?.kind==='order'?<Package size={18}/>:<Bell size={18}/>}</span>
              <div className="notice-panel-body">
                <div className="notice-panel-top"><b>{!item.read&&<span className="notice-panel-dot"><span className="sr-only">{c.newBadge}</span></span>}{text.title}</b>{time(item.at)}</div>
                <p>{text.message}</p>
                <div className="notice-panel-foot">
                  {target?.kind==='order'&&<Link className="order-x-link" href={target.href} onClick={close}>{p.order} {item.orderId}<ArrowRight size={14} aria-hidden="true"/></Link>}
                  {target?.kind==='document'&&<Link className="order-x-link" href={target.href} onClick={close}>{p.document}<ArrowRight size={14} aria-hidden="true"/></Link>}
                  {!target&&<Link className="order-x-link" href={'/notifications?id='+encodeURIComponent(item.id)} onClick={close}>{p.open}<ArrowRight size={14} aria-hidden="true"/></Link>}</div>
              </div>
            </li>})}
          </ul>}
        </section>}
      </div>
      <footer className="notice-panel-footer"><Link className="notice-panel-all" href="/notifications" onClick={close}>{p.all}<ArrowRight size={17} aria-hidden="true"/></Link></footer>
    </SheetContent>
  </Sheet>;
}
