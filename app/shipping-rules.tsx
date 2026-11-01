"use client";

import {Package,ShieldCheck,Star} from "lucide-react";
import Link from "@/components/site-link";
import {useMarket} from "@/lib/market/store";
import {pickLocale} from "@/lib/market/uz-cyrl";
import {insuranceServiceId} from "@/lib/market/domain";
import {courierAllowanceUsd} from "@/lib/market/customs";
import {formatPercent,formatUsd} from "@/lib/market/format";

// Company rules shown on /customs: the safe-arrival guarantee and compensation, items that cannot be shipped, and the
// Uzbekistan limits. Informational only: the guarantee itself is chosen per parcel in the cart (a value-percent
// service, lib/market/domain.ts), and its rates and the monthly allowance are read from the tariff, so this page
// never disagrees with the cart. The compensation without the guarantee follows the public offer, section 6.1.
const copy={
 ru:{
  title:"Правила доставки: гарантия сохранности, запреты, лимиты",
  insTitle:"Гарантия сохранности Atlas и компенсация",
  without:{title:"Без гарантии",items:["Утеря — $15 за кг оплачиваемого веса, не больше стоимости товара","Порча — $3 за кг"],price:"Без доплаты"},
  with:{title:"С гарантией сохранности Atlas",badge:"Рекомендуем для дорогих вещей",items:["Утеря и порча — до 100% стоимости товара и доставки","Обязательство Atlas, а не страхование"],price:(rate:string,high:string)=>`${rate} от посылки с доставкой${high?"; "+high:""}`},
  high:(usd:string,rate:string)=>`дороже ${usd} — ${rate}`,
  recalc:"Если цена товара после выкупа изменится, плата за гарантию пересчитается по той же ставке от разницы.",
  claims:"Об утере сообщите в «Моих заказах», когда посылка отправлена в Ташкент; о порче — в течение 14 дней после получения. Возмещение зачисляем на баланс Atlas.",
  insNote:"По желанию — отмечается в корзине у каждой посылки.",insTerms:"Условия — ",insTermsLink:"оферта, раздел 6.1",
  banTitle:"Что нельзя отправлять обычной курьерской доставкой",
  banIntro:"Мы бережно доставляем посылки из-за рубежа в Ташкент, но некоторые вещи отправить нельзя:",
  banItems:[
   "Любые виды топлива, а также б/у запчасти топливных систем.",
   "Спиртные напитки.",
   "Медикаменты и препараты, оборот которых ограничен или запрещён в Узбекистане.",
   "Едкие и опасные химикаты.",
   "Наркотические и психотропные вещества и их прекурсоры.",
   "Холодное и огнестрельное оружие, его компоненты, снаряжённые и неснаряжённые боеприпасы, макеты оружия, в том числе охолощенное.",
   "Легковоспламеняющиеся предметы, в том числе спреи и парфюм объёмом более 100 мл на одну коробку.",
   "Острые предметы (ножи, ножницы, пилы и т. п.) без упаковки.",
   "Автомобильные амортизаторы без специальной упаковки.",
   "Игрушки 18+.",
  ],
  limTitle:"Лимиты по законодательству Узбекистана",
  limItems:(allowance:string)=>[
   `Без пошлины — товары до ${allowance} в месяц на одного получателя; суммарный вес за календарный квартал — до 30 кг.`,
   "Сверх лимита таможенный платёж начисляется только на превышение — посчитайте его в калькуляторе выше. Коммерческие партии оформляются по другим правилам.",
  ],
 },
 uz:{
  title:"Yetkazib berish qoidalari: saqlash kafolati, taqiqlar, limitlar",
  insTitle:"Atlas saqlash kafolati va kompensatsiya",
  without:{title:"Kafolatsiz",items:["Yo‘qolsa — to‘lanadigan vaznning har kg uchun $15, tovar narxidan oshmaydi","Shikastlansa — har kg uchun $3"],price:"Qo‘shimcha to‘lovsiz"},
  with:{title:"Atlas saqlash kafolati bilan",badge:"Qimmat buyumlar uchun tavsiya etamiz",items:["Yo‘qolish va shikast — tovar va yetkazish qiymatining 100% gacha","Atlas majburiyati, sug‘urta emas"],price:(rate:string,high:string)=>`Yetkazish bilan posilka qiymatining ${rate}${high?"; "+high:""}`},
  high:(usd:string,rate:string)=>`${usd} dan qimmat bo‘lsa — ${rate}`,
  recalc:"Xariddan keyin tovar narxi o‘zgarsa, kafolat narxi farqdan o‘sha stavka bo‘yicha qayta hisoblanadi.",
  claims:"Yo‘qolgani haqida posilka Toshkentga jo‘natilgach «Buyurtmalarim»da xabar bering; shikast haqida — olganingizdan keyin 14 kun ichida. Qoplash Atlas balansiga o‘tkaziladi.",
  insNote:"Ixtiyoriy — savatda har bir posilka uchun belgilanadi.",insTerms:"Shartlar — ",insTermsLink:"oferta, 6.1-bo‘lim",
  banTitle:"Oddiy kuryer yetkazib berishida jo‘natib bo‘lmaydigan narsalar",
  banIntro:"Posilkalarni chet eldan Toshkentga ehtiyotkorlik bilan yetkazamiz, ammo quyidagilarni jo‘natib bo‘lmaydi:",
  banItems:[
   "Har qanday yoqilg‘i, shuningdek yoqilg‘i tizimining ishlatilgan ehtiyot qismlari.",
   "Spirtli ichimliklar.",
   "O‘zbekistonda muomalasi cheklangan yoki taqiqlangan dori-darmonlar.",
   "Kuydiruvchi va xavfli kimyoviy moddalar.",
   "Giyohvand va psixotrop moddalar hamda ularning prekursorlari.",
   "Sovuq va o‘qotar qurol, ularning qismlari, o‘qlangan va o‘qlanmagan o‘q-dorilar, qurol maketlari, jumladan o‘qsizlantirilgan qurol.",
   "Tez alangalanuvchi buyumlar, jumladan bir qutiga 100 ml dan ortiq sprey va parfyum.",
   "Qadoqsiz o‘tkir buyumlar (pichoq, qaychi, arra va shu kabilar).",
   "Maxsus qadoqsiz avtomobil amortizatorlari.",
   "18+ o‘yinchoqlar.",
  ],
  limTitle:"O‘zbekiston qonunchiligi bo‘yicha limitlar",
  limItems:(allowance:string)=>[
   `Bojsiz — bitta qabul qiluvchiga oyiga ${allowance} gacha tovar; kalendar chorakda umumiy vazn — 30 kg gacha.`,
   "Limitdan oshsa, bojxona to‘lovi faqat oshgan qismga hisoblanadi — uni yuqoridagi kalkulyatorda hisoblang. Tijorat partiyalari boshqa qoidalar bo‘yicha rasmiylashtiriladi.",
  ],
 },
 en:{
  title:"Shipping rules: safe-arrival guarantee, prohibited items, limits",
  insTitle:"Atlas safe-arrival guarantee and compensation",
  without:{title:"Without the guarantee",items:["Loss — $15 per billable kg, up to the item price","Damage — $3 per kg"],price:"No extra charge"},
  with:{title:"With the Atlas safe-arrival guarantee",badge:"Recommended for valuable items",items:["Loss and damage — up to 100% of goods and delivery","Atlas’s own obligation, not insurance"],price:(rate:string,high:string)=>`${rate} of the parcel with delivery${high?"; "+high:""}`},
  high:(usd:string,rate:string)=>`over ${usd} — ${rate}`,
  recalc:"If the item price changes after purchase, the guarantee fee is recalculated on the difference at the same rate.",
  claims:"Report a loss in My orders once the parcel has left for Tashkent, and damage within 14 days of receipt. Compensation goes to your Atlas balance.",
  insNote:"Optional — tick it per parcel in the cart.",insTerms:"Terms: ",insTermsLink:"public offer, section 6.1",
  banTitle:"What cannot go by regular courier delivery",
  banIntro:"We deliver parcels from abroad to Tashkent with care, but some items cannot be shipped:",
  banItems:[
   "Any kind of fuel, and used parts of fuel systems.",
   "Alcoholic drinks.",
   "Medicines whose circulation is restricted or banned in Uzbekistan.",
   "Corrosive and hazardous chemicals.",
   "Narcotic and psychotropic substances and their precursors.",
   "Bladed and firearms, their components, loaded and unloaded ammunition, replica weapons including deactivated ones.",
   "Flammable items, including sprays and perfumes over 100 ml per box.",
   "Sharp items (knives, scissors, saws, etc.) without packaging.",
   "Car shock absorbers without special packaging.",
   "18+ toys.",
  ],
  limTitle:"Limits under Uzbekistan law",
  limItems:(allowance:string)=>[
   `Duty-free: goods up to ${allowance} per month per recipient; total weight up to 30 kg per calendar quarter.`,
   "Above the allowance, the customs payment applies to the excess only — estimate it with the calculator above. Commercial shipments follow different rules.",
  ],
 },
};

