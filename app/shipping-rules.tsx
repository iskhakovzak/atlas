"use client";

import {useMarket} from "@/lib/market/store";
import {pickLocale} from "@/lib/market/uz-cyrl";

// Company rules shown on /customs: insurance and compensation, items that cannot be shipped, and the
// Uzbekistan limits. Informational only: the insurance itself is chosen per parcel in the cart (a value-percent
// service, lib/market/domain.ts) and its rates come from there.
const copy={
 ru:{
  title:"Правила доставки: гарантия сохранности, запреты, лимиты",
  insTitle:"Гарантия сохранности Atlas и компенсация",
  insItems:[
   "Без гарантии сохранности: за утерянную посылку мы возмещаем $15 за кг, за порчу посылки или её содержимого — $3 за кг.",
   "С гарантией сохранности Atlas: утрата и ущерб возмещаются в размере 100 % стоимости товара и доставки. Это собственное обязательство Atlas, а не страхование.",
   "Плата за гарантию — 2,9 % от стоимости посылки вместе с доставкой. Если посылка с доставкой дороже $200, ставка — 3,9 %.",
   "Если цена товара после выкупа изменится, плата за гарантию пересчитается по той же ставке от разницы.",
   "Об утере сообщите в «Моих заказах», когда посылка отправлена в Ташкент; о порче — в течение 14 дней после получения. Возмещение зачисляем на баланс Atlas.",
  ],
  insNote:"Гарантию сохранности отмечают в корзине у каждой посылки — она сразу входит в сумму заказа.",
  banTitle:"Что нельзя отправлять обычной курьерской доставкой",
  banIntro:"Мы бережно и вовремя доставляем посылки из США в Ташкент, но есть вещи, которые отправить нельзя:",
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
  limItems:[
   "В календарном квартале гражданин может получить товары суммарным весом до 30 кг, а общая стоимость отправленных товаров — до $200 в месяц, без таможенных пошлин.",
   "При превышении лимита посылка облагается пошлиной как коммерческий груз.",
  ],
 },
 uz:{
  title:"Yetkazib berish qoidalari: saqlash kafolati, taqiqlar, limitlar",
  insTitle:"Atlas saqlash kafolati va kompensatsiya",
  insItems:[
   "Kafolatsiz: yo‘qolgan posilka uchun har kg uchun $15, posilka yoki uning tarkibi shikastlansa — har kg uchun $3 qoplaymiz.",
   "Atlas saqlash kafolati bilan: yo‘qotish va zarar tovar va yetkazib berish qiymatining 100 % miqdorida qoplanadi. Bu Atlasning o‘z majburiyati, sug‘urta emas.",
   "Kafolat narxi — posilkaning yetkazib berish bilan birga qiymatining 2,9 %. Yetkazib berish bilan posilka $200 dan qimmat bo‘lsa, stavka — 3,9 %.",
   "Xariddan keyin tovar narxi o‘zgarsa, kafolat narxi farqdan o‘sha stavka bo‘yicha qayta hisoblanadi.",
   "Yo‘qolgani haqida posilka Toshkentga jo‘natilgach «Buyurtmalarim»da xabar bering; shikast haqida — olganingizdan keyin 14 kun ichida. Qoplash Atlas balansiga o‘tkaziladi.",
  ],
  insNote:"Saqlash kafolati savatda har bir posilka uchun belgilanadi — u darhol buyurtma summasiga kiradi.",
  banTitle:"Oddiy kuryer yetkazib berishida jo‘natib bo‘lmaydigan narsalar",
  banIntro:"Posilkalarni AQShdan Toshkentga ehtiyotkorlik bilan va o‘z vaqtida yetkazamiz, ammo quyidagilarni jo‘natib bo‘lmaydi:",
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
  limItems:[
   "Kalendar chorakda fuqaro umumiy og‘irligi 30 kg gacha tovar olishi mumkin, jo‘natilgan tovarlarning umumiy qiymati esa bojxona boji olinmaydigan oyiga $200 gacha.",
   "Limit oshib ketsa, posilkadan tijorat yuki sifatida boj olinadi.",
  ],
 },
 en:{
  title:"Shipping rules: safe-arrival guarantee, prohibited items, limits",
  insTitle:"Atlas safe-arrival guarantee and compensation",
  insItems:[
   "Without the guarantee: we compensate a lost parcel at $15 per kg, and a damaged parcel or contents at $3 per kg.",
   "With the Atlas safe-arrival guarantee: loss and damage are compensated in full (100% of the goods and delivery). This is Atlas's own obligation, not insurance.",
   "The guarantee costs 2.9% of the parcel value including delivery. If the parcel with delivery is worth more than $200, the rate is 3.9%.",
   "If the item price changes after purchase, the guarantee fee is recalculated on the difference at the same rate.",
   "Report a loss in My orders once the parcel has left for Tashkent, and damage within 14 days of receipt. Compensation goes to your Atlas balance.",
  ],
  insNote:"Tick the safe-arrival guarantee for each parcel in the cart — it is added to the order total right away.",
  banTitle:"What cannot go by regular courier delivery",
  banIntro:"We deliver parcels from the USA to Tashkent carefully and on time, but some items cannot be shipped:",
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
  limItems:[
   "In a calendar quarter a citizen may receive goods weighing up to 30 kg in total, with the combined value of goods sent up to $200 per month, free of customs duty.",
   "Above the limit the parcel is charged duty as a commercial shipment.",
  ],
 },
};

export function ShippingRules(){
 const {state}=useMarket();
 const t=pickLocale(copy,state.communication.language);
 return <section className="surface customs-text" id="shipping-rules" aria-labelledby="shipping-rules-title">
  <h2 id="shipping-rules-title">{t.title}</h2>
  <h3>{t.insTitle}</h3>
  <ul>{t.insItems.map(item=><li key={item}>{item}</li>)}</ul>
  <p className="micro">{t.insNote}</p>
  <h3>{t.banTitle}</h3>
  <p>{t.banIntro}</p>
  <ol>{t.banItems.map(item=><li key={item}>{item}</li>)}</ol>
  <h3>{t.limTitle}</h3>
  <ul>{t.limItems.map(item=><li key={item}>{item}</li>)}</ul>
 </section>;
}
