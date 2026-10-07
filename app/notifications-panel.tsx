'use client';
import {ArrowRight,Bell,CheckCheck,FileText,Package,X} from 'lucide-react';
import Link from '@/components/site-link';
import {Sheet,SheetClose,SheetContent,SheetDescription,SheetTitle,SheetTrigger} from '@/components/ui/sheet';
import {useMarket} from '@/lib/market/store';
import type {Locale} from '@/lib/market/i18n';
import {formatDateTime,noticesCopy} from '@/lib/market/customer-copy';
import {renderNotification} from '@/lib/market/history-copy';
import {noticePanel,noticeTarget,type OrderAttention} from '@/lib/market/notice-panel';
import {withCyrillic} from '@/lib/market/uz-cyrl';

const panelCopy=withCyrillic({
  ru:{action:'Требуют действия',updates:'Последние обновления',reasons:{extra:'Нужно согласие на доплату',change:'Ответьте на изменение заказа',payment:'Завершите оплату'} as Record<OrderAttention,string>,order:'Заказ',open:'Открыть',document:'Открыть документ',all:'Все уведомления',close:'Закрыть уведомления',read:'Отметить прочитанными',nothing:'Ничего не требует вашего решения.'},
  uz:{action:'Harakat kerak',updates:'So‘nggi yangilanishlar',reasons:{extra:'Qo‘shimcha to‘lovga rozilik kerak',change:'Buyurtma o‘zgarishiga javob bering',payment:'To‘lovni yakunlang'} as Record<OrderAttention,string>,order:'Buyurtma',open:'Ochish',document:'Hujjatni ochish',all:'Barcha bildirishnomalar',close:'Bildirishnomalarni yopish',read:'O‘qilgan deb belgilash',nothing:'Hozir qaroringiz kerak emas.'},
  en:{action:'Needs your action',updates:'Latest updates',reasons:{extra:'Approve the extra charge',change:'Answer the order change',payment:'Complete the payment'} as Record<OrderAttention,string>,order:'Order',open:'Open',document:'Open document',all:'All notifications',close:'Close notifications',read:'Mark as read',nothing:'Nothing needs your decision.'},
});

/** The bell and the notifications sheet over the current page (left side; full screen on phones). Radix moves focus
 *  into the sheet when it opens and back to the bell when it closes. /notifications stays the full inbox. */
export function NotificationsPanel({open,onOpenChange,label,active}:{open:boolean;onOpenChange:(open:boolean)=>void;label:string;active:boolean}){
  const {state,ready,act}=useMarket();
  const locale=state.communication.language as Locale,c=noticesCopy[locale],p=panelCopy[locale];
  const panel=noticePanel(state);
  const close=()=>onOpenChange(false);
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetTrigger asChild><button type="button" aria-label={label+panel.unread} className={'icon-btn notice-link'+(active||open?' active':'')}><Bell size={20} aria-hidden="true"/>{panel.unread>0&&<b>{Math.min(panel.unread,99)}</b>}</button></SheetTrigger>
    <SheetContent side="left" showCloseButton={false} className="notice-panel">
      <header className="notice-panel-head">
        <div><SheetTitle>{c.title}</SheetTitle><SheetDescription>{!ready?c.loading:panel.unread?c.unread(panel.unread):panel.total?c.allRead:c.emptyTitle}</SheetDescription></div>
        <SheetClose asChild><button type="button" className="icon-btn" aria-label={p.close}><X size={20} aria-hidden="true"/></button></SheetClose>
      </header>
      <div className="notice-panel-scroll">
        {ready&&panel.unread>0&&<button type="button" className="btn secondary notice-panel-read" onClick={()=>void act({type:'notifications-read'})}><CheckCheck size={17} aria-hidden="true"/>{p.read}</button>}
        {ready&&panel.action.length>0&&<section aria-labelledby="notice-panel-action"><h3 id="notice-panel-action">{p.action}<b>{panel.action.length}</b></h3><ul className="notice-panel-list">
          {panel.action.map(({order,reason,notice})=><li key={order.id} className="notice-panel-item attention">
            <span className="notice-panel-icon" aria-hidden="true"><Package size={17}/></span>
            <div><b>{p.reasons[reason]}</b><p>{notice?renderNotification(notice,locale).title:''}</p>
              <div className="notice-panel-foot">{notice&&<time dateTime={new Date(notice.at).toISOString()}>{formatDateTime(notice.at,locale)}</time>}<Link className="order-x-link" href={'/orders#'+encodeURIComponent(order.id)} onClick={close}>{p.order} {order.id}<ArrowRight size={14} aria-hidden="true"/></Link></div></div>
          </li>)}
        </ul></section>}
        {ready&&<section aria-labelledby="notice-panel-updates"><h3 id="notice-panel-updates">{p.updates}</h3>
          {!panel.updates.length?<p className="notice-panel-empty">{panel.total?p.nothing:c.emptyText}</p>:<ul className="notice-panel-list">
            {panel.updates.map(item=>{const text=renderNotification(item,locale),target=noticeTarget(item);return <li key={item.id} className={'notice-panel-item'+(item.read?'':' unread')}>
              <span className="notice-panel-icon" aria-hidden="true">{target?.kind==='document'?<FileText size={17}/>:<Bell size={17}/>}</span>
              <div><b>{text.title}{!item.read&&<span className="notice-x-new">{c.newBadge}</span>}</b><p>{text.message}</p>
                <div className="notice-panel-foot"><time dateTime={new Date(item.at).toISOString()}>{formatDateTime(item.at,locale)}</time>
                  {target?.kind==='order'&&<Link className="order-x-link" href={target.href} onClick={close}>{p.order} {item.orderId}<ArrowRight size={14} aria-hidden="true"/></Link>}
                  {target?.kind==='document'&&<Link className="order-x-link" href={target.href} onClick={close}>{p.document}<ArrowRight size={14} aria-hidden="true"/></Link>}
                  {!target&&<Link className="order-x-link" href={'/notifications?id='+encodeURIComponent(item.id)} onClick={close}>{p.open}<ArrowRight size={14} aria-hidden="true"/></Link>}</div></div>
            </li>})}
          </ul>}
        </section>}
      </div>
      <footer className="notice-panel-footer"><Link className="btn secondary" href="/notifications" onClick={close}>{p.all}<ArrowRight size={17} aria-hidden="true"/></Link></footer>
    </SheetContent>
  </Sheet>;
}
