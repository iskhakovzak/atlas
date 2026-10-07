"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Check, ExternalLink, Info, Link2, Loader2, Lock, Minus, Plus, ShieldCheck, ShoppingBag, X } from "lucide-react";
import Link from "@/components/site-link";
import { toast } from "sonner";
import { useMarket } from "@/lib/market/store";
import { signInPath } from "@/lib/market/access";
import { catalogOrderVariants } from "@/lib/market/catalog";
import { catalogLinkSeed, catalogLinkPrice, catalogLinkWeight } from "@/lib/market/link-order-context";
import {
  browserStorage,
  choicesFromAction,
  cleanPicks,
  discardPendingCartAdd,
  draftAddress,
  draftChoices,
  draftKeyFor,
  draftVisible,
  forgetLastDraft,
  keepPicks,
  markDraftDone,
  ownerTag,
  readDraft,
  readLastDraft,
  removeDraft,
  restoreMode,
  savePendingCartAdd,
  storageWritable,
  writeDraft,
  type CartAddAction,
  type DraftChoices,
  type LockFields,
} from "@/lib/market/link-order-draft";
import { usePendingCartAdd, type PendingCartAddResult } from "./pending-cart-add";
import {
  cartDeliverySpeed,
  repriceCart,
  storeDiscount,
  storeShippingReserves,
  unknownStoreShippingUsd,
  validateSource,
  type CartItem,
  type DeliverySpeed,
  type Product,
} from "@/lib/market/domain";
import { deliverySpeedOptions, savingText } from "@/lib/market/delivery-speed";
import { calcCopy, type CalcCopy } from "@/lib/market/calc-copy";
import { Money } from "./money";
import { cartCustomsEstimate } from "@/lib/market/allowance";
import { BlankBill, CalcLines, CustomsPanel, DeliverySpeedSwitch, HoldNote, sumQuotes } from "./calc-summary";
import { countries, currencies, currencyForCountry, toUsd, paddedWeight } from "@/lib/market/world";
import { describeSingleColorway } from "@/lib/market/variant-colorway";
import { variantsForSourceColor } from "@/lib/importer/link-selection";
import { findNikeFootwearSizeRow, getNikeFootwearSizeRows, inferNikeFootwearSizeSystem } from "@/lib/market/nike-size-chart";
import { estimateBoxedWeight, estimatedBoxedWeight, validBoxedWeight, weightCategories } from "@/lib/market/weight";
import {
  safeImage,
  dedupeSafeImages,
  inferProductCategory,
  inferStorefrontCountry,
  type Extracted,
  type ProductVariant,
  type ProductColorwayGallery,
} from "@/lib/importer/extract";
import { WasPrice } from "./market-ui";
import { Choice } from "./choice";
import { formatSum } from "@/lib/market/format";
import { cartCopy, countryLabel, linkOrderCopy } from "@/lib/market/customer-copy";
import { ProductGallery } from "./product-gallery";
import {
  communityDeals,
  communityEstimatedWeight,
  communityFallbackOptions,
  communityProductCategory,
  hasSelectableDimensions,
} from "@/lib/market/community-deals";
import {uzText} from '@/lib/market/uz-cyrl';
import {isUzbek,type Locale} from '@/lib/market/i18n';

const countryAliases:Record<string,string>={'United States':'США','US':'США','AQSh':'США','Spain':'Испания','Ispaniya':'Испания','Germany':'Германия','Germaniya':'Германия','United Kingdom':'Великобритания','Buyuk Britaniya':'Великобритания','France':'Франция','Fransiya':'Франция','Italy':'Италия','Italiya':'Италия','Romania':'Румыния','Ruminiya':'Румыния','China':'Китай','Xitoy':'Китай','Turkey':'Турция','Turkiya':'Турция','Japan':'Япония','Yaponiya':'Япония','South Korea':'Южная Корея','Janubiy Koreya':'Южная Корея','United Arab Emirates':'ОАЭ','BAA':'ОАЭ','Canada':'Канада','Kanada':'Канада','Australia':'Австралия','Avstraliya':'Австралия','Other country':'Другая страна','Boshqa mamlakat':'Другая страна'};
const categoryAliases:Record<string,string>={'Shoes':'Обувь','Oyoq kiyim':'Обувь','Clothing':'Одежда','Kiyim':'Одежда','Electronics':'Электроника','Elektronika':'Электроника','Accessories':'Аксессуары','Aksessuarlar':'Аксессуары','Beauty & care':'Красота и уход','Go‘zallik va parvarish':'Красота и уход','Home & living':'Дом и быт','Uy va maishiy':'Дом и быт','Sports':'Спорт','Boshqa':'Другое','Other':'Другое'};
const canonicalCountry=(value:string)=>countryAliases[value]??value;
const canonicalCategory=(value:string)=>categoryAliases[value]??value;
function cleanColorwayGalleries(value:unknown,base:string):ProductColorwayGallery[]{
  if(!Array.isArray(value))return [];
  const byColor=new Map<string,string[]>();
  for(const entry of value.slice(0,20)){
    if(!entry||typeof entry!=='object')continue;
    const row=entry as {color?:unknown;images?:unknown};
    const color=typeof row.color==='string'?row.color.trim().slice(0,140):'';
    if(!color||!Array.isArray(row.images))continue;
    const images=dedupeSafeImages(row.images,base,12);
    if(!images.length)continue;
    byColor.set(color,[...new Set([...(byColor.get(color)??[]),...images])].slice(0,12));
  }
  return [...byColor].map(([color,images])=>({color,images}));
}
function selectedImportedColor(data:Extracted,variants:ProductVariant[],galleries:ProductColorwayGallery[]):string{
  const colors=[...new Set(variants.map(item=>item.color).filter((value):value is string=>Boolean(value)))];
  if(data.selectedVariantColor&&colors.includes(data.selectedVariantColor))return data.selectedVariantColor;
  const image=data.image;
  const imageColor=image?galleries.find(gallery=>gallery.images.includes(image))?.color:undefined;
  if(imageColor&&colors.includes(imageColor))return imageColor;
  return colors.length===1?colors[0]:'';
}
function displayCategoryName(value:string,locale:Locale){
  const canonical=canonicalCategory(value);
  if(locale==='ru')return canonical;
  const labels=isUzbek(locale)
    ? uzText(locale, {'Обувь':'Oyoq kiyim','Одежда':'Kiyim','Электроника':'Elektronika','Аксессуары':'Aksessuarlar','Красота и уход':'Go‘zallik va parvarish','Дом и быт':'Uy va maishiy','Спорт':'Sport','Другое':'Boshqa'})
    : {'Обувь':'Shoes','Одежда':'Clothing','Электроника':'Electronics','Аксессуары':'Accessories','Красота и уход':'Beauty & care','Дом и быт':'Home & living','Спорт':'Sports','Другое':'Other'};
  return labels[canonical as keyof typeof labels]??canonical;
}
/** Units left as the store reports them (only eBay does); empty when unknown — never guessed. */
function stockText(item: ProductVariant | undefined, k: CalcCopy) {
  if (item?.quantity !== undefined) return item.quantity === 0 ? k.outOfStock : `${k.stockLeft(item.quantity)} · ${k.stockByEbay}`;
  if (item?.quantityMoreThan !== undefined) return `${k.stockMore(item.quantityMoreThan)} · ${k.stockByEbay}`;
  return "";
}
/** At most 10 of one option, or fewer when the store reports less stock. */
const maxFor = (item: ProductVariant | undefined) => Math.max(1, Math.min(10, item?.quantity ?? 10));

function Stepper({ value, max, label, k, onChange }: { value: number; max: number; label: string; k: CalcCopy; onChange: (value: number) => void }) {
  return <span className="lo-stepper" role="group" aria-label={label}>
    <button type="button" aria-label={k.less} disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus size={16} aria-hidden="true" /></button>
    <output aria-live="polite">{value}</output>
    <button type="button" aria-label={k.more} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={16} aria-hidden="true" /></button>
  </span>;
}

/** Options without a color/size matrix, as buttons the customer can pick several of. */
function OptionChips({ variants, picked, k, onToggle }: { variants: ProductVariant[]; picked: Record<string, number>; k: CalcCopy; onToggle: (item: ProductVariant) => void }) {
  return <div className="variant-options lo-option-chips">{variants.map(item => <button type="button" key={item.label} aria-pressed={Boolean(picked[item.label])} disabled={item.quantity === 0} onClick={() => onToggle(item)}>
    <span>{item.label}</span>{item.quantity !== undefined && item.quantity <= 5 && <small className="lo-stock">{item.quantity ? k.stockLeft(item.quantity) : k.outOfStock}</small>}
  </button>)}</div>;
}

/**
 * While the store is being asked, in place of the option picker: what is happening and what comes next.
 * Only the first step moves on by time (the request to the store is out); the price is never shown as checked before the answer.
 */
function StoreCheck({ host, locale }: { host: string; locale: Locale }) {
  const [step, setStep] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timers = [window.setTimeout(() => setStep(1), 1200), window.setTimeout(() => setSlow(true), 9000)];
    return () => timers.forEach(window.clearTimeout);
  }, []);
  const tx = (ru: string, uz: string, en: string) => locale === "ru" ? ru : isUzbek(locale) ? uzText(locale, uz) : en;
  const store = host || tx("магазина", "do‘kon", "store");
  const steps = [
    tx(`Открываем страницу ${store}`, `${store} sahifasini ochyapmiz`, `Opening the ${store} page`),
    tx("Сверяем цену и варианты", "Narx va variantlarni solishtiryapmiz", "Checking the price and options"),
    tx("Считаем итог с доставкой в Узбекистан", "O‘zbekistonga yetkazish bilan jamini hisoblaymiz", "Working out the total with delivery to Uzbekistan"),
  ];
  return <section className="lo-card lo-variant lo-check" role="status" aria-live="polite">
    <div className="lo-check-head">
      <span className="lo-check-orb" aria-hidden="true"><Loader2 className="spin" size={20} /></span>
      <span><b>{tx("Проверяем товар в магазине", "Tovarni do‘konda tekshiryapmiz", "Checking the item with the store")}</b>
        <small>{slow ? tx("Магазин отвечает дольше обычного — подождите ещё немного.", "Do‘kon odatdagidan sekinroq javob bermoqda — biroz kuting.", "The store is slower than usual — please wait a little longer.") : tx("Обычно это занимает несколько секунд.", "Odatda bu bir necha soniya oladi.", "This usually takes a few seconds.")}</small></span>
    </div>
    <ol className="lo-check-steps">{steps.map((label, index) => <li key={index} data-state={index < step ? "done" : index === step ? "current" : "next"}>
      <span className="lo-check-mark" aria-hidden="true">{index < step && <Check size={13} strokeWidth={3} />}</span>{label}
    </li>)}</ol>
    <div className="lo-check-bar" aria-hidden="true"><i /></div>
  </section>;
}

/** The bill's outline while the price is checked, so the total does not jump in from nowhere. */
function BillPlaceholder() {
  return <div className="lo-skel-bill" aria-hidden="true">
    <div><span className="lo-skel" /><span className="lo-skel" /></div>
    <div><span className="lo-skel" /><span className="lo-skel" /></div>
    <div><span className="lo-skel" /><span className="lo-skel" /></div>
    <div className="lo-skel-total"><span className="lo-skel" /><span className="lo-skel" /></div>
  </div>;
}

/**
 * Values Atlas loaded (from the store or its catalog): calm "label — value" lines with a lock, not inputs.
 * `rule`: a value an Atlas rule sets (free store delivery above the threshold), with an info mark instead of a lock.
 */
function LockedFacts({ rows, hint, stack = false, rule = false }: { rows: { id: string; label: string; value: string }[]; hint: string; stack?: boolean; rule?: boolean }) {
  return <dl className={"lo-facts" + (stack ? " stack" : "") + (rule ? " rule" : "")}>{rows.map(row => <div key={row.id} id={row.id} tabIndex={-1}>
    <dt>{row.label}</dt>
    <dd>{rule ? <Info size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}<span>{row.value || "—"}</span>{hint && <span className="sr-only"> ({hint})</span>}</dd>
  </div>)}</dl>;
}

/** The cart beside the order button: its unit count bumps when something is added (the banner on top confirms what). */
function CartEntry({ count, label, compact = false }: { count: number; label: string; compact?: boolean }) {
  return <Link className={"lo-cart-entry" + (compact ? " compact" : "")} href="/cart" aria-label={`${label}: ${count}`}>
    <ShoppingBag size={compact ? 20 : 18} aria-hidden="true" />{!compact && <span>{label}</span>}<b key={count}>{count}</b>
  </Link>;
}

