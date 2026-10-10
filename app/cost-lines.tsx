'use client';
import {CircleHelp} from 'lucide-react';
import {type Quote} from '@/lib/market/domain';
import {atlasServiceBreakdown,atlasServiceTotal} from '@/lib/market/quote-presentation';
import {formatSum} from '@/lib/market/format';
import {calcCopy} from '@/lib/market/calc-copy';
import {pickLocale} from '@/lib/market/uz-cyrl';
import {type Locale} from '@/lib/market/i18n';

// The bill lines live apart from app/market-ui.tsx so pages without a bill do not load the calculator copy.
/** `storeReserveWaived`: store delivery is unknown and no reserve was taken (a large enough store order), so it is not "free". */
export function CostLines({ q, shippingUnknown = false, storeReserveWaived = false, locale = "ru", internationalHelp }: { q: Pick<Quote, "merchandise" | "service" | "shipping" | "reserve" | "sourceShipping" | "storeShippingHold" | "buyout" | "conversion" | "deliveryMargin" | "optionalServices" | "customsHelp" | "customsHelpRate" | "customsDuty">; shippingUnknown?: boolean; storeReserveWaived?: boolean; locale?: Locale; internationalHelp?: string }) {
  const copy = pickLocale({
    ru: { item: "Товар", merchantShipping: "Доставка магазина", service: "Сервис Atlas", fee: "Комиссия Atlas", international: "Международная доставка", optional: "Дополнительные услуги", reserve: "Возвратный резерв", breakdown: "Состав сервиса", help: "Как считается международная доставка", reserveHelp: "Резерв покрывает посылку, пока склад не взвесит её и не измерит габариты. Если международная доставка выйдет дешевле, разницу зачислим на внутренний баланс Atlas. Если дороже — сначала сообщим сумму; доплата только с вашего согласия.", reserveHelpLabel: "О возвратном резерве", unknown: "Уточняется", free: "Бесплатно", noReserve: "Без резерва" },
    uz: { item: "Tovar", merchantShipping: "Do‘kon yetkazishi", service: "Atlas xizmati", fee: "Atlas komissiyasi", international: "Xalqaro yetkazish", optional: "Qo‘shimcha xizmatlar", reserve: "Qaytariladigan zaxira", breakdown: "Xizmat tarkibi", help: "Xalqaro yetkazish qanday hisoblanadi", reserveHelp: "Zaxira ombor jo‘natmani tortib, o‘lchamlarini o‘lchaguncha uni qoplaydi. Xalqaro yetkazish arzonroq chiqsa, farq Atlas ichki balansiga qaytariladi. Qimmatroq bo‘lsa — avval summani aytamiz; qo‘shimcha to‘lov faqat roziligingiz bilan.", reserveHelpLabel: "Qaytariladigan zaxira haqida", unknown: "Aniqlanmoqda", free: "Bepul", noReserve: "Zaxirasiz" },
    en: { item: "Item", merchantShipping: "Store delivery", service: "Atlas service", fee: "Atlas fee", international: "International delivery", optional: "Extra services", reserve: "Refundable reserve", breakdown: "Service breakdown", help: "How international delivery is estimated", reserveHelp: "The reserve covers the parcel until the warehouse weighs and measures it. If international delivery costs less, the difference is credited to your Atlas balance. If it costs more, we tell you the amount first; any extra payment needs your consent.", reserveHelpLabel: "About the refundable reserve", unknown: "To be confirmed", free: "Free", noReserve: "No reserve" },
  }, locale);
  const breakdown = atlasServiceBreakdown(q);
  const serviceParts = [
    { key: "service", label: copy.fee, amount: breakdown.service },
    { key: "international", label: copy.international, amount: breakdown.international },
  ];
  const serviceTotal = atlasServiceTotal(q);
  return <dl className="cost-lines">
    <div><dt>{copy.item}</dt><dd>{formatSum(q.merchandise, locale)}</dd></div>
    <div><dt>{copy.merchantShipping}</dt><dd>{shippingUnknown ? copy.unknown : q.sourceShipping ? formatSum(q.sourceShipping, locale) : q.storeShippingHold ? calcCopy[locale].lines.holdOutside : q.storeShippingHold === 0 ? calcCopy[locale].lines.free : storeReserveWaived ? copy.noReserve : copy.free}</dd></div>
    {/* Since 4 October 2026 an unknown store delivery is held apart from the sum: shown here, never added in. */}
    {(q.storeShippingHold ?? 0) > 0 && <div className="cost-hold"><dt>{calcCopy[locale].hold}</dt><dd>{formatSum(q.storeShippingHold!, locale)}<small>{calcCopy[locale].holdNote}</small></dd></div>}
    {serviceTotal > 0 && <div className="cost-service-row">
      <dt>{copy.service}</dt>
      <dd>
        <span className="cost-service-total">{formatSum(serviceTotal, locale)}</span>
        <details className="cost-service-breakdown">
          <summary>{copy.breakdown}</summary>
          <dl>{serviceParts.filter(part => part.amount > 0).map(part => <div key={part.key}>
            <dt>{part.label}</dt>
            <dd>
              <span>{formatSum(part.amount, locale)}</span>
              {part.key === "international" && internationalHelp && <details className="quote-cost-help">
                <summary aria-label={copy.help} title={copy.help}><CircleHelp size={16}/></summary>
                <div className="quote-cost-help-popover"><p>{internationalHelp}</p></div>
              </details>}
            </dd>
          </div>)}</dl>
        </details>
      </dd>
    </div>}
    {(q.optionalServices ?? 0) > 0 && <div><dt>{copy.optional}</dt><dd>{formatSum(q.optionalServices ?? 0, locale)}</dd></div>}
    {(q.customsHelp ?? 0) > 0 && <div><dt>{calcCopy[locale].lines.customsHelp(new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 2 }).format((q.customsHelpRate ?? 0) * 100) + "%")}</dt><dd>{formatSum(q.customsHelp ?? 0, locale)}</dd></div>}
    {(q.customsDuty ?? 0) > 0 && <div><dt>{calcCopy[locale].lines.customsDuty}</dt><dd>{formatSum(q.customsDuty ?? 0, locale)}</dd></div>}
    {q.reserve > 0 && <div className="cost-reserve-row"><dt>{copy.reserve}</dt><dd><span>{formatSum(q.reserve, locale)}</span><details className="quote-cost-help reserve-cost-help">
      <summary aria-label={copy.reserveHelpLabel} title={copy.reserveHelpLabel}><CircleHelp size={16}/></summary>
      <div className="quote-cost-help-popover"><p>{copy.reserveHelp}</p></div>
    </details></dd></div>}
  </dl>;
}
