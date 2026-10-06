"use client";
// Admin → Тарифы и услуги: "what is in force now" above the PricingManager form (app/order-workspace.tsx).
import type {Pricing} from "@/lib/market/domain";
import {pricingSnapshot} from "@/lib/market/admin-dashboard";
import {dateTime} from "./admin-shared";

const usd=(value:number)=>`$${value.toFixed(2).replace('.',',')}`;
export function PricingSummary({pricing}:{pricing:Pricing}){
 const s=pricingSnapshot(pricing);
 return <section className="surface admin-section admin-pricing-summary" aria-label="Действующий тариф">
  <div className="admin-section-head"><div><h2>Что действует сейчас</h2><p>Версия {s.version}{s.managedBy?` · ${s.managedBy}`:''} · изменено {s.updatedAt?dateTime(s.updatedAt):'—'}</p></div></div>
  <dl className="admin-now">
   <div><dt>Курс USD</dt><dd>{new Intl.NumberFormat('ru-RU').format(Math.round(s.fx))} сум</dd><small>{s.fxSource}{s.fxDate?` · ЦБ на ${s.fxDate}`:''}{s.fxUpdatedAt?` · обновлён ${dateTime(s.fxUpdatedAt)}`:''}</small></div>
   <div><dt>Экспресс</dt><dd>{usd(s.expressPerKgUsd)} / кг</dd><small>международная доставка</small></div>
   <div><dt>Обычная</dt><dd>{usd(s.standardPerKgUsd)} / кг</dd><small>международная доставка</small></div>
   <div><dt>Комиссия Atlas</dt><dd>{s.marginPercent.toLocaleString('ru-RU')} %</dd><small>только от товаров</small></div>
   <div><dt>Резерв доставки</dt><dd>{s.reserve?`${Math.round(s.reserve*100)} %`:'нет'}</dd><small>{s.reserve?'отдельная строка в счёте':'в счёте не показывается'}</small></div>
   <div><dt>Таможня через Atlas</dt><dd>{s.customsHelpPercent.toLocaleString('ru-RU')} %</dd><small>от стоимости товара, по выбору клиента</small></div>
   <div><dt>Доставка магазина</dt><dd>бесплатно от {usd(s.storeShippingFreeFromUsd)}</dd><small>когда магазин её не указал</small></div>
  </dl>
 </section>;
}
