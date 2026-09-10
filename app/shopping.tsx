"use client";

import { useEffect, useState } from "react";
import Link from "@/components/site-link";
import { ArrowRight, Check, Clock3, MapPin, Minus, Plus, ShieldCheck, Trash2, Wallet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarket } from "@/lib/market/store";
import { balanceOf, cartSignature, money, totalOf, type DeliveryProfile } from "@/lib/market/domain";
import { customsVersion } from "@/lib/market/world";
import { CostLines, Empty, Expiry, Modal, PageHeading, ProductImage } from "./market-ui";
import {cities,regions,streets,suggestions} from "@/lib/market/addresses";

const emptyDelivery: DeliveryProfile = { recipient: "", phone: "", region: "Ташкент", city: "Ташкент", address: "", postalCode: "", comment: "" };

export function CartView() {
  const { state, act, ready, error, user } = useMarket();
  const [useBalance, setUseBalance] = useState(false);
  const [consent, setConsent] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryProfile>(emptyDelivery);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const expired = now > 0 && state.cart.some((item) => now >= item.quote.expiresAt);
  const total = totalOf(state.cart);
  const balance = balanceOf(state);
  const credit = useBalance ? Math.min(total, Math.max(0, balance)) : 0;
  const sums = state.cart.reduce((result, item) => ({
    merchandise: result.merchandise + item.quote.merchandise,
    service: result.service + item.quote.service,
    shipping: result.shipping + item.quote.shipping,
    reserve: result.reserve + item.quote.reserve,
    sourceShipping: result.sourceShipping + (item.quote.sourceShipping ?? 0),
  }), { merchandise: 0, service: 0, shipping: 0, reserve: 0, sourceShipping: 0 });

  function openCheckout() {
    if (expired) { void act({ type: "cart-renew" }); return; }
    setDelivery(state.deliveryProfile ?? { ...emptyDelivery, recipient: user?.name ?? "", phone: state.communication.phone });
    setCheckoutOpen(true);
  }

  async function checkout() {
    if (busy) return;
    setBusy(true);
    const ok = await act({ type: "checkout", key: crypto.randomUUID(), signature: cartSignature(state.cart), useBalance, expectedCredit: credit, consentVersion: customsVersion, delivery });
    setBusy(false);
    if (ok) { setCheckoutOpen(false); setSuccess(true); }
  }

  return <>
    <PageHeading overline="ПРЕДРЕЛИЗНОЕ ОФОРМЛЕНИЕ" title="Ваша корзина." description="Проверьте товары, укажите получателя и пройдите безопасный тест оплаты." />
    {!ready ? (error ? <Empty title="Войдите, чтобы открыть корзину" description="Корзина и заказы сохраняются в вашем профиле Atlas." href="/account" label="Открыть вход" /> : <div className="surface loading-state">Загружаем корзину…</div>) : !state.cart.length ? <Empty title="Корзина ждёт ваших находок" description="Выберите товар в каталоге или добавьте свою ссылку." href="/" /> :
      <div className="cart-layout">
        <div className="cart-items">
          {state.cart.map((item) => <article className="surface cart-item" key={item.id}>
            <div className="cart-product-photo"><ProductImage product={item.product} decorative /></div>
            <div className="cart-item-body">
              <span className="eyebrow">{item.product.brand}</span><h2>{item.product.name}</h2><p>{item.variant} · {item.product.country ?? "США"}</p>
              {item.product.sourceUrl && <a className="text-link micro" href={item.product.sourceUrl} target="_blank" rel="noopener noreferrer">Источник товара</a>}
              <div className="item-controls"><div className="quantity-control">
                <button aria-label={`Уменьшить количество ${item.product.name}`} disabled={item.quantity <= 1} onClick={() => void act({ type: "cart-quantity", id: item.id, quantity: item.quantity - 1 })}><Minus size={16} /></button>
                <span aria-label="Количество">{item.quantity}</span>
                <button aria-label={`Увеличить количество ${item.product.name}`} disabled={item.quantity >= 10} onClick={() => void act({ type: "cart-quantity", id: item.id, quantity: item.quantity + 1 })}><Plus size={16} /></button>
              </div><button className="remove-item" aria-label={`Удалить ${item.product.name}`} onClick={() => void act({ type: "cart-remove", id: item.id })}><Trash2 size={16} /><span>Удалить</span></button></div>
            </div>
            <div className="cart-item-price"><strong>{money(item.quote.total)}</strong><span>За {item.quantity} шт. с резервом</span><Expiry expiresAt={item.quote.expiresAt} /></div>
          </article>)}
          <Link className="text-link" href="/">Продолжить покупки <ArrowRight size={16} /></Link>
        </div>
        <aside className="surface cart-summary"><h2>Ваш заказ</h2><CostLines q={sums} />
          <div className="balance-option"><div><Wallet size={18} /><label htmlFor="use-balance">Использовать демобаланс<small>Доступно {money(balance)}</small></label></div><Checkbox id="use-balance" disabled={balance <= 0} checked={useBalance} onCheckedChange={(value) => setUseBalance(value === true)} /></div>
          {credit > 0 && <div className="credit-line"><span>С демобаланса</span><b>−{money(credit)}</b></div>}
          <div className="summary-total"><span>К тестовой оплате<strong>{money(total - credit)}</strong></span><span className="currency-mark">UZS</span></div>
          <div className="notice warning">Для курьерских отправлений указан ориентир $200 за календарный месяц на получателя; для почтовых — отдельная норма $100. Таможенные платежи не включены. <Link href="/customs">Подробнее</Link></div>
          <div className="consent"><Checkbox id="checkout-consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><label htmlFor="checkout-consent">Подтверждаю <Link href="/customs" target="_blank">таможенные условия</Link>. Понимаю, что это предрелиз: реального списания и доставки нет.</label></div>
          {expired && <div className="notice warning"><Clock3 size={19} /><span>Срок расчёта истёк. Обновите стоимость.</span></div>}
          <button className="btn primary full" disabled={!ready || (!expired && !consent)} onClick={openCheckout}>{expired ? "Обновить расчёт" : "Указать доставку"}<ArrowRight size={18} /></button>
          <div className="summary-assurance"><ShieldCheck size={16} /><span>Доплата только с вашего согласия</span></div>
        </aside>
      </div>}

    <Modal open={checkoutOpen} onClose={() => { if (!busy) setCheckoutOpen(false); }} title="Получатель и адрес" description="Данные сохранятся в профиле и будут зафиксированы в заказе.">
      <form className="checkout-form" onSubmit={(event) => { event.preventDefault(); void checkout(); }}>
        <div className="checkout-address-head"><MapPin size={21} /><span>Доставка по Узбекистану</span></div>
        <div className="two-fields">
          <div className="field"><label htmlFor="recipient">Получатель</label><input id="recipient" required minLength={2} maxLength={100} value={delivery.recipient} onChange={(event) => setDelivery({ ...delivery, recipient: event.target.value })} /></div>
          <div className="field"><label htmlFor="recipient-phone">Телефон</label><input id="recipient-phone" required type="tel" minLength={7} maxLength={30} placeholder="+998 90 123 45 67" value={delivery.phone} onChange={(event) => setDelivery({ ...delivery, phone: event.target.value })} /></div>
          <div className="field"><label htmlFor="region">Область</label><input id="region" list="region-suggestions" autoComplete="address-level1" required minLength={2} maxLength={100} value={delivery.region} onChange={(event) => setDelivery({ ...delivery, region: event.target.value })} /><datalist id="region-suggestions">{suggestions(regions,delivery.region).map(value=><option key={value} value={value}/>)}</datalist></div>
          <div className="field"><label htmlFor="city">Город</label><input id="city" list="city-suggestions" autoComplete="address-level2" required minLength={2} maxLength={100} value={delivery.city} onChange={(event) => setDelivery({ ...delivery, city: event.target.value })} /><datalist id="city-suggestions">{suggestions(cities,delivery.city).map(value=><option key={value} value={value}/>)}</datalist></div>
        </div>
        <div className="field"><label htmlFor="delivery-address">Улица, дом, квартира</label><input id="delivery-address" list="street-suggestions" autoComplete="street-address" required minLength={5} maxLength={220} placeholder="Начните вводить улицу" value={delivery.address} onChange={(event) => setDelivery({ ...delivery, address: event.target.value })} /><datalist id="street-suggestions">{suggestions(streets,delivery.address).map(value=><option key={value} value={value}/>)}</datalist><small>Подсказки Atlas работают локально — адрес не передаётся стороннему поиску.</small></div>
        <div className="two-fields">
          <div className="field"><label htmlFor="postal-code">Индекс</label><input id="postal-code" maxLength={20} value={delivery.postalCode} onChange={(event) => setDelivery({ ...delivery, postalCode: event.target.value })} /></div>
          <div className="field"><label htmlFor="delivery-comment">Комментарий</label><input id="delivery-comment" maxLength={300} value={delivery.comment} onChange={(event) => setDelivery({ ...delivery, comment: event.target.value })} /></div>
        </div>
        <div className="payment-preview"><div><span>Способ оплаты</span><b>Тестовая платёжная ссылка</b></div><strong>{money(total - credit)}</strong></div>
        <p className="micro">На следующем экране можно безопасно имитировать подтверждение платёжного провайдера.</p>
        <button className="btn primary full" disabled={busy}>{busy ? "Сохраняем заказ…" : "Подтвердить предзаказ"}<Check size={18} /></button>
      </form>
    </Modal>

    <Modal open={success} onClose={() => { setSuccess(false); window.location.assign("/orders"); }} title="Предзаказ оформлен" description="Адрес сохранён. Завершите тестовую оплату в разделе заказов.">
      <div className="success-icon"><Check size={35} /></div><button className="btn primary full" onClick={() => { setSuccess(false); window.location.assign("/orders"); }}>Перейти к оплате <ArrowRight size={18} /></button><p className="micro center">Реальных списаний, писем, SMS и доставки не происходит.</p>
    </Modal>
  </>;
}
