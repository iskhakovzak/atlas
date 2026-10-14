"use client";

import { ArrowUpRight, Check, ChevronDown, ClipboardPaste, Link2 } from "lucide-react";
import Link from "@/components/site-link";
import { useMarket } from "@/lib/market/store";
import { catalogAllowance } from "@/lib/market/allowance";
import { courierAllowanceUsd, customsReferences as customsSources } from "@/lib/market/customs";
import { formatPercent, formatUsd } from "@/lib/market/format";
import type { Pricing } from "@/lib/market/domain";
import { notFoundCopy } from "@/lib/market/not-found-copy";
import { CustomsCalculator } from "./customs-estimate";
import { PageHeading } from "./market-ui";
import { ShippingRules } from "./shipping-rules";
import {pickLocale,uzText,withCyrillic} from '@/lib/market/uz-cyrl';
import {isUzbek,navCopy,type Locale} from '@/lib/market/i18n';

// Every customs disclosure: the whole pill opens it, with the site's chevron instead of the browser's ▶.
const chevron = <ChevronDown className="disclosure-chevron" size={20} aria-hidden="true" />;

// The step after the calculator: the full order total by link, and both ways to pay customs, described side by side
// (nothing chosen here; the choice is in the cart, only when there is duty). The fee comes from the tariff.
const nextCopy = /*@__PURE__*/withCyrillic({
  ru: { title: "Посчитаем заказ целиком", text: "Вставьте ссылку на товар из магазина — Atlas покажет итог в сумах: товар, доставку, сервис Atlas и таможню отдельными строками.", pay: "Как оплатить таможню", atlas: "Atlas оплатит таможню", atlasText: (p: string) => `пошлину по расчёту вносим вместе с заказом, сбор ${p} от стоимости товара. Если таможня начислит больше — доплата только с вашего согласия.`, self: "Оплачу сам(а)", selfText: "без сбора: вы оплачиваете счёт таможни сами; пока он не оплачен, посылка ждёт на таможне.", where: "Выбор — в корзине и только когда есть пошлина." },
  uz: { title: "Buyurtmani to‘liq hisoblaymiz", text: "Do‘kondagi tovar havolasini qo‘ying — Atlas yakuniy narxni so‘mda ko‘rsatadi: tovar, yetkazish, Atlas xizmati va bojxona alohida satrlarda.", pay: "Bojxonani qanday to‘lash", atlas: "Bojxonani Atlas to‘laydi", atlasText: (p: string) => `hisoblangan bojni buyurtma bilan to‘laymiz, yig‘im tovar narxidan ${p}. Bojxona ko‘proq hisoblasa — qo‘shimcha to‘lov faqat roziligingiz bilan.`, self: "O‘zim to‘layman", selfText: "yig‘imsiz: bojxona hisobini o‘zingiz to‘laysiz; to‘lanmaguncha posilka bojxonada kutadi.", where: "Tanlov savatda va faqat boj bo‘lganda chiqadi." },
  en: { title: "Get the full order total", text: "Paste a product link — Atlas shows the total in soum: item, delivery, Atlas service and customs on separate lines.", pay: "How to pay customs", atlas: "Atlas pays customs", atlasText: (p: string) => `we pay the estimated duty with the order, for a ${p} fee on the item value. If customs charges more, any extra only with your consent.`, self: "I’ll pay myself", selfText: "no fee: you pay the customs bill yourself; until it is paid, the parcel waits at customs.", where: "You choose in the cart, only when duty applies." },
});

function CustomsNextStep({ locale, pricing }: { locale: Locale; pricing: Pricing }) {
  const t = nextCopy[locale];
  return <section className="surface customs-next" aria-labelledby="customs-next-title">
    <h2 id="customs-next-title"><Link2 size={22} aria-hidden="true" />{t.title}</h2>
    <p>{t.text}</p>
    <div className="customs-next-actions">
      <Link className="btn primary" href="/order-by-link"><ClipboardPaste size={18} aria-hidden="true" />{notFoundCopy[locale].paste}</Link>
      <Link className="btn secondary" href="/catalog">{navCopy[locale].catalog}</Link>
    </div>
    <h3>{t.pay}</h3>
    <ul className="customs-pay-ways">
      <li><Check size={18} aria-hidden="true" /><span><b>{t.atlas}</b> — {t.atlasText(formatPercent(pricing.customsHelpFee, locale))}</span></li>
      <li><Check size={18} aria-hidden="true" /><span><b>{t.self}</b> — {t.selfText}</span></li>
    </ul>
    <p className="micro">{t.where}</p>
  </section>;
}

