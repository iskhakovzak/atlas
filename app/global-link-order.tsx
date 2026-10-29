"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Check, CircleHelp, ClipboardPaste, ExternalLink, Heart, Info, Link2, Loader2, Lock, LogIn, Minus, Plus, ShieldCheck, ShoppingBag, Star, X } from "lucide-react";
import Link from "@/components/site-link";
import { toast } from "@/lib/market/toast";
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
  listDrafts,
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
  type LinkOrderDraft,
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
  type Product,
} from "@/lib/market/domain";
import { calcCopy, type CalcCopy } from "@/lib/market/calc-copy";
import { Money } from "./money";
import { cartCustomsEstimate } from "@/lib/market/allowance";
import { BlankBill, CalcLines, CustomsPanel, HoldNote, sumQuotes } from "./calc-summary";
import { daysRangeFor, deliverySpeedCopy, fasterText } from "@/lib/market/delivery-speed";
import { countries, currencies, currencyForCountry, toUsd, paddedWeight, packagingKg } from "@/lib/market/world";
import { describeSingleColorway } from "@/lib/market/variant-colorway";
import { compareSizes } from "@/lib/market/size-order";
import { heroStores, storeBrands, storefrontUrl } from "@/lib/market/store-brands";
import { dealCopy } from "@/lib/market/deal-copy";
import { StoreLogo } from "./store-logo";
import { adidasMenSize } from "@/lib/market/adidas-size-chart";
import {isOrderableVariant, isStockUnconfirmed} from '@/lib/importer/variant-normalization';
import { optionStock } from "@/lib/market/link-order-stock";
import { variantsForSourceColor, variantSourceUrl, variantGallery, variantDisplayPrices } from "@/lib/importer/link-selection";
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
import { formatKg, formatSum } from "@/lib/market/format";
import { cartCopy, countryLabel, linkOrderCopy } from "@/lib/market/customer-copy";
import { extractSharedLink } from "@/lib/market/shared-link";
import {PasteButton} from '@/components/paste-button';
import {useClipboardLink} from './use-clipboard-link';
import { ProductGallery } from "./product-gallery";
import { retryOriginal, sizedImage } from "@/lib/market/image-size";
import {
  communityDeals,
  communityEstimatedWeight,
  communityFallbackOptions,
  communityProductCategory,
  hasSelectableDimensions,
} from "@/lib/market/community-deals";
import {uzText} from '@/lib/market/uz-cyrl';
import {isUzbek,type Locale} from '@/lib/market/i18n';
import {requestImport} from "@/lib/market/import-client";

