"use client";

import {useMarket} from "@/lib/market/store";
import {pickLocale} from "@/lib/market/uz-cyrl";

// Company rules shown on /customs: insurance and compensation, items that cannot be shipped, and the
// Uzbekistan limits. Informational only: the insurance itself is chosen per parcel in the cart (a value-percent
// service, lib/market/domain.ts) and its rates come from there.
const copy={
 ru:{
  title:"Правила доставки: страховка, запреты, лимиты",
  insTitle:"Страховка и компенсация",
  insItems:[
   "Без страховки: за утерянную посылку мы возмещаем $15 за кг, за порчу посылки или её содержимого — $3 за кг.",
   "Со страховкой: утрата и ущерб возмещаются в размере 100 %.",
   "Стоимость страховки — 2 % от стоимости посылки. Если посылка дороже $200, ставка повышается до 3 %.",
  ],
  insNote:"Страховку отмечают в корзине у каждой посылки — она сразу входит в сумму заказа.",
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
  title:"Yetkazib berish qoidalari: sug‘urta, taqiqlar, limitlar",
  insTitle:"Sug‘urta va kompensatsiya",
  insItems:[
   "Sug‘urtasiz: yo‘qolgan posilka uchun har kg uchun $15, posilka yoki uning tarkibi shikastlansa — har kg uchun $3 qoplaymiz.",
   "Sug‘urta bilan: yo‘qotish va zarar 100 % qoplanadi.",
   "Sug‘urta narxi — posilka qiymatining 2 %. Posilka $200 dan qimmat bo‘lsa, stavka 3 % gacha oshadi.",
  ],
  insNote:"Sug‘urta savatda har bir posilka uchun belgilanadi — u darhol buyurtma summasiga kiradi.",
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
  title:"Shipping rules: insurance, prohibited items, limits",
  insTitle:"Insurance and compensation",
  insItems:[
   "Without insurance: we compensate a lost parcel at $15 per kg, and a damaged parcel or contents at $3 per kg.",
   "With insurance: loss and damage are compensated in full (100%).",
   "Insurance costs 2% of the parcel value. If the parcel is worth more than $200, the rate rises to 3%.",
  ],
  insNote:"Tick insurance for each parcel in the cart — it is added to the order total right away.",
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