// Public customs guidance (/customs): Russian text with Uzbek and English versions.
export function CustomsView() {
  const { pricing, state, status } = useMarket();
  // The monthly allowance comes from the tariff, like the cart's customs card.
  const allowance = formatUsd(pricing.customsAllowanceUsd ?? courierAllowanceUsd, state.communication.language);
  // A signed-in customer: this month's counted Atlas orders prefill the calculator (only usedUsd — catalogAllowance's
  // remainingUsd counts from the law, not the tariff). Guests start from an unused allowance.
  const usedUsd = status === 'authenticated' ? catalogAllowance(state, pricing.fx)?.usedUsd : undefined;
  if(state.communication.language!=='ru')return <LocalizedCustoms locale={state.communication.language} pricing={pricing} allowance={allowance} usedUsd={usedUsd}/>;
  return <>
    <PageHeading overline="ДО ОФОРМЛЕНИЯ ЗАКАЗА" title="Таможня: что нужно учитывать." description="Памятка для личных некоммерческих покупок в Узбекистан. Проверена 11 сентября 2026 года." />
    <div className="customs-grid"><section className="surface"><h2>Курьерские отправления</h2><strong className="customs-limit">{allowance}</strong><p>Лимит беспошлинного ввоза на имя физического лица за календарный месяц по нормам, введённым с 1 мая 2025 года. Учитывайте покупки у других продавцов и сервисов.</p></section><section className="surface"><h2>Почтовые отправления</h2><strong className="customs-limit">$100</strong><p>Для международных почтовых отправлений установлена отдельная норма. Нельзя автоматически применять к ним курьерский лимит.</p></section></div>
    <CustomsCalculator pricing={pricing} locale={state.communication.language} usedUsd={usedUsd}/><CustomsNextStep locale="ru" pricing={pricing}/><section className="surface customs-text"><details className="ux-disclosure"><summary>Если стоимость выше нормы{chevron}</summary><p>Для личных некоммерческих товаров превышение установленных норм облагается единым таможенным платежом. Конкретный расчёт зависит от таможенной стоимости, количества, категории и способа ввоза. Возможны отдельные сборы.</p></details><details className="ux-disclosure"><summary>Какая ставка используется{chevron}</summary><p>Сводная редакция ПП-4508 с 1 сентября 2026 года: 20% превышения, минимум $2 за кг облагаемой части. Пункт 8 УП-174 называет для той же ставки дату 1 января 2027 года, а до неё действовали 30% и $3 за кг. Пока даты расходятся, калькулятор считает по 20% и $2 и отмечает это; окончательную ставку определяет таможня. НДС повторно не добавляется. Дата прибытия меняет ставку в калькуляторе.</p><details><summary>Почему не 3% или 5% из публикаций?</summary><p>ПП-136 устанавливает отдельный эксперимент для бондовых складов и зарегистрированных платформ: 3% плюс НДС для специального перечня либо единый платёж 5%. Это не общий режим зарубежных покупок; 5% не означает 5% плюс НДС, а курьерский лимит $200 к этой схеме не переносится.</p></details></details><details className="ux-disclosure"><summary>Что означает ваше согласие{chevron}</summary><p>При оформлении вы подтверждаете, что ознакомлены с условиями и понимаете: сверх лимита платится таможенная пошлина. Это не разрешение на автоматическое списание: любая доплата — только с вашего отдельного согласия.</p></details><details className="ux-disclosure"><summary>Что Atlas не видит{chevron}</summary><p>Мы не получаем ваши покупки через другие сервисы и официальный остаток месячного лимита. Пошлина входит в сумму заказа, только если вы выбрали «Atlas оплатит таможню»; иначе её оплачиваете вы на таможне. Страна магазина сама по себе не определяет размер платежа; некоторые категории и коммерческие партии имеют другие требования.</p></details><details className="ux-disclosure"><summary>Официальные источники{chevron}</summary><div className="source-list">{customsSources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title.ru}<ArrowUpRight size={16} /></a>)}</div><p className="micro">Перед покупкой сверьтесь с действующей редакцией правил и расчётом перевозчика. Эта памятка не заменяет таможенное решение.</p></details></section>
    <ShippingRules/>
  </>;
}