export function ShippingRules(){
 const {state,pricing}=useMarket();
 const locale=state.communication.language;
 const t=pickLocale(copy,locale);
 // The guarantee as the cart sells it: its rate, and the higher rate above the threshold when the tariff sets one.
 const g=pricing.serviceCatalog.find(service=>service.id===insuranceServiceId&&service.enabled);
 const high=g&&g.valuePercentHigh!==undefined&&g.valueThresholdUsd!==undefined&&g.valuePercentHigh!==g.valuePercent?t.high(formatUsd(g.valueThresholdUsd,locale),formatPercent(g.valuePercentHigh,locale)):"";
 const allowance=formatUsd(pricing.customsAllowanceUsd??courierAllowanceUsd,locale);
 return <section className="surface customs-text" id="shipping-rules" aria-labelledby="shipping-rules-title">
  <h2 id="shipping-rules-title">{t.title}</h2>
  <h3>{t.insTitle}</h3>
  <div className="guarantee-compare">
   <article className="guarantee-card">
    <header><Package size={20} aria-hidden="true"/><h4>{t.without.title}</h4></header>
    <ul>{t.without.items.map(item=><li key={item}>{item}</li>)}</ul>
    <p className="guarantee-price">{t.without.price}</p>
   </article>
   {g&&<article className="guarantee-card guarantee-card-on">
    <header><ShieldCheck size={20} aria-hidden="true"/><h4>{t.with.title}</h4></header>
    <span className="guarantee-badge"><Star size={14} className="speed-option-star" aria-hidden="true"/>{t.with.badge}</span>
    <ul>{t.with.items.map(item=><li key={item}>{item}</li>)}</ul>
    <p className="guarantee-price">{t.with.price(formatPercent(g.valuePercent??0,locale),high)}</p>
   </article>}
  </div>
  <ul>{(g?[t.recalc,t.claims]:[t.claims]).map(item=><li key={item}>{item}</li>)}</ul>
  <p className="micro">{t.insNote} {t.insTerms}<Link href="/terms#offer-insurance">{t.insTermsLink}</Link></p>
  <h3>{t.banTitle}</h3>
  <p>{t.banIntro}</p>
  <ol>{t.banItems.map(item=><li key={item}>{item}</li>)}</ol>
  <h3>{t.limTitle}</h3>
  <ul>{t.limItems(allowance).map(item=><li key={item}>{item}</li>)}</ul>
 </section>;
}
