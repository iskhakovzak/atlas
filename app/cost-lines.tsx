'use client';
import {CircleHelp} from 'lucide-react';
import {type Quote} from '@/lib/market/domain';
import {atlasServiceBreakdown,billLines} from '@/lib/market/quote-presentation';
import {formatPercent,formatSum} from '@/lib/market/format';
import {calcCopy} from '@/lib/market/calc-copy';
import {pickLocale} from '@/lib/market/uz-cyrl';
import {type Locale} from '@/lib/market/i18n';

// The bill lines live apart from app/market-ui.tsx so pages without a bill do not load the calculator copy.
/** `storeReserveWaived`: store delivery is unknown and no reserve was taken (a large enough store order), so it is not "free". */
/** The lines in the order of the cart and the checkout (owner, 2 November 2026): items · Сервис Atlas · promo code ·
 *  international delivery · store delivery · guarantee and services · duty · reserve. */
export function CostLines({ q, shippingUnknown = false, storeReserveWaived = false, locale = "ru", internationalHelp, promoCode }: { q: Pick<Quote, "merchandise" | "service" | "shipping" | "reserve" | "sourceShipping" | "storeShippingHold" | "buyout" | "conversion" | "deliveryMargin" | "optionalServices" | "customsHelp" | "customsHelpRate" | "customsDuty" | "serviceFees" | "promoDiscount"> & { weight?: number }; shippingUnknown?: boolean; storeReserveWaived?: boolean; locale?: Locale; internationalHelp?: string; promoCode?: string }) {
  const copy = pickLocale({
    ru: { item: "Товары", merchantShipping: "Доставка магазина", service: "Сервис Atlas", fee: "Комиссия Atlas", international: "Международная доставка", optional: "Дополнительные услуги", insurance: "Гарантия сохранности Atlas", reserve: "Возвратный резерв", breakdown: "Состав сервиса", help: "Как считается международная доставка", reserveHelp: "Резерв покрывает посылку, пока склад не взвесит её и не измерит габариты. Если международная доставка выйдет дешевле, разницу зачислим на внутренний баланс Atlas. Если дороже — сначала сообщим сумму; доплата только с вашего согласия.", reserveHelpLabel: "О возвратном резерве", unknown: "Уточняется", free: "Бесплатно", noReserve: "Без резерва", promo: "Скидка по промокоду" },
    uz: { item: "Tovarlar", merchantShipping: "Do‘kon yetkazishi", service: "Atlas xizmati", fee: "Atlas komissiyasi", international: "Xalqaro yetkazish", optional: "Qo‘shimcha xizmatlar", insurance: "Atlas saqlash kafolati", reserve: "Qaytariladigan zaxira", breakdown: "Xizmat tarkibi", help: "Xalqaro yetkazish qanday hisoblanadi", reserveHelp: "Zaxira ombor jo‘natmani tortib, o‘lchamlarini o‘lchaguncha uni qoplaydi. Xalqaro yetkazish arzonroq chiqsa, farq Atlas ichki balansiga qaytariladi. Qimmatroq bo‘lsa — avval summani aytamiz; qo‘shimcha to‘lov faqat roziligingiz bilan.", reserveHelpLabel: "Qaytariladigan zaxira haqida", unknown: "Aniqlanmoqda", free: "Bepul", noReserve: "Zaxirasiz", promo: "Promokod chegirmasi" },
    en: { item: "Items", merchantShipping: "Store delivery", service: "Atlas service", fee: "Atlas fee", international: "International delivery", optional: "Extra services", insurance: "Atlas safe-arrival guarantee", reserve: "Refundable reserve", breakdown: "Service breakdown", help: "How international delivery is estimated", reserveHelp: "The reserve covers the parcel until the warehouse weighs and measures it. If international delivery costs less, the difference is credited to your Atlas balance. If it costs more, we tell you the amount first; any extra payment needs your consent.", reserveHelpLabel: "About the refundable reserve", unknown: "To be confirmed", free: "Free", noReserve: "No reserve", promo: "Promo code discount" },
  }, locale);
  const lines = billLines(q);
  // "Atlas pays customs" is part of the Atlas service, as in the cart (owner, 12 October 2026); with it the line names its two parts.
  const serviceParts = [
    { key: "service", label: copy.fee, amount: atlasServiceBreakdown(q).service },
    { key: "customsHelp", label: calcCopy[locale].lines.customsHelp(formatPercent(q.customsHelpRate ?? 0, locale)), amount: q.customsHelp ?? 0 },
  ].filter(part => part.amount > 0);
  const kg = q.weight ? new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 2 }).format(q.weight) : "";
  const merchantShipping = <div><dt>{copy.merchantShipping}</dt><dd>{shippingUnknown ? copy.unknown : q.sourceShipping ? formatSum(q.sourceShipping, locale) : q.storeShippingHold ? calcCopy[locale].lines.holdOutside : q.storeShippingHold === 0 ? calcCopy[locale].lines.free : storeReserveWaived ? copy.noReserve : copy.free}</dd></div>;
  return <dl className="cost-lines">
    <div><dt>{copy.item}</dt><dd>{formatSum(q.merchandise, locale)}</dd></div>
    {lines.service > 0 && <div className="cost-service-row">
      <dt>{copy.service}</dt>
      <dd>
        <span className="cost-service-total">{formatSum(lines.service, locale)}</span>
        {serviceParts.length > 1 && <details className="cost-service-breakdown">
          <summary>{copy.breakdown}</summary>
          <dl>{serviceParts.map(part => <div key={part.key}><dt>{part.label}</dt><dd><span>{formatSum(part.amount, locale)}</span></dd></div>)}</dl>
        </details>}
      </dd>
    </div>}
    {/* A promo code took this off the Atlas commission (redesign stage 6): the lines add up to what was paid. */}
    {(q.promoDiscount ?? 0) > 0 && <div className="cost-promo"><dt>{copy.promo}{promoCode ? ` ${promoCode}` : ""}</dt><dd>−{formatSum(q.promoDiscount ?? 0, locale)}</dd></div>}
    {/* International delivery is its own line, as in the cart and the checkout (owner, 2 November 2026). */}
    {lines.delivery > 0 && <div className="cost-delivery-row"><dt>{calcCopy[locale].lines.delivery(kg, "")}</dt><dd>
      <span>{formatSum(lines.delivery, locale)}</span>
      {internationalHelp && <details className="quote-cost-help">
        <summary aria-label={copy.help} title={copy.help}><CircleHelp size={16}/></summary>
        <div className="quote-cost-help-popover"><p>{internationalHelp}</p></div>
      </details>}
    </dd></div>}
    {merchantShipping}
    {/* Since 4 October 2026 an unknown store delivery is held apart from the sum: shown here, never added in. */}
    {(q.storeShippingHold ?? 0) > 0 && <div className="cost-hold"><dt>{calcCopy[locale].hold}</dt><dd>{formatSum(q.storeShippingHold!, locale)}<small>{calcCopy[locale].holdNote}</small></dd></div>}
    {(q.optionalServices ?? 0) > 0 && <div><dt>{copy.optional}</dt><dd>{formatSum(q.optionalServices ?? 0, locale)}</dd></div>}
    {(q.serviceFees ?? []).filter(fee => fee.amount > 0).map(fee => <div key={fee.id}><dt>{copy.insurance} · {formatPercent(fee.rate, locale)}</dt><dd>{formatSum(fee.amount, locale)}</dd></div>)}
    {(q.customsDuty ?? 0) > 0 && <div><dt>{calcCopy[locale].lines.customsDuty}</dt><dd>{formatSum(q.customsDuty ?? 0, locale)}</dd></div>}
    {q.reserve > 0 && <div className="cost-reserve-row"><dt>{copy.reserve}</dt><dd><span>{formatSum(q.reserve, locale)}</span><details className="quote-cost-help reserve-cost-help">
      <summary aria-label={copy.reserveHelpLabel} title={copy.reserveHelpLabel}><CircleHelp size={16}/></summary>
      <div className="quote-cost-help-popover"><p>{copy.reserveHelp}</p></div>
    </details></dd></div>}
  </dl>;
}
