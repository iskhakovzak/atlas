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

import { CustomsEstimate } from "./customs-estimate";
const emptyDelivery: DeliveryProfile = { recipient: "", phone: "", region: "Ташкент", city: "Ташкент", address: "", postalCode: "", comment: "" };

export function CartView() {
  const { state, act, ready, error, user, pricing } = useMarket();
  const [useBalance, setUseBalance] = useState(false);
  const [consent, setConsent] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [review,setReview]=useState(false);
  const [delivery, setDelivery] = useState<DeliveryProfile>(emptyDelivery);
  const [selectedProfile, setSelectedProfile] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  const expired = now > 0 && state.cart.some((item) => now >= item.quote.expiresAt);
  const total = totalOf(state.cart);
  const balance = balanceOf(state);
  const credit = useBalance ? Math.min(total, Math.max(0, balance)) : 0;
  const locale = state.communication.language;
  const c = {
    ru:{overline:"ОФОРМЛЕНИЕ ЗАКАЗА",title:"Ваша корзина.",intro:"Проверьте товары, варианты и предварительный расчёт.",signin:"Войдите, чтобы открыть корзину",signinHint:"Корзина и заказы сохраняются в вашем профиле Atlas.",loading:"Загружаем корзину…",empty:"Корзина ждёт ваших находок",emptyHint:"Выберите товар в каталоге или добавьте свою ссылку.",order:"Ваш заказ",breakdown:"Состав стоимости",estimate:"Расчёт предварительный. После приёмки на складе изменение стоимости запрашивается отдельно и применяется только после вашего подтверждения.",checkout:"Указать доставку",renew:"Обновить расчёт",assurance:"Доплата только с вашего согласия",delivery:"Получатель и адрес",deliveryHint:"Данные сохранятся в профиле и будут зафиксированы в заказе.",success:"Предзаказ оформлен",successHint:"Адрес сохранён. Завершите оплату в разделе заказов."},
    uz:{overline:"BUYURTMANI RASMIYLASHTIRISH",title:"Savatingiz.",intro:"Tovarlar, variantlar va dastlabki hisobni tekshiring.",signin:"Savatni ochish uchun kiring",signinHint:"Savat va buyurtmalar Atlas profilingizda saqlanadi.",loading:"Savat yuklanmoqda…",empty:"Savat topilmalaringizni kutmoqda",emptyHint:"Katalogdan tovar tanlang yoki o‘z havolangizni qo‘shing.",order:"Buyurtmangiz",breakdown:"Narx tarkibi",estimate:"Hisob dastlabki. Ombordagi qabuldan keyingi narx o‘zgarishi alohida yuboriladi va faqat tasdiqlashingizdan so‘ng qo‘llanadi.",checkout:"Yetkazish manzilini kiritish",renew:"Hisobni yangilash",assurance:"Qo‘shimcha to‘lov faqat roziligingiz bilan",delivery:"Qabul qiluvchi va manzil",deliveryHint:"Ma’lumotlar profilingizda saqlanadi va buyurtmaga biriktiriladi.",success:"Oldindan buyurtma yaratildi",successHint:"Manzil saqlandi. Buyurtmalar bo‘limida sinov to‘lovini yakunlang."},
    en:{overline:"CHECKOUT",title:"Your cart.",intro:"Review items, variants and the preliminary calculation.",signin:"Sign in to open your cart",signinHint:"Your cart and orders are saved to your Atlas profile.",loading:"Loading cart…",empty:"Your cart is ready for finds",emptyHint:"Choose an item from the catalog or add your own link.",order:"Your order",breakdown:"Price breakdown",estimate:"This is a preliminary calculation. After warehouse intake, any price change is requested separately and applies only after your approval.",checkout:"Add delivery details",renew:"Refresh calculation",assurance:"Extra charges require your approval",delivery:"Recipient and address",deliveryHint:"The details are saved to your profile and attached to the order.",success:"Pre-order created",successHint:"Address saved. Complete the simulated payment in Orders."},
  }[locale];
  const sums = state.cart.reduce((result, item) => ({
    merchandise: result.merchandise + item.quote.merchandise,
    service: result.service + item.quote.service,
    shipping: result.shipping + item.quote.shipping,
    reserve: result.reserve + item.quote.reserve,
    sourceShipping: result.sourceShipping + (item.quote.sourceShipping ?? 0),
    buyout: result.buyout + (item.quote.buyout ?? 0),
    conversion: result.conversion + (item.quote.conversion ?? 0),
    deliveryMargin: result.deliveryMargin + (item.quote.deliveryMargin ?? 0),
    optionalServices: result.optionalServices + (item.quote.optionalServices ?? 0),
  }), { merchandise: 0, service: 0, shipping: 0, reserve: 0, sourceShipping: 0, buyout: 0, conversion: 0, deliveryMargin: 0, optionalServices: 0 });

  function openCheckout() {
    if (expired) { void act({ type: "cart-renew" }); return; }
    const saved = state.deliveryProfiles.find(profile => profile.primary) ?? state.deliveryProfiles[0];
    setSelectedProfile(saved?.id ?? "manual");
    setDelivery(saved ?? state.deliveryProfile ?? { ...emptyDelivery, recipient: user?.name ?? "", phone: state.communication.phone });
    setCheckoutOpen(true);
    setReview(false);
  }

  async function checkout() {
    if (busy) return;
    setBusy(true);
    const ok = await act({ type: "checkout", key: crypto.randomUUID(), signature: cartSignature(state.cart), useBalance, expectedCredit: credit, consentVersion: customsVersion, delivery });
    setBusy(false);
    if (ok) { setCheckoutOpen(false); setSuccess(true); }
  }

  return <>
    <PageHeading overline={c.overline} title={c.title} description={c.intro} />
    {!ready ? (error ? <Empty title={c.signin} description={c.signinHint} href="/account" label={c.signin} /> : <div className="surface loading-state">{c.loading}</div>) : !state.cart.length ? <Empty title={c.empty} description={c.emptyHint} href="/" /> :
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
            <div className="cart-item-price"><strong>{money(item.quote.total)}</strong><span>За {item.quantity} шт.</span><Expiry expiresAt={item.quote.expiresAt} /></div>
          </article>)}
          <Link className="text-link" href="/">Продолжить покупки <ArrowRight size={16} /></Link>
        </div>
        <aside className="surface cart-summary"><h2>{c.order}</h2><details className="quote-details"><summary>{c.breakdown}</summary><CostLines q={sums} locale={locale} /><p className="micro">{c.estimate}</p></details>
          <p className="micro parcel-note">Товары одного магазина считаются одной посылкой: вес складывается, запас на упаковку добавляется один раз. Минимальный оплачиваемый вес посылки — 1 кг.</p>
          <div className="balance-option"><div><Wallet size={18} /><label htmlFor="use-balance">Использовать баланс Atlas<small>Доступно {money(balance)}</small></label></div><Checkbox id="use-balance" disabled={balance <= 0} checked={useBalance} onCheckedChange={(value) => setUseBalance(value === true)} /></div>
          {credit > 0 && <div className="credit-line"><span>С баланса Atlas</span><b>−{money(credit)}</b></div>}
          <div className="summary-total"><span>К оплате<strong>{money(total - credit)}</strong></span><span className="currency-mark">UZS</span></div>
          <CustomsEstimate valueUsd={state.cart.reduce((sum, item) => sum + item.product.usd * item.quantity, 0)} grossKg={state.cart.reduce((sum, item) => sum + (item.product.boxedWeight ?? item.product.weight) * item.quantity, 0)} fx={pricing.fx} locale={state.communication.language}/>
          <div className="consent"><Checkbox id="checkout-consent" checked={consent} onCheckedChange={(value) => setConsent(value === true)} /><label htmlFor="checkout-consent">Подтверждаю <Link href="/customs" target="_blank">таможенные условия</Link>. Реальная оплата и доставка ещё не подключены: это подтверждение не списывает деньги и не создаёт отправку.</label></div>
          {expired && <div className="notice warning"><Clock3 size={19} /><span>Срок расчёта истёк. Обновите стоимость.</span></div>}
          <button className="btn primary full" disabled={!ready || (!expired && !consent)} onClick={openCheckout}>{expired ? c.renew : c.checkout}<ArrowRight size={18} /></button>
          <div className="summary-assurance"><ShieldCheck size={16} /><span>{c.assurance}</span></div>
        </aside>
      </div>}

    <Modal open={checkoutOpen} onClose={() => { if (!busy) setCheckoutOpen(false); }} title={c.delivery} description={c.deliveryHint}>
      <ol className="checkout-progress"><li className={!review?'active':''}>1 · {locale==='ru'?'Получатель':locale==='uz'?'Qabul qiluvchi':'Recipient'}</li><li className={review?'active':''}>2 · {locale==='ru'?'Проверка':locale==='uz'?'Tekshirish':'Review'}</li></ol>
      <form className="checkout-form" onSubmit={(event) => { event.preventDefault(); if(!review){setReview(true);return;} void checkout(); }}>
        {!review&&<>
        <div className="checkout-address-head"><MapPin size={21} /><span>Доставка по Узбекистану</span></div>
        {state.deliveryProfiles.length > 0 && <div className="field"><label htmlFor="saved-recipient">Сохранённый получатель</label><select id="saved-recipient" value={selectedProfile} onChange={event => { const profile = state.deliveryProfiles.find(item => item.id === event.target.value); setSelectedProfile(event.target.value); if (profile) setDelivery(profile); }}><option value="manual">Ввести новый адрес</option>{state.deliveryProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label} · {profile.recipient}</option>)}</select><small>Можно выбрать адрес из профиля или указать новый.</small></div>}
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
        </>}
        {review&&<section className="checkout-review"><h3>{delivery.recipient}</h3><p>{delivery.phone}</p><p>{delivery.region}, {delivery.city}, {delivery.address}</p><button type="button" className="text-button" onClick={()=>setReview(false)}>{locale==='ru'?'Изменить адрес':locale==='uz'?'Manzilni o‘zgartirish':'Edit address'}</button><hr/><div className="review-items">{state.cart.map(item=><div key={item.id}><span>{item.product.name}<small>{item.variant} · {item.quantity}</small></span><b>{money(item.quote.total)}</b></div>)}</div><details className="quote-details"><summary>{c.breakdown}</summary><CostLines q={sums} locale={locale}/></details></section>}
        <div className="payment-preview"><div><span>{locale==='ru'?'Предварительный итог':locale==='uz'?'Dastlabki jami':'Estimated total'}</span><b>{state.cart.length} {locale==='ru'?'товаров':locale==='uz'?'tovar':'items'}</b></div><strong>{money(total - credit)}</strong></div>
        {review&&<p className="micro">{locale==='ru'?'Предзаказ сохраняется в Atlas. Реальные платежи и доставка ещё не подключены.':locale==='uz'?'Oldindan buyurtma Atlas’da saqlanadi. Haqiqiy to‘lov va yetkazish hali ulanmagan.':'Your pre-order is saved in Atlas. Real payments and delivery are not connected yet.'}</p>}
        <button className="btn primary full" disabled={busy}>{busy ? "Сохраняем заказ…" : review ? (locale==='ru'?"Подтвердить предзаказ":locale==='uz'?'Oldindan buyurtmani tasdiqlash':'Confirm pre-order') : (locale==='ru'?'Проверить заказ':locale==='uz'?'Buyurtmani tekshirish':'Review order')}<Check size={18} /></button>
      </form>
    </Modal>

    <Modal open={success} onClose={() => { setSuccess(false); window.location.assign("/orders"); }} title={c.success} description={c.successHint}>
      <div className="success-icon"><Check size={35} /></div><button className="btn primary full" onClick={() => { setSuccess(false); window.location.assign("/orders"); }}>Перейти к оплате <ArrowRight size={18} /></button><p className="micro center">Реальных списаний, писем, SMS и доставки не происходит.</p>
    </Modal>
  </>;
}