const countryAliases:Record<string,string>={'United States':'США','US':'США','AQSh':'США','Spain':'Испания','Ispaniya':'Испания','Germany':'Германия','Germaniya':'Германия','United Kingdom':'Великобритания','Buyuk Britaniya':'Великобритания','France':'Франция','Fransiya':'Франция','Italy':'Италия','Italiya':'Италия','Romania':'Румыния','Ruminiya':'Румыния','China':'Китай','Xitoy':'Китай','Turkey':'Турция','Turkiya':'Турция','Japan':'Япония','Yaponiya':'Япония','South Korea':'Южная Корея','Janubiy Koreya':'Южная Корея','United Arab Emirates':'ОАЭ','BAA':'ОАЭ','Canada':'Канада','Kanada':'Канада','Australia':'Австралия','Avstraliya':'Австралия','Other country':'Другая страна','Boshqa mamlakat':'Другая страна'};
const categoryAliases:Record<string,string>={'Shoes':'Обувь','Oyoq kiyim':'Обувь','Clothing':'Одежда','Kiyim':'Одежда','Electronics':'Электроника','Elektronika':'Электроника','Accessories':'Аксессуары','Aksessuarlar':'Аксессуары','Beauty & care':'Красота и уход','Go‘zallik va parvarish':'Красота и уход','Home & living':'Дом и быт','Uy va maishiy':'Дом и быт','Sports':'Спорт','Boshqa':'Другое','Other':'Другое'};
const canonicalCountry=(value:string)=>countryAliases[value]??value;
const canonicalCategory=(value:string)=>categoryAliases[value]??value;
function cleanColorwayGalleries(value:unknown,base:string):ProductColorwayGallery[]{
  if(!Array.isArray(value))return [];
  const byColor=new Map<string,ProductColorwayGallery>();
  for(const entry of value.slice(0,20)){
    if(!entry||typeof entry!=='object')continue;
    const row=entry as {color?:unknown;colorId?:unknown;images?:unknown};
    const color=typeof row.color==='string'?row.color.trim().slice(0,140):'';
    if(!color||!Array.isArray(row.images))continue;
    const images=dedupeSafeImages(row.images,base,12);
    if(!images.length)continue;
    const colorId=typeof row.colorId==='string'?row.colorId.slice(0,120):undefined;
    const key=colorId??color;
    byColor.set(key,{color,colorId,images:[...new Set([...(byColor.get(key)?.images??[]),...images])].slice(0,12)});
  }
  return [...byColor.values()];
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
  if (item?.quantity !== undefined) return item.quantity === 0 ? k.outOfStock : k.stockLeft(item.quantity);
  if (item?.quantityMoreThan !== undefined) return k.stockMore(item.quantityMoreThan);
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
function OptionChips({ variants, picked, k, onToggle, format }: { format:(value:number)=>string; variants: ProductVariant[]; picked: Record<string, number>; k: CalcCopy; onToggle: (item: ProductVariant) => void }) {
  return <div className="variant-options lo-option-chips">{variants.map(item => <button type="button" key={item.label} aria-pressed={Boolean(picked[item.label])} disabled={!isOrderableVariant(item)} onClick={() => onToggle(item)}>
    <span>{item.label}</span>{item.price!==undefined&&<small>{format(item.price)}</small>}{item.options?.length? <small>{item.options.map(o=>`${o.name}: ${o.value}`).join(" · ")}</small>:null}{item.quantity !== undefined && item.quantity <= 5 && <small className="lo-stock">{item.quantity ? k.stockLeft(item.quantity) : k.outOfStock}</small>}
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
    tx("Считаем итог с доставкой в Ташкент", "Toshkentga yetkazish bilan jamini hisoblaymiz", "Working out the total with delivery to Tashkent"),
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

// The chosen colour in a sideways row of colours is scrolled into view without moving the page.
function keepChosenColourInView(row: HTMLElement) {
  const chosen = row.querySelector<HTMLElement>('button[aria-pressed="true"]');
  if (!chosen || row.scrollWidth <= row.clientWidth) return;
  const left = chosen.offsetLeft - row.offsetLeft, right = left + chosen.offsetWidth;
  if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) row.scrollLeft = Math.max(0, left - (row.clientWidth - chosen.offsetWidth) / 2);
}

export function GlobalLinkOrder() {
  const { ready, status, error: accountError, user, refresh, pricing, state, act, lastActionError, catalogProducts, loadCatalog } = useMarket();
  // Delivery is chosen only in the cart; estimates follow its current speed.
  const [previewSpeed, setPreviewSpeed] = useState<"express" | "standard">("express");
  // The heart beside a catalog item's name: the same favourites as in the catalog.
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const cartSpeed = cartDeliverySpeed(state.cart);
  useEffect(() => {
    let active = true;
    if (ready) queueMicrotask(() => { if (active) setPreviewSpeed(cartSpeed); });
    return () => { active = false; };
  }, [ready, cartSpeed]);
  const lang=state.communication.language;
  const freeFrom=`$${pricing.storeShippingFreeFromUsd??50}`;
  // The store-delivery hold from the tariff constant, never typed into the copy.
  const holdText=`$${unknownStoreShippingUsd}`;
  const c=lang==='ru'?{over:'ПОКУПКИ СО ВСЕГО МИРА',choose:'Выберите свой вариант',order:'Заказ по ссылке',checkPrice:'Проверьте размер и цену перед добавлением.',paste:'Вставьте ссылку — Atlas заполнит доступные данные.',loading:'Загружаем цену и варианты из магазина…',selected:'Товар уже выбран. Проверьте вариант и добавьте его в корзину.',edit:'Изменить ссылку',linkStep:'Ссылка на товар',stores:'eBay, Zara, Mango, Amazon и другие магазины.',storePage:'Страница магазина',get:'Получаем данные…',load:'Загрузить товар',directory:'Магазины для заказа по ссылке',storeHint:'Выбирайте региональную витрину по ссылке. Atlas считает итог с доставкой.',search:'Магазин или категория',enhanced:'цена + варианты',otherMatches:'Другие совпадения',allStores:'Все остальные магазины',notFound:'Этого магазина нет в списке. Отправьте его оператору — он проверит магазин.',login:'Войдите в личный кабинет: автозагрузка защищена, а товар сохранится в вашей корзине.',original:'Открыть оригинал в магазине',loaded:'Что загрузилось и что нужно проверить',availability:'Проверьте наличие в магазине',availabilityHint:'Откройте страницу товара, проверьте выбранный размер или вариант и вернитесь с ответом.',openStore:'Открыть магазин',available:'Есть в наличии',unavailable:'Нет в наличии',openFirst:'Сначала откройте страницу магазина — после возврата кнопки ответа станут доступны.',thanks:'Спасибо. Можно проверить остальные данные и продолжить.',removed:'Товар не будет добавлен. Администратор получил сообщение для проверки.',dataStep:'Проверьте данные',name:'Название товара',namePlaceholder:'Название со страницы магазина',shipCountry:'Страна фактической отправки',countryLabel:'Страна отправки',currency:'Валюта магазина',otherCountry:'Укажите страну',price:'Цена товара',atlasShipping:'До склада Atlas',change:'изменить',useShipping:'Использовать доставку до склада Atlas',shippingNote:`Это доставка от магазина до склада Atlas. Если магазин её не указал, держим резерв ${holdText} отдельно от суммы к оплате — один на заказ из магазина и только при товарах из него на ${freeFrom} или меньше.`,category:'Категория',weight:'Вес товара с коробкой, кг',weightDetails:'Как уточняется вес доставки',forCalc:'для расчёта',variant:'Вариант товара',color:'Цвет',size:'Размер / модель',selectColor:'Выберите цвет',selectVariant:'Выберите вариант',selectSize:'Выберите размер',none:'Нет',photo:'Фото товара — автоматически или по ссылке',image:'Адрес изображения',verified:'Я проверил данные и выбранный вариант.',add:'В корзину',adding:'Добавляем в корзину…',gallery:'Фотографии магазина',uz:'Узбекистан',empty:'Ваш товар появится здесь',fresh:'Когда проверены данные',freshText:'Atlas автоматически сверяет цену, валюту и выбранный вариант с магазином.',declaration:'Черновик декларации',cost:'Состав стоимости',reserve:`${holdText} — резерв на доставку магазина, один на заказ из этого магазина; в сумму к оплате не входит. При товарах дороже ${freeFrom} резерва нет. Фактическую сумму менеджер подтвердит после оформления.`,subtotal:'Промежуточный итог',estimate:'Итого с доставкой',emptyQuote:'Вставьте ссылку или заполните цену и вес.'}:{over:isUzbek(lang)?uzText(lang, 'DUNYODAN XARIDLAR'):'SHOP THE WORLD',choose:isUzbek(lang)?uzText(lang, 'Variantni tanlang'):'Choose your option',order:isUzbek(lang)?uzText(lang, 'Havola orqali buyurtma'):'Order by link',checkPrice:isUzbek(lang)?uzText(lang, 'Qo‘shishdan oldin o‘lcham va narxni tekshiring.'):'Check the size and price before adding.',paste:isUzbek(lang)?uzText(lang, 'Havolani kiriting — Atlas ma’lumotlarni to‘ldiradi.'):'Paste a link — Atlas will fill in the details.',loading:isUzbek(lang)?uzText(lang, 'Do‘kondan narx va variantlar yuklanmoqda…'):'Loading price and options from the store…',selected:isUzbek(lang)?uzText(lang, 'Tovar tanlandi. Variantni tekshirib savatga qo‘shing.'):'The item is selected. Check the option and add it to your cart.',edit:isUzbek(lang)?uzText(lang, 'Havolani o‘zgartirish'):'Change link',linkStep:isUzbek(lang)?uzText(lang, 'Tovar havolasi'):'Item link',stores:isUzbek(lang)?uzText(lang, 'eBay, Zara, Mango, Amazon va boshqa do‘konlar.'):'eBay, Zara, Mango, Amazon and more.',storePage:isUzbek(lang)?uzText(lang, 'Do‘kon sahifasi'):'Store page',get:isUzbek(lang)?uzText(lang, 'Ma’lumot olinmoqda…'):'Getting product data…',load:isUzbek(lang)?uzText(lang, 'Tovarni yuklash'):'Load item',directory:isUzbek(lang)?uzText(lang, 'Havola orqali buyurtma do‘konlari'):'Stores for link orders',storeHint:isUzbek(lang)?uzText(lang, 'Havola orqali mintaqaviy vitrinani tanlang. Atlas yetkazish bilan hisoblaydi.'):'Choose a regional storefront. Atlas calculates the total with delivery.',search:isUzbek(lang)?uzText(lang, 'Do‘kon yoki kategoriya'):'Store or category',enhanced:isUzbek(lang)?uzText(lang, 'narx + variantlar'):'price + options',otherMatches:isUzbek(lang)?uzText(lang, 'Boshqa moslar'):'Other matches',allStores:isUzbek(lang)?uzText(lang, 'Boshqa barcha do‘konlar'):'All other stores',notFound:isUzbek(lang)?uzText(lang, 'Bu do‘kon ro‘yxatda yo‘q. Uni operatorga yuboring — u do‘konni tekshiradi.'):'This store is not on the list. Send it to an operator — they will review the store.',login:isUzbek(lang)?uzText(lang, 'Kabinetga kiring: avtomatik yuklash himoyalangan va tovar savatda saqlanadi.'):'Sign in: automatic import is protected and the item will be saved to your cart.',original:isUzbek(lang)?uzText(lang, 'Do‘kondagi asl sahifani ochish'):'Open original store page',loaded:isUzbek(lang)?uzText(lang, 'Nimalar yuklandi va nimani tekshirish kerak'):'What loaded and what to check',availability:isUzbek(lang)?uzText(lang, 'Do‘kondagi mavjudlikni tekshiring'):'Check availability in the store',availabilityHint:isUzbek(lang)?uzText(lang, 'Tovar sahifasini oching, tanlangan o‘lcham yoki variantni tekshiring va javob bilan qayting.'):'Open the item page, check the selected size or option, and return with your answer.',openStore:isUzbek(lang)?uzText(lang, 'Do‘konni ochish'):'Open store',available:isUzbek(lang)?uzText(lang, 'Mavjud'):'In stock',unavailable:isUzbek(lang)?uzText(lang, 'Mavjud emas'):'Out of stock',openFirst:isUzbek(lang)?uzText(lang, 'Avval do‘kon sahifasini oching — qaytgach javob tugmalari yoqiladi.'):'Open the store page first; the answer buttons will unlock when you return.',thanks:isUzbek(lang)?uzText(lang, 'Rahmat. Qolgan ma’lumotlarni tekshirib davom eting.'):'Thanks. Check the remaining details to continue.',removed:isUzbek(lang)?uzText(lang, 'Tovar qo‘shilmaydi. Administrator tekshiradi.'):'The item will not be added. An administrator will review it.',dataStep:isUzbek(lang)?uzText(lang, 'Ma’lumotlarni tekshiring'):'Check the details',name:isUzbek(lang)?uzText(lang, 'Tovar nomi'):'Item name',namePlaceholder:isUzbek(lang)?uzText(lang, 'Do‘kon sahifasidagi nom'):'Name from the store page',shipCountry:isUzbek(lang)?uzText(lang, 'Haqiqiy jo‘natish mamlakati'):'Actual dispatch country',countryLabel:isUzbek(lang)?uzText(lang, 'Jo‘natish mamlakati'):'Dispatch country',currency:isUzbek(lang)?uzText(lang, 'Do‘kon valyutasi'):'Store currency',otherCountry:isUzbek(lang)?uzText(lang, 'Mamlakatni kiriting'):'Enter country',price:isUzbek(lang)?uzText(lang, 'Tovar narxi'):'Item price',atlasShipping:isUzbek(lang)?uzText(lang, 'Atlas omborigacha'):'To Atlas warehouse',change:isUzbek(lang)?uzText(lang, 'o‘zgartirish'):'edit',useShipping:isUzbek(lang)?uzText(lang, 'Atlas omborigacha yetkazishni ishlatish'):'Use delivery to Atlas warehouse',shippingNote:isUzbek(lang)?uzText(lang, `Bu do‘kondan Atlas omborigacha yetkazish. Do‘kon uni ko‘rsatmagan bo‘lsa, ${holdText} zaxirani to‘lov summasidan alohida ushlab turamiz — do‘kondan bitta buyurtmaga bir marta va faqat tovarlar ${freeFrom} yoki undan kam bo‘lsa.`):`This is store-to-Atlas delivery. If the store does not state it, we hold a ${holdText} reserve apart from the amount to pay — once per store order, and only when items from that store total ${freeFrom} or less.`,category:isUzbek(lang)?uzText(lang, 'Kategoriya'):'Category',weight:isUzbek(lang)?uzText(lang, 'Qutidagi og‘irlik, kg'):'Boxed weight, kg',weightDetails:isUzbek(lang)?uzText(lang, 'Yetkazish og‘irligi qanday aniqlanadi'):'How delivery weight is refined',forCalc:isUzbek(lang)?uzText(lang, 'hisoblash uchun'):'for calculation',variant:isUzbek(lang)?uzText(lang, 'Tovar varianti'):'Item option',color:isUzbek(lang)?uzText(lang, 'Rang'):'Color',size:isUzbek(lang)?uzText(lang, 'O‘lcham / model'):'Size / model',selectColor:isUzbek(lang)?uzText(lang, 'Rangni tanlang'):'Choose a color',selectVariant:isUzbek(lang)?uzText(lang, 'Variantni tanlang'):'Choose an option',selectSize:isUzbek(lang)?uzText(lang, 'O‘lchamni tanlang'):'Choose a size',none:isUzbek(lang)?uzText(lang, 'Yo‘q'):'Unavailable',photo:isUzbek(lang)?uzText(lang, 'Tovar surati — avtomatik yoki havola orqali'):'Product photo — automatic or by link',image:isUzbek(lang)?uzText(lang, 'Rasm manzili'):'Image URL',verified:isUzbek(lang)?uzText(lang, 'Ma’lumot va variantni tekshirdim.'):'I checked the details and selected option.',add:isUzbek(lang)?uzText(lang, 'Savatga'):'Add to cart',adding:isUzbek(lang)?uzText(lang, 'Savatga qo‘shilmoqda…'):'Adding to cart…',gallery:isUzbek(lang)?uzText(lang, 'Do‘kon rasmlari'):'Store photos',uz:isUzbek(lang)?uzText(lang, 'O‘zbekiston'):'Uzbekistan',empty:isUzbek(lang)?uzText(lang, 'Tovaringiz shu yerda paydo bo‘ladi'):'Your item will appear here',fresh:isUzbek(lang)?uzText(lang, 'Ma’lumot qachon tekshirildi'):'When the data was checked',freshText:isUzbek(lang)?uzText(lang, 'Atlas narx, valyuta va tanlangan variantni do‘kon bilan avtomatik solishtiradi.'):'Atlas automatically verifies the price, currency and selected option with the store.',declaration:isUzbek(lang)?uzText(lang, 'Deklaratsiya qoralamasi'):'Declaration draft',cost:isUzbek(lang)?uzText(lang, 'Narx tarkibi'):'Cost breakdown',reserve:isUzbek(lang)?uzText(lang, `${holdText} — do‘kon yetkazishi uchun zaxira, shu do‘kondan bitta buyurtmaga bir marta; to‘lov summasiga kirmaydi. Tovarlar ${freeFrom} dan qimmat bo‘lsa, zaxira yo‘q. Haqiqiy summani menejer rasmiylashtirilgach tasdiqlaydi.`):`${holdText} is the store-delivery reserve, once per order from this store, kept apart from the amount to pay. Over ${freeFrom} of items there is no reserve. A manager confirms the actual amount after checkout.`,subtotal:isUzbek(lang)?uzText(lang, 'Oraliq jami'):'Interim total',estimate:isUzbek(lang)?uzText(lang, 'Yetkazish bilan jami'):'Total with delivery',emptyQuote:isUzbek(lang)?uzText(lang, 'Havolani kiriting yoki narx va og‘irlikni to‘ldiring.'):'Paste a link or enter price and weight.'};
  const tx=(ru:string,uz:string,en:string)=>lang==='ru'?ru:isUzbek(lang)?uzText(lang, uz):en;
  const lc = linkOrderCopy[lang];
  const checkedText=tx('Atlas уже проверил цену и валюту в магазине.','Atlas narx va valyutani do‘konda tekshirib bo‘ldi.','Atlas has already checked the price and currency with the store.');
  // Same words as the home link field (home-copy `hero.invalid`); the copy itself stays out of this page's chunk.
  const invalidLinkText=tx('Вставьте полную ссылку на страницу товара — она начинается с https://','Tovar sahifasining to‘liq havolasini qo‘ying — u https:// bilan boshlanadi','Paste the full product page link — it starts with https://');
  // Short enough not to be cut at 375 px; the same meaning as the phone bar's «Войти и добавить»: after sign-in the item goes to the cart.
  const searchParams = useSearchParams();
  const router = useRouter();
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
    // The colour under the pointer or focus, named in full in the step heading while a long row of colours is shown.
    [colourPeek, setColourPeek] = useState(""),
    [selectedSize, setSelectedSize] = useState(""),
    [image, setImage] = useState(seed?.image ?? dealSeed?.image ?? ""),
    [images, setImages] = useState<string[]>(seedImages),
    [colorwayImages, setColorwayImages] = useState<ProductColorwayGallery[]>([]),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    [showSourceForm, setShowSourceForm] = useState(() => !requestedUrl),
    [note, setNote] = useState(seed ? tx(`Данные из подборки ${seed.store} на ${seed.observedOn}. Atlas сверяет цену и вариант с магазином при добавлении в корзину. Вес — оценка Atlas: склад взвесит посылку.`, `${seed.store} to‘plamidagi ma’lumotlar, ${seed.observedOn}. Atlas savatga qo‘shishda narx va variantni do‘kon bilan solishtiradi. Vazn — Atlas bahosi: ombor jo‘natmani tortadi.`, `Data from the ${seed.store} selection as of ${seed.observedOn}. Atlas checks the price and option with the store when you add the item to the cart. Weight is an Atlas estimate: the warehouse weighs the parcel.`) : dealSeed ? tx(`Цена и фото сохранены из подборки на ${dealSeed.observedOn}. Atlas сейчас сверяет их с магазином.`, `Narx va surat ${dealSeed.observedOn} sanadagi to‘plamdan olingan. Atlas hozir ularni do‘kon bilan solishtirmoqda.`, `Price and photo saved from the selection on ${dealSeed.observedOn}. Atlas is checking them with the store now.`) : ""),
    [weightOrigin, setWeightOrigin] = useState(tx("Оценка по категории","Kategoriya bo‘yicha taxmin","Category estimate")),
    [sourceCheckStatus, setSourceCheckStatus] = useState<'idle'|'checking'|'verified'|'failed'|'manual'>('idle'),
    [importedAt, setImportedAt] = useState<number | undefined>(),
    [sourceExpiresAt, setSourceExpiresAt] = useState<number | undefined>(),
    [formIssue, setFormIssue] = useState(""),
    // The field the message under the add button is about: marked invalid only while that message is shown.
    [issueField, setIssueField] = useState<{ id: string; message: string } | null>(null),
    // A link that is not a store page: said under the link field in the page language, not by the browser or a toast.
    [linkError, setLinkError] = useState(""),
    // A store Atlas does not read (manualEntryStoreRoots): the customer confirms the details typed from its page.
    [manualConfirmed, setManualConfirmed] = useState(false),
    [dataOpen, setDataOpen] = useState(false),
    [foundShipping, setFoundShipping] = useState<{
      amount: number;
      currency: string;
      destination?: string;
    } | null>(null);
  // Several options of one product can go to the cart at once: option label → quantity.
  // Also on the first paint of the colours, when a colour arrives already chosen from the link.
  useEffect(() => { document.querySelectorAll<HTMLElement>(".lo-colour-rail").forEach(keepChosenColourInView); }, [selectedColor, variants]);
  const [picked, setPicked] = useState<Record<string, number>>(() => fallbackOptions.length === 1 ? { [fallbackOptions[0].label]: 1 } : {});
  // One option at a time by default: a tap replaces the choice. "Several or a quantity" turns on the list with
  // quantities (owner, 12 October 2026). A restored draft with several options opens in that mode.
  const [multiPick, setMultiPick] = useState(false);
  // Nike's chart opens from the "?" beside US / EU / UK / CM instead of a line of its own (owner, 12 October 2026).
  const [sizeChartOpen, setSizeChartOpen] = useState(false);
  const manyMode = multiPick || Object.keys(picked).length > 1;
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
  // The store answered that every option at this link is sold out (lib/market/link-order-stock.ts): the failed check
  // then says «Нет в наличии в магазине» instead of asking to retry for a price.
  const [storeSoldOut, setStoreSoldOut] = useState(false);
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
  const focusLinkField = useRef(false);
  // "Поделиться → Atlas" brought text without a web link (app/share/route.ts): say so once and drop the mark from the address.
  const sharedWithoutLink = searchParams.get("shared") === "nolink";
  useEffect(() => {
    if (!sharedWithoutLink) return;
    toast.message(lc.sharedNoLink);
    const address = new URL(window.location.href);
    address.searchParams.delete("shared");
    window.history.replaceState(window.history.state, "", address.pathname + address.search + address.hash);
    document.getElementById("source-url")?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per arrival; the language does not reopen it
  }, [sharedWithoutLink]);
  useEffect(() => {
    if (!showSourceForm || !focusLinkField.current) return;
    focusLinkField.current = false;
    document.getElementById("source-url")?.focus();
  }, [showSourceForm]);
  const autoLoadKey=`${catalogId}:${requestedUrl}`;
  const [autoLoadStarted,setAutoLoadStarted]=useState("");
  // From the first frame until the store answers the page keeps its shape: the product stays, the rest waits in placeholders.
  const checking=busy||(Boolean(requestedUrl)&&autoLoadStarted!==autoLoadKey);
  // A store link already copied lights up "Вставить" and is fetched in the background (app/use-clipboard-link.ts).
  const clip = useClipboardLink(requestedUrl);
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
  // Arriving from "Поделиться → Atlas" without a link is a fresh start: the customer came to paste a new one.
  const [resumeChecked,setResumeChecked]=useState(()=>Boolean(requestedUrl||catalogId||sharedWithoutLink));
  useEffect(()=>{
    if(resumeChecked)return;
    const last=requestedUrl||catalogId?null:readLastDraft(browserStorage());
    if(last?.owner&&status==='loading')return;
    queueMicrotask(()=>{setResumeChecked(true);if(last&&draftVisible(last,viewer))setResumedFrom(last.pageUrl)});
    if(last&&draftVisible(last,viewer))window.history.replaceState(window.history.state,"",draftAddress(last,window.location.search));
  },[resumeChecked,requestedUrl,catalogId,status,viewer]);
  useEffect(()=>{if(!storageWritable(browserStorage()))queueMicrotask(()=>setCanKeep(false))},[]);
  // "Recently checked" on the empty page: this customer's own unfinished items on this device, once the viewer is known.
  const [recentDrafts,setRecentDrafts]=useState<LinkOrderDraft[]>([]);
  const emptyPage=!source&&!requestedUrl;
  useEffect(()=>{
    if(viewer===null||!emptyPage)return;
    let active=true;
    queueMicrotask(()=>{if(active)setRecentDrafts(listDrafts(browserStorage(),viewer))});
    return()=>{active=false};
  },[viewer,emptyPage]);

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
      picked,manualQuantity,comment,
    },Date.now(),prunedFor.current!==draftKey);
    prunedFor.current=draftKey;
  },[draftKey,viewer,checking,choicesApplied,added,requestedUrl,catalogId,dealId,url,source,name,brand,declaration,currency,amount,basePrice,importReference,shipping,shippingCurrency,shippingEstimated,foundShipping,weight,weightBasis,weightOrigin,country,otherCountry,category,variant,variants,selectedColor,selectedSize,image,images,colorwayImages,showSourceForm,note,sourceCheckStatus,importedAt,sourceExpiresAt,atlasLocks,picked,manualQuantity,comment,previewSpeed]);
  const [sizeFormat,setSizeFormat]=useState<"us"|"uk"|"eu"|"cm">("us");
  const variantColors = useMemo(() => [...new Set(variants.map(item => item.color).filter((value): value is string => Boolean(value)))], [variants]);
  const currentCatalogSeed=catalogLinkSeed(catalogProducts,catalogId,requestedUrl,url);
  const catalogProductFlow=Boolean(currentCatalogSeed || (dealSeed && url===requestedUrl));
  // Incomplete merchant/catalog responses must never leave an empty read-only price.
  const catalogPriceLocked=catalogProductFlow && Boolean(catalogLinkPrice(currentCatalogSeed) || dealSeed);
  const catalogCountryLocked=catalogProductFlow && Boolean(dealSeed || (currentCatalogSeed?.country && countries.includes(canonicalCountry(currentCatalogSeed.country)) && canonicalCountry(currentCatalogSeed.country)!=='Другая страна'));
  const variantsForColor = useMemo(() => selectedColor ? variants.filter(item => item.color === selectedColor) : variantColors.length===1 ? variants.filter(item => item.color === variantColors[0]) : variantColors.length ? [] : variants, [variants,selectedColor,variantColors]);
  const complexVariants=variantsForColor.some(v=>(v.options??[]).some(o=>!/colou?r|shade/i.test(o.name)&&o.name!==v.sizeLabel&&!(o.value===v.size&&/size/i.test(o.name))&&!(v.sizeAlternates??[]).some(a=>a.value===o.value)&&new Set(variantsForColor.flatMap(option=>(option.options??[]).filter(axis=>axis.name===o.name).map(axis=>axis.value))).size>1))||new Set(variantsForColor.map(v=>`${v.color??''}|${v.size??''}`)).size<variantsForColor.length;
  const variantSizes = useMemo(() => [...new Set(variantsForColor.filter(item=>item.available&&item.quantity!==0).map(item => item.size).filter((value): value is string => Boolean(value)))].sort(compareSizes), [variantsForColor]);
  const nikeSizeSystem = variantsForColor.some(item => item.sizeLabel === 'Nike US women')
    ? 'women' as const
    : variantsForColor.some(item => item.sizeLabel === 'Nike US men') ? 'men' as const
      : inferNikeFootwearSizeSystem({sourceUrl:source,currency,category,title:name});
  const adidasSizes=variantsForColor.some(v=>/US/i.test(v.sizeLabel??"")&&adidasMenSize(brand,name,v.size??""));
  // Nike sizes switch between US, UK, EU and CM/JP by Nike's own chart, like adidas (owner, 12 October 2026).
  const nikeSizeIn=(size:string)=>{const row=nikeSizeSystem?findNikeFootwearSizeRow(nikeSizeSystem,size):undefined;return !row?`US ${size}`:sizeFormat==='cm'?`CM ${row.cmLabel}`:`${sizeFormat.toUpperCase()} ${row[sizeFormat]}`;};
  const sizeDisplay=(size:string)=>{if(nikeSizeSystem)return nikeSizeIn(size);const alternate=variantsForColor.find(v=>v.size===size)?.sizeAlternates?.find(v=>v.system.toLowerCase()===sizeFormat);if(alternate)return `${sizeFormat.toUpperCase()} ${alternate.value}`;return adidasSizes?`${sizeFormat.toUpperCase()} ${adidasMenSize(brand,name,size)?.[sizeFormat]??size}`:size;};
  // Importers keep the store's axis name, some in Russian ("Размер", "Объём"): shown in the page language; a store's own
  // name ("Waist", "US") stays as the store wrote it.
  const localSizeLabel = (label: string) => {
    const key = label.replace(/\s+/g, " ").trim().toLowerCase();
    return key === "размер" || key === "size" ? tx("Размер", "O‘lcham", "Size")
      : key === "объём" || key === "объем" ? tx("Объём", "Hajm", "Size")
      : key === "вариант" ? tx("Вариант", "Variant", "Option")
      : key === "band / cup" ? tx("Обхват / чашка", "Aylana / chashka", "Band / cup")
      : label;
  };
  const nikeSizeRows = nikeSizeSystem ? getNikeFootwearSizeRows(nikeSizeSystem, variantSizes) : [];
  const selectedNikeSize = nikeSizeSystem && selectedSize ? findNikeFootwearSizeRow(nikeSizeSystem, selectedSize) : undefined;
  const variantSizeLabel = nikeSizeSystem
    ? nikeSizeSystem === 'women'
      ? tx('Размер · Nike, женские','O‘lcham · Nike, ayollar','Size · Nike women')
      : tx('Размер · Nike, мужские','O‘lcham · Nike, erkaklar','Size · Nike men')
    : [...new Set(variantsForColor.map(item => item.sizeLabel).filter((value): value is string => Boolean(value)).map(localSizeLabel))].join(' / ') || (lang==='ru'?'Размер / модель':isUzbek(lang)?uzText(lang, 'O‘lcham / model'):'Size / model');
  // The step is about sizes (not a volume or a model): its hint says "choose a size".
  const sizeLabels = variantsForColor.map(item => item.sizeLabel?.trim().toLowerCase()).filter(Boolean);
  const sizeStep = Boolean(nikeSizeSystem || adidasSizes || (sizeLabels.length && sizeLabels.every(label => label === 'размер' || label === 'size')));
  // The store's product price applies to options it lists without their own; only from a store check (locked there).
  const storeBasePrice=sourceCheckStatus==='verified'&&atlasLocks?.price&&!unlocked.price?basePrice:undefined;
  function applyVariantChoice(item:ProductVariant|undefined,knownCurrency=true){
    if(!item){setVariant("");setSelectedSize("");return}
    setVariant(item.label);setSelectedColor(item.color??"");setSelectedSize(item.size??"");
    if(item.price!==undefined&&knownCurrency)setAmount(String(item.price));else if(storeBasePrice!==undefined)setAmount(String(storeBasePrice));else if(variants.some(value=>value.price!==undefined))setAmount("");
    const ownGallery=variantGallery(item,colorwayImages,source);
    if(ownGallery.length){setImages(ownGallery);setImage(ownGallery[0]);}
  }
  /** Toggle an option in the selection; the last one touched sets the price shown in the form. */
  function togglePick(item:ProductVariant){
    if(!isOrderableVariant(item))return;
    setFormIssue("");
    setPicked(current=>{if(!manyMode)return current[item.label]&&Object.keys(current).length===1?current:{[item.label]:1};const next={...current};if(next[item.label])delete next[item.label];else next[item.label]=1;return next});
    applyVariantChoice(item);
    setAdded(null);setGoneOptions([]);setChoiceNote("");
  }
  function setPickQuantity(label:string,quantity:number){
    setFormIssue("");
    setPicked(current=>({...current,[label]:quantity}));

  }
  function selectColorway(color:string){
    setFormIssue("");
    const choices=variants.filter(item=>item.color===color);
    const first=choices.find(item=>item.available)??choices[0];
    // The chosen color tapped again picks its only option back (after "add to cart" or removing it from the list).
    if(color===selectedColor){
      if(first&&!choices.some(item=>item.size)&&!picked[first.label]){applyVariantChoice(first);setPicked(current=>manyMode?{...current,[first.label]:1}:{[first.label]:1})}
      return;
    }
    const gallery=colorwayImages.find(item=>item.color===color)?.images??[];
    const nextImages=gallery.length?gallery:first?.image?[first.image]:[];
    setSelectedColor(color);setSelectedSize('');setVariant('');
    setImages(nextImages);
    setImage(first?.image&&nextImages.includes(first.image)?first.image:nextImages[0]??'');
    if(choices.some(item=>item.price!==undefined))setAmount('');
    if(!choices.some(item=>item.size)&&first){applyVariantChoice(first);setPicked(current=>manyMode?{...current,[first.label]:current[first.label]??1}:{[first.label]:current[first.label]??1})}
  }
  /** What the customer has chosen now, to apply again after a reload. */
  function currentChoices():DraftChoices{
    const choices:DraftChoices={picked,variant,selectedColor,selectedSize,manualQuantity,comment};
    if(!variants.length&&variant.trim())choices.manualOption={label:variant.trim(),quantity:manualQuantity};
    if((sourceCheckStatus==='failed'||sourceCheckStatus==='manual')&&!catalogProductFlow)choices.manual={name,currency,amount,shipping,shippingCurrency,shippingEstimated,weight,weightBasis,weightOrigin,country,otherCountry,category};
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
    // What the customer typed comes back only while the store still gives nothing for it.
    const typed=saved.manual;
    if(typed&&(sourceCheckStatus==='failed'||sourceCheckStatus==='manual')){
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
    } catch {
      setLinkError(invalidLinkText);
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
    setLinkError("");
    setUrl(link);
    setBusy(true);
    setSource(link);
    setManualConfirmed(false);

    setSourceCheckStatus('checking');
    setAtlasLocks(null);setUnlocked({});setGoneOptions([]);setChoiceNote("");setBasePrice(undefined);setStoreSoldOut(false);
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
    setColorwayImages(cleanColorwayGalleries(linkSeed?.sourceColorwayImages,linkSeed?.sourceUrl??link));
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
      // A product opened for ordering is checked against the merchant now;
      // the short cache remains for batch imports and repeat browsing only.
      // Walmart may answer "still collecting" (202): the page says so and asks again by itself.
      const response = await requestImport({ url: link, fresh: true }, {
        isCancelled: () => seq !== loadSeq.current,
        onPending: (pending) => { if (seq === loadSeq.current && pending.message) setNote(pending.message); },
      });
      if (response.status === 202) return;
      const data: Extracted & {
        error?: string;
        manualEntryAvailable?: boolean;
        /** A store Atlas does not read: the customer enters the details (lib/importer/stores.ts manualEntryStoreRoots). */
        manualStore?: boolean;
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
        const partialVariants=variantsForSourceColor(receivedPartialVariants,data.selectedVariantColor,data.sourceUrl??link,data.variantScope);
        const partialSelected=partialVariants.find(item=>item.id&&(item.id===data.selectedVariantId||item.id===data.sku));
        setVariants(partialVariants.filter(isOrderableVariant));
        setStoreSoldOut(optionStock(partialVariants)==='sold-out');
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
        // A store Atlas does not read at all opens the form for the customer's own entry; anything else is a failed check.
        const manualStore=data.manualStore===true;
        setSourceCheckStatus(manualStore?'manual':'failed');
        setNote(manualStore?"":tx("Автоматически получены не все данные. Проверьте цену и вариант.","Ma’lumotlarning hammasi avtomatik olinmadi. Narx va variantni tekshiring.","Some details were not available automatically. Review the price and option."));
        if(manualStore)setDataOpen(true);
        setShowSourceForm(false);
        return;
      }
      if (!response.ok)
        throw Error(data.error ?? tx("Магазин не ответил. Повторите или заполните данные товара вручную.", "Do‘kon javob bermadi. Qayta urining yoki tovar ma’lumotlarini qo‘lda kiriting.", "The store didn’t respond. Try again or fill in the item details manually."));
      setSource(data.sourceUrl);
      setName(linkIsCatalogFlow&&linkSeed?linkSeed.name:data.title ?? linkSeed?.name ?? linkDealSeed?.title ?? "");
      setBrand(data.brand ?? linkSeed?.brand ?? linkDealSeed?.store ?? new URL(data.sourceUrl).hostname);
      setImage(data.image ?? linkSeed?.image ?? linkDealSeed?.image ?? "");
      const importedImages=dedupeSafeImages([data.image,...(data.images??[])].filter(Boolean) as string[],data.sourceUrl);
      setImages(importedImages.length?importedImages:linkSeedImages);
      const allImportedColorwayGalleries=cleanColorwayGalleries(data.colorwayImages,data.sourceUrl);
      const importedColorwayGalleries=variantsForSourceColor(allImportedColorwayGalleries,data.selectedVariantColor,data.sourceUrl,data.variantScope);
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
      const importedVariants = variantsForSourceColor(allImportedVariants,data.selectedVariantColor,data.sourceUrl,data.variantScope);
      const safeVariants = knownCurrency ? importedVariants : importedVariants.map(item => ({...item, price: undefined}));
      
      const selectableVariants=safeVariants.filter(isOrderableVariant).filter(item=>{const value=item.price??(data.variantScope==='group'?undefined:data.price);return typeof value==='number'&&Number.isFinite(value)&&value>0;});
      setVariants(selectableVariants);
      // Every option the store lists at this link is sold out: said as such, not as a price still to come.
      setStoreSoldOut(optionStock(safeVariants)==='sold-out');
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
      const sourceHasPrice=knownCurrency&&Boolean(selectableVariants.length)&&(productPriceKnown||selectableVariants.some(v=>typeof v.price==='number'&&v.price>0));
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
          selectableVariants.length<safeVariants.length?tx("Варианты без подтверждённых цены и наличия не показаны.","Narxi yoki mavjudligi tasdiqlanmagan variantlar ko‘rsatilmaydi.","Options without a confirmed price and availability are not shown."):"",
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
    catch { setLinkError(invalidLinkText); setShowSourceForm(true); return; }
    setLinkError("");
    if (link === requestedUrl) { void load(link); return; }
    removeDraft(browserStorage(), draftKeyFor({ pageUrl: link }));
    setAdded(null); setResumedFrom("");
    // The address change loads it, even when the same link was open before "Next item".
    automaticallyLoaded.current = null;
    window.history.replaceState(window.history.state, "", draftAddress({ pageUrl: link }, window.location.search));
  }
  /** "Изменить ссылку": an empty field for the new link. The product stays below until another link is opened; Esc goes back. */
  function editLink() {
    // Focused once the field is drawn: after the clipboard read a timer can fire before that.
    focusLinkField.current = true;
    setUrl(""); setLinkError(""); setShowSourceForm(true);
  }
  /** "Заменить ссылку": the link last copied replaces this one. The same link, no link or a refused clipboard open the empty field. */
  async function replaceLink() {
    let text = "";
    try { text = (await navigator.clipboard.readText()).trim(); } catch { /* denied or unsupported: paste by hand */ }
    // A link shared from an app often comes with its title around it.
    const found = extractSharedLink(text) || text;
    let link = "";
    try { link = found ? validateSource(found) : ""; } catch { link = ""; }
    // The store may answer with its own address for the product, so the link that was opened counts as the same too.
    let opened = "";
    try { opened = requestedUrl ? validateSource(requestedUrl) : ""; } catch { opened = ""; }
    if (!link || link === source || link === opened) { editLink(); return; }
    setUrl(link);
    openLink(link);
  }
  /** "Next item" and "Start with a new link": an empty link form at /order-by-link that does not bring this draft back. */
  function startNewLink() {
    forgetLastDraft(browserStorage());
    automaticallyLoaded.current = null; setAutoLoadStarted("");
    setAdded(null); setResumedFrom(""); setFormIssue(""); setLinkError(""); setUrl(""); setSource(""); setSourceCheckStatus("idle"); setShowSourceForm(true);
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
  const previewFor = (lines: [string, number][]): CartItem[] => {
    try {
      const boxed = validBoxedWeight(weight);
      if (boxed === undefined || !lines.length || !source) return [];
      const shippingUsd = shipping === "" ? 0 : toUsd(Number(shipping), shippingCurrency, pricing.rates);
      return repriceCart(lines.map(([label, quantity], index) => ({
        id: `preview-${index}`,
        product: { id: `preview-${index}`, name: name || "item", brand: "", category, usd: toUsd(priceOf(label), currency, pricing.rates), weight: paddedWeight(boxed), image: "", variants: [label], sourceUrl: source, country: country === "Другая страна" ? otherCountry : country, sourceShippingUsd: shippingUsd, sourceShippingEstimated: shippingEstimated, boxedWeight: boxed },
        variant: label, quantity, requestedServiceIds: [], deliverySpeed: previewSpeed, quote: {} as CartItem["quote"],
      })), 0, pricing);
    } catch { return []; }
  };
  const previewItems = previewFor(picks);
  const previewSums = previewItems.length ? sumQuotes(previewItems.map(item => item.quote)) : null;
  const previewWeight = Math.round(previewItems.reduce((sum, item) => sum + item.quote.weight, 0) * 100) / 100;
  const previewHold = storeShippingReserves(previewItems, pricing)[0];
  const storeShippingState: "stated" | "free" | "hold" | "none" = !shippingEstimated ? (Number(shipping) > 0 ? "stated" : "none") : !previewItems.length ? "none" : previewHold?.reserveUsd ? "hold" : "free";
  // Unknown store delivery is free by Atlas's rule once the items cost more than the threshold: a line, not a field.
  // Decided by the amount, not by an empty or zero field, so clearing the field to type a new value keeps the field.
  const shippingFree = shippingEstimated && Boolean(previewHold) && previewHold!.subtotalUsd > (pricing.storeShippingFreeFromUsd ?? 50);
  // Sent with the item: what the customer typed, or the usual $10 hold when the rule made it free and nothing valid was typed.
  const shippingTyped = shipping !== "" && Number.isFinite(Number(shipping)) && Number(shipping) >= 0;
  const sendShipping = shippingTyped ? Number(shipping) : unknownStoreShippingUsd, sendShippingCurrency = shippingTyped ? shippingCurrency : "USD";
  const primaryProfile = state.deliveryProfiles.find(profile => profile.primary) ?? state.deliveryProfiles[0];
  // Together with what the cart already holds for checkout: the allowance is per month, so the cart must not surprise later.
  const customsPreview = previewItems.length ? cartCustomsEstimate({ ...state, cart: [...state.cart, ...previewItems] }, pricing, { profile: primaryProfile }, { outsideUsed: false, help: false }) : null;
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
    // Added: straight to the cart, where delivery and payment are chosen (owner, 12 October 2026).
    router.push("/cart");
  }
  // A guest's "add to cart" is sent once after sign-in, when this product is on screen again (app/pending-cart-add.ts).
  const pendingAdd = usePendingCartAdd(!checking && !adding && Boolean(source) && draftDecidedFor === draftKey, (result: PendingCartAddResult) => {
    if (result.status === "added") {
      toast.success(lc.pending.added(result.pending.units) + (result.speedKept ? " " + lc.pending.speedKept : ""));
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
  // A catalog item can be saved to favourites right here; a link outside the catalog has nothing to save.
  const favoriteId = currentCatalogSeed && ready && !isGuest ? currentCatalogSeed.id : "";
  const favoriteSaved = Boolean(favoriteId) && state.favorites.includes(favoriteId);
  const dc = dealCopy(lang);
  async function toggleFavorite() {
    if (!favoriteId || favoriteBusy) return;
    setFavoriteBusy(true);
    try { await act({ type: "favorite", id: favoriteId }); } finally { setFavoriteBusy(false); }
  }
  // Units already in the cart, for the entry beside the order button (signed-in customers only).
  const cartUnits = ready && !isGuest ? state.cart.reduce((sum, line) => sum + line.quantity, 0) : 0;
  const cartLabel = tx("Корзина", "Savat", "Cart");
  // The store link at the top: domain and path, no tracking parameters; the full address opens on click.
  const sourceShort = (() => { try { const parsed = new URL(source || url); return parsed.hostname.replace(/^www\./, "") + (parsed.pathname === "/" ? "" : parsed.pathname); } catch { return sourceHost || url; } })();
  const weightNote = weightBasis === "store" ? k.weightStore : weightBasis === "catalog" ? k.weightCatalog : weightBasis === "customer" ? k.weightCustomer : weightBasis === "title" ? k.weightTitle : k.weightEstimate(displayCategoryName(category, lang));
  // Prices on the size buttons only when sizes of the chosen colour cost differently; the colour's price is shown above.
  const sizePricesDiffer = new Set(variantsForColor.filter(item => item.available && item.quantity !== 0).map(item => item.price).filter((value): value is number => value !== undefined)).size > 1;
  const countryText = country === "Другая страна" ? otherCountry.trim() || countryLabel(country, lang) : countryLabel(canonicalCountry(country), lang);
  // Store money is written one way on the whole page ("15,99 $"): the header, the options and the details alike.
  const moneyIn = (value: number, code: string) => { try { return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(value); } catch { return `${value} ${code}`; } };
  const sourceFormat = (value: number) => moneyIn(value, currency);
  const typedMoney = (value: string, code: string) => value.trim() !== "" && Number.isFinite(Number(value)) ? moneyIn(Number(value), code) : `${value} ${code}`;
  // The heading follows the colour/size being viewed. The quote below still totals all cart picks.
  const pickPrices = [...new Set(picks.map(([label]) => priceOf(label)).filter(value => value > 0))].sort((a, b) => a - b);
  const displayPrices=variantDisplayPrices(complexVariants&&variants.find(v=>v.label===variant)?variants.filter(v=>v.label===variant):variants,selectedColor,selectedSize);
  const headAmount = displayPrices.length === 1 ? displayPrices[0] : displayPrices.length ? NaN : Number(amount);
  const storePriceText = displayPrices.length > 1 ? `${sourceFormat(displayPrices[0])} – ${sourceFormat(displayPrices[displayPrices.length - 1])}` : headAmount > 0 ? sourceFormat(headAmount) : "—";
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
  // Verified with the store, or typed by the customer for a store Atlas does not read: the item can be ordered.
  const orderable = sourceCheckStatus === "verified" || sourceCheckStatus === "manual";
  // Nothing chosen yet among several options: an honest "from" total for the lowest-priced option that can be ordered
  // (in the colour being viewed, or in any colour while none is chosen). Priced like the real choice; the server prices that.
  const fromSums = (() => {
    if (picks.length || variants.length < 2 || !orderable || checking) return null;
    const pool = variantsForColor.length ? variantsForColor : variants;
    const cheapest = pool.filter(item => isOrderableVariant(item) && item.quantity !== 0 && priceOf(item.label) > 0)
      .sort((a, b) => priceOf(a.label) - priceOf(b.label))[0];
    const items = cheapest ? previewFor([[cheapest.label, 1]]) : [];
    return items.length ? sumQuotes(items.map(item => item.quote)) : null;
  })();
  // Options listed and none of them on sale: the add buttons say so and stay inactive, never lead to an empty step.
  const stock = optionStock(variants);
  const nothingToChoose = !checking && orderable && (stock === "sold-out" || stock === "unconfirmed");
  const soldOutText = tx("Нет в наличии в магазине", "Do‘konda mavjud emas", "Out of stock at the store");
  const noStockText = stock === "unconfirmed" ? tx("Наличие не подтверждено магазином", "Do‘kon mavjudligini tasdiqlamadi", "The store has not confirmed stock") : soldOutText;
  // A failed check whose answer was "every option sold out" (the store's own words, not a guess).
  const soldOutAtStore = !checking && sourceCheckStatus === "failed" && storeSoldOut;
  // Until an option is chosen the add buttons name the next step (colour, then size or option) and lead to it.
  const needsChoice = !checking && orderable && variants.length > 1 && !picks.length && !nothingToChoose;
  const sizeStepShown = (variantColors.length === 0 || Boolean(selectedColor)) && !complexVariants && variantSizes.length > 0;
  const nextChoiceText = variantColors.length > 1 && !selectedColor ? c.selectColor : sizeStep && sizeStepShown ? lc.chooseSize : c.selectVariant;
  /** Scrolls to the step still to choose in and focuses its first open button; nothing is marked as an error. */
  function focusChoice() {
    window.setTimeout(() => {
      const shown = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].find(element => element.getClientRects().length > 0 && !(element as HTMLButtonElement).disabled);
      const target = (variantColors.length > 1 && !selectedColor ? shown(".lo-colours-aside .variant-options button, .lo-colours-main .variant-options button") : undefined)
        ?? shown('[data-order-variant] .variant-options.sizes button[aria-pressed="false"], [data-order-variant] .lo-option-chips button[aria-pressed="false"]')
        ?? shown("[data-order-variant] button, [data-order-variant] input")
        ?? document.getElementById("variant") ?? undefined;
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    }, 0);
  }
  // The delivery speed the total uses (the cart's, express by default) with its window in business days; the other speed
  // is chosen in the cart. No price difference here: the cart compares the speeds (owner, 14 October 2026).
  const speedRange = country === "Другая страна" ? null : daysRangeFor(pricing, [country], previewSpeed);
  const speedFaster = previewSpeed === "standard" && country !== "Другая страна" ? fasterText(pricing, [country], lang) : "";
  const speedLine = <p className="lo-speed">
    <span className="lo-speed-label">{lc.speedLabel}</span>
    <span className="lo-speed-chip">{deliverySpeedCopy[lang].names[previewSpeed]}{previewSpeed === "express" && <Star size={13} className="speed-option-star" aria-hidden="true" />}{speedRange && <span className="lo-speed-days">{` · ${deliverySpeedCopy[lang].days(speedRange[0], speedRange[1])}`}</span>}</span>
    <small>{previewSpeed === "express" ? lc.standardInCart : speedFaster ? `${speedFaster} — ${lc.expressInCart}` : tx("Скорость доставки выберете в корзине.", "Yetkazish tezligini savatda tanlaysiz.", "Choose delivery speed in your cart.")}</small>
  </p>;
  // The field the shown message under the add button is about; a newer message (or none) unmarks it.
  const invalidField = issueField && formIssue === issueField.message ? issueField.id : "";
  const issueProps = (id: string) => invalidField === id ? { "aria-invalid": true, "aria-describedby": "link-form-issue" } : {};
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
  const lockedPriceText = displayPrices.length ? storePriceText : pickPrices.length > 1 ? lc.locked.byOption : pickPrices.length === 1 ? sourceFormat(pickPrices[0]) : Number(amount) > 0 ? storePriceText : storeBasePrice ? sourceFormat(storeBasePrice) : variants.some(item => item.price !== undefined) ? lc.locked.byOption : "—";
  const lockedShippingText = shippingFree || (shippingEstimated && storeShippingState === "free") ? k.lines.free : !shippingEstimated ? typedMoney(shipping, shippingCurrency) : lc.locked.reserve(typedMoney(shipping, shippingCurrency));
  const weightText = String(weight).replace(".", lang === "en" ? "." : ",");
  const dataSummary = [countryText, amount ? typedMoney(amount, currency) : "", validBoxedWeight(weight) !== undefined ? `${formatKg(validBoxedWeight(weight)!, lang)} ${lc.kg}` : "", shippingEstimated ? (storeShippingState === "free" ? lc.storeShipping(k.lines.free.toLowerCase()) : `${lc.shippingReserve} ${typedMoney(shipping, shippingCurrency)}`) : lc.storeShipping(typedMoney(shipping, shippingCurrency))].filter(Boolean).join(" · ");
  // The colour buttons: in the option card, and on wide screens also beside the photo, where the card hides its own.
  const colourPhoto = (color: string) => colorwayImages.find(g => g.color === color)?.images[0] ?? variants.find(v => v.color === color && v.image)?.image;
  // One picture for every colour tells nothing: the buttons then show names only.
  const colourPhotosDiffer = new Set(variantColors.map(colourPhoto).filter(Boolean)).size > 1;
  // A tile names the colour by its first part ("University Red" of "University Red/University Red/White") when that is
  // enough to tell the colours apart; otherwise the full name breaks at its slashes, never inside a word. The full name
  // stays in the step heading, the tooltip and the accessible name.
  const colourPrimaries = variantColors.map(color => describeSingleColorway(color).primary);
  const colourName = (color: string) => { const primary = describeSingleColorway(color).primary; return colourPrimaries.filter(value => value === primary).length === 1 ? primary : color.replace(/\//g, "/\u200b"); };
  // One price on every tile says nothing: when all colours cost the same, the tiles show only the name (the price
  // stays in the button label and the total below; 27 October 2026).
  const colourPricesSame = variantDisplayPrices(variants).length <= 1;
  // Three shapes for the colours (29 October 2026, owner: no empty space around small photos, and no colour hidden).
  // Up to six colours with their own photos: tiles whose photo fills the tile, the name under it, filling the width.
  // More: the same tiles in one row that scrolls sideways, the chosen one kept in view. No photos: name chips.
  const colourMode = !colourPhotosDiffer ? "names" : variantColors.length > 6 ? "rail" : "tiles";
  const colourHeading = (colourMode === "rail" && colourPeek) || selectedColor || c.selectColor;
  const colourOptions = <div className={`variant-options lo-colour-${colourMode}`} style={{ "--cols": Math.min(variantColors.length, variantColors.length > 4 ? 3 : 4) } as CSSProperties} onMouseLeave={() => setColourPeek("")} onScroll={colourMode === "rail" ? event => { const row = event.currentTarget; row.toggleAttribute("data-end", row.scrollLeft + row.clientWidth >= row.scrollWidth - 4); } : undefined}>{variantColors.map(color=>{const options=variants.filter(v=>v.color===color),photo=colourPhotosDiffer?colourPhoto(color):undefined,stock=options.some(v=>v.available&&v.quantity!==0),colorPrices=variantDisplayPrices(options),priceText=colorPrices.length>0?sourceFormat(colorPrices[0])+(colorPrices.length>1?` – ${sourceFormat(colorPrices[colorPrices.length-1])}`:""):"";return <button type="button" key={color} title={color} className={stock?undefined:"is-out"} aria-label={[color,priceText,stock?"":k.outOfStock].filter(Boolean).join(", ")} aria-pressed={selectedColor===color} onClick={()=>selectColorway(color)} onMouseEnter={()=>setColourPeek(color)} onFocus={()=>setColourPeek(color)} onBlur={()=>setColourPeek("")}>
    {/* eslint-disable-next-line @next/next/no-img-element -- a small store photo through sizedImage, as elsewhere on this page */}
    {photo&&<img src={sizedImage(photo,240)} alt="" width={112} height={112} decoding="async" data-loading="" onLoad={event=>{event.currentTarget.removeAttribute("data-loading")}} ref={el=>{if(el?.complete&&el.naturalWidth)el.removeAttribute("data-loading")}} onError={event=>{event.currentTarget.removeAttribute("data-loading");retryOriginal(event.currentTarget,photo)}}/>}<span>{colourName(color)}</span>{priceText&&!colourPricesSame&&<small className="lo-colour-price">{priceText}</small>}{!stock&&<small>{k.outOfStock}</small>}</button>})}</div>;
  // The item data card: in the right column under the total, or, for a store Atlas does not read (the customer types
  // every field), under the item card across the wide left column. Rendered in one place only.
  const manualLayout = sourceCheckStatus === "manual";
  const finishSheet = () => <div className="lo-sheet lo-sheet-finish">
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
          <input id="name" {...issueProps('name')} required maxLength={140} value={name} onChange={(e) => {
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
                <input id="amount" {...issueProps('amount')} type="number" inputMode="decimal" required min=".01" step=".01" value={amount} onChange={(e) => {setAmount(e.target.value); }} />
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
                <input id="shipping" {...issueProps('shipping')} type="number" inputMode="decimal" required min="0" step=".01" value={shipping} onChange={(e) => { setShipping(e.target.value); setShippingEstimated(true);  }} />
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
                <input id="other-country" {...issueProps('other-country')} required maxLength={60} value={otherCountry} onChange={(e) => setOtherCountry(e.target.value)} />
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
                <input id="weight" {...issueProps('weight')} type="number" inputMode="decimal" required min=".01" max="49.5" step=".01" value={weight}
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
            <small className="micro">{k.weightRule(formatKg(packagingKg, lang))}{previewWeight ? ` ${k.parcelWeight(formatKg(previewWeight, lang))}.` : ""}</small>
          </fieldset>
        </div>
      </div>
    </section>
    </div>;
  // Wide screens: the right column never reaches below the window, so the total and the add button stay in view; what
  // does not fit (customs, the store-delivery hold, opened item data) scrolls inside the column, with the add button
  // pinned at its foot (app/customer.css, .lo-side). The room is measured from where the column starts on screen: under
  // the page heading at first, at its sticky top once the page is scrolled.
  const sideRef = useRef<HTMLDivElement>(null);
  const sideShown = Boolean(source || checking);
  useEffect(() => {
    const side = sideRef.current;
    if (!side) return;
    let frame = 0;
    const queue = () => { if (!frame) frame = window.requestAnimationFrame(fit); };
    const observer = new ResizeObserver(queue);
    // A card added inside a full column does not change the column's own size, so its content is watched too.
    const cards = new MutationObserver(queue);
    function fit() {
      frame = 0;
      if (!side) return;
      const stuckAt = parseFloat(getComputedStyle(side).top);
      const top = Math.max(side.getBoundingClientRect().top, Number.isFinite(stuckAt) ? stuckAt : 0);
      // Every read comes before any write, and a value is written only when it changed: this runs on every scroll frame,
      // and a write between reads lays the page out again.
      const room = `${Math.max(360, Math.round(window.innerHeight - top - 16))}px`;
      const fits = side.scrollHeight <= side.clientHeight + 1;
      const confirm = side.querySelector<HTMLElement>(".lo-confirm");
      const padding = confirm ? `${confirm.offsetHeight + 12}px` : "";
      for (const card of Array.from(side.children)) observer.observe(card);
      if (side.style.getPropertyValue("--lo-side-room") !== room) side.style.setProperty("--lo-side-room", room);
      // The scroll box would cut the cards' shadows, so it is on only while the column is taller than the room.
      if (side.hasAttribute("data-fits") !== fits) side.toggleAttribute("data-fits", fits);
      // Tab into the column scrolls a field into view above the pinned button, not under it.
      if (side.style.scrollPaddingBottom !== padding) side.style.scrollPaddingBottom = padding;
    }
    observer.observe(document.body);
    observer.observe(side);
    cards.observe(side, { childList: true });
    // In the next frame, not during mount: the page is laid out by then, so reading the column costs nothing extra.
    queue();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      cards.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [sideShown]);
  return (
    <div className={"lo-page" + ((source || isSourcedFlow) && !showSourceForm ? " lo-page-loaded" : "")}>
      <header className="orders-head"><div><h1>{lc.title}</h1><p>{(source || isSourcedFlow) && !showSourceForm ? lc.leadLoaded : lc.lead}</p></div></header>

      {(showSourceForm || (!requestedUrl && resumeChecked)) && <form className="lo-link" onSubmit={(e) => { e.preventDefault(); openLink(); }} aria-busy={busy} noValidate>
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
          aria-invalid={!!linkError}
          aria-describedby={linkError ? "source-url-error" : undefined}
          onChange={(e) => {
            // A new link is being started: opening the page later does not bring the previous draft back.
            forgetLastDraft(browserStorage());
            setResumedFrom("");
            setUrl(e.target.value);
            setLinkError("");
            setSource("");
            setSourceCheckStatus('idle');

            setShowSourceForm(true);
          }}
          // Back to the loaded product when "Изменить ссылку" was opened by mistake and nothing was typed yet.
          onKeyDown={(e) => { if (e.key === "Escape" && source && !url) { e.preventDefault(); setShowSourceForm(false); } }}
          // A pasted store link starts the calculation at once: no second tap on "Рассчитать", and the store is asked
          // while the customer would still be reaching for the button. Anything else pastes as usual.
          onPaste={(e) => {
            const text = e.clipboardData.getData('text').trim();
            try { validateSource(text); } catch { return; }
            e.preventDefault();
            forgetLastDraft(browserStorage()); setResumedFrom(''); setFormIssue(''); setLinkError(''); setUrl(text); setSource(''); setSourceCheckStatus('idle');
            openLink(text);
          }}
          placeholder={lc.placeholder}
        /><PasteButton targetId="source-url" locale={lang} disabled={busy} ready={clip.ready && !source} onPaste={text => {
          clip.used();
          forgetLastDraft(browserStorage()); setResumedFrom(''); setFormIssue(''); setLinkError(''); setUrl(text); setSource(''); setSourceCheckStatus('idle'); setShowSourceForm(true);
          // The "Вставить" button is the same intent: a valid store link is opened right away.
          try { validateSource(text); openLink(text); } catch { /* not a link: it stays in the field */ }
        }}/></span>
        <button className="btn primary lo-link-submit" disabled={busy}>{busy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : null}{busy ? c.get : lc.calculate}</button>
      </form>}
      {(showSourceForm || (!requestedUrl && resumeChecked)) && linkError && <p id="source-url-error" className="basket-consent-error" role="alert">{linkError}</p>}
      {(showSourceForm || (!requestedUrl && resumeChecked)) && !source && !busy && <><div className="lo-hints"><p>{lc.hint}</p><div className="home-hero-links"><Link href="/batch-import">{lc.batch}</Link></div></div>
        {/* Unfinished items from this device: back to the choice in one tap; the total is worked out again there. */}
        {recentDrafts.length > 0 && <section className="lo-recent" aria-labelledby="lo-recent-title">
          <h2 id="lo-recent-title">{lc.recent.title}</h2>
          <ul>{recentDrafts.map(draft => {
            const host = (() => { try { return new URL(draft.source).hostname.replace(/^www[.]/, ""); } catch { return ""; } })();
            return <li key={draftKeyFor(draft)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a 48 px store photo through sizedImage, as elsewhere on this page */}
              {draft.image ? <img src={sizedImage(draft.image, 96)} alt="" width={48} height={48} loading="lazy" decoding="async" onError={event => { retryOriginal(event.currentTarget, draft.image); }} /> : <span className="lo-recent-photo" aria-hidden="true"><Link2 size={18} /></span>}
              <span className="lo-recent-copy"><b>{draft.name}</b><small>{host}</small></span>
              <Link className="btn secondary lo-recent-go" href={draftAddress(draft)} aria-label={`${lc.recent.continue}: ${draft.name}`}><span className="lo-recent-go-text">{lc.recent.continue}</span><ArrowRight size={16} aria-hidden="true" /></Link>
            </li>;
          })}</ul>
        </section>}
        {/* Before a link: where to take one (stores that work, the way in three steps) beside the blank bill. */}
        <div className="lo-empty">
          <section className="lo-where" aria-labelledby="lo-where-title">
            <h2 id="lo-where-title">{lc.where.title}</h2>
            <ul className="lo-where-stores">{heroStores.map(store => <li key={store.key}><a href={storefrontUrl(store)} target="_blank" rel="noopener noreferrer"><StoreLogo brand={store} size={20} />{store.name}<span className="sr-only"> ({lc.openStore})</span></a></li>)}<li><Link className="lo-where-all" href="/stores">{lc.where.all(storeBrands.length)}</Link></li></ul>
            <ol className="lo-where-steps">{lc.where.steps.map(step => <li key={step}>{step}</li>)}</ol>
          </section>
          <BlankBill pricing={pricing} locale={lang}/>
        </div></>}

      {(isSourcedFlow || source) && !showSourceForm && <div className="lo-source" aria-live="polite">
        {source && !checking
          ? <a className="lo-source-host" href={source} target="_blank" rel="noopener noreferrer" title={source}><Link2 size={16} aria-hidden="true" /><span>{sourceShort}</span><ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> ({lc.openStore})</span></a>
          : <span className="lo-source-host"><Link2 size={16} aria-hidden="true" /><span>{sourceShort}</span></span>}
        {/* The check itself is told in the card below; here only the way back to another link, once it is done. */}
        {/* Rendered while the store is read too, only hidden: the row keeps its height, so the card below does not jump
            down when the check ends (mobile CLS, 26 October 2026). */}
        <span className={"lo-source-actions" + (checking ? " is-waiting" : "")} aria-hidden={checking || undefined} inert={checking || undefined}>
          <button type="button" className="lo-source-link" onClick={editLink}>{lc.change}</button>
          <button type="button" className="lo-source-link" title={lc.replaceHint} onClick={() => void replaceLink()}><ClipboardPaste size={15} aria-hidden="true" />{lc.replace}</button>
        </span>
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
      {note && !source && <div className="notice" role="status"><p>{note}</p></div>}
      {source && !checking && sourceCheckStatus==='failed' && <div className={"notice" + (soldOutAtStore ? " lo-sold-out" : "")} role="status">
        <p>{soldOutAtStore
          ? tx('Нет в наличии в магазине: сейчас магазин не продаёт ни один вариант по этой ссылке. Проверьте позже или выберите другой товар.','Do‘konda mavjud emas: hozir bu havoladagi birorta variant ham sotuvda yo‘q. Keyinroq tekshiring yoki boshqa tovar tanlang.','Out of stock at the store: none of the options at this link is on sale right now. Check again later or choose another item.')
          : tx('Магазин пока не предоставил проверяемую цену или варианты. Повторите автоматическую загрузку позже.','Do‘kon hozircha tekshiriladigan narx yoki variantlarni bermadi. Avtomatik yuklashni keyinroq takrorlang.','The store has not supplied a verifiable price or options yet. Retry automatic import later.')}</p>
        <button type="button" className="btn secondary" onClick={()=>void load(source)}>{soldOutAtStore ? tx('Проверить снова','Qayta tekshirish','Check again') : tx('Повторить автозагрузку','Avtomatik yuklashni takrorlash','Retry automatic import')}</button>
      </div>}

      {source && !checking && sourceCheckStatus==='manual' && <div className="notice lo-manual-store" role="status">
        <p>{tx('Atlas не получает данные этого товара автоматически. Откройте товар на сайте магазина и впишите название, цену, вариант и доставку сами — оператор Atlas сверит их перед выкупом.','Atlas bu tovar ma’lumotlarini avtomatik olmaydi. Tovarni do‘kon saytida oching va nomi, narxi, varianti va yetkazishni o‘zingiz kiriting — Atlas operatori xariddan oldin ularni solishtiradi.','Atlas does not get this item\'s details automatically. Open the item on the store\'s site and enter the name, price, option and shipping yourself — an Atlas operator checks them before buying.')}</p>
        <a className="btn secondary" href={source} target="_blank" rel="noopener noreferrer">{tx('Открыть товар в магазине','Tovarni do‘konda ochish','Open the item in the store')}<ExternalLink size={14} aria-hidden="true" /></a>
      </div>}

      {(source || checking) && (
        <form
          id="link-order-form"
          className={"lo-layout link-order-data-form" + (checking ? " is-checking" : " is-ready") + (manualLayout && !checking ? " manual" : "")}
          noValidate
          aria-busy={checking}
          onChangeCapture={() => setFormIssue("")}
          onSubmit={async (e) => {
            e.preventDefault();
            if (checking) return;
            try {
              if(!orderable){
                const message=tx('Загрузка ещё не завершилась. Дождитесь результата или вставьте ссылку повторно.','Yuklash hali tugamadi. Natijani kuting yoki havolani qayta kiriting.','Import has not finished. Wait for the result or enter the link again.');
                setFormIssue(message);toast.error(message);return;
              }
              // Enter in a field while nothing is on sale: the same honest words as the inactive button.
              if(nothingToChoose){setFormIssue(noStockText);return;}
              const missing=[
                {id:'name',invalid:!name.trim(),message:tx('Введите название товара.','Tovar nomini kiriting.','Enter the item name.')},
                {id:'variant',invalid:!picks.length,message:tx('Выберите или укажите цвет, размер либо модель.','Rang, o‘lcham yoki modelni tanlang yoki kiriting.','Choose or enter a color, size, or model.')},
                {id:'variant',invalid:picks.some(([label,quantity])=>{const left=pickedVariant(label)?.quantity;return left!==undefined&&quantity>left}),message:tx('Для одного из вариантов выбрано больше, чем осталось у магазина.','Variantlardan biri uchun do‘konda qolganidan ko‘p tanlangan.','One option is chosen in a larger quantity than the store has left.')},
                {id:'other-country',invalid:country==='Другая страна'&&!otherCountry.trim(),message:tx('Укажите страну фактической отправки.','Haqiqiy jo‘natish mamlakatini kiriting.','Enter the actual dispatch country.')},
                {id:'amount',invalid:picks.length?picks.some(([label])=>!(priceOf(label)>0)):!(Number(amount)>0),message:tx('Укажите цену товара больше нуля.','Tovar narxini noldan katta kiriting.','Enter an item price greater than zero.')},
                {id:'shipping',invalid:!shippingFree&&!shippingTyped,message:tx('Укажите доставку магазина до склада Atlas; 0 — только если она бесплатная.','Do‘kondan Atlas omborigacha yetkazishni kiriting; 0 faqat bepul bo‘lsa.','Enter store-to-Atlas shipping; use 0 only when it is free.')},
                {id:'weight',invalid:validBoxedWeight(weight)===undefined,message:tx('Укажите вес товара с коробкой от 0,01 до 49,5 кг.','Qadoq bilan vaznni 0,01–49,5 kg oralig‘ida kiriting.','Enter boxed weight from 0.01 to 49.5 kg.')},
                {id:'manual-confirm',invalid:sourceCheckStatus==='manual'&&!manualConfirmed,message:tx('Подтвердите, что сверили название, цену, вариант и доставку со страницей магазина.','Nomi, narxi, varianti va yetkazishni do‘kon sahifasi bilan solishtirganingizni tasdiqlang.','Confirm that you checked the name, price, option and shipping against the store page.')},
              ].find(field=>field.invalid);
              if(missing){
                setFormIssue(missing.message);setIssueField({id:missing.id,message:missing.message});
                const lockOf:Record<string,keyof LockFields>={name:'name',amount:'price',shipping:'shipping','other-country':'country',weight:'weight'};
                const lockedField=lockOf[missing.id];
                if(lockedField&&locks[lockedField])setUnlocked(current=>({...current,[lockedField]:true}));
                // Fields folded under "Calculation details" must be visible before they can take focus.
                if(['name','other-country','amount','shipping','weight'].includes(missing.id))setDataOpen(true);
                // An option still to choose: its step, whichever copy of it is on screen (colours sit beside the photo on wide screens).
                if(missing.id==='variant'){focusChoice();return;}
                window.setTimeout(()=>{
                  const target=window.document.getElementById(missing.id);
                  target?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
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
                id: variantSourceUrl(source,option) + "#" + label,
                sourceUrl: variantSourceUrl(source,option),
                usd: toUsd(priceOf(label), currency, pricing.rates),
                image: photo,
                sourceImages: variantGallery(option,colorwayImages,source).length?variantGallery(option,colorwayImages,source):dedupeSafeImages([photo,...(!option?.color?images:[])],source,12),
                sourceVariantId: option?.id,
                sourceProductId:option?.productId,sourceSellerId:option?.sellerId,sourceOfferId:option?.offerId,sourceColorId:option?.colorId,sourceOptions:option?.options,
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
                // Only for a store Atlas does not read: the server then takes the customer's confirmed details (lib/importer/manual-fallback.ts).
                sourceManuallyConfirmed:sourceCheckStatus==='manual'&&manualConfirmed,
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
                if (canKeep && !savePendingCartAdd(browserStorage(), { action, returnTo: here, draftKey })) {
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
            {image ? <div className="lo-gallery"><ProductGallery product={previewProduct} images={images.length?images:[image]} activeImage={image} onImageChange={setImage} locale={lang} compact/></div>
              : checking && <div className="lo-gallery lo-skel lo-skel-photo" aria-hidden="true" />}
            <div className="lo-product-copy">
              {brand || sourceHost || !checking
                ? <p className="basket-brand">{[brand, sourceHost && brand !== sourceHost ? sourceHost : ""].filter(Boolean).join(" · ")}</p>
                : <span className="lo-skel lo-skel-brand" aria-hidden="true" />}
              <div className="lo-name-row">
              <h2 id="lo-product-name">{name || (checking ? <><span className="sr-only">{c.get}</span><span className="lo-skel lo-skel-title" aria-hidden="true" /></> : sourceCheckStatus === "manual" ? tx('Впишите данные товара','Tovar ma’lumotlarini kiriting','Enter the item details') : sourceCheckStatus === "failed" ? tx('Данные товара пока недоступны','Tovar ma’lumotlari hozircha mavjud emas','Item details are not available yet') : c.empty)}</h2>
              {favoriteId && <button type="button" className={"find-save lo-save" + (favoriteSaved ? " saved" : "")} aria-pressed={favoriteSaved} aria-label={favoriteSaved ? dc.remove : dc.save} title={favoriteSaved ? dc.remove : dc.save} disabled={favoriteBusy} onClick={() => void toggleFavorite()}><Heart size={20} aria-hidden="true" /></button>}
              </div>
              {checking && <LoadStage url={requestedUrl || url} locale={lang} />}
              {checking
                ? <p className="lo-store-price">{lc.storePrice}: <span className="lo-skel lo-skel-price" aria-hidden="true" /></p>
                : sourceCheckStatus === "manual" && !(Number(amount) > 0) ? null : <p className="lo-store-price lo-reveal">{lc.storePrice}: <b>{storePriceText}</b>{discount && <WasPrice was={discount.was} percent={discount.percent} format={sourceFormat} />}</p>}
              {/* Its own quiet line with a tick: as a tail after the price it wrapped alone, starting with "·", on phones (owner, 27 October 2026). */}
              {!checking && sourceCheckStatus === "verified" && checkedTime && <p className="lo-checked"><Check size={14} aria-hidden="true" />{lc.checkedAt(checkedTime)}</p>}
              {!checking && sourceCheckStatus === "failed" && <p className="lo-note warn" role="status"><AlertCircle size={16} aria-hidden="true" />{soldOutAtStore ? soldOutText : tx('Автоматическая проверка не завершена. Сохранённые данные предварительные.','Avtomatik tekshirish tugamadi. Saqlangan ma’lumotlar taxminiy.','Automatic verification is incomplete. Saved details are preliminary.')}</p>}
              {!checking && orderable && variants.length > 1 && variantColors.length > 1 && <div className="variant-step lo-colours-aside"><div><b>{c.color}</b><span>{colourHeading}</span></div>{colourOptions}</div>}
              {/* Wide screens: what Atlas read from the store, beside the photo, so the card has no empty half
                  (owner, 26 October 2026). Phones keep it in the "Calculation data" card only. */}
              {!checking && orderable && dataMode !== "manual" && <dl className="lo-store-facts">
                {countryText && <div><dt>{tx('Отправка из','Jo‘natish joyi','Ships from')}</dt><dd>{countryText}</dd></div>}
                {validBoxedWeight(weight) !== undefined && <div><dt>{tx('Вес для расчёта','Hisob uchun og‘irlik','Weight for the estimate')}</dt><dd>{formatKg(validBoxedWeight(weight)!, lang)} {lc.kg}</dd></div>}
                <div><dt>{tx('Доставка магазина','Do‘kon yetkazishi','Store delivery')}</dt><dd>{lockedShippingText}</dd></div>
                <div><dt>{tx('Наличие','Mavjudlik','Stock')}</dt><dd>{variants.some(item => item.quantity !== undefined || item.quantityMoreThan !== undefined) ? tx('Магазин сообщает остаток по вариантам','Do‘kon variantlar bo‘yicha qoldiqni ko‘rsatadi','The store shows stock per option') : k.stockUnknown}</dd></div>
                {/* "Price checked" is not repeated here: the line under the price already says it (29 October 2026). */}
                {(source || url) && <div className="lo-store-facts-link"><a className="lo-source-link" href={source || url} target="_blank" rel="noopener noreferrer">{c.original}<ExternalLink size={14} aria-hidden="true" /></a></div>}
              </dl>}
            </div>

          {/* The choice sits inside the item card, across its full width under the photo and colours (owner, 12 October 2026). */}
          {checking ? <StoreCheck host={(() => { try { return new URL(source || url).hostname.replace(/^www\./, ""); } catch { return ""; } })()} locale={lang} /> : orderable && <section className="lo-card lo-variant">
            <div className="field variant-matrix" data-order-variant tabIndex={-1}>
              <label htmlFor="variant">{c.variant}</label>
              {variants.length===1 ? <div className="single-variant-selection lo-single-option">
                <span><small>{k.onlyOption}</small><b>{variants[0].label==='Выбранный вариант'||variants[0].label==='Объявление eBay'?name||variants[0].label:variantColors.length===1&&!variants[0].size?describeSingleColorway(variantColors[0]).primary:variants[0].label}</b>{stockText(variants[0],k)&&<em className="lo-stock">{stockText(variants[0],k)}</em>}</span>
                <Stepper value={picked[variants[0].label]??1} max={maxFor(variants[0])} label={k.quantity} k={k} onChange={value=>setPickQuantity(variants[0].label,value)}/>
                <input id="variant" value={variant} readOnly required className="sr-only" aria-label={c.variant}/>
              </div> : variants.length && (variantColors.length||variantSizes.length) ? <>
                {variantColors.length>0&&<div className={"variant-step"+(variantColors.length>1?" lo-colours-main":"")}><div><b>{variantColors.length===1?tx('Расцветка по ссылке','Havoladagi rang','Linked colorway'):c.color}</b>{variantColors.length!==1&&<span>{colourHeading}</span>}</div>{variantColors.length===1?<><div className="single-variant-selection"><span>{describeSingleColorway(variantColors[0]).primary}</span><small>{tx('Одна расцветка по этой ссылке','Bu havolada bitta rang varianti','One colorway in this link')}</small></div><p className="single-colorway-note">{tx('Для другого цвета нужна ссылка на соответствующий артикул магазина.','Boshqa rang uchun do‘kondagi tegishli artikl havolasi kerak.','Another color requires a link to its separate store item.')}</p><details className="single-colorway-source"><summary>{tx('Полное название расцветки в магазине','Do‘kondagi rangning to‘liq nomi','Full store colorway name')}</summary><span>{variantColors[0]}</span></details></>:colourOptions}</div>}
                {(variantColors.length===0||selectedColor)&&!complexVariants&&variantSizes.length>0&&<div className="variant-step"><div><b>{variantSizeLabel||c.size}</b><span>{selectedSize?(sizeDisplay(selectedSize)):sizeStep?c.selectSize:c.selectVariant}</span></div>{(adidasSizes||nikeSizeSystem)&&<div className="variant-options lo-size-formats" role="group" aria-label={tx("Формат размера","O‘lcham formati","Size format")}><span className="lo-size-seg">{(["us","eu","uk","cm"] as const).map(format=><button type="button" key={format} aria-pressed={sizeFormat===format} onClick={()=>setSizeFormat(format)}>{format==="cm"?tx("СМ","SM","CM"):format.toUpperCase()}</button>)}</span>{nikeSizeSystem&&<button type="button" className="lo-size-help" aria-expanded={sizeChartOpen} aria-controls="nike-size-chart" aria-label={tx('Официальная таблица Nike: US → EU, UK и см','Rasmiy Nike jadvali: US → EU, UK va sm','Official Nike chart: US → EU, UK and cm')} title={tx('Таблица размеров Nike','Nike o‘lcham jadvali','Nike size chart')} onClick={()=>setSizeChartOpen(open=>!open)}><CircleHelp size={18} aria-hidden="true"/></button>}{adidasSizes&&<a className="lo-size-chart" href="https://www.adidas.com/us/help/size_charts/men-shoes" target="_blank" rel="noopener noreferrer">{tx("Таблица adidas","adidas jadvali","adidas chart")}<ExternalLink size={13} aria-hidden="true"/></a>}{sizeFormat==="cm"&&<small>{adidasSizes?tx("Длина стопы, см","Oyoq uzunligi, sm","Foot length, cm"):tx("CM/JP по таблице Nike","Nike jadvali bo‘yicha CM/JP","CM/JP by Nike's chart")}</small>}</div>}<div className="variant-options sizes">{variantSizes.map(size=>{const choices=variantsForColor.filter(item=>item.size===size),choice=choices[0],price=choice?.price;return <button type="button" key={size} aria-pressed={Boolean(choice&&picked[choice.label])} disabled={!choice||!choice.available||choice.quantity===0} aria-label={!choice||!choice.available||choice.quantity===0?`${sizeDisplay(size)} — ${k.outOfStock}`:undefined} onClick={()=>choice&&togglePick(choice)}><span>{sizeDisplay(size)}</span>{choice&&price!==undefined&&sizePricesDiffer&&<small>{sourceFormat(price)}</small>}{choice?.quantity!==undefined&&choice.quantity<=5&&<small className="lo-stock">{choice.quantity?k.stockLeft(choice.quantity):k.outOfStock}</small>}</button>})}</div>{nikeSizeSystem&&sizeChartOpen&&<div className="nike-size-guide" id="nike-size-chart">
                  {selectedNikeSize&&<p className="nike-selected-size">{tx('Выбранный размер','Tanlangan o‘lcham','Selected size')}: <strong>US {selectedNikeSize.us}</strong><span>EU {selectedNikeSize.eu}</span><span>UK {selectedNikeSize.uk}</span><span>CM/JP {selectedNikeSize.cmLabel}</span><span>{tx('Стопа','Oyoq','Foot')} {selectedNikeSize.footLengthCm===undefined?'—':selectedNikeSize.footLengthCm} {tx('см','sm','cm')}</span></p>}
                  <div className="nike-size-chart"><b>{tx('Официальная таблица Nike: US → EU, UK и см','Rasmiy Nike jadvali: US → EU, UK va sm','Official Nike chart: US → EU, UK and cm')}</b>
                    <p>{tx('Показаны размеры, найденные для этого товара. CM/JP — маркировка обуви Nike; длина стопы указана отдельно.','Bu tovar uchun topilgan o‘lchamlar ko‘rsatilgan. CM/JP — Nike poyabzali yorlig‘i; oyoq uzunligi alohida berilgan.','Shows sizes found for this item. CM/JP is Nike’s shoe-label size; foot length is listed separately.')}</p>
                    <div className="nike-size-chart-scroll" role="region" aria-label={tx('Таблица размеров Nike с прокруткой','Nike o‘lcham jadvali','Nike size chart')} tabIndex={0}><table><thead><tr><th scope="col">US</th><th scope="col">UK</th><th scope="col">EU</th><th scope="col">CM/JP</th><th scope="col">{tx('Стопа, см','Oyoq, sm','Foot, cm')}</th></tr></thead><tbody>{nikeSizeRows.map(row=><tr key={row.us}><th scope="row">{row.us}</th><td>{row.uk}</td><td>{row.eu}</td><td>{row.cmLabel}</td><td>{row.footLengthCm===undefined?'—':row.footLengthCm}</td></tr>)}</tbody></table></div>
                    <a className="nike-size-source" href={`https://www.nike.com/size-fit/${nikeSizeSystem==='women'?'womens':'mens'}-footwear`} target="_blank" rel="noopener noreferrer">{tx('Полная таблица на сайте Nike','To‘liq jadval Nike saytida','Full chart on Nike')} <ExternalLink size={13}/></a>
                  </div>
                </div>}</div>}
                {complexVariants&&variantsForColor.length>0&&<OptionChips format={sourceFormat} variants={variantsForColor} picked={picked} k={k} onToggle={togglePick}/>}
                {!complexVariants&&!variantColors.length&&!variantSizes.length&&<OptionChips format={sourceFormat} variants={variants} picked={picked} k={k} onToggle={togglePick}/>}
                <input id="variant" value={variant} readOnly required className="sr-only" aria-label={c.variant}/>
              </> : variants.length ? <OptionChips format={sourceFormat} variants={variants} picked={picked} k={k} onToggle={togglePick}/> : (
                <div className="lo-manual-option"><input id="variant" required maxLength={80} value={variant} aria-label={k.optionLabel} onChange={(e) => {setVariant(e.target.value);setChoiceNote("");setAdded(null)}} placeholder={k.optionPlaceholder}/><Stepper value={manualQuantity} max={10} label={k.quantity} k={k} onChange={setManualQuantity}/></div>
              )}
            </div>
            {goneOptions.length > 0 && <p className="lo-note warn" role="status"><AlertCircle size={16} aria-hidden="true" />{lc.optionGone(goneOptions)}</p>}
            {choiceNote && <p className="lo-note warn" role="status"><AlertCircle size={16} aria-hidden="true" />{choiceNote}</p>}
            {variants.length > 1 && <>
              <div className="lo-pick-mode">
                {/* One option is the default and needs no sentence; the hint shows only in the "several" mode (27 October 2026). */}
                {manyMode && <p className="lo-hint-line">{k.chooseOptions}</p>}
                <button type="button" className="lo-source-link" aria-pressed={manyMode} onClick={() => {
                  setFormIssue("");
                  if (!manyMode) { setMultiPick(true); return; }
                  // Back to one: the option touched last stays, with one piece.
                  setMultiPick(false);
                  setPicked(current => { const last = Object.keys(current).at(-1); return last ? { [last]: 1 } : {}; });
                }}>{!manyMode && <Plus size={16} aria-hidden="true"/>}{manyMode ? k.pickOne : k.pickMany}</button>
              </div>
              {/* The choice shows below even when it is one option, with a tick, so it is clear what is chosen; the
                  quantity appears in the "several" mode (owner, 12 October 2026). */}
              {picks.length > 0 && <ul className={"lo-picks" + (manyMode ? "" : " single")} aria-label={k.chosen}>{picks.map(([label, quantity]) => {
                const option = pickedVariant(label);
                const optionPrice = option?.price ?? Number(amount);
                const shown = option?.size ? [option.color ? colourName(option.color) : "", sizeDisplay(option.size)].filter(Boolean).join(" · ") : label;
                return <li key={label}>
                  <Check className="lo-pick-tick" size={18} aria-hidden="true"/>
                  <span className="lo-pick-label"><b>{shown}</b><small>{[Number.isFinite(optionPrice) && optionPrice > 0 ? sourceFormat(optionPrice) : "", stockText(option, k)].filter(Boolean).join(" · ")}</small></span>
                  {manyMode && <Stepper value={quantity} max={maxFor(option)} label={`${k.quantity}: ${label}`} k={k} onChange={value => setPickQuantity(label, value)}/>}
                  <button type="button" className="lo-pick-remove" aria-label={`${k.removeOption}: ${label}`} onClick={() => { setFormIssue(""); setAdded(null); setPicked(current => { const next = { ...current }; delete next[label]; return next; }); }}><X size={16} aria-hidden="true"/></button>
                </li>;
              })}</ul>}
            </>}
            {variants.length > 0 && !variants.some(item => item.quantity !== undefined || item.quantityMoreThan !== undefined) && <p className="lo-hint-line muted lo-stock-hint">{variants.some(isStockUnconfirmed) ? k.stockCheckFirst : k.stockUnknown}</p>}
            {/* The comment sits right under the chosen options (owner, 12 October 2026). */}
            <div className="lo-comment">
              <label htmlFor="order-comment"><b>{k.blocks.comment}</b><small>{k.commentHint}</small></label>
              <textarea id="order-comment" rows={2} maxLength={500} value={comment} placeholder={k.commentPlaceholder} onChange={(e) => setComment(e.target.value)} />
            </div>
          </section>}
          </section>
          </div>

          {!checking && orderable && manualLayout && finishSheet()}
          {/* The right column on wide screens: total, item data and the add button, in this order for the eye, Tab and
              screen readers; it stays in view while the long item card scrolls (on phones it is one column, as before). */}
          <div className="lo-side" ref={sideRef}>
          {/* The bill in a folder: the sheet is the amount to pay, the slip holds the hold and customs that stay outside it. */}
          <div className="lo-sheet lo-sheet-bill">
          <aside className="lo-summary basket-summary folio" aria-labelledby="lo-summary-title">
            <div className="folio-sheet">
              <h2 id="lo-summary-title">{lc.total}</h2>
              {checking ? <BillPlaceholder /> : previewSums && !nothingToChoose ? <>
                {speedLine}
                <CalcLines sums={previewSums} locale={lang} pricing={pricing} weightKg={previewWeight} storeShippingState={storeShippingState} speed={previewSpeed}/>
                <div className="basket-total bill-total"><span>{units > 1 ? `${k.lines.total} (${units} ${lang === "en" ? "pcs" : isUzbek(lang) ? uzText(lang, "dona") : "шт."})` : k.lines.total}</span><strong><Money value={previewSums.total} locale={lang}/></strong></div>
                {/* The allowance in two lines; "Atlas pays customs for me" is chosen in the cart, for the whole order. */}
                {customsPreview && <CustomsPanel estimate={customsPreview} choices={{ outsideUsed: false, help: false }} locale={lang} pricing={pricing} profiles={primaryProfile ? [primaryProfile] : []} compact/>}
              </> : fromSums ? <>
                {speedLine}
                {/* "From" sits in the label, not in the amount, so the amount is never cut on a phone. */}
                <div className="basket-total bill-total lo-from-total"><span>{lc.fromLabel}</span><strong><Money value={fromSums.total} locale={lang}/></strong></div>
                <p className="micro lo-from-note">{lc.fromNote}</p>
              </> : <p className="cabinet-empty">{soldOutAtStore || nothingToChoose ? noStockText : picks.length ? lc.emptyTotal : sourceCheckStatus === "manual" && !variants.length ? lc.manualTotal : tx("Выберите вариант, и мы покажем итог.", "Variantni tanlang, jamini ko‘rsatamiz.", "Choose an option to see the total.")}</p>}
            </div>
            {!checking && !nothingToChoose && previewSums && previewSums.storeShippingHold > 0 && <section className="folio-outside" aria-labelledby="lo-outside-title">
              <h3 id="lo-outside-title">{k.outside}</h3>
              <HoldNote amount={previewSums.storeShippingHold} locale={lang} pricing={pricing}/>
            </section>}
          </aside>
          </div>
          {!checking && orderable && !manualLayout && finishSheet()}
          {/* The add button sits under the total and the item data: the right column holds the decision (owner, 12 October 2026). */}
          {!checking && orderable && <section className="lo-card lo-confirm">
            {formIssue && <p id="link-form-issue" className="basket-consent-error" role="alert">{formIssue}</p>}
            {sourceCheckStatus==='manual' ? <div className={"basket-consent" + (formIssue && !manualConfirmed ? " invalid" : "")}>
              <input id="manual-confirm" type="checkbox" {...issueProps('manual-confirm')} checked={manualConfirmed} onChange={(e) => { setManualConfirmed(e.target.checked); if (e.target.checked) setFormIssue(""); }} />
              <label htmlFor="manual-confirm">{tx('Я сверил название, цену, вариант и доставку со страницей магазина. Оператор Atlas сверит их с магазином перед выкупом.','Nomi, narxi, varianti va yetkazishni do‘kon sahifasi bilan solishtirdim. Atlas operatori xariddan oldin ularni do‘kon bilan solishtiradi.','I checked the name, price, option and shipping against the store page. An Atlas operator checks them with the store before buying.')}</label>
            </div> : sourceCheckStatus !== "verified" ? <p className="micro" role="status">{tx("Atlas автоматически сверит цену, валюту и выбранный вариант перед добавлением в корзину.","Atlas savatga qo‘shishdan oldin narx, valyuta va tanlangan variantni avtomatik tekshiradi.","Atlas automatically checks the price, currency and selected option before adding it to your cart.")}</p> : null}
            <div className={"lo-cta-row" + (cartUnits ? " has-cart" : "")}>
            {nothingToChoose ? <button type="button" className="btn primary basket-cta" disabled>{noStockText}</button> : needsChoice ? <button type="button" className="btn primary basket-cta" onClick={focusChoice}>{nextChoiceText}<ArrowRight size={18} aria-hidden="true" /></button> : <button className="btn primary basket-cta" disabled={addBusy || status==='loading'}>{(addBusy || status==='loading') && <Loader2 className="spin" size={18} aria-hidden="true" />}{pendingAdd.sending ? lc.pending.sending : adding ? c.adding : isGuest ? (canKeep ? lc.signinAdd : lc.signinContinue) : k.addOptions(Math.max(1, picks.length), Math.max(1, units))}{!addBusy && status!=='loading' && <ArrowRight size={18} aria-hidden="true" />}</button>}
            {cartUnits > 0 && <CartEntry count={cartUnits} label={cartLabel} compact />}
            </div>
            {/* For a guest, right under the button it explains: the item goes to the cart by itself after sign-in. */}
            {isGuest && <p className="lo-guest"><LogIn size={16} aria-hidden="true" /><span>{canKeep ? lc.guest : lc.guestNoKeep}</span></p>}
            <ul className="basket-assurance"><li><ShieldCheck size={16} aria-hidden="true" />{cc.summary.assurance}</li>{/* Said once: "checked at HH:MM" by the price at the top, or "will check" above the button until then. */}{sourceCheckStatus === "manual" ? <li><Info size={16} aria-hidden="true" />{tx("Данные введены вами по странице магазина.","Ma’lumotlarni do‘kon sahifasi bo‘yicha o‘zingiz kiritdingiz.","You entered the details from the store page.")}</li> : sourceCheckStatus === "verified" && !checkedTime ? <li><ShieldCheck size={16} aria-hidden="true" />{checkedText}</li> : null}</ul>
          </section>}
          </div>
        </form>
      )}

      {/* On phones the total bar stays put through the check, so the page does not jump when the price arrives. */}
      {(source || checking) && <div className={"basket-sticky lo-sticky" + (isGuest ? " guest" : "")} role="region" aria-label={lc.total}>
        <div><span>{!checking && !previewSums && fromSums ? lc.fromLabel : k.lines.total}</span><strong>{checking ? <span className="lo-skel lo-skel-sum" aria-hidden="true" /> : previewSums && !nothingToChoose ? formatSum(previewSums.total, lang) : fromSums ? formatSum(fromSums.total, lang) : "—"}</strong></div>
        {nothingToChoose || soldOutAtStore ? <button type="button" className="btn primary" disabled>{noStockText}</button> : needsChoice ? <button type="button" className="btn primary" onClick={focusChoice}>{nextChoiceText}<ArrowRight size={18} aria-hidden="true" /></button> : <button type="submit" form="link-order-form" className="btn primary" disabled={checking || !orderable || addBusy || status==='loading'}>{(checking || addBusy || status==='loading') && <Loader2 className="spin" size={18} aria-hidden="true" />}{checking ? tx("Проверяем…", "Tekshiryapmiz…", "Checking…") : addBusy ? c.adding : isGuest ? (canKeep ? lc.signinAddShort : lc.signinContinue) : lc.addShort}{!checking && !addBusy && status!=='loading' && <ArrowRight size={18} aria-hidden="true" />}</button>}
        {cartUnits > 0 && <CartEntry count={cartUnits} label={cartLabel} compact />}
      </div>}
    </div>
  );
}


/** While the store is being read: what is happening now, by elapsed time, with the store's name; a slow store says so
 *  instead of leaving the grey outline silent. Announced politely; gone as soon as the product is in. */
function LoadStage({ url, locale }: { url: string; locale: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - started), 500);
    return () => window.clearInterval(timer);
  }, [url]);
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\d*\./, ''); } catch { /* no address yet */ }
  const t = (ru: string, uz: string, en: string) => locale === 'ru' ? ru : locale === 'en' ? en : uzText(locale as Locale, uz);
  const text = elapsed < 1500 ? t(`Открываем страницу ${host || 'магазина'}…`, `${host || 'Do‘kon'} sahifasini ochyapmiz…`, `Opening ${host || 'the store'}…`)
    : elapsed < 4000 ? t('Читаем цену, варианты и фото…', 'Narx, variantlar va suratlarni o‘qiyapmiz…', 'Reading the price, options and photos…')
    : elapsed < 9000 ? t('Магазин отвечает медленно — ещё несколько секунд', 'Do‘kon sekin javob bermoqda — yana bir necha soniya', 'The store is slow to answer — a few more seconds')
    : t('Почти готово: последняя проверка', 'Deyarli tayyor: oxirgi tekshiruv', 'Almost there: one last check');
  return <p className="lo-load-stage" role="status" aria-live="polite"><Loader2 className="spin" size={14} aria-hidden="true" />{text}</p>;
}