function LocalizedCustoms({locale,pricing,allowance,usedUsd}:{locale:Exclude<Locale,'ru'>;pricing:Pricing;allowance:string;usedUsd?:number}){
  const c=isUzbek(locale)?uzText(locale, {overline:'BUYURTMA RASMIYLASHTIRISHDAN OLDIN',title:'Bojxona: nimalarni bilish kerak.',intro:'O‘zbekistondagi shaxsiy notijorat xaridlar uchun qo‘llanma. 2026-yil 11-sentabrda tekshirilgan.',courier:'Kuryer jo‘natmalari',courierText:'2025-yil 1-maydan amaldagi normalar bo‘yicha jismoniy shaxs nomiga kalendar oy uchun bojsiz olib kirish limiti. Boshqa xizmatlardagi xaridlarni ham hisobga oling.',postal:'Pochta jo‘natmalari',postalText:'Xalqaro pochta jo‘natmalari uchun alohida norma mavjud. Kuryer limitini avtomatik qo‘llab bo‘lmaydi.',overLimit:'Qiymat limitdan oshsa',overText:'Limitdan oshgan qism yagona bojxona to‘lovi bilan soliqqa tortiladi. Hisob qiymat, miqdor, kategoriya va olib kirish usuliga bog‘liq.',rate:'Qaysi stavka ishlatiladi',rateText:'PQ-4508 ning 2026-yil 1-sentabrdagi jamlangan tahririda: oshgan qismning 20 foizi, kamida har kg uchun $2. PF-174 ning 8-bandi shu stavka uchun 2027-yil 1-yanvarni ko‘rsatadi, undan oldin 30 foiz va $3 amal qilgan. Sanalar mos kelmaguncha kalkulyator 20 foiz va $2 bo‘yicha hisoblaydi va buni belgilaydi; yakuniy stavkani bojxona belgilaydi.',consent:'Roziligingiz nimani anglatadi',consentText:'Shartlarni o‘qiganingizni va limitdan oshgan qismga bojxona to‘lovi olinishini tushunganingizni tasdiqlaysiz. Har qanday qo‘shimcha to‘lov — faqat alohida roziligingiz bilan.',unknown:'Atlas nimani ko‘rmaydi',unknownText:'Boshqa xizmatlardagi rasmiy oylik limit qoldig‘i bizga ko‘rinmaydi. Boj buyurtma summasiga faqat «Bojxonani Atlas to‘laydi» tanlansa kiradi; aks holda uni bojxonada o‘zingiz to‘laysiz.',sources:'Rasmiy manbalar',sourcesText:'Xariddan oldin amaldagi qoidalarni tekshiring.'}):{overline:'BEFORE CHECKOUT',title:'Customs: what to keep in mind.',intro:'A guide for personal, non-commercial purchases in Uzbekistan. Checked on 11 September 2026.',courier:'Courier shipments',courierText:'Duty-free allowance for an individual per calendar month under the rules in force since 1 May 2025. Include purchases made through other services.',postal:'Postal shipments',postalText:'International postal shipments have a separate allowance. The courier allowance cannot be applied automatically.',overLimit:'If the value exceeds the allowance',overText:'The excess is subject to a single customs payment. The calculation depends on value, quantity, category and import method.',rate:'Which rate applies',rateText:'The consolidated text of PP-4508 from 1 September 2026: 20% of the excess, at least $2 per taxable kilogram. Clause 8 of UP-174 gives 1 January 2027 for the same rate, with 30% and $3 before it. While the dates disagree, the calculator uses 20% and $2 and says so; customs sets the final rate.',consent:'What your consent means',consentText:'You confirm that you have read the terms and understand that customs duty applies above the allowance. Any top-up needs your separate consent.',unknown:'What Atlas cannot see',unknownText:'We cannot see the official monthly allowance used through other services. Duty is part of the order amount only if you choose “Atlas pays customs”; otherwise you pay it at customs.',sources:'Official sources',sourcesText:'Before buying, check the current rules.'};
  return <><PageHeading overline={c.overline} title={c.title} description={c.intro}/><div className="customs-grid"><section className="surface"><h2>{c.courier}</h2><strong className="customs-limit">{allowance}</strong><p>{c.courierText}</p></section><section className="surface"><h2>{c.postal}</h2><strong className="customs-limit">$100</strong><p>{c.postalText}</p></section></div><CustomsCalculator pricing={pricing} locale={locale} usedUsd={usedUsd}/><CustomsNextStep locale={locale} pricing={pricing}/><section className="surface customs-text"><details className="ux-disclosure"><summary>{c.overLimit}{chevron}</summary><p>{c.overText}</p></details><details className="ux-disclosure"><summary>{c.rate}{chevron}</summary><p>{c.rateText}</p></details><details className="ux-disclosure"><summary>{c.consent}{chevron}</summary><p>{c.consentText}</p></details><details className="ux-disclosure"><summary>{c.unknown}{chevron}</summary><p>{c.unknownText}</p></details><details className="ux-disclosure"><summary>{c.sources}{chevron}</summary><div className="source-list">{customsSources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{pickLocale(source.title,locale)}<ArrowUpRight size={16}/></a>)}</div><p className="micro">{c.sourcesText}</p></details></section><ShippingRules/></>;
}
