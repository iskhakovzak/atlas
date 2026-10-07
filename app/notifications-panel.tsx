'use client';
import {ArrowRight,Bell,CheckCheck,FileText,Inbox,Package,X} from 'lucide-react';
import Link from '@/components/site-link';
import {Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle,SheetTrigger} from '@/components/ui/sheet';
import {useMarket} from '@/lib/market/store';
import type {Locale} from '@/lib/market/i18n';
import {formatDateTime,noticesCopy} from '@/lib/market/notices-copy';
import {renderNotification} from '@/lib/market/history-copy';
import {noticePanel,noticeTarget,type OrderAttention} from '@/lib/market/notice-panel';
import {withCyrillic} from '@/lib/market/uz-cyrl';

const panelCopy=/*@__PURE__*/withCyrillic({
  ru:{action:'Требуют действия',updates:'Последние обновления',reasons:{extra:'Подтвердите доплату',change:'Ответьте на изменение заказа',payment:'Завершите оплату'} as Record<OrderAttention,string>,order:'Заказ',open:'Открыть',document:'Открыть документ',all:'Все уведомления',close:'Закрыть уведомления',read:'Отметить все прочитанными',nothing:'Других обновлений нет.'},
  uz:{action:'Harakat kerak',updates:'So‘nggi yangilanishlar',reasons:{extra:'Qo‘shimcha to‘lovni tasdiqlang',change:'Buyurtma o‘zgarishiga javob bering',payment:'To‘lovni yakunlang'} as Record<OrderAttention,string>,order:'Buyurtma',open:'Ochish',document:'Hujjatni ochish',all:'Barcha bildirishnomalar',close:'Bildirishnomalarni yopish',read:'Hammasini o‘qilgan deb belgilash',nothing:'Boshqa yangilanishlar yo‘q.'},
  en:{action:'Action needed',updates:'Latest updates',reasons:{extra:'Approve the extra payment',change:'Answer the order change',payment:'Complete the payment'} as Record<OrderAttention,string>,order:'Order',open:'Open',document:'Open document',all:'All notifications',close:'Close notifications',read:'Mark all as read',nothing:'No other updates.'},
});

/** The bell and the notifications sheet over the current page (left side; full screen on phones). Radix moves focus
 *  into the sheet when it opens and back to the bell when it closes. /notifications stays the full inbox.
 *  Each card's link covers the whole card (header-panel.css), so a tap anywhere on it opens the order or document. */
export function NotificationsPanel({open,onOpenChange,label,active}:{open:boolean;onOpenChange:(open:boolean)=>void;label:string;active:boolean}){
  const {state,ready,act}=useMarket();
  const locale=state.communication.language as Locale,c=noticesCopy[locale],p=panelCopy[locale];
  const panel=noticePanel(state);
  const close=()=>onOpenChange(false);
  // Stagger step for the opening animation (header-panel.css); rows past the tenth arrive together.
  const row=(index:number)=>({'--i':2+Math.min(index,8)}) as React.CSSProperties;
  const time=(at:number)=><time dateTime={new Date(at).toISOString()}>{formatDateTime(at,locale)}</time>;
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetTrigger asChild><button type="button" aria-label={label+panel.unread} className={'icon-btn notice-link'+(active||open?' active':'')+(panel.unread>0?' has-unread':'')}><Bell size={20} strokeWidth={1.85} aria-hidden="true" key={panel.unread>0?'ring':'still'}/>{panel.unread>0&&<b key={panel.unread}>{Math.min(panel.unread,99)}</b>}</button></SheetTrigger>
    {/* Focus lands on the sheet itself, not on the close button, so no focus ring flashes when it opens with a click. */}
    <SheetContent side="left" showCloseButton={false} className="notice-panel" overlayClassName="notice-panel-overlay" onOpenAutoFocus={event=>{event.preventDefault();(event.currentTarget as HTMLElement).focus({preventScroll:true})}}>
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
        {ready&&panel.action.length>0&&<section aria-labelledby="notice-panel-action"><h3 id="notice-panel-action">{p.action}<b>{panel.action.length}</b></h3><ul className="notice-panel-list">
          {panel.action.map(({order,reason,notice},index)=><li key={order.id} className="notice-panel-item attention" style={row(index)}>
            <span className="notice-panel-icon" aria-hidden="true"><Package size={18}/></span>
            <div className="notice-panel-body">
              <div className="notice-panel-top"><b>{p.reasons[reason]}</b>{notice&&time(notice.at)}</div>
              {notice&&<p>{renderNotification(notice,locale).title}</p>}
              <div className="notice-panel-foot"><span className="notice-panel-id">{p.order} {order.id}</span><Link className="notice-panel-cta" href={'/orders#'+encodeURIComponent(order.id)} onClick={close}>{c.openOrder}<ArrowRight size={15} aria-hidden="true"/></Link></div>
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