export function GlobalLinkOrder() {
  const { ready, status, error: accountError, user, refresh, pricing, state, act, lastActionError, catalogProducts, loadCatalog } = useMarket();
  // Express by default; a cart that already chose standard keeps it, since the added line inherits the cart's speed.
  const [previewSpeed, setPreviewSpeed] = useState<DeliverySpeed>("express");
  const speedTouched = useRef(false);
  const cartSpeed = cartDeliverySpeed(state.cart);
  useEffect(() => { if (ready && !speedTouched.current) setPreviewSpeed(cartSpeed); }, [ready, cartSpeed]);
  const lang=state.communication.language;
  const freeFrom=`$${pricing.storeShippingFreeFromUsd??50}`;
  const c=lang==='ru'?{over:'ПОКУПКИ СО ВСЕГО МИРА',choose:'Выберите свой вариант',order:'Заказ по ссылке',checkPrice:'Проверьте размер и цену перед добавлением.',paste:'Вставьте ссылку — Atlas заполнит доступные данные.',loading:'Загружаем цену и варианты из магазина…',selected:'Товар уже выбран. Проверьте вариант и добавьте его в корзину.',edit:'Изменить ссылку',linkStep:'Ссылка на товар',stores:'eBay, Zara, Mango, Amazon и другие магазины.',storePage:'Страница магазина',get:'Получаем данные…',load:'Загрузить товар',directory:'Магазины для заказа по ссылке',storeHint:'Выбирайте региональную витрину по ссылке. Atlas считает итог с доставкой.',search:'Магазин или категория',enhanced:'цена + варианты',otherMatches:'Другие совпадения',allStores:'Все остальные магазины',notFound:'Этого магазина нет в списке. Отправьте его оператору — он проверит магазин.',login:'Войдите в личный кабинет: автозагрузка защищена, а товар сохранится в вашей корзине.',original:'Открыть оригинал в магазине',loaded:'Что загрузилось и что нужно проверить',availability:'Проверьте наличие в магазине',availabilityHint:'Откройте страницу товара, проверьте выбранный размер или вариант и вернитесь с ответом.',openStore:'Открыть магазин',available:'Есть в наличии',unavailable:'Нет в наличии',openFirst:'Сначала откройте страницу магазина — после возврата кнопки ответа станут доступны.',thanks:'Спасибо. Можно проверить остальные данные и продолжить.',removed:'Товар не будет добавлен. Администратор получил сообщение для проверки.',dataStep:'Проверьте данные',name:'Название товара',namePlaceholder:'Название со страницы магазина',shipCountry:'Страна фактической отправки',countryLabel:'Страна отправки',currency:'Валюта магазина',otherCountry:'Укажите страну',price:'Цена товара',atlasShipping:'До склада Atlas',change:'изменить',useShipping:'Использовать доставку до склада Atlas',shippingNote:`Это доставка от магазина до склада Atlas. Если магазин её не указал, держим резерв $10 отдельно от суммы к оплате — один на заказ из магазина и только при товарах из него на ${freeFrom} или меньше.`,category:'Категория',weight:'Вес товара с коробкой, кг',weightDetails:'Как уточняется вес доставки',forCalc:'для расчёта',variant:'Вариант товара',color:'Цвет',size:'Размер / модель',selectColor:'Выберите цвет',selectVariant:'Выберите вариант',none:'Нет',photo:'Фото товара — автоматически или по ссылке',image:'Адрес изображения',verified:'Я проверил данные и выбранный вариант.',add:'В корзину',adding:'Добавляем в корзину…',gallery:'Фотографии магазина',uz:'Узбекистан',empty:'Ваш товар появится здесь',fresh:'Когда проверены данные',freshText:'Atlas автоматически сверяет цену, валюту и выбранный вариант с магазином.',declaration:'Черновик декларации',cost:'Состав стоимости',reserve:`$10 — резерв на доставку магазина, один на заказ из этого магазина; в сумму к оплате не входит. При товарах дороже ${freeFrom} резерва нет. Фактическую сумму менеджер подтвердит после оформления.`,subtotal:'Промежуточный итог',estimate:'Итого с доставкой',emptyQuote:'Вставьте ссылку или заполните цену и вес.'}:{over:isUzbek(lang)?uzText(lang, 'DUNYODAN XARIDLAR'):'SHOP THE WORLD',choose:isUzbek(lang)?uzText(lang, 'Variantni tanlang'):'Choose your option',order:isUzbek(lang)?uzText(lang, 'Havola orqali buyurtma'):'Order by link',checkPrice:isUzbek(lang)?uzText(lang, 'Qo‘shishdan oldin o‘lcham va narxni tekshiring.'):'Check the size and price before adding.',paste:isUzbek(lang)?uzText(lang, 'Havolani kiriting — Atlas ma’lumotlarni to‘ldiradi.'):'Paste a link — Atlas will fill in the details.',loading:isUzbek(lang)?uzText(lang, 'Do‘kondan narx va variantlar yuklanmoqda…'):'Loading price and options from the store…',selected:isUzbek(lang)?uzText(lang, 'Tovar tanlandi. Variantni tekshirib savatga qo‘shing.'):'The item is selected. Check the option and add it to your cart.',edit:isUzbek(lang)?uzText(lang, 'Havolani o‘zgartirish'):'Change link',linkStep:isUzbek(lang)?uzText(lang, 'Tovar havolasi'):'Item link',stores:isUzbek(lang)?uzText(lang, 'eBay, Zara, Mango, Amazon va boshqa do‘konlar.'):'eBay, Zara, Mango, Amazon and more.',storePage:isUzbek(lang)?uzText(lang, 'Do‘kon sahifasi'):'Store page',get:isUzbek(lang)?uzText(lang, 'Ma’lumot olinmoqda…'):'Getting product data…',load:isUzbek(lang)?uzText(lang, 'Tovarni yuklash'):'Load item',directory:isUzbek(lang)?uzText(lang, 'Havola orqali buyurtma do‘konlari'):'Stores for link orders',storeHint:isUzbek(lang)?uzText(lang, 'Havola orqali mintaqaviy vitrinani tanlang. Atlas yetkazish bilan hisoblaydi.'):'Choose a regional storefront. Atlas calculates the total with delivery.',search:isUzbek(lang)?uzText(lang, 'Do‘kon yoki kategoriya'):'Store or category',enhanced:isUzbek(lang)?uzText(lang, 'narx + variantlar'):'price + options',otherMatches:isUzbek(lang)?uzText(lang, 'Boshqa moslar'):'Other matches',allStores:isUzbek(lang)?uzText(lang, 'Boshqa barcha do‘konlar'):'All other stores',notFound:isUzbek(lang)?uzText(lang, 'Bu do‘kon ro‘yxatda yo‘q. Uni operatorga yuboring — u do‘konni tekshiradi.'):'This store is not on the list. Send it to an operator — they will review the store.',login:isUzbek(lang)?uzText(lang, 'Kabinetga kiring: avtomatik yuklash himoyalangan va tovar savatda saqlanadi.'):'Sign in: automatic import is protected and the item will be saved to your cart.',original:isUzbek(lang)?uzText(lang, 'Do‘kondagi asl sahifani ochish'):'Open original store page',loaded:isUzbek(lang)?uzText(lang, 'Nimalar yuklandi va nimani tekshirish kerak'):'What loaded and what to check',availability:isUzbek(lang)?uzText(lang, 'Do‘kondagi mavjudlikni tekshiring'):'Check availability in the store',availabilityHint:isUzbek(lang)?uzText(lang, 'Tovar sahifasini oching, tanlangan o‘lcham yoki variantni tekshiring va javob bilan qayting.'):'Open the item page, check the selected size or option, and return with your answer.',openStore:isUzbek(lang)?uzText(lang, 'Do‘konni ochish'):'Open store',available:isUzbek(lang)?uzText(lang, 'Mavjud'):'In stock',unavailable:isUzbek(lang)?uzText(lang, 'Mavjud emas'):'Out of stock',openFirst:isUzbek(lang)?uzText(lang, 'Avval do‘kon sahifasini oching — qaytgach javob tugmalari yoqiladi.'):'Open the store page first; the answer buttons will unlock when you return.',thanks:isUzbek(lang)?uzText(lang, 'Rahmat. Qolgan ma’lumotlarni tekshirib davom eting.'):'Thanks. Check the remaining details to continue.',removed:isUzbek(lang)?uzText(lang, 'Tovar qo‘shilmaydi. Administrator tekshiradi.'):'The item will not be added. An administrator will review it.',dataStep:isUzbek(lang)?uzText(lang, 'Ma’lumotlarni tekshiring'):'Check the details',name:isUzbek(lang)?uzText(lang, 'Tovar nomi'):'Item name',namePlaceholder:isUzbek(lang)?uzText(lang, 'Do‘kon sahifasidagi nom'):'Name from the store page',shipCountry:isUzbek(lang)?uzText(lang, 'Haqiqiy jo‘natish mamlakati'):'Actual dispatch country',countryLabel:isUzbek(lang)?uzText(lang, 'Jo‘natish mamlakati'):'Dispatch country',currency:isUzbek(lang)?uzText(lang, 'Do‘kon valyutasi'):'Store currency',otherCountry:isUzbek(lang)?uzText(lang, 'Mamlakatni kiriting'):'Enter country',price:isUzbek(lang)?uzText(lang, 'Tovar narxi'):'Item price',atlasShipping:isUzbek(lang)?uzText(lang, 'Atlas omborigacha'):'To Atlas warehouse',change:isUzbek(lang)?uzText(lang, 'o‘zgartirish'):'edit',useShipping:isUzbek(lang)?uzText(lang, 'Atlas omborigacha yetkazishni ishlatish'):'Use delivery to Atlas warehouse',shippingNote:isUzbek(lang)?uzText(lang, `Bu do‘kondan Atlas omborigacha yetkazish. Do‘kon uni ko‘rsatmagan bo‘lsa, $10 zaxirani to‘lov summasidan alohida ushlab turamiz — do‘kondan bitta buyurtmaga bir marta va faqat tovarlar ${freeFrom} yoki undan kam bo‘lsa.`):`This is store-to-Atlas delivery. If the store does not state it, we hold a $10 reserve apart from the amount to pay — once per store order, and only when items from that store total ${freeFrom} or less.`,category:isUzbek(lang)?uzText(lang, 'Kategoriya'):'Category',weight:isUzbek(lang)?uzText(lang, 'Qutidagi og‘irlik, kg'):'Boxed weight, kg',weightDetails:isUzbek(lang)?uzText(lang, 'Yetkazish og‘irligi qanday aniqlanadi'):'How delivery weight is refined',forCalc:isUzbek(lang)?uzText(lang, 'hisoblash uchun'):'for calculation',variant:isUzbek(lang)?uzText(lang, 'Tovar varianti'):'Item option',color:isUzbek(lang)?uzText(lang, 'Rang'):'Color',size:isUzbek(lang)?uzText(lang, 'O‘lcham / model'):'Size / model',selectColor:isUzbek(lang)?uzText(lang, 'Rangni tanlang'):'Choose a color',selectVariant:isUzbek(lang)?uzText(lang, 'Variantni tanlang'):'Choose an option',none:isUzbek(lang)?uzText(lang, 'Yo‘q'):'Unavailable',photo:isUzbek(lang)?uzText(lang, 'Tovar surati — avtomatik yoki havola orqali'):'Product photo — automatic or by link',image:isUzbek(lang)?uzText(lang, 'Rasm manzili'):'Image URL',verified:isUzbek(lang)?uzText(lang, 'Ma’lumot va variantni tekshirdim.'):'I checked the details and selected option.',add:isUzbek(lang)?uzText(lang, 'Savatga'):'Add to cart',adding:isUzbek(lang)?uzText(lang, 'Savatga qo‘shilmoqda…'):'Adding to cart…',gallery:isUzbek(lang)?uzText(lang, 'Do‘kon rasmlari'):'Store photos',uz:isUzbek(lang)?uzText(lang, 'O‘zbekiston'):'Uzbekistan',empty:isUzbek(lang)?uzText(lang, 'Tovaringiz shu yerda paydo bo‘ladi'):'Your item will appear here',fresh:isUzbek(lang)?uzText(lang, 'Ma’lumot qachon tekshirildi'):'When the data was checked',freshText:isUzbek(lang)?uzText(lang, 'Atlas narx, valyuta va tanlangan variantni do‘kon bilan avtomatik solishtiradi.'):'Atlas automatically verifies the price, currency and selected option with the store.',declaration:isUzbek(lang)?uzText(lang, 'Deklaratsiya qoralamasi'):'Declaration draft',cost:isUzbek(lang)?uzText(lang, 'Narx tarkibi'):'Cost breakdown',reserve:isUzbek(lang)?uzText(lang, `$10 — do‘kon yetkazishi uchun zaxira, shu do‘kondan bitta buyurtmaga bir marta; to‘lov summasiga kirmaydi. Tovarlar ${freeFrom} dan qimmat bo‘lsa, zaxira yo‘q. Haqiqiy summani menejer rasmiylashtirilgach tasdiqlaydi.`):`$10 is the store-delivery reserve, once per order from this store, kept apart from the amount to pay. Over ${freeFrom} of items there is no reserve. A manager confirms the actual amount after checkout.`,subtotal:isUzbek(lang)?uzText(lang, 'Oraliq jami'):'Interim total',estimate:isUzbek(lang)?uzText(lang, 'Yetkazish bilan jami'):'Total with delivery',emptyQuote:isUzbek(lang)?uzText(lang, 'Havolani kiriting yoki narx va og‘irlikni to‘ldiring.'):'Paste a link or enter price and weight.'};
  const tx=(ru:string,uz:string,en:string)=>lang==='ru'?ru:isUzbek(lang)?uzText(lang, uz):en;
  const lc = linkOrderCopy[lang];
  c.freshText=tx('Atlas автоматически сверяет цену, валюту и выбранный вариант с магазином.','Atlas narx, valyuta va tanlangan variantni do‘kon bilan avtomatik solishtiradi.','Atlas automatically verifies the price, currency and selected option with the store.');
  const checkedText=tx('Atlas уже проверил цену и валюту в магазине.','Atlas narx va valyutani do‘konda tekshirib bo‘ldi.','Atlas has already checked the price and currency with the store.');
  const searchParams = useSearchParams();
  const requestedUrl = searchParams.get("url") ?? "";
  const catalogId = searchParams.get("catalog") ?? "";
  const isSourcedFlow = Boolean(requestedUrl);
  const dealSeed = communityDeals.find(item => item.id === searchParams.get("deal") && item.url === requestedUrl);
  const dealOptions: ProductVariant[] = dealSeed ? communityFallbackOptions(dealSeed).map(item => ({ ...item, available: true })) : [];
  const dealBoxedWeight = dealSeed ? Math.max(0.1, communityEstimatedWeight(dealSeed) - 0.5) : undefined;
  const seed = catalogLinkSeed(catalogProducts, catalogId, requestedUrl);
  const seedPrice = catalogLinkPrice(seed);
  const seedOptions: ProductVariant[] = seed ? catalogOrderVariants(seed) : [];
  const fallbackOptions = seedOptions.length ? seedOptions : dealOptions;
  const seedImages = seed
    ? dedupeSafeImages([seed.image, ...(seed.sourceImages ?? [])], seed.sourceUrl ?? requestedUrl)
    : dealSeed?.image ? [dealSeed.image] : [];
  const fallbackBoxedWeight = catalogLinkWeight(seed) ?? dealBoxedWeight;
  const [url, setUrl] = useState(() => searchParams.get("url") ?? "");
  const [source, setSource] = useState(seed?.sourceUrl ?? dealSeed?.url ?? ""),
    [name, setName] = useState(seed?.name ?? dealSeed?.title ?? ""),
    [brand, setBrand] = useState(seed?.brand ?? dealSeed?.store ?? ""),
    [declaration, setDeclaration] = useState(""),
    [currency, setCurrency] = useState(seed?.sourceCurrency ?? "USD"),
    [amount, setAmount] = useState(seedPrice ? String(seedPrice.amount) : dealSeed ? String(dealSeed.price) : ""),
    // The store's own "before the discount" price from the import (Shopify), in the store currency.
    [importReference, setImportReference] = useState<number | undefined>(undefined),
    [shipping, setShipping] = useState(String(seed?.sourceShippingUsd ?? 10)),
    [shippingCurrency, setShippingCurrency] = useState(seed?.sourceShippingCurrency ?? "USD"),
    [shippingEstimated, setShippingEstimated] = useState(seed?.sourceShippingEstimated ?? true),
    [weight, setWeight] = useState(fallbackBoxedWeight ? String(fallbackBoxedWeight) : ""),
    [country, setCountry] = useState(seed?.country ?? "США"),
    [otherCountry, setOtherCountry] = useState(""),
    [category, setCategory] = useState(seed?.category ?? (dealSeed ? communityProductCategory(dealSeed) : "Другое")),
    [variant, setVariant] = useState(fallbackOptions.length === 1 ? fallbackOptions[0].label : ""),
    [variants, setVariants] = useState<ProductVariant[]>(fallbackOptions),
    [selectedColor, setSelectedColor] = useState(""),
    [selectedSize, setSelectedSize] = useState(""),
    [image, setImage] = useState(seed?.image ?? dealSeed?.image ?? ""),
    [images, setImages] = useState<string[]>(seedImages),
    [colorwayImages, setColorwayImages] = useState<ProductColorwayGallery[]>([]),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    [showSourceForm, setShowSourceForm] = useState(() => !requestedUrl),
    [note, setNote] = useState(seed ? tx(`Данные из подборки ${seed.store} на ${seed.observedOn}. Atlas сверяет цену и вариант с магазином при добавлении в корзину. Вес — оценка Atlas: склад взвесит посылку.`, `${seed.store} to‘plamidagi ma’lumotlar, ${seed.observedOn}. Atlas savatga qo‘shishda narx va variantni do‘kon bilan solishtiradi. Vazn — Atlas bahosi: ombor jo‘natmani tortadi.`, `Data from the ${seed.store} selection as of ${seed.observedOn}. Atlas checks the price and option with the store when you add the item to the cart. Weight is an Atlas estimate: the warehouse weighs the parcel.`) : dealSeed ? tx(`Цена и фото сохранены из подборки на ${dealSeed.observedOn}. Atlas сейчас сверяет их с магазином.`, `Narx va surat ${dealSeed.observedOn} sanadagi to‘plamdan olingan. Atlas hozir ularni do‘kon bilan solishtirmoqda.`, `Price and photo saved from the selection on ${dealSeed.observedOn}. Atlas is checking them with the store now.`) : ""),
    [weightOrigin, setWeightOrigin] = useState(tx("Оценка по категории","Kategoriya bo‘yicha taxmin","Category estimate")),
    [sourceCheckStatus, setSourceCheckStatus] = useState<'idle'|'checking'|'verified'|'failed'>('idle'),
    [importedAt, setImportedAt] = useState<number | undefined>(),
    [sourceExpiresAt, setSourceExpiresAt] = useState<number | undefined>(),
    [formIssue, setFormIssue] = useState(""),
    [dataOpen, setDataOpen] = useState(false),
    [foundShipping, setFoundShipping] = useState<{
      amount: number;
      currency: string;
      destination?: string;
    } | null>(null);
  // Several options of one product can go to the cart at once: option label → quantity.
  const [picked, setPicked] = useState<Record<string, number>>(() => fallbackOptions.length === 1 ? { [fallbackOptions[0].label]: 1 } : {});
  const [manualQuantity, setManualQuantity] = useState(1);
  const [comment, setComment] = useState("");
  const [weightBasis, setWeightBasis] = useState<"store" | "estimate" | "title" | "catalog" | "customer">(seed ? "catalog" : "estimate");
  const [added, setAdded] = useState<{ lines: number; units: number } | null>(null);
  // Calculation details Atlas filled from the store, shown locked; null until a store check succeeds.
  const [atlasLocks, setAtlasLocks] = useState<LockFields | null>(null);
  // A locked value that would block the order (never expected) is opened for the customer instead of a dead end.
  const [unlocked, setUnlocked] = useState<Partial<LockFields>>({});
  // Options the customer had chosen that the reloaded product no longer sells.
  const [goneOptions, setGoneOptions] = useState<string[]>([]);
  // Finished loads: the customer's earlier choice is applied once the reloaded product is on screen.
  const [loadsDone, setLoadsDone] = useState(0);
  // Bumped when an earlier choice was applied, so the draft is saved even if the choice changed nothing on screen.
  const [choicesApplied, setChoicesApplied] = useState(0);
  // The store's product price from a store check: the price of options it lists without their own.
  const [basePrice, setBasePrice] = useState<number | undefined>();
  // An earlier choice that could not be applied as it was (the store did not answer, or now lists its own options).
  const [choiceNote, setChoiceNote] = useState("");
  // The link of the unfinished draft that opening the page without a link brought back; named on the page.
  const [resumedFrom, setResumedFrom] = useState("");
  // Whether this device keeps a guest's "add after sign-in"; the button promises it only then.
  const [canKeep, setCanKeep] = useState(true);
  // The page whose saved draft has been looked at; the product is loaded only after that.
  const [draftDecidedFor, setDraftDecidedFor] = useState<string | null>(null);
  const draftDecided = useRef<string | null>(null);
  // Only the latest request to the store fills the form: an older answer arriving late is dropped.
  const loadSeq = useRef(0);
  const automaticallyLoaded = useRef<string | null>(null);
  const autoLoadKey=`${catalogId}:${requestedUrl}`;
  const [autoLoadStarted,setAutoLoadStarted]=useState("");
  // From the first frame until the store answers the page keeps its shape: the product stays, the rest waits in placeholders.
  const checking=busy||(Boolean(requestedUrl)&&autoLoadStarted!==autoLoadKey);
  const [catalogContextLoaded,setCatalogContextLoaded]=useState<string|null>(()=>catalogId?null:'');
  // Drafts are kept per page address (link, catalog card or deal) on this device: lib/market/link-order-draft.ts.
  const dealId=dealSeed?.id??"";
  const draftKey=draftKeyFor({pageUrl:requestedUrl,catalogId,dealId});
  // Who is on this device: an account tag, '' for a guest, null until the account is known (or could not be loaded).
  const viewer=status==='authenticated'?ownerTag(user):status==='guest'?'':null;
  const draftRestored=useRef(false),draftCanSkipAutomaticLoad=useRef(false),draftPersistenceReady=useRef(false),prunedFor=useRef("");
  // The customer's choice to apply again once the product is (re)loaded: a stale draft, a price change, a guest add after sign-in.
  const reapply=useRef<DraftChoices|null>(null);

  useEffect(()=>{
    let active=true;
    void loadCatalog().finally(()=>{if(active&&catalogId)setCatalogContextLoaded(catalogId)});
    return()=>{active=false};
  },[catalogId,loadCatalog]);

  // Opening the page without a link brings back the unfinished draft the customer was last working on, at its own address
  // (so back, forward and reload keep it), and says so. A link the customer started typing, or "Next item", clears that
  // pointer. A draft saved under an account waits until the account is known and is never shown to anyone else.
  // Until this is decided the empty link form is not drawn, so it does not flash before the draft.
  const [resumeChecked,setResumeChecked]=useState(()=>Boolean(requestedUrl||catalogId));
  useEffect(()=>{
    if(resumeChecked)return;
    const last=requestedUrl||catalogId?null:readLastDraft(browserStorage());
    if(last?.owner&&status==='loading')return;
    queueMicrotask(()=>{setResumeChecked(true);if(last&&draftVisible(last,viewer))setResumedFrom(last.pageUrl)});
    if(last&&draftVisible(last,viewer))window.history.replaceState(window.history.state,"",draftAddress(last,window.location.search));
  },[resumeChecked,requestedUrl,catalogId,status,viewer]);
  useEffect(()=>{if(!storageWritable(browserStorage()))queueMicrotask(()=>setCanKeep(false))},[]);

  // This page's draft: a fresh store check of a plain link comes back as it was, without asking the store again;
  // anything else (stale, failed, a catalog card, a deal) loads the product again and then applies the customer's choice.
  useEffect(()=>{
    if(draftDecided.current===draftKey)return;
    draftRestored.current=false;draftCanSkipAutomaticLoad.current=false;draftPersistenceReady.current=false;reapply.current=null;
    const now=Date.now();
    const found=readDraft(browserStorage(),draftKey,now);
    // A draft saved under an account waits for the account; another account's draft is not this page's.
    if(found?.owner&&status==='loading')return;
    draftDecided.current=draftKey;
    const draft=found&&draftVisible(found,viewer)?found:null;
    if(draft){
      draftRestored.current=true;
      if(restoreMode(draft,now)==='full'){
        draftCanSkipAutomaticLoad.current=true;
        if(draft.previewSpeed)speedTouched.current=true;
        const kept=keepPicks(draft.picked,draft.variants).picked;
        const single=draft.variants.length===1?draft.variants[0].label:'';
        queueMicrotask(()=>{
          setUrl(draft.url||requestedUrl);setSource(draft.source);setName(draft.name);setBrand(draft.brand);setDeclaration(draft.declaration);
          setCurrency(draft.currency);setAmount(draft.amount);setBasePrice(draft.basePrice);setImportReference(draft.importReference);setChoiceNote("");
          setShipping(draft.shipping);setShippingCurrency(draft.shippingCurrency);setShippingEstimated(draft.shippingEstimated);setFoundShipping(draft.foundShipping);
          setWeight(draft.weight);setWeightBasis(draft.weightBasis);setWeightOrigin(draft.weightOrigin);
          setCountry(canonicalCountry(draft.country||'Другая страна'));setOtherCountry(draft.otherCountry);setCategory(canonicalCategory(draft.category||'Другое'));
          setVariants(draft.variants);setVariant(draft.variant||single);setPicked(Object.keys(kept).length||!single?kept:{[single]:1});
          setSelectedColor(draft.selectedColor);setSelectedSize(draft.selectedSize);setManualQuantity(draft.manualQuantity);setComment(draft.comment);
          if(draft.previewSpeed)setPreviewSpeed(draft.previewSpeed);
          setImage(draft.image);setImages(dedupeSafeImages(draft.images,draft.source));setColorwayImages(cleanColorwayGalleries(draft.colorwayImages,draft.source));
          setShowSourceForm(false);setNote(draft.note);
          setSourceCheckStatus(draft.sourceCheckStatus);setImportedAt(draft.importedAt);setSourceExpiresAt(draft.sourceExpiresAt);
          setAtlasLocks(draft.sourceCheckStatus==='verified'?draft.locks??null:null);
        });
      }
      else reapply.current=draftChoices(draft);
    }
    draftPersistenceReady.current=true;
    queueMicrotask(()=>setDraftDecidedFor(draftKey));
  },[draftKey,requestedUrl,status,viewer]);

  useEffect(()=>{
    // Not while the store is asked or a choice waits to be applied: an in-between form would overwrite the customer's choice.
    // Not before it is known who is here: the draft is saved under that account (or as a guest's).
    if(!draftPersistenceReady.current||checking||reapply.current||!source||!draftKey||viewer===null)return;
    writeDraft(browserStorage(),draftKey,{
      done:Boolean(added),owner:viewer,pageUrl:requestedUrl,catalogId,dealId,
      url,source,name,brand,declaration,currency,amount,basePrice,importReference,shipping,shippingCurrency,shippingEstimated,foundShipping,
      weight,weightBasis,weightOrigin,country,otherCountry,category,variant,variants,selectedColor,selectedSize,image,images,colorwayImages,
      showSourceForm,note,verified:false,sourceCheckStatus,importedAt,sourceExpiresAt,locks:atlasLocks??undefined,
      picked,manualQuantity,comment,previewSpeed:speedTouched.current?previewSpeed:undefined,
    },Date.now(),prunedFor.current!==draftKey);
    prunedFor.current=draftKey;
  },[draftKey,viewer,checking,choicesApplied,added,requestedUrl,catalogId,dealId,url,source,name,brand,declaration,currency,amount,basePrice,importReference,shipping,shippingCurrency,shippingEstimated,foundShipping,weight,weightBasis,weightOrigin,country,otherCountry,category,variant,variants,selectedColor,selectedSize,image,images,colorwayImages,showSourceForm,note,sourceCheckStatus,importedAt,sourceExpiresAt,atlasLocks,picked,manualQuantity,comment,previewSpeed]);
  const variantColors = useMemo(() => [...new Set(variants.map(item => item.color).filter((value): value is string => Boolean(value)))], [variants]);
  const currentCatalogSeed=catalogLinkSeed(catalogProducts,catalogId,requestedUrl,url);
  const catalogProductFlow=Boolean(currentCatalogSeed || (dealSeed && url===requestedUrl));
  // Incomplete merchant/catalog responses must never leave an empty read-only price.
  const catalogPriceLocked=catalogProductFlow && Boolean(catalogLinkPrice(currentCatalogSeed) || dealSeed);
  const catalogCountryLocked=catalogProductFlow && Boolean(dealSeed || (currentCatalogSeed?.country && countries.includes(canonicalCountry(currentCatalogSeed.country)) && canonicalCountry(currentCatalogSeed.country)!=='Другая страна'));
  const variantsForColor = useMemo(() => selectedColor ? variants.filter(item => item.color === selectedColor) : variantColors.length===1 ? variants.filter(item => item.color === variantColors[0]) : variantColors.length ? [] : variants, [variants,selectedColor,variantColors]);
  const variantSizes = useMemo(() => [...new Set(variantsForColor.map(item => item.size).filter((value): value is string => Boolean(value)))], [variantsForColor]);
  const nikeSizeSystem = variantsForColor.some(item => item.sizeLabel === 'Nike US women')
    ? 'women' as const
    : variantsForColor.some(item => item.sizeLabel === 'Nike US men') ? 'men' as const
      : inferNikeFootwearSizeSystem({sourceUrl:source,currency,category,title:name});
  const nikeSizeRows = nikeSizeSystem ? getNikeFootwearSizeRows(nikeSizeSystem, variantSizes) : [];
  const selectedNikeSize = nikeSizeSystem && selectedSize ? findNikeFootwearSizeRow(nikeSizeSystem, selectedSize) : undefined;
  const variantSizeLabel = nikeSizeSystem
    ? nikeSizeSystem === 'women'
      ? tx('Размер · Nike US, женские','O‘lcham · Nike US, ayollar','Size · Nike US women')
      : tx('Размер · Nike US, мужские','O‘lcham · Nike US, erkaklar','Size · Nike US men')
    : [...new Set(variantsForColor.map(item => item.sizeLabel).filter((value): value is string => Boolean(value)))].join(' / ') || (lang==='ru'?'Размер / модель':isUzbek(lang)?uzText(lang, 'O‘lcham / model'):'Size / model');
  // The store's product price applies to options it lists without their own; only from a store check (locked there).
  const storeBasePrice=sourceCheckStatus==='verified'&&atlasLocks?.price&&!unlocked.price?basePrice:undefined;
  function applyVariantChoice(item:ProductVariant|undefined,knownCurrency=true){
    if(!item){setVariant("");setSelectedSize("");return}
    setVariant(item.label);setSelectedColor(item.color??"");setSelectedSize(item.size??"");
    if(item.price!==undefined&&knownCurrency)setAmount(String(item.price));else if(storeBasePrice!==undefined)setAmount(String(storeBasePrice));else if(variants.some(value=>value.price!==undefined))setAmount("");
    if(item.image&&item.color!==selectedColor)setImage(item.image);
  }
  /** Toggle an option in the selection; the last one touched sets the price shown in the form. */
  function togglePick(item:ProductVariant){
    setPicked(current=>{const next={...current};if(next[item.label])delete next[item.label];else next[item.label]=1;return next});
    applyVariantChoice(item);
    setAdded(null);setGoneOptions([]);setChoiceNote("");
  }
  function setPickQuantity(label:string,quantity:number){
    setPicked(current=>({...current,[label]:quantity}));

  }
  function selectColorway(color:string){
    const choices=variants.filter(item=>item.color===color);
    const first=choices.find(item=>item.available)??choices[0];
    // The chosen color tapped again picks its only option back (after "add to cart" or removing it from the list).
    if(color===selectedColor){
      if(first&&!choices.some(item=>item.size)&&!picked[first.label]){applyVariantChoice(first);setPicked(current=>({...current,[first.label]:1}))}
      return;
    }
    const gallery=colorwayImages.find(item=>item.color===color)?.images??[];
    const nextImages=gallery.length?gallery:first?.image?[first.image]:[];
    setSelectedColor(color);setSelectedSize('');setVariant('');
    setImages(nextImages);
    setImage(first?.image&&nextImages.includes(first.image)?first.image:nextImages[0]??'');
    if(choices.some(item=>item.price!==undefined))setAmount('');
    if(!choices.some(item=>item.size)&&first){applyVariantChoice(first);setPicked(current=>({...current,[first.label]:current[first.label]??1}))}
  }
  /** What the customer has chosen now, to apply again after a reload. */
  function currentChoices():DraftChoices{
    const choices:DraftChoices={picked,variant,selectedColor,selectedSize,manualQuantity,comment,previewSpeed:speedTouched.current?previewSpeed:undefined};
    if(!variants.length&&variant.trim())choices.manualOption={label:variant.trim(),quantity:manualQuantity};
    if(sourceCheckStatus==='failed'&&!catalogProductFlow)choices.manual={name,currency,amount,shipping,shippingCurrency,shippingEstimated,weight,weightBasis,weightOrigin,country,otherCountry,category};
    return choices;
  }
  /** Options still sold keep their quantities (within stock); gone ones are named and never swapped for another option. */
  function applyChoices(saved:DraftChoices){
    let note="";
    if(variants.length){
      // An option typed while the store listed none is chosen again if the store now lists it by that name.
      let wanted=cleanPicks(saved.picked);
      const typed=saved.manualOption;
      if(!Object.keys(wanted).length&&typed){
        const match=variants.find(item=>item.label.trim().toLowerCase()===typed.label.toLowerCase());
        if(match)wanted={[match.label]:typed.quantity};else note=lc.choice.typed(`${typed.label} × ${typed.quantity}`);
      }
      const {picked:kept,missing}=keepPicks(wanted,variants);
      const labels=Object.keys(kept);
      if(labels.length){
        const lead=variants.find(item=>item.label===(kept[saved.variant]?saved.variant:labels[labels.length-1]));
        if(lead?.color&&lead.color!==selectedColor&&variantColors.includes(lead.color))selectColorway(lead.color);
        if(lead)applyVariantChoice(lead);
        setPicked(kept);
      }
      // The only option of a product is always the chosen one; with several, nothing is chosen for the customer.
      else if(missing.length&&variants.length>1){setPicked({});setVariant('');setSelectedSize('')}
      else if(!missing.length&&saved.selectedColor&&variantColors.includes(saved.selectedColor))selectColorway(saved.selectedColor);
      setGoneOptions(missing);
    }else{
      // The store did not answer this time: a typed option comes back as typed; one chosen option goes into the field
      // with its quantity; several are named for the customer instead of keeping one of them silently.
      const earlier=Object.entries(cleanPicks(saved.picked));
      if(saved.manualOption){setVariant(saved.manualOption.label);setManualQuantity(saved.manualOption.quantity)}
      else if(earlier.length===1){setVariant(earlier[0][0]);setManualQuantity(earlier[0][1])}
      else if(earlier.length>1){setVariant("");note=lc.choice.unanswered(earlier.map(([label,quantity])=>`${label} × ${quantity}`).join(", "))}
    }
    setChoiceNote(note);
    if(saved.comment)setComment(saved.comment);
    if(saved.previewSpeed){speedTouched.current=true;setPreviewSpeed(saved.previewSpeed)}
    // What the customer typed comes back only while the store still gives nothing for it.
    const typed=saved.manual;
    if(typed&&sourceCheckStatus==='failed'){
      if(typed.name.trim())setName(typed.name);
      if(Number(typed.amount)>0){setAmount(typed.amount);if(currencies.includes(typed.currency))setCurrency(typed.currency)}
      if(typed.shipping!==''&&Number(typed.shipping)>=0){setShipping(typed.shipping);setShippingCurrency(typed.shippingCurrency);setShippingEstimated(typed.shippingEstimated)}
      if(validBoxedWeight(typed.weight)!==undefined){setWeight(typed.weight);setWeightBasis(typed.weightBasis);setWeightOrigin(typed.weightOrigin)}
      if(typed.country){setCountry(canonicalCountry(typed.country));setOtherCountry(typed.otherCountry)}
      if(typed.category)setCategory(canonicalCategory(typed.category));
    }

    setChoicesApplied(count=>count+1);
  }
  // After the product is (re)loaded — a stale draft, a price change, a guest add refused after sign-in — the customer's
  // choice comes back: the options the store still sells with their quantities, the comment and the delivery speed.
  useEffect(()=>{
    const wanted=reapply.current;
    if(!wanted||busy||!loadsDone)return;
    reapply.current=null;
    queueMicrotask(()=>applyChoices(wanted));
    // `applyChoices` reads the product just loaded; this runs once per finished load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loadsDone]);
  async function load(value = url) {
    let link: string;
    try {
      link = validateSource(value);
    } catch (e) {
      toast.error((e as Error).message);
      setShowSourceForm(true);
      reapply.current=null;
      return;
    }
    const linkSeed=catalogLinkSeed(catalogProducts,catalogId,requestedUrl,link);
    const linkDealSeed=link===requestedUrl?dealSeed:undefined;
    const linkIsCatalogFlow=Boolean(linkSeed||linkDealSeed);
    const linkSeedPrice=catalogLinkPrice(linkSeed);
    const linkFallbackOptions:ProductVariant[]=linkSeed?catalogOrderVariants(linkSeed):linkDealSeed?communityFallbackOptions(linkDealSeed).map(item=>({...item,available:true})):[];
    const linkSeedImages=linkSeed?dedupeSafeImages([linkSeed.image,...(linkSeed.sourceImages??[])],linkSeed.sourceUrl??link):linkDealSeed?.image?[linkDealSeed.image]:[];
    const linkBoxedWeight=catalogLinkWeight(linkSeed)??(linkDealSeed?Math.max(.1,communityEstimatedWeight(linkDealSeed)-.5):undefined);
    const seq=++loadSeq.current;
    setUrl(link);
    setBusy(true);
    setSource(link);

    setSourceCheckStatus('checking');
    setAtlasLocks(null);setUnlocked({});setGoneOptions([]);setChoiceNote("");setBasePrice(undefined);
    setName(linkSeed?.name ?? linkDealSeed?.title ?? "");
    setBrand(linkSeed?.brand ?? linkDealSeed?.store ?? "");
    setDeclaration("");
    setAmount(linkSeedPrice ? String(linkSeedPrice.amount) : linkDealSeed ? String(linkDealSeed.price) : "");
    setImportReference(undefined);
    setCurrency(linkSeedPrice?.currency ?? "USD");
    setShipping(String(linkSeed?.sourceShippingUsd ?? 10));
    setShippingCurrency("USD");
    setShippingEstimated(linkSeed?.sourceShippingEstimated ?? true);
    setImage(linkSeed?.image ?? linkDealSeed?.image ?? "");
    setImages(linkSeedImages);
    setColorwayImages([]);
    setImportedAt(undefined);
    setSourceExpiresAt(undefined);
    setWeight(linkBoxedWeight ? String(linkBoxedWeight) : "");
    const inferredCountry = linkSeed?.country ?? inferStorefrontCountry(link, linkSeed?.sourceCurrency);
    setCountry(canonicalCountry(inferredCountry ?? "Другая страна"));
    setOtherCountry("");
    setCategory(canonicalCategory(linkSeed?.category ?? (linkDealSeed ? communityProductCategory(linkDealSeed) : "Другое")));
    setVariant(linkFallbackOptions.length === 1 ? linkFallbackOptions[0].label : "");
    setVariants(linkFallbackOptions);
    setPicked(linkFallbackOptions.length === 1 ? { [linkFallbackOptions[0].label]: 1 } : {});
    setManualQuantity(1);
    setAdded(null);
    setSelectedColor("");
    setSelectedSize("");
    setNote(linkDealSeed ? tx(`Цена и фото сохранены из подборки на ${linkDealSeed.observedOn}. Atlas сверяет их с магазином.`, `Narx va surat ${linkDealSeed.observedOn} sanadagi to‘plamdan olingan. Atlas ularni do‘kon bilan solishtiradi.`, `Price and photo saved from the selection on ${linkDealSeed.observedOn}. Atlas checks them with the store.`) : linkSeed ? tx(`Товар из каталога ${linkSeed.store}. Atlas сверит цену и вариант с магазином.`, `${linkSeed.store} katalogidagi tovar. Atlas narx va variantni do‘kon bilan solishtiradi.`, `Item from the ${linkSeed.store} catalog. Atlas checks the price and option with the store.`) : "");
    setFoundShipping(null);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A product opened for ordering is checked against the merchant now;
        // the short cache remains for batch imports and repeat browsing only.
        body: JSON.stringify({ url: link, fresh: true }),
      });
      const data: Extracted & {
        error?: string;
        manualEntryAvailable?: boolean;
        fetchedAt?: number;
        expiresAt?: number;
        cached?: boolean;
      } = await response.json();
      if (seq !== loadSeq.current) return;
      if (!response.ok && data.manualEntryAvailable) {
        const partialImages=dedupeSafeImages([data.image,...(data.images??[])].filter(Boolean) as string[],link);
        const allPartialGalleries=cleanColorwayGalleries(data.colorwayImages,data.sourceUrl??link);
        const partialGalleries=data.selectedVariantColor
          ? allPartialGalleries.filter(gallery=>gallery.color===data.selectedVariantColor)
          : allPartialGalleries;
        const partialCountry=canonicalCountry((linkIsCatalogFlow&&linkSeed?linkSeed.country??data.country??inferStorefrontCountry(link,data.currency):data.country??inferStorefrontCountry(link,data.currency))??"Другая страна");
        const partialCurrency=currencies.includes(data.currency??"")?data.currency!:currencyForCountry(partialCountry);
        setSource(data.sourceUrl??link);
        setName(linkIsCatalogFlow&&linkSeed?linkSeed.name:data.title??linkSeed?.name??linkDealSeed?.title??"");
        setBrand(data.brand??linkSeed?.brand??linkDealSeed?.store??new URL(link).hostname.replace(/^www\./,''));
        setImage(partialImages[0]??linkSeed?.image??linkDealSeed?.image??"");
        setImages(partialImages.length?partialImages:linkSeedImages);
        setColorwayImages(partialGalleries);
        setImportReference(typeof data.referencePrice==='number'?data.referencePrice:undefined);
        if(data.price!==undefined&&currencies.includes(data.currency??"")){setAmount(String(data.price));setCurrency(data.currency!)}
        else if(linkSeedPrice){setAmount(String(linkSeedPrice.amount));setCurrency(linkSeedPrice.currency)}
        else if(linkDealSeed){setAmount(String(linkDealSeed.price));setCurrency("USD")}
        else {setAmount("");setCurrency(currencies.includes(partialCurrency??"")?partialCurrency!:"USD")}
        const partialCategory=canonicalCategory(linkIsCatalogFlow&&linkSeed?linkSeed.category:data.category??linkSeed?.category??inferProductCategory(data.title??"",data.brand??""));
        setCategory(partialCategory);
        const receivedPartialVariants=data.variants?.length?data.variants:linkFallbackOptions;
        const partialVariants=variantsForSourceColor(receivedPartialVariants,data.selectedVariantColor);
        const partialSelected=partialVariants.find(item=>item.id&&(item.id===data.selectedVariantId||item.id===data.sku));
        setVariants(partialVariants);
        setVariant(partialSelected?.label??(partialVariants.length===1?partialVariants[0].label:""));
        setPicked(partialVariants.length===1?{[partialVariants[0].label]:1}:{});
        const partialColor=selectedImportedColor(data,partialVariants,partialGalleries);
        setSelectedColor(partialColor);setSelectedSize(partialSelected?.size??"");
        const partialGallery=partialGalleries.find(gallery=>gallery.color===partialColor);
        if(partialGallery){setImages(partialGallery.images);setImage(partialGallery.images[0]);}
        setCountry(partialCountry);
        if(linkIsCatalogFlow&&linkSeed){setWeight(String(linkBoxedWeight));setWeightBasis('catalog')}
        else{
          const stated=data.weightKind==='shipping'?validBoxedWeight(data.boxedWeight):undefined;
          const estimate=estimateBoxedWeight(partialCategory,data.title??'');
          setWeight(String(stated??estimate.kg));setWeightBasis(stated!==undefined?'store':estimate.basis==='title'?'title':'estimate');
        }
        setSourceCheckStatus('failed');
        setNote(tx("Автоматически получены не все данные. Проверьте цену и вариант.","Ma’lumotlarning hammasi avtomatik olinmadi. Narx va variantni tekshiring.","Some details were not available automatically. Review the price and option."));
        setShowSourceForm(false);
        return;
      }
      if (!response.ok)
        throw Error(data.error ?? tx("Не удалось получить данные магазина.", "Do‘kon ma’lumotlarini olib bo‘lmadi.", "Could not load store data."));
      setSource(data.sourceUrl);
      setName(linkIsCatalogFlow&&linkSeed?linkSeed.name:data.title ?? linkSeed?.name ?? linkDealSeed?.title ?? "");
      setBrand(data.brand ?? linkSeed?.brand ?? linkDealSeed?.store ?? new URL(data.sourceUrl).hostname);
      setImage(data.image ?? linkSeed?.image ?? linkDealSeed?.image ?? "");
      const importedImages=dedupeSafeImages([data.image,...(data.images??[])].filter(Boolean) as string[],data.sourceUrl);
      setImages(importedImages.length?importedImages:linkSeedImages);
      const allImportedColorwayGalleries=cleanColorwayGalleries(data.colorwayImages,data.sourceUrl);
      const importedColorwayGalleries=data.selectedVariantColor
        ? allImportedColorwayGalleries.filter(gallery=>gallery.color===data.selectedVariantColor)
        : allImportedColorwayGalleries;
      setColorwayImages(importedColorwayGalleries);
      if(importedImages.length&&!data.image)setImage(importedImages[0]);
      const nextCategory = linkIsCatalogFlow&&linkSeed
        ? canonicalCategory(linkSeed.category)
        : canonicalCategory(data.category ?? linkSeed?.category ?? inferProductCategory(data.title ?? "", data.brand ?? ""));
      setCategory(nextCategory);
      setDeclaration(data.declarationDescription ?? "");
      setCurrency(
        currencies.includes(data.currency ?? "") ? data.currency! : "USD",
      );
      const knownCurrency = currencies.includes(data.currency ?? "");
      setImportReference(typeof data.referencePrice === "number" ? data.referencePrice : undefined);
      if (data.price !== undefined && knownCurrency) setAmount(String(data.price));
      else if (linkSeedPrice) {setAmount(String(linkSeedPrice.amount));setCurrency(linkSeedPrice.currency)}
      else if (linkDealSeed) setAmount(String(linkDealSeed.price));
      const receivedVariants = data.variants ?? [];
      const allImportedVariants = hasSelectableDimensions(linkFallbackOptions) && !hasSelectableDimensions(receivedVariants)
        ? linkFallbackOptions
        : receivedVariants.length
          ? receivedVariants
          : linkFallbackOptions;
      const importedVariants = variantsForSourceColor(allImportedVariants,data.selectedVariantColor);
      const safeVariants = knownCurrency ? importedVariants : importedVariants.map(item => ({...item, price: undefined}));
      const hasPricedVariants=knownCurrency&&safeVariants.some(item=>typeof item.price==='number'&&Number.isFinite(item.price)&&item.price>0);
      const selectableVariants=data.price===undefined&&hasPricedVariants?safeVariants.filter(item=>typeof item.price==='number'&&Number.isFinite(item.price)&&item.price>0):safeVariants;
      setVariants(selectableVariants);
      const sourceParams = new URL(data.sourceUrl).searchParams;
      const selectedIds = [data.selectedVariantId, data.sku, sourceParams.get('variant'), sourceParams.get('var')].filter((value): value is string => Boolean(value));
      const selectedVariant = selectableVariants.find(item => item.id && selectedIds.includes(item.id))
        ?? (selectableVariants.length === 1 ? selectableVariants[0] : undefined);
      const selectedColorForLink=selectedVariant?.color??selectedImportedColor(data,selectableVariants,importedColorwayGalleries);
      setSelectedColor(selectedColorForLink);
      const selectedColorGallery=importedColorwayGalleries.find(gallery=>gallery.color===selectedColorForLink);
      if(selectedColorGallery){
        setImages(selectedColorGallery.images);
        if(!selectedVariant?.image)setImage(selectedColorGallery.images[0]);
      }
      setPicked(selectedVariant ? { [selectedVariant.label]: 1 } : {});
      if (selectedVariant) {
        setVariant(selectedVariant.label);
        setSelectedSize(selectedVariant.size??"");
        if (selectedVariant.price !== undefined && knownCurrency) setAmount(String(selectedVariant.price));
        if (selectedVariant.image) setImage(selectedVariant.image);
      }
      const nextCountry = canonicalCountry((linkIsCatalogFlow&&linkSeed?linkSeed.country??data.country??inferStorefrontCountry(data.sourceUrl,data.currency):data.country??inferStorefrontCountry(data.sourceUrl,data.currency)) ?? "Другая страна");
      setCountry(nextCountry);
      if ((!data.currency || !currencies.includes(data.currency)) && !linkSeedPrice)
        setCurrency(currencyForCountry(nextCountry) ?? "USD");
      const importedWeight=validBoxedWeight(data.boxedWeight);
      // Only a shipping weight is "with packaging"; a bare product weight is a floor for the estimate.
      const statedWeight=data.weightKind==='shipping'?importedWeight:undefined;
      const titleEstimate=estimateBoxedWeight(nextCategory,data.title??'');
      const estimateKg=Math.max(titleEstimate.kg,importedWeight??0);
      setWeight(String(linkIsCatalogFlow&&linkSeed?linkBoxedWeight:statedWeight ?? linkBoxedWeight ?? estimateKg));
      setWeightBasis(linkIsCatalogFlow&&linkSeed?'catalog':statedWeight!==undefined?'store':linkBoxedWeight!==undefined?'catalog':titleEstimate.basis==='title'?'title':'estimate');
      setWeightOrigin(
        linkIsCatalogFlow&&linkSeed
          ? tx("Вес задан Atlas для карточки каталога","Vazn Atlas katalog kartochkasi uchun belgilagan","Weight set by Atlas for this catalog item")
          : importedWeight
          ? data.weightKind === "shipping"
            ? tx("Вес отправления со страницы","Sahifadagi jo‘natma og‘irligi","Shipping weight from page")
            : tx("Вес товара со страницы — коробку нужно проверить","Sahifadagi tovar og‘irligi — qutini tekshirish kerak","Product weight from page; verify the box")
          : fallbackBoxedWeight
            ? tx("Оценка Atlas; склад взвесит посылку","Atlas bahosi; ombor jo‘natmani tortadi","Atlas estimate; the warehouse weighs the parcel")
            : tx("Оценка Atlas по категории","Kategoriya bo‘yicha Atlas bahosi","Atlas estimate by category"),
      );
      setImportedAt(data.fetchedAt ?? Date.now());
      setSourceExpiresAt(data.expiresAt);
      const productPriceKnown=typeof data.price==='number'&&Number.isFinite(data.price)&&data.price>0;
      const sourceHasPrice=knownCurrency&&Boolean(selectableVariants.length)&&(productPriceKnown||hasPricedVariants);
      setSourceCheckStatus(sourceHasPrice?'verified':'failed');
      // What Atlas got from the store is locked on the page, the price and its currency always: each option costs its own
      // price or, without one, the product price, exactly as the server checks it (lib/importer/verify.ts).
      setBasePrice(sourceHasPrice&&productPriceKnown?data.price:undefined);
      const loadedName=linkIsCatalogFlow&&linkSeed?linkSeed.name:data.title??linkSeed?.name??linkDealSeed?.title??"";
      setAtlasLocks(sourceHasPrice?{name:Boolean(loadedName.trim()),price:true,shipping:true,country:nextCountry!=="Другая страна",category:true,weight:true}:null);
      setShowSourceForm(false);
      // Shipping may depend on destination/session; require explicit confirmation even if found.
      if (!linkIsCatalogFlow&&data.shipping !== undefined) {
        const foundCurrency = data.shippingCurrency ?? data.currency ?? "";
        setFoundShipping({
          amount: data.shipping,
          currency: foundCurrency,
          destination: data.shippingDestination,
        });
        if (currencies.includes(foundCurrency)) {
          setShipping(String(data.shipping));
          setShippingCurrency(foundCurrency);
          setShippingEstimated(false);
        }
      }
      const shippingMessage =
        !linkIsCatalogFlow&&data.shipping !== undefined
          ? tx("На странице указана доставка ", "Sahifada yetkazish ", "The page lists shipping of ") +
            data.shipping +
            " " +
            (data.shippingCurrency ?? "") +
            (data.shippingDestination
              ? tx(" для ", " uchun ", " for ") + data.shippingDestination
              : "") +
            tx(". Это доставка от магазина до склада Atlas.", ". Bu do‘kondan Atlas omborigacha yetkazish.", ". This is store-to-Atlas warehouse shipping.")
          : "";
      setNote(
        [
          data.title
            ? tx("Название и доступные данные загружены.", "Nom va mavjud ma’lumotlar yuklandi.", "Name and available data loaded.")
            : tx("Не все данные опубликованы.", "Barcha ma’lumotlar e’lon qilinmagan.", "Some data is not published."),
          data.cached ? tx("Использованы недавно проверенные данные.", "Yaqinda tekshirilgan ma’lumotlar ishlatildi.", "Recently checked data was used.") : "",
          ...data.warnings,
          !sourceHasPrice?tx("Цена или вариант пока не получены. Повторите автоматическую загрузку позже.","Narx yoki variant hozircha olinmadi. Avtomatik yuklashni keyinroq takrorlang.","Price or option is not available yet. Retry automatic import later."):"",
          selectableVariants.length<safeVariants.length?tx("Варианты без подтверждённой цены магазина не показаны.","Do‘kon tasdiqlagan narxi yo‘q variantlar ko‘rsatilmaydi.","Options without a store-confirmed price are not shown."):"",
          shippingMessage,
          data.currency && !currencies.includes(data.currency)
             ? tx("Валюта ", "Valyuta ", "Currency ") +
               data.currency +
               tx(" не поддерживается: укажите эквивалент в поддерживаемой валюте.", " qo‘llanmaydi: qo‘llab-quvvatlanadigan valyutada ekvivalent kiriting.", " is not supported: enter an equivalent in a supported currency.")
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setNote((e as Error).message);
      setName(linkSeed?.name??linkDealSeed?.title??"");
      setBrand(linkSeed?.brand??linkDealSeed?.store??new URL(link).hostname.replace(/^www\./,''));
      setImage(linkSeed?.image??linkDealSeed?.image??"");
      setImages(linkSeedImages);
      setAmount(linkSeedPrice?String(linkSeedPrice.amount):linkDealSeed?String(linkDealSeed.price):"");
      setCurrency(linkSeedPrice?.currency??"USD");
      setShipping(String(linkSeed?.sourceShippingUsd??unknownStoreShippingUsd));setShippingCurrency("USD");setShippingEstimated(linkSeed?.sourceShippingEstimated??true);
      setVariants(linkFallbackOptions);
      setColorwayImages([]);
      setVariant(linkFallbackOptions.length===1?linkFallbackOptions[0].label:"");
      setPicked(linkFallbackOptions.length===1?{[linkFallbackOptions[0].label]:1}:{});
      setWeight(String(linkBoxedWeight ?? estimatedBoxedWeight(category)));
      setWeightBasis(linkBoxedWeight!==undefined?'catalog':'estimate');
      setWeightOrigin(linkIsCatalogFlow&&linkSeed?tx("Вес задан Atlas для карточки каталога","Vazn Atlas katalog kartochkasi uchun belgilagan","Weight set by Atlas for this catalog item"):linkBoxedWeight ? tx("Оценка Atlas; склад взвесит посылку","Atlas bahosi; ombor jo‘natmani tortadi","Atlas estimate; the warehouse weighs the parcel") : tx("Оценка Atlas по категории","Kategoriya bo‘yicha Atlas bahosi","Atlas estimate by category"));
      setSourceCheckStatus('failed');
      setShowSourceForm(false);
    } finally {
      if (seq === loadSeq.current) {
        setBusy(false);
        setLoadsDone(count=>count+1);
      }
    }
  }
  /** A link typed in the form becomes the page address (?url=…), so back, forward and reload keep it; a new link starts clean. */
  function openLink(value = url) {
    let link: string;
    try { link = validateSource(value); }
    catch (e) { toast.error((e as Error).message); setShowSourceForm(true); return; }
    if (link === requestedUrl) { void load(link); return; }
    removeDraft(browserStorage(), draftKeyFor({ pageUrl: link }));
    setAdded(null); setResumedFrom("");
    // The address change loads it, even when the same link was open before "Next item".
    automaticallyLoaded.current = null;
    window.history.replaceState(window.history.state, "", draftAddress({ pageUrl: link }, window.location.search));
  }
  /** "Next item" and "Start with a new link": an empty link form at /order-by-link that does not bring this draft back. */
  function startNewLink() {
    forgetLastDraft(browserStorage());
    automaticallyLoaded.current = null; setAutoLoadStarted("");
    setAdded(null); setResumedFrom(""); setFormIssue(""); setUrl(""); setSource(""); setSourceCheckStatus("idle"); setShowSourceForm(true);
    window.history.replaceState(window.history.state, "", draftAddress({ pageUrl: "" }, window.location.search));
    window.setTimeout(() => document.getElementById("source-url")?.focus(), 0);
  }
  useEffect(() => {
    const loadKey=autoLoadKey;
    // After this page's saved draft was looked at: a fresh one is shown as it was, any other is reloaded with the choice.
    if (!requestedUrl || (catalogId&&catalogContextLoaded!==catalogId) || draftDecidedFor !== draftKey || automaticallyLoaded.current === loadKey) return;
    setAutoLoadStarted(loadKey);
    if(draftRestored.current&&draftCanSkipAutomaticLoad.current){
      automaticallyLoaded.current=loadKey;
      setShowSourceForm(false);
      return;
    }
    automaticallyLoaded.current = loadKey;
    setUrl(requestedUrl);
    setShowSourceForm(false);
    void load(requestedUrl);
    // `load` intentionally reads the current form state; this effect runs once per requested product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedUrl, catalogId, catalogContextLoaded, draftDecidedFor, draftKey]);
  // The options the customer chose, with quantities: from the option buttons, or the typed option.
  const picks: [string, number][] = variants.length
    ? Object.entries(picked).filter(([label]) => variants.some(item => item.label === label))
    : variant.trim() ? [[variant.trim(), manualQuantity]] : [];
  const pickedVariant = (label: string) => variants.find(item => item.label === label);
  const priceOf = (label: string) => pickedVariant(label)?.price ?? storeBasePrice ?? Number(amount);
  const units = picks.reduce((sum, [, quantity]) => sum + quantity, 0);
  // Priced exactly as the cart would price these lines on their own: one parcel, one store-delivery hold.
  let previewItems: CartItem[] = [];
  try {
    const boxed = validBoxedWeight(weight);
    if (boxed !== undefined && picks.length && source) {
      const shippingUsd = shipping === "" ? 0 : toUsd(Number(shipping), shippingCurrency, pricing.rates);
      previewItems = repriceCart(picks.map(([label, quantity], index) => ({
        id: `preview-${index}`,
        product: { id: `preview-${index}`, name: name || "item", brand: "", category, usd: toUsd(priceOf(label), currency, pricing.rates), weight: paddedWeight(boxed), image: "", variants: [label], sourceUrl: source, country: country === "Другая страна" ? otherCountry : country, sourceShippingUsd: shippingUsd, sourceShippingEstimated: shippingEstimated, boxedWeight: boxed },
        variant: label, quantity, requestedServiceIds: [], deliverySpeed: previewSpeed, quote: {} as CartItem["quote"],
      })), 0, pricing);
    }
  } catch { previewItems = []; }
  const previewSums = previewItems.length ? sumQuotes(previewItems.map(item => item.quote)) : null;
  const previewWeight = Math.round(previewItems.reduce((sum, item) => sum + item.quote.weight, 0) * 100) / 100;
  const previewHold = storeShippingReserves(previewItems, pricing)[0];
  const previewCountry = country === "Другая страна" ? otherCountry : country;
  const speedOptions = deliverySpeedOptions(pricing, [previewCountry], lang);
  const speedNote = previewItems.length ? savingText(previewItems, pricing, lang) : "";
  const storeShippingState: "stated" | "free" | "hold" | "none" = !shippingEstimated ? (Number(shipping) > 0 ? "stated" : "none") : !previewItems.length ? "none" : previewHold?.reserveUsd ? "hold" : "free";
  // Unknown store delivery is free by Atlas's rule once the items cost more than the threshold: a line, not a field.
  // Decided by the amount, not by an empty or zero field, so clearing the field to type a new value keeps the field.
  const shippingFree = shippingEstimated && Boolean(previewHold) && previewHold!.subtotalUsd > (pricing.storeShippingFreeFromUsd ?? 50);
  // Sent with the item: what the customer typed, or the usual $10 hold when the rule made it free and nothing valid was typed.
  const shippingTyped = shipping !== "" && Number.isFinite(Number(shipping)) && Number(shipping) >= 0;
  const sendShipping = shippingTyped ? Number(shipping) : unknownStoreShippingUsd, sendShippingCurrency = shippingTyped ? shippingCurrency : "USD";
  const primaryProfile = state.deliveryProfiles.find(profile => profile.primary) ?? state.deliveryProfiles[0];
  const customsPreview = previewItems.length ? cartCustomsEstimate({ ...state, cart: previewItems }, pricing, { profile: primaryProfile }, { outsideUsed: false, help: false }) : null;
  const k = calcCopy[lang];
  const sourceHost = (() => { try { return source ? new URL(source).hostname.replace(/^www\./, "") : ""; } catch { return ""; } })();
  const previewProduct: Product = {
    id: "preview",
    name: name || "Фото товара",
    brand: brand || sourceHost,
    category,
    usd: 1,
    weight: 1,
    image,
    sourceUrl: source || undefined,
    variants: [""],
  };
  const cc = cartCopy[lang];
  /**
   * The item went to the cart: the draft is done (before anything else is awaited) and what was added is no longer
   * chosen, so a new choice here holds only new options; the cart merges equal lines, so repeating it would add twice.
   */
  function finishAdd(lines: number, units: number) {
    markDraftDone(browserStorage(), draftKey);
    setAdded({ lines, units });
    setPicked(variants.length === 1 ? { [variants[0].label]: 1 } : {});
    setManualQuantity(1);
    if (!variants.length) setVariant("");
     setComment(""); setFormIssue(""); setGoneOptions([]); setChoiceNote(""); setResumedFrom("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  // A guest's "add to cart" is sent once after sign-in, when this product is on screen again (app/pending-cart-add.ts).
  const pendingAdd = usePendingCartAdd(!checking && !adding && Boolean(source) && draftDecidedFor === draftKey, (result: PendingCartAddResult) => {
    if (result.status === "added") {
      toast.success(lc.pending.added(result.pending.units) + (result.speedKept ? " " + lc.pending.speedKept : ""));
      speedTouched.current = false; setPreviewSpeed(result.speed);
      finishAdd(result.pending.lines, result.pending.units);
      return;
    }
    setFormIssue(result.status === "changed" ? lc.pending.changed : lc.pending.failed);
    // The store price moved while the customer was signing in: show the new one with their choice, never add it silently.
    if (result.status === "changed") { reapply.current = choicesFromAction(result.pending.action, result.pending.speed); void load(requestedUrl || source); }
  }, { draftKey });
  // A guest who changes the choice after asking to add it (back from the sign-in page) gets what is on screen after
  // signing in, not the older choice: the kept add for this product is dropped and the button keeps the new one.
  useEffect(() => { if (status === "guest") discardPendingCartAdd(browserStorage(), draftKey); }, [status, draftKey, picked, manualQuantity, variant, comment, previewSpeed]);
  const addBusy = adding || pendingAdd.sending;
  const isGuest = status === "guest";
  // Units already in the cart, for the entry beside the order button (signed-in customers only).
  const cartUnits = ready && !isGuest ? state.cart.reduce((sum, line) => sum + line.quantity, 0) : 0;
  const cartLabel = tx("Корзина", "Savat", "Cart");
  // The store link at the top: domain and path, no tracking parameters; the full address opens on click.
  const sourceShort = (() => { try { const parsed = new URL(source || url); return parsed.hostname.replace(/^www\./, "") + (parsed.pathname === "/" ? "" : parsed.pathname); } catch { return sourceHost || url; } })();
  const weightNote = weightBasis === "store" ? k.weightStore : weightBasis === "catalog" ? k.weightCatalog : weightBasis === "customer" ? k.weightCustomer : weightBasis === "title" ? k.weightTitle : k.weightEstimate(displayCategoryName(category, lang));
  const sizePricesDiffer = new Set(variantsForColor.map(item => item.price).filter((value): value is number => value !== undefined)).size > 1;
  const countryText = country === "Другая страна" ? otherCountry.trim() || countryLabel(country, lang) : countryLabel(canonicalCountry(country), lang);
  const sourceFormat = (value: number) => { try { return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); } catch { return `${value} ${currency}`; } };
  // The store price at the top follows what is chosen (what the bill counts): one price, a range for options at
  // different prices, or the form's price before anything is chosen.
  const pickPrices = [...new Set(picks.map(([label]) => priceOf(label)).filter(value => value > 0))].sort((a, b) => a - b);
  const headAmount = pickPrices.length === 1 ? pickPrices[0] : pickPrices.length ? NaN : Number(amount);
  const storePriceText = pickPrices.length > 1 ? `${sourceFormat(pickPrices[0])} – ${sourceFormat(pickPrices[pickPrices.length - 1])}` : headAmount > 0 ? sourceFormat(headAmount) : "—";
  // The catalog's price before the store's discount (USD cards), crossed out here and kept with the cart item.
  // Then the chosen option's own "before" price, then the one the store gave for the whole product.
  const optionReference = variants.find(item => item.price !== undefined && item.price === Number(amount) && item.compareAtPrice)?.compareAtPrice;
  const catalogReference = currentCatalogSeed && !currentCatalogSeed.priceNeedsConfirmation && currency === "USD" ? currentCatalogSeed.referenceUsd : undefined;
  const referencePrice = catalogReference ?? optionReference ?? importReference;
  // Crossed out next to the price shown at the top (the same reference, matched to that price).
  const shownReference = catalogReference ?? variants.find(item => item.price !== undefined && item.price === headAmount && item.compareAtPrice)?.compareAtPrice ?? importReference;
  const discount = storeDiscount({ usd: headAmount, sourcePrice: headAmount, sourceReferencePrice: shownReference });
  const checkedTime = importedAt ? `${String(new Date(importedAt).getHours()).padStart(2, "0")}:${String(new Date(importedAt).getMinutes()).padStart(2, "0")}` : "";
  // Locked: what Atlas got from the store (all of it once the check succeeded) or what an Atlas catalog card fixes.
  const atlasLoaded = sourceCheckStatus === "verified" && Boolean(atlasLocks);
  const locks: LockFields = {
    name: (catalogProductFlow || Boolean(atlasLoaded && atlasLocks?.name)) && !unlocked.name,
    price: (catalogPriceLocked || Boolean(atlasLoaded && atlasLocks?.price)) && !unlocked.price,
    shipping: (catalogProductFlow || Boolean(atlasLoaded && atlasLocks?.shipping)) && !unlocked.shipping,
    country: (catalogCountryLocked || Boolean(atlasLoaded && atlasLocks?.country)) && !unlocked.country,
    category: (catalogProductFlow || Boolean(atlasLoaded && atlasLocks?.category)) && !unlocked.weight,
    weight: (catalogProductFlow || Boolean(atlasLoaded && atlasLocks?.weight)) && !unlocked.weight,
  };
  const anyLocked = Object.values(locks).some(Boolean), allLocked = Object.values(locks).every(Boolean);
  // A confirmed and fully locked import keeps the details folded; anything to fill in or review stays open.
  const dataExpanded = dataOpen || sourceCheckStatus !== "verified" || !allLocked;
  const dataMode: "atlas" | "catalog" | "manual" = atlasLoaded ? "atlas" : anyLocked ? "catalog" : "manual";
  const dataNote = dataMode === "manual" ? lc.locked.manualNote : (dataMode === "atlas" ? lc.locked.note(checkedTime) : lc.locked.catalogNote) + (allLocked ? "" : " " + lc.locked.partNote);
  // The locked price is the chosen option's; with several options at different prices, each is shown in the list above.
  const lockedPriceText = pickPrices.length > 1 ? lc.locked.byOption : pickPrices.length === 1 ? sourceFormat(pickPrices[0]) : Number(amount) > 0 ? storePriceText : storeBasePrice ? sourceFormat(storeBasePrice) : variants.some(item => item.price !== undefined) ? lc.locked.byOption : "—";
  const lockedShippingText = shippingFree || (shippingEstimated && storeShippingState === "free") ? k.lines.free : !shippingEstimated ? `${shipping} ${shippingCurrency}` : lc.locked.reserve(`${shipping} ${shippingCurrency}`);
  const weightText = String(weight).replace(".", lang === "en" ? "." : ",");
  const dataSummary = [countryText, amount ? `${amount} ${currency}` : "", validBoxedWeight(weight) !== undefined ? `${weight} ${lc.kg}` : "", shippingEstimated ? (storeShippingState === "free" ? lc.storeShipping(k.lines.free.toLowerCase()) : `${lc.shippingReserve} ${shipping} ${shippingCurrency}`) : lc.storeShipping(`${shipping} ${shippingCurrency}`)].filter(Boolean).join(" · ");
  return (
    <div className="lo-page">
      <header className="orders-head"><div><h1>{lc.title}</h1><p>{(source || isSourcedFlow) && !showSourceForm ? lc.leadLoaded : lc.lead}</p></div></header>

      {(showSourceForm || (!requestedUrl && resumeChecked)) && <form className="lo-link" onSubmit={(e) => { e.preventDefault(); openLink(); }} aria-busy={busy}>
        <label className="sr-only" htmlFor="source-url">{lc.label}</label>
        <span className="lo-link-field"><Link2 size={20} aria-hidden="true" /><input
          id="source-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          required
          value={url}
          disabled={busy}
          onChange={(e) => {
            // A new link is being started: opening the page later does not bring the previous draft back.
            forgetLastDraft(browserStorage());
            setResumedFrom("");
            setUrl(e.target.value);
            setSource("");
            setSourceCheckStatus('idle');

            setShowSourceForm(true);
          }}
          placeholder={lc.placeholder}
        /></span>
        <button className="btn primary lo-link-submit" disabled={busy}>{busy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : null}{busy ? c.get : lc.calculate}</button>
      </form>}
      {(showSourceForm || (!requestedUrl && resumeChecked)) && !source && !busy && <><div className="lo-hints"><p>{lc.hint}</p><div className="home-hero-links"><Link href="/stores">{lc.stores}</Link><Link href="/batch-import">{lc.batch}</Link></div></div><BlankBill pricing={pricing} locale={lang}/></>}

      {(isSourcedFlow || source) && !showSourceForm && <div className="lo-source" aria-live="polite">
        {source && !checking
          ? <a className="lo-source-host" href={source} target="_blank" rel="noopener noreferrer" title={source}><Link2 size={16} aria-hidden="true" /><span>{sourceShort}</span><ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> ({lc.openStore})</span></a>
          : <span className="lo-source-host"><Link2 size={16} aria-hidden="true" /><span>{sourceShort}</span></span>}
        {/* The check itself is told in the card below; here only the way back to another link, once it is done. */}
        {!checking && <button type="button" className="lo-source-link" onClick={() => setShowSourceForm(true)}>{lc.change}</button>}
      </div>}

      {resumedFrom && resumedFrom === requestedUrl && !added && <div className="lo-resumed" role="status">
        <Info size={16} aria-hidden="true" />
        <span>{lc.resumed((() => { try { return new URL(resumedFrom).hostname.replace(/^www\./, ""); } catch { return resumedFrom; } })())}</span>
        <button type="button" className="lo-source-link" onClick={startNewLink}>{lc.startNew}</button>
      </div>}
      {pendingAdd.sending && !added && <p className="lo-pending" role="status"><Loader2 className="spin" size={16} aria-hidden="true" />{lc.pending.sending}</p>}
      {added && <div className="lo-added" role="status">
        <Check size={20} aria-hidden="true" />
        <div><b>{tx(`В корзине: +${added.units} шт.`, `Savatda: +${added.units} dona`, `Added to cart: ${added.units} pcs`)}</b><small>{tx("Можно выбрать другой вариант или вставить ссылку на следующий товар — корзина сохранится.", "Boshqa variantni tanlash yoki keyingi tovar havolasini qo‘yish mumkin — savat saqlanadi.", "Choose another option or paste the next product link — your cart is kept.")}</small></div>
        <span className="lo-added-actions">
          <button type="button" className="btn secondary" onClick={startNewLink}><Link2 size={16} aria-hidden="true" />{tx("Следующий товар", "Keyingi tovar", "Next item")}</button>
          <Link className="btn primary" href="/cart"><ShoppingBag size={16} aria-hidden="true" />{tx("В корзину", "Savatga", "Go to cart")}</Link>
        </span>
      </div>}
      {isGuest && (checking || sourceCheckStatus==='verified') && <p className="lo-guest">{canKeep ? lc.guest : lc.guestNoKeep}</p>}
      {note && !source && <div className="notice" role="status"><p>{note}</p></div>}
      {source && !checking && sourceCheckStatus==='failed' && <div className="notice" role="status">
        <p>{tx('Магазин пока не предоставил проверяемую цену или варианты. Повторите автоматическую загрузку позже.','Do‘kon hozircha tekshiriladigan narx yoki variantlarni bermadi. Avtomatik yuklashni keyinroq takrorlang.','The store has not supplied a verifiable price or options yet. Retry automatic import later.')}</p>
        <button type="button" className="btn secondary" onClick={()=>void load(source)}>{tx('Повторить автозагрузку','Avtomatik yuklashni takrorlash','Retry automatic import')}</button>
      </div>}

      {(source || checking) && (
        <form
          id="link-order-form"
          className={"lo-layout link-order-data-form" + (checking ? " is-checking" : " is-ready")}
          noValidate
          aria-busy={checking}
          onSubmit={async (e) => {
            e.preventDefault();
            if (checking) return;
            try {
              if(sourceCheckStatus!=='verified'){
                const message=tx('Загрузка ещё не завершилась. Дождитесь результата или вставьте ссылку повторно.','Yuklash hali tugamadi. Natijani kuting yoki havolani qayta kiriting.','Import has not finished. Wait for the result or enter the link again.');
                setFormIssue(message);toast.error(message);return;
              }
              const missing=[
                {id:'name',invalid:!name.trim(),message:tx('Введите название товара.','Tovar nomini kiriting.','Enter the item name.')},
                {id:'variant',invalid:!picks.length,message:tx('Выберите или укажите цвет, размер либо модель.','Rang, o‘lcham yoki modelni tanlang yoki kiriting.','Choose or enter a color, size, or model.')},
                {id:'variant',invalid:picks.some(([label,quantity])=>{const left=pickedVariant(label)?.quantity;return left!==undefined&&quantity>left}),message:tx('Для одного из вариантов выбрано больше, чем осталось у магазина.','Variantlardan biri uchun do‘konda qolganidan ko‘p tanlangan.','One option is chosen in a larger quantity than the store has left.')},
                {id:'other-country',invalid:country==='Другая страна'&&!otherCountry.trim(),message:tx('Укажите страну фактической отправки.','Haqiqiy jo‘natish mamlakatini kiriting.','Enter the actual dispatch country.')},
                {id:'amount',invalid:picks.length?picks.some(([label])=>!(priceOf(label)>0)):!(Number(amount)>0),message:tx('Укажите цену товара больше нуля.','Tovar narxini noldan katta kiriting.','Enter an item price greater than zero.')},
                {id:'shipping',invalid:!shippingFree&&!shippingTyped,message:tx('Укажите доставку магазина до склада Atlas; 0 — только если она бесплатная.','Do‘kondan Atlas omborigacha yetkazishni kiriting; 0 faqat bepul bo‘lsa.','Enter store-to-Atlas shipping; use 0 only when it is free.')},
                {id:'weight',invalid:validBoxedWeight(weight)===undefined,message:tx('Укажите вес товара с коробкой от 0,01 до 49,5 кг.','Qadoq bilan vaznni 0,01–49,5 kg oralig‘ida kiriting.','Enter boxed weight from 0.01 to 49.5 kg.')},
              ].find(field=>field.invalid);
              if(missing){
                setFormIssue(missing.message);
                const lockOf:Record<string,keyof LockFields>={name:'name',amount:'price',shipping:'shipping','other-country':'country',weight:'weight'};
                const lockedField=lockOf[missing.id];
                if(lockedField&&locks[lockedField])setUnlocked(current=>({...current,[lockedField]:true}));
                // Fields folded under "Calculation details" must be visible before they can take focus.
                if(['name','other-country','amount','shipping','weight'].includes(missing.id))setDataOpen(true);
                window.setTimeout(()=>{
                  const group=missing.id==='variant'?window.document.querySelector<HTMLElement>('[data-order-variant]'):null;
                  const steps=group?.querySelectorAll<HTMLElement>('.variant-step');
                  const lastStep=steps?.item(Math.max(0,(steps?.length??1)-1));
                  const target=lastStep?.querySelector<HTMLElement>('button[aria-pressed="false"], button, input')??group?.querySelector<HTMLElement>('button, input')??window.document.getElementById(missing.id);
                  target?.scrollIntoView({behavior:'smooth',block:'center'});
                  target?.focus({preventScroll:true});
                },0);
                return;
              }
              setFormIssue("");
              // The account is still loading (the button waits), or could not be loaded: say so and try again, never
              // send a signed-in customer to the sign-in page.
              if (!ready && !isGuest) {
                if (status === "error") { setFormIssue(accountError ?? lc.pending.failed); void refresh(); }
                return;
              }
              const img = image ? safeImage(image, source) : "";
              if (image && !img)
                 throw Error(tx("Изображение должно иметь публичный HTTPS-адрес.","Rasm ommaviy HTTPS manziliga ega bo‘lishi kerak.","The image must have a public HTTPS URL."));
              // One cart line per chosen option, each with its own store price, option ID and photo.
              const productFor = (label: string): Product => {
                const option = pickedVariant(label);
                const optionImage = option?.image ? safeImage(option.image, source) : undefined;
                const photo = optionImage || img || "";
                return {
                ...baseProduct,
                id: source + "#" + label,
                usd: toUsd(priceOf(label), currency, pricing.rates),
                image: photo,
                sourceImages: dedupeSafeImages([photo, ...images], source, 12),
                sourceVariantId: option?.id,
                variants: [label],
                sourcePrice: priceOf(label),
                };
              };
              const baseProduct: Product = {
                id: source,
                name: name.trim(),
                brand: brand || new URL(source).hostname,
                category,
                usd: toUsd(Number(amount || priceOf(picks[0][0])), currency, pricing.rates),
                weight: paddedWeight(Number(weight)),
                image: img ?? "",
                sourceUrl: source,
                variants: [picks[0][0]],
                country:
                  country === "Другая страна"
                    ? otherCountry.trim()
                    : country,
                sourceCurrency: currency,
                sourcePrice: priceOf(picks[0][0]),
                sourceReferencePrice: referencePrice,
                sourceShipping: sendShipping,
                sourceShippingCurrency: sendShippingCurrency,
                sourceShippingUsd: toUsd(
                  sendShipping,
                  sendShippingCurrency,
                  pricing.rates,
                ),
                sourceShippingEstimated: shippingEstimated,
                shippingKnown: true,
                boxedWeight: Number(weight),
                weightOrigin,
                weightBasis: weightBasis === "title" ? "estimate" : weightBasis,
                importedAt,
                sourceExpiresAt,
                sourceManuallyConfirmed:false,
                 imageOrigin: importedAt ? tx("страница магазина","do‘kon sahifasi","store page") : tx("ручной ввод","qo‘lda kiritish","manual entry"),
                declarationDescription: declaration || undefined,
              };
              const note = comment.trim() || undefined;
              const action: CartAddAction = picks.length === 1
                ? { type: "cart-add", product: productFor(picks[0][0]), variant: picks[0][0], quantity: picks[0][1], note }
                : { type: "cart-add-many", items: picks.map(([label, quantity]) => ({ product: productFor(label), variant: label, quantity })), note };
              if (!ready) {
                // A guest signs in first; this exact add is then sent once (app/pending-cart-add.ts) and the server
                // checks it with the store like any other. Where this device keeps nothing, the button never promised it;
                // if keeping it fails now, the customer is told before leaving and the button says so.
                const here = window.location.pathname + window.location.search;
                if (canKeep && !savePendingCartAdd(browserStorage(), { action, speed: speedTouched.current ? previewSpeed : undefined, returnTo: here, draftKey })) {
                  setCanKeep(false); setFormIssue(lc.pending.notKept); return;
                }
                window.location.assign(signInPath(here));
                return;
              }
              setAdding(true);
              const ok = await act(action);
              // The cart keeps what is already there; the customer can add more from this or another link.
              if (ok) {
                finishAdd(picks.length, units);
                // The added line took the cart's speed; the speed chosen here applies to the whole cart (one speed per cart).
                if (previewSpeed !== cartSpeed) await act({ type: "cart-delivery-speed", speed: previewSpeed });
              }
              // The store's price moved since this page loaded: load it again and keep the customer's choice.
              else if (lastActionError()?.code === "err_34") { reapply.current = currentChoices(); void load(requestedUrl || source); }
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setAdding(false);
            }
          }}
        >
          <div className="lo-sheet lo-sheet-pick">
          <section className={"lo-product" + (image || checking ? "" : " lo-product-plain")} aria-labelledby="lo-product-name">
            {/* A catalog product keeps its photo and name through the check; a bare link gets their outline. */}
            {image ? <div className="lo-gallery"><ProductGallery product={previewProduct} images={images.length?images:[image]} activeImage={image} onImageChange={setImage} locale={lang}/></div>
              : checking && <div className="lo-gallery lo-skel lo-skel-photo" aria-hidden="true" />}
            <div className="lo-product-copy">
              {brand || sourceHost || !checking
                ? <p className="basket-brand">{[brand, sourceHost && brand !== sourceHost ? sourceHost : ""].filter(Boolean).join(" · ")}</p>
                : <span className="lo-skel lo-skel-brand" aria-hidden="true" />}
              <h2 id="lo-product-name">{name || (checking ? <><span className="sr-only">{c.get}</span><span className="lo-skel lo-skel-title" aria-hidden="true" /></> : sourceCheckStatus === "failed" ? tx('Данные товара пока недоступны','Tovar ma’lumotlari hozircha mavjud emas','Item details are not available yet') : c.empty)}</h2>
              {checking
                ? <p className="lo-store-price">{lc.storePrice}: <span className="lo-skel lo-skel-price" aria-hidden="true" /></p>
                : <p className="lo-store-price lo-reveal">{lc.storePrice}: <b>{storePriceText}</b>{discount && <WasPrice was={discount.was} percent={discount.percent} format={sourceFormat} />}{sourceCheckStatus === "verified" && checkedTime && <small> · {lc.checkedAt(checkedTime)}</small>}</p>}
              {!checking && sourceCheckStatus === "failed" && <p className="lo-note warn" role="status"><AlertCircle size={16} aria-hidden="true" />{tx('Автоматическая проверка не завершена. Сохранённые данные предварительные.','Avtomatik tekshirish tugamadi. Saqlangan ma’lumotlar taxminiy.','Automatic verification is incomplete. Saved details are preliminary.')}</p>}
            </div>
          </section>

          {checking ? <StoreCheck host={(() => { try { return new URL(source || url).hostname.replace(/^www\./, ""); } catch { return ""; } })()} locale={lang} /> : sourceCheckStatus==='verified' && <section className="lo-card lo-variant">
            <div className="field variant-matrix" data-order-variant tabIndex={-1}>
              <label htmlFor="variant">{c.variant}</label>
              {variants.length===1 ? <div className="single-variant-selection lo-single-option">
                <span><small>{k.onlyOption}</small><b>{variants[0].label==='Выбранный вариант'||variants[0].label==='Объявление eBay'?name||variants[0].label:variantColors.length===1&&!variants[0].size?describeSingleColorway(variantColors[0]).primary:variants[0].label}</b>{stockText(variants[0],k)&&<em className="lo-stock">{stockText(variants[0],k)}</em>}</span>
                <Stepper value={picked[variants[0].label]??1} max={maxFor(variants[0])} label={k.quantity} k={k} onChange={value=>setPickQuantity(variants[0].label,value)}/>
                <input id="variant" value={variant} readOnly required className="sr-only" aria-label={c.variant}/>
              </div> : variants.length && (variantColors.length||variantSizes.length) ? <>
                {variantColors.length>0&&<div className="variant-step"><div><b>{variantColors.length===1?tx('Расцветка по ссылке','Havoladagi rang','Linked colorway'):c.color}</b>{variantColors.length!==1&&<span>{selectedColor||c.selectColor}</span>}</div>{variantColors.length===1?<><div className="single-variant-selection"><span>{describeSingleColorway(variantColors[0]).primary}</span><small>{tx('Одна расцветка по этой ссылке','Bu havolada bitta rang varianti','One colorway in this link')}</small></div><p className="single-colorway-note">{tx('Для другого цвета нужна ссылка на соответствующий артикул магазина.','Boshqa rang uchun do‘kondagi tegishli artikl havolasi kerak.','Another color requires a link to its separate store item.')}</p><details className="single-colorway-source"><summary>{tx('Полное название расцветки в магазине','Do‘kondagi rangning to‘liq nomi','Full store colorway name')}</summary><span>{variantColors[0]}</span></details></>:<div className="variant-options">{variantColors.map(color=><button type="button" key={color} aria-pressed={selectedColor===color} onClick={()=>selectColorway(color)}>{color}</button>)}</div>}</div>}
                {(variantColors.length===0||selectedColor)&&variantSizes.length>0&&<div className="variant-step"><div><b>{variantSizeLabel||c.size}</b><span>{selectedSize?(nikeSizeSystem?`US ${selectedSize}`:selectedSize):c.selectVariant}</span></div><div className="variant-options sizes">{variantSizes.map(size=>{const choices=variantsForColor.filter(item=>item.size===size),choice=choices[0],price=choice?.price;return <button type="button" key={size} aria-pressed={Boolean(choice&&picked[choice.label])} disabled={choice?.quantity===0} onClick={()=>choice&&togglePick(choice)}><span>{nikeSizeSystem?`US ${size}`:size}</span>{choice&&price!==undefined&&sizePricesDiffer&&<small>{price} {currency}</small>}{choice?.quantity!==undefined&&choice.quantity<=5&&<small className="lo-stock">{choice.quantity?k.stockLeft(choice.quantity):k.outOfStock}</small>}</button>})}</div>{nikeSizeSystem&&<div className="nike-size-guide">
                  {selectedNikeSize&&<p className="nike-selected-size">{tx('Выбранный размер','Tanlangan o‘lcham','Selected size')}: <strong>US {selectedNikeSize.us}</strong><span>EU {selectedNikeSize.eu}</span><span>UK {selectedNikeSize.uk}</span><span>CM/JP {selectedNikeSize.cmLabel}</span><span>{tx('Стопа','Oyoq','Foot')} {selectedNikeSize.footLengthCm===undefined?'—':selectedNikeSize.footLengthCm} {tx('см','sm','cm')}</span></p>}
                  <details className="nike-size-chart"><summary>{tx('Официальная таблица Nike: US → EU, UK и см','Rasmiy Nike jadvali: US → EU, UK va sm','Official Nike chart: US → EU, UK and cm')}</summary>
                    <p>{tx('Показаны размеры, найденные для этого товара. CM/JP — маркировка обуви Nike; длина стопы указана отдельно.','Bu tovar uchun topilgan o‘lchamlar ko‘rsatilgan. CM/JP — Nike poyabzali yorlig‘i; oyoq uzunligi alohida berilgan.','Shows sizes found for this item. CM/JP is Nike’s shoe-label size; foot length is listed separately.')}</p>
                    <div className="nike-size-chart-scroll" role="region" aria-label={tx('Таблица размеров Nike с прокруткой','Nike o‘lcham jadvali','Nike size chart')} tabIndex={0}><table><thead><tr><th scope="col">US</th><th scope="col">UK</th><th scope="col">EU</th><th scope="col">CM/JP</th><th scope="col">{tx('Стопа, см','Oyoq, sm','Foot, cm')}</th></tr></thead><tbody>{nikeSizeRows.map(row=><tr key={row.us}><th scope="row">{row.us}</th><td>{row.uk}</td><td>{row.eu}</td><td>{row.cmLabel}</td><td>{row.footLengthCm===undefined?'—':row.footLengthCm}</td></tr>)}</tbody></table></div>
                    <a className="nike-size-source" href={`https://www.nike.com/size-fit/${nikeSizeSystem==='women'?'womens':'mens'}-footwear`} target="_blank" rel="noopener noreferrer">{tx('Полная таблица на сайте Nike','To‘liq jadval Nike saytida','Full chart on Nike')} <ExternalLink size={13}/></a>
                  </details>
                </div>}</div>}
                {!variantColors.length&&!variantSizes.length&&<OptionChips variants={variants} picked={picked} k={k} onToggle={togglePick}/>}
                <input id="variant" value={variant} readOnly required className="sr-only" aria-label={c.variant}/>
              </> : variants.length ? <OptionChips variants={variants} picked={picked} k={k} onToggle={togglePick}/> : (
                <div className="lo-manual-option"><input id="variant" required maxLength={80} value={variant} aria-label={k.optionLabel} onChange={(e) => {setVariant(e.target.value);setChoiceNote("");setAdded(null)}} placeholder={k.optionPlaceholder}/><Stepper value={manualQuantity} max={10} label={k.quantity} k={k} onChange={setManualQuantity}/></div>
              )}
            </div>
            {goneOptions.length > 0 && <p className="lo-note warn" role="status"><AlertCircle size={16} aria-hidden="true" />{lc.optionGone(goneOptions)}</p>}
            {choiceNote && <p className="lo-note warn" role="status"><AlertCircle size={16} aria-hidden="true" />{choiceNote}</p>}
            {variants.length > 1 && <>
              <p className="lo-hint-line">{k.chooseOptions}</p>
              {picks.length > 0 && <ul className="lo-picks" aria-label={k.chosen}>{picks.map(([label, quantity]) => {
                const option = pickedVariant(label);
                const optionPrice = option?.price ?? Number(amount);
                return <li key={label}>
                  <span className="lo-pick-label"><b>{label}</b><small>{[Number.isFinite(optionPrice) && optionPrice > 0 ? `${optionPrice} ${currency}` : "", stockText(option, k)].filter(Boolean).join(" · ")}</small></span>
                  <Stepper value={quantity} max={maxFor(option)} label={`${k.quantity}: ${label}`} k={k} onChange={value => setPickQuantity(label, value)}/>
                  <button type="button" className="lo-pick-remove" aria-label={`${k.removeOption}: ${label}`} onClick={() => option && togglePick(option)}><X size={16} aria-hidden="true"/></button>
                </li>;
              })}</ul>}
            </>}
            {variants.length > 0 && !variants.some(item => item.quantity !== undefined || item.quantityMoreThan !== undefined) && <p className="lo-hint-line muted">{k.stockUnknown}</p>}
          </section>}
          </div>

          {/* The bill in a folder: the sheet is the amount to pay, the slip holds the hold and customs that stay outside it. */}
          <div className="lo-sheet lo-sheet-bill">
          <aside className="lo-summary basket-summary folio" aria-labelledby="lo-summary-title">
            <div className="folio-sheet">
              <h2 id="lo-summary-title">{lc.total}</h2>
              {checking ? <BillPlaceholder /> : previewSums ? <>
                <DeliverySpeedSwitch value={previewSpeed} options={speedOptions} locale={lang} note={speedNote} compact onChange={(next) => { speedTouched.current = true; setPreviewSpeed(next); }}/>
                <CalcLines sums={previewSums} locale={lang} pricing={pricing} weightKg={previewWeight} storeShippingState={storeShippingState} speed={previewSpeed}/>
                <div className="basket-total bill-total"><span>{units > 1 ? `${k.lines.total} (${units} ${lang === "en" ? "pcs" : isUzbek(lang) ? uzText(lang, "dona") : "шт."})` : k.lines.total}</span><strong><Money value={previewSums.total} locale={lang}/></strong></div>
                {/* The allowance in two lines; "Atlas pays customs for me" is chosen in the cart, for the whole order. */}
                {customsPreview && <CustomsPanel estimate={customsPreview} choices={{ outsideUsed: false, help: false }} locale={lang} pricing={pricing} profiles={primaryProfile ? [primaryProfile] : []} compact/>}
              </> : <p className="cabinet-empty">{picks.length ? lc.emptyTotal : tx("Выберите вариант, и мы покажем итог.", "Variantni tanlang, jamini ko‘rsatamiz.", "Choose an option to see the total.")}</p>}
            </div>
            {!checking && previewSums && previewSums.storeShippingHold > 0 && <section className="folio-outside" aria-labelledby="lo-outside-title">
              <h3 id="lo-outside-title">{k.outside}</h3>
              <HoldNote amount={previewSums.storeShippingHold} locale={lang} pricing={pricing}/>
            </section>}
          </aside>
          </div>

          {!checking && sourceCheckStatus==='verified' && <div className="lo-sheet lo-sheet-finish">
          <section className={"lo-card lo-data" + (dataExpanded ? " open" : "")}>
            <button type="button" className="lo-data-toggle" aria-expanded={dataExpanded} aria-controls="lo-data-fields" onClick={() => setDataOpen(!dataExpanded)}>
              <span>
                <span className="lo-data-title"><b>{lc.data}</b>{dataMode !== "manual" && <span className="lo-data-badge"><Lock size={12} aria-hidden="true" />{dataMode === "atlas" ? lc.locked.badge : lc.locked.catalogBadge}</span>}</span>
                <small>{!dataExpanded ? dataSummary : !allLocked ? lc.fillFromStore : dataMode === "atlas" ? lc.locked.hint : lc.locked.catalogHint}</small>
              </span>
              <span aria-hidden="true" className="lo-data-sign">{dataExpanded ? "−" : "+"}</span>
            </button>
            <div id="lo-data-fields" className="lo-data-fields" hidden={!dataExpanded}>
              <p className="lo-note lo-data-note">{dataMode === "manual" ? <Info size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}<span>{dataNote}</span></p>
              {locks.name ? <LockedFacts stack hint={lc.locked.value} rows={[{ id: "name", label: c.name, value: name }]} /> : <div className="field lo-name-field">
                <label htmlFor="name">{c.name}</label>
                <input id="name" required maxLength={140} value={name} onChange={(e) => {
                  setName(e.target.value);
                  // An Atlas estimate follows the name ("boots", "t-shirt"); a weight the customer or the store gave stays.
                  if(weightBasis==="estimate"||weightBasis==="title"){const estimate=estimateBoxedWeight(category,e.target.value);setWeight(String(estimate.kg));setWeightBasis(estimate.basis==="title"?"title":"estimate")}
                }} placeholder={c.namePlaceholder} />
              </div>}
              <div className="lo-blocks">
                <fieldset className="lo-block">
                  <legend>{k.blocks.price}</legend>
                  {locks.price ? <LockedFacts hint={lc.locked.value} rows={[{ id: "amount", label: k.price, value: lockedPriceText }, { id: "currency", label: k.currency, value: currency }]} /> : <div className="lo-block-row">
                    <div className="field">
                      <label htmlFor="amount">{k.price}</label>
                      <input id="amount" type="number" inputMode="decimal" required min=".01" step=".01" value={amount} onChange={(e) => {setAmount(e.target.value); }} />
                    </div>
                  </div>}
                  {variants.some(item => item.price !== undefined) && picks.length > 1 && <small className="micro">{tx("У каждого выбранного варианта своя цена магазина.","Har bir tanlangan variantning o‘z do‘kon narxi bor.","Each chosen option keeps its own store price.")}</small>}
                </fieldset>
                <fieldset className="lo-block">
                  <legend>{k.blocks.storeShipping}</legend>
                  {/* Unknown delivery from a store order above the threshold is free: a rule, shown as a line, not a field. */}
                  {locks.shipping || shippingFree ? <>
                    <LockedFacts rule={!locks.shipping} hint={locks.shipping ? lc.locked.value : ""} rows={[{ id: "shipping", label: k.storeShippingAmount, value: lockedShippingText }]} />
                    {storeShippingState !== "free" && <p className="lo-block-state">{shippingEstimated ? k.storeShippingUnknown : k.storeShippingStated}</p>}
                  </> : <div className="lo-block-row">
                    <div className="field">
                      <label htmlFor="shipping">{k.storeShippingAmount}, {shippingCurrency}</label>
                      <input id="shipping" type="number" inputMode="decimal" required min="0" step=".01" value={shipping} onChange={(e) => { setShipping(e.target.value); setShippingEstimated(true);  }} />
                    </div>
                    <p className="lo-block-state">{shippingEstimated ? k.storeShippingUnknown : k.storeShippingStated}</p>
                  </div>}
                  <small className="micro">{catalogProductFlow && !shippingEstimated ? tx("Сумма доставки подтверждена Atlas при добавлении товара.","Yetkazish summasi tovar qo‘shilganda Atlas tomonidan tasdiqlangan.","Atlas confirmed this shipping amount when adding the item.") : k.storeShippingRule(freeFrom)}</small>
                  {foundShipping && shippingEstimated && !locks.shipping && <button type="button" className="btn secondary lo-found-shipping" onClick={() => {
                    if (!currencies.includes(foundShipping.currency)) {
                      toast.error(tx("Валюта ", "Valyuta ", "Currency ") + foundShipping.currency + tx(" не поддерживается: укажите эквивалент в поддерживаемой валюте.", " qo‘llanmaydi: qo‘llab-quvvatlanadigan valyutada ekvivalent kiriting.", " is not supported: enter an equivalent in a supported currency."));
                      return;
                    }
                    setShipping(String(foundShipping.amount));
                    setShippingCurrency(foundShipping.currency);
                    setShippingEstimated(false);

                  }}>{k.useStated}: {foundShipping.amount} {foundShipping.currency}{foundShipping.destination ? " · " + foundShipping.destination : ""}</button>}
                </fieldset>
                <fieldset className="lo-block">
                  <legend>{k.blocks.country}</legend>
                  {locks.country ? <LockedFacts hint={lc.locked.value} rows={[{ id: "ship-country", label: tx("Страна", "Mamlakat", "Country"), value: countryText }]} /> : <>
                    <div className="field">
                      <label htmlFor="ship-country" className="sr-only">{c.shipCountry}</label>
                      <select id="ship-country" className="select-control" value={canonicalCountry(country)} onChange={(e) => { setCountry(canonicalCountry(e.target.value));  }}>
                        {countries.map((value) => <option key={value} value={value}>{countryLabel(value,lang)}</option>)}
                      </select>
                    </div>
                    {country === "Другая страна" && <div className="field">
                      <label htmlFor="other-country">{c.otherCountry}</label>
                      <input id="other-country" required maxLength={60} value={otherCountry} onChange={(e) => setOtherCountry(e.target.value)} />
                    </div>}
                  </>}
                </fieldset>
                <fieldset className="lo-block">
                  <legend>{k.blocks.weight}</legend>
                  {locks.category && locks.weight ? <LockedFacts hint={lc.locked.value} rows={[{ id: "category", label: k.category, value: displayCategoryName(category, lang) }, { id: "weight", label: k.boxedWeight, value: weightText }]} /> : <div className="lo-block-row">
                    <div className="field">
                      <label htmlFor="category">{k.category}</label>
                      <select id="category" className="select-control" value={canonicalCategory(category)} onChange={(e) => {
                        const canonical = canonicalCategory(e.target.value);
                        const estimate = estimateBoxedWeight(canonical, name);
                        setCategory(canonical);
                        setWeight(String(estimate.kg));
                        setWeightBasis(estimate.basis === "title" ? "title" : "estimate");
                        setWeightOrigin(tx("Оценка Atlas","Atlas bahosi","Atlas estimate"));

                      }}>
                        {weightCategories.map((value) => <option key={value} value={value}>{displayCategoryName(value,lang)}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="weight">{k.boxedWeight}</label>
                      <input id="weight" type="number" inputMode="decimal" required min=".01" max="49.5" step=".01" value={weight}
                        onChange={(e) => { setWeight(e.target.value); setWeightBasis("customer"); setWeightOrigin(tx("Указан покупателем","Xaridor kiritdi","Entered by customer"));  }}
                        onBlur={() => {
                          const valid=validBoxedWeight(weight);
                          if(valid!==undefined){setWeight(String(valid));return}
                          const estimate=estimateBoxedWeight(category,name);
                          setWeight(String(estimate.kg));
                          setWeightBasis(estimate.basis==="title"?"title":"estimate");
                          setWeightOrigin(tx("Оценка Atlas","Atlas bahosi","Atlas estimate"));
                          toast.error(tx("Вес должен быть от 0,01 до 49,5 кг. Вернули оценку Atlas.","Og‘irlik 0,01–49,5 kg bo‘lishi kerak. Atlas bahosi qaytarildi.","Weight must be between 0.01 and 49.5 kg. The Atlas estimate was restored."));
                        }} />
                    </div>
                  </div>}
                  {/* A locked estimate is not the customer's to correct: the warehouse weighs the parcel. */}
                  <small className={"micro lo-weight-basis" + ((weightBasis === "estimate" || weightBasis === "title") && !locks.weight ? " estimate" : "")}>{locks.weight && (weightBasis === "estimate" || weightBasis === "title") ? lc.locked.weight : weightNote}</small>
                  <small className="micro">{k.weightRule}{previewWeight ? ` ${k.parcelWeight(String(previewWeight).replace(".", lang === "en" ? "." : ","))}.` : ""}</small>
                </fieldset>
              </div>
            </div>
          </section>

          <section className="lo-card lo-comment">
            <label htmlFor="order-comment"><b>{k.blocks.comment}</b><small>{k.commentHint}</small></label>
            <textarea id="order-comment" rows={2} maxLength={500} value={comment} placeholder={k.commentPlaceholder} onChange={(e) => setComment(e.target.value)} />
          </section>

          <section className="lo-card lo-confirm">
            {formIssue && <p className="basket-consent-error" role="alert">{formIssue}</p>}
            <p className="micro" role="status">{tx("Atlas автоматически сверит цену, валюту и выбранный вариант перед добавлением в корзину.","Atlas savatga qo‘shishdan oldin narx, valyuta va tanlangan variantni avtomatik tekshiradi.","Atlas automatically checks the price, currency and selected option before adding it to your cart.")}</p>
            <div className={"lo-cta-row" + (cartUnits ? " has-cart" : "")}>
            <button className="btn primary basket-cta" disabled={addBusy || status==='loading'}>{(addBusy || status==='loading') && <Loader2 className="spin" size={18} aria-hidden="true" />}{pendingAdd.sending ? lc.pending.sending : adding ? c.adding : isGuest ? (canKeep ? lc.signinAdd : lc.signinContinue) : k.addOptions(Math.max(1, picks.length), Math.max(1, units))}{!addBusy && status!=='loading' && <ArrowRight size={18} aria-hidden="true" />}</button>
            {cartUnits > 0 && <CartEntry count={cartUnits} label={cartLabel} />}
            </div>
            <ul className="basket-assurance"><li><ShieldCheck size={16} aria-hidden="true" />{cc.summary.assurance}</li><li>{sourceCheckStatus === "verified" ? <ShieldCheck size={16} aria-hidden="true" /> : <Info size={16} aria-hidden="true" />}{sourceCheckStatus === "verified" ? checkedText : c.freshText}</li></ul>
          </section>
          </div>}
        </form>
      )}

      {/* On phones the total bar stays put through the check, so the page does not jump when the price arrives. */}
      {(source || checking) && <div className={"basket-sticky lo-sticky" + (isGuest ? " guest" : "")} role="region" aria-label={lc.total}>
        <div><span>{k.lines.total}</span><strong>{checking ? <span className="lo-skel lo-skel-sum" aria-hidden="true" /> : previewSums ? formatSum(previewSums.total, lang) : "—"}</strong></div>
        <button type="submit" form="link-order-form" className="btn primary" disabled={checking || sourceCheckStatus!=='verified' || addBusy || status==='loading'}>{(checking || addBusy || status==='loading') && <Loader2 className="spin" size={18} aria-hidden="true" />}{checking ? tx("Проверяем…", "Tekshiryapmiz…", "Checking…") : addBusy ? c.adding : isGuest ? (canKeep ? lc.signinAddShort : lc.signinContinue) : lc.addShort}{!checking && !addBusy && status!=='loading' && <ArrowRight size={18} aria-hidden="true" />}</button>
        {cartUnits > 0 && <CartEntry count={cartUnits} label={cartLabel} compact />}
      </div>}
    </div>
  );
}
