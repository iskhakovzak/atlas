"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Check, ExternalLink, Info, Link2, Loader2, Minus, Plus, ShieldCheck, ShoppingBag, X } from "lucide-react";
import Link from "@/components/site-link";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarket } from "@/lib/market/store";
import { signInPath } from "@/lib/market/access";
import { catalogOrderVariants } from "@/lib/market/catalog";
import { catalogLinkSeed, catalogLinkPrice, catalogLinkWeight } from "@/lib/market/link-order-context";
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
import { Choice, WasPrice } from "./market-ui";
import { formatSum } from "@/lib/market/home-copy";
import { cartCopy, countryLabel, linkOrderCopy } from "@/lib/market/customer-copy";
import { ProductGallery } from "./product-gallery";
import {
  communityDeals,
  communityEstimatedWeight,
  communityFallbackOptions,
  communityProductCategory,
  hasSelectableDimensions,
} from "@/lib/market/community-deals";

type LinkOrderDraftSnapshot={
  url:string;source:string;name:string;brand:string;declaration:string;currency:string;amount:string;shipping:string;shippingCurrency:string;shippingEstimated:boolean;weight:string;country:string;otherCountry:string;category:string;variant:string;variants:ProductVariant[];selectedColor:string;selectedSize:string;image:string;images:string[];colorwayImages?:ProductColorwayGallery[];showSourceForm:boolean;note:string;weightOrigin:string;verified:boolean;sourceCheckStatus:'idle'|'checking'|'verified'|'failed';importedAt?:number;sourceExpiresAt?:number;foundShipping:{amount:number;currency:string;destination?:string}|null;
};
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
function displayCategoryName(value:string,locale:string){
  const canonical=canonicalCategory(value);
  if(locale==='ru')return canonical;
  const labels=locale==='uz'
    ? {'Обувь':'Oyoq kiyim','Одежда':'Kiyim','Электроника':'Elektronika','Аксессуары':'Aksessuarlar','Красота и уход':'Go‘zallik va parvarish','Дом и быт':'Uy va maishiy','Спорт':'Sport','Другое':'Boshqa'}
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

export function GlobalLinkOrder() {
  const { ready, status, pricing, state, act, lastActionError, catalogProducts, loadCatalog } = useMarket();
  // Express by default; a cart that already chose standard keeps it, since the added line inherits the cart's speed.
  const [previewSpeed, setPreviewSpeed] = useState<DeliverySpeed>("express");
  const speedTouched = useRef(false);
  const cartSpeed = cartDeliverySpeed(state.cart);
  useEffect(() => { if (ready && !speedTouched.current) setPreviewSpeed(cartSpeed); }, [ready, cartSpeed]);
  const lang=state.communication.language;
  const freeFrom=`$${pricing.storeShippingFreeFromUsd??50}`;
  const c=lang==='ru'?{over:'ПОКУПКИ СО ВСЕГО МИРА',choose:'Выберите свой вариант',order:'Заказ по ссылке',checkPrice:'Проверьте размер и цену перед добавлением.',paste:'Вставьте ссылку — Atlas заполнит доступные данные.',loading:'Загружаем цену и варианты из магазина…',selected:'Товар уже выбран. Проверьте вариант и добавьте его в корзину.',edit:'Изменить ссылку',linkStep:'Ссылка на товар',stores:'eBay, Zara, Mango, Amazon и другие магазины.',storePage:'Страница магазина',get:'Получаем данные…',load:'Загрузить товар',directory:'Магазины для заказа по ссылке',storeHint:'Выбирайте региональную витрину по ссылке. Atlas считает итог с доставкой.',search:'Магазин или категория',enhanced:'цена + варианты',otherMatches:'Другие совпадения',allStores:'Все остальные магазины',notFound:'Такого магазина пока нет в списке. Можно прислать его оператору для проверки.',login:'Войдите в личный кабинет: автозагрузка защищена, а товар сохранится в вашей корзине.',original:'Открыть оригинал в магазине',loaded:'Что загрузилось и что нужно проверить',availability:'Проверьте наличие в магазине',availabilityHint:'Откройте страницу товара, проверьте выбранный размер или вариант и вернитесь с ответом.',openStore:'Открыть магазин',available:'Есть в наличии',unavailable:'Нет в наличии',openFirst:'Сначала откройте страницу магазина — после возврата кнопки ответа станут доступны.',thanks:'Спасибо. Можно проверить остальные данные и продолжить.',removed:'Товар не будет добавлен. Администратор получил сообщение для проверки.',dataStep:'Проверьте данные',name:'Название товара',namePlaceholder:'Название со страницы магазина',shipCountry:'Страна фактической отправки',countryLabel:'Страна отправки',currency:'Валюта магазина',otherCountry:'Укажите страну',price:'Цена товара',atlasShipping:'До склада Atlas',change:'изменить',useShipping:'Использовать доставку до склада Atlas',shippingNote:`Это доставка от магазина до склада Atlas. Если магазин её не публикует, закладываем изменяемый резерв $10 — один на заказ из магазина и только если товаров из него меньше чем на ${freeFrom}.`,category:'Категория',weight:'Вес товара с коробкой, кг',weightDetails:'Как уточняется вес доставки',forCalc:'для расчёта',variant:'Вариант товара',color:'Цвет',size:'Размер / модель',selectColor:'Выберите цвет',selectVariant:'Выберите вариант',none:'Нет',photo:'Фото товара — автоматически или по ссылке',image:'Адрес изображения',verified:'Я проверил данные и выбранный вариант.',add:'В корзину',adding:'Добавляем в корзину…',gallery:'Фотографии магазина',uz:'Узбекистан',empty:'Ваш товар появится здесь',fresh:'Когда проверены данные',freshText:'Перед оформлением Atlas перепроверит цену и выбранный вариант, если магазин ответит.',declaration:'Черновик декларации',cost:'Состав стоимости',reserve:`$10 — временный резерв доставки магазина, один на заказ из этого магазина. От ${freeFrom} резерв не берём. Менеджер проверит сумму после оформления.`,subtotal:'Промежуточный итог',estimate:'С доставкой, ориентир',emptyQuote:'Вставьте ссылку или заполните цену и вес.'}:{over:lang==='uz'?'DUNYODAN XARIDLAR':'SHOP THE WORLD',choose:lang==='uz'?'Variantni tanlang':'Choose your option',order:lang==='uz'?'Havola orqali buyurtma':'Order by link',checkPrice:lang==='uz'?'Qo‘shishdan oldin o‘lcham va narxni tekshiring.':'Check the size and price before adding.',paste:lang==='uz'?'Havolani kiriting — Atlas ma’lumotlarni to‘ldiradi.':'Paste a link — Atlas will fill in the details.',loading:lang==='uz'?'Do‘kondan narx va variantlar yuklanmoqda…':'Loading price and options from the store…',selected:lang==='uz'?'Tovar tanlandi. Variantni tekshirib savatga qo‘shing.':'The item is selected. Check the option and add it to your cart.',edit:lang==='uz'?'Havolani o‘zgartirish':'Change link',linkStep:lang==='uz'?'Tovar havolasi':'Item link',stores:lang==='uz'?'eBay, Zara, Mango, Amazon va boshqa do‘konlar.':'eBay, Zara, Mango, Amazon and more.',storePage:lang==='uz'?'Do‘kon sahifasi':'Store page',get:lang==='uz'?'Ma’lumot olinmoqda…':'Getting product data…',load:lang==='uz'?'Tovarni yuklash':'Load item',directory:lang==='uz'?'Havola orqali buyurtma do‘konlari':'Stores for link orders',storeHint:lang==='uz'?'Havola orqali mintaqaviy vitrinani tanlang. Atlas yetkazish bilan hisoblaydi.':'Choose a regional storefront. Atlas calculates the total with delivery.',search:lang==='uz'?'Do‘kon yoki kategoriya':'Store or category',enhanced:lang==='uz'?'narx + variantlar':'price + options',otherMatches:lang==='uz'?'Boshqa moslar':'Other matches',allStores:lang==='uz'?'Boshqa barcha do‘konlar':'All other stores',notFound:lang==='uz'?'Bu do‘kon ro‘yxatda yo‘q. Tekshirish uchun operatorga yuborishingiz mumkin.':'This store is not listed yet. Send it to an operator for review.',login:lang==='uz'?'Kabinetga kiring: avtomatik yuklash himoyalangan va tovar savatda saqlanadi.':'Sign in: automatic import is protected and the item will be saved to your cart.',original:lang==='uz'?'Do‘kondagi asl sahifani ochish':'Open original store page',loaded:lang==='uz'?'Nimalar yuklandi va nimani tekshirish kerak':'What loaded and what to check',availability:lang==='uz'?'Do‘kondagi mavjudlikni tekshiring':'Check availability in the store',availabilityHint:lang==='uz'?'Tovar sahifasini oching, tanlangan o‘lcham yoki variantni tekshiring va javob bilan qayting.':'Open the item page, check the selected size or option, and return with your answer.',openStore:lang==='uz'?'Do‘konni ochish':'Open store',available:lang==='uz'?'Mavjud':'In stock',unavailable:lang==='uz'?'Mavjud emas':'Out of stock',openFirst:lang==='uz'?'Avval do‘kon sahifasini oching — qaytgach javob tugmalari yoqiladi.':'Open the store page first; the answer buttons will unlock when you return.',thanks:lang==='uz'?'Rahmat. Qolgan ma’lumotlarni tekshirib davom eting.':'Thanks. Check the remaining details to continue.',removed:lang==='uz'?'Tovar qo‘shilmaydi. Administrator tekshiradi.':'The item will not be added. An administrator will review it.',dataStep:lang==='uz'?'Ma’lumotlarni tekshiring':'Check the details',name:lang==='uz'?'Tovar nomi':'Item name',namePlaceholder:lang==='uz'?'Do‘kon sahifasidagi nom':'Name from the store page',shipCountry:lang==='uz'?'Haqiqiy jo‘natish mamlakati':'Actual dispatch country',countryLabel:lang==='uz'?'Jo‘natish mamlakati':'Dispatch country',currency:lang==='uz'?'Do‘kon valyutasi':'Store currency',otherCountry:lang==='uz'?'Mamlakatni kiriting':'Enter country',price:lang==='uz'?'Tovar narxi':'Item price',atlasShipping:lang==='uz'?'Atlas omborigacha':'To Atlas warehouse',change:lang==='uz'?'o‘zgartirish':'edit',useShipping:lang==='uz'?'Atlas omborigacha yetkazishni ishlatish':'Use delivery to Atlas warehouse',shippingNote:lang==='uz'?`Bu do‘kondan Atlas omborigacha yetkazish. Ko‘rsatilmasa, o‘zgartiriladigan $10 zaxira qo‘yiladi — do‘kondan bitta buyurtmaga bir marta va faqat tovarlar ${freeFrom} dan kam bo‘lsa.`:`This is store-to-Atlas delivery. If unpublished, an editable $10 reserve is added — once per store order, and only below ${freeFrom} of items from that store.`,category:lang==='uz'?'Kategoriya':'Category',weight:lang==='uz'?'Qutidagi og‘irlik, kg':'Boxed weight, kg',weightDetails:lang==='uz'?'Yetkazish og‘irligi qanday aniqlanadi':'How delivery weight is refined',forCalc:lang==='uz'?'hisoblash uchun':'for calculation',variant:lang==='uz'?'Tovar varianti':'Item option',color:lang==='uz'?'Rang':'Color',size:lang==='uz'?'O‘lcham / model':'Size / model',selectColor:lang==='uz'?'Rangni tanlang':'Choose a color',selectVariant:lang==='uz'?'Variantni tanlang':'Choose an option',none:lang==='uz'?'Yo‘q':'Unavailable',photo:lang==='uz'?'Tovar surati — avtomatik yoki havola orqali':'Product photo — automatic or by link',image:lang==='uz'?'Rasm manzili':'Image URL',verified:lang==='uz'?'Ma’lumot va variantni tekshirdim.':'I checked the details and selected option.',add:lang==='uz'?'Savatga':'Add to cart',adding:lang==='uz'?'Savatga qo‘shilmoqda…':'Adding to cart…',gallery:lang==='uz'?'Do‘kon rasmlari':'Store photos',uz:lang==='uz'?'O‘zbekiston':'Uzbekistan',empty:lang==='uz'?'Tovaringiz shu yerda paydo bo‘ladi':'Your item will appear here',fresh:lang==='uz'?'Ma’lumot qachon tekshirildi':'When the data was checked',freshText:lang==='uz'?'Rasmiylashtirishdan oldin do‘kon javob bersa, Atlas narx va tanlangan variantni qayta tekshiradi.':'Before checkout, Atlas rechecks the price and selected option if the store responds.',declaration:lang==='uz'?'Deklaratsiya qoralamasi':'Declaration draft',cost:lang==='uz'?'Narx tarkibi':'Cost breakdown',reserve:lang==='uz'?`$10 — do‘kon yetkazishi uchun vaqtinchalik zaxira, shu do‘kondan bitta buyurtmaga bir marta. ${freeFrom} dan zaxira olinmaydi. Menejer rasmiylashtirilgach tekshiradi.`:`$10 is a temporary store-delivery reserve, once per order from this store. From ${freeFrom} there is no reserve. A manager will verify it after the order.`,subtotal:lang==='uz'?'Oraliq jami':'Interim total',estimate:lang==='uz'?'Yetkazish bilan taxmin':'Estimate with delivery',emptyQuote:lang==='uz'?'Havolani kiriting yoki narx va og‘irlikni to‘ldiring.':'Paste a link or enter price and weight.'};
  const tx=(ru:string,uz:string,en:string)=>lang==='ru'?ru:lang==='uz'?uz:en;
  c.freshText=tx('Перед оформлением Atlas проверит цену и валюту, если магазин ответит.','Do‘kon javob bersa, Atlas rasmiylashtirishdan oldin narx va valyutani tekshiradi.','Atlas rechecks price and currency before checkout when the store responds.');
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
    [note, setNote] = useState(seed ? "Данные из подборки " + seed.store + " на " + seed.observedOn + ". Atlas автоматически проверяет цену и вариант перед добавлением. Вес и доставка предварительные." : dealSeed ? `Цена и фото сохранены из подборки на ${dealSeed.observedOn}. Atlas сейчас автоматически уточняет их в магазине.` : ""),
    [weightOrigin, setWeightOrigin] = useState(tx("Оценка по категории","Kategoriya bo‘yicha taxmin","Category estimate")),
    [verified, setVerified] = useState(false),
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
  const automaticallyLoaded = useRef<string | null>(null);
  const [catalogContextLoaded,setCatalogContextLoaded]=useState<string|null>(()=>catalogId?null:'');
  const draftStorageKey=`atlas:link-order:${catalogId?'catalog:'+catalogId:requestedUrl||'manual'}`;
  const draftRestored=useRef(false),draftCanSkipAutomaticLoad=useRef(false),draftPersistenceReady=useRef(false);

  useEffect(()=>{
    let active=true;
    void loadCatalog().finally(()=>{if(active&&catalogId)setCatalogContextLoaded(catalogId)});
    return()=>{active=false};
  },[catalogId,loadCatalog]);

  useEffect(()=>{
    draftRestored.current=false;draftCanSkipAutomaticLoad.current=false;draftPersistenceReady.current=false;
    try{
      const raw=sessionStorage.getItem(draftStorageKey);
      if(raw&&!catalogId&&!dealSeed&&raw.length<300000){
        const value=JSON.parse(raw) as Partial<LinkOrderDraftSnapshot>;
        const usable=typeof value==='object'&&value!==null&&typeof value.source==='string'&&value.source.length>0&&typeof value.sourceCheckStatus==='string';
        const needsNikeGallery=typeof value.source==='string'&&/^https:\/\/(?:www\.)?nike\.com\//i.test(value.source);
        const fresh=usable&&value.sourceCheckStatus==='verified'&&typeof value.sourceExpiresAt==='number'&&value.sourceExpiresAt>Date.now()&&(!needsNikeGallery||Array.isArray(value.colorwayImages));
        if(usable&&(fresh||(!requestedUrl&&value.source))){
          const text=(item:unknown,fallback='')=>typeof item==='string'?item:fallback;
          const restoredVariants=Array.isArray(value.variants)?value.variants.slice(0,250):[];
          const restoredVariant=text(value.variant,restoredVariants.length===1?restoredVariants[0].label:'');
          draftRestored.current=true;draftCanSkipAutomaticLoad.current=Boolean(fresh);
          queueMicrotask(()=>{
            setUrl(text(value.url,requestedUrl));setSource(text(value.source));setName(text(value.name));setBrand(text(value.brand));setDeclaration(text(value.declaration));
            setCurrency(text(value.currency,'USD'));setAmount(text(value.amount));setShipping(text(value.shipping,'10'));setShippingCurrency(text(value.shippingCurrency,'USD'));setShippingEstimated(value.shippingEstimated!==false);
            setWeight(text(value.weight));setCountry(canonicalCountry(text(value.country,'Другая страна')));setOtherCountry(text(value.otherCountry));setCategory(canonicalCategory(text(value.category,'Другое')));setVariant(restoredVariant);setPicked(restoredVariant?{[restoredVariant]:1}:{});
            setVariants(restoredVariants);setSelectedColor(text(value.selectedColor));setSelectedSize(text(value.selectedSize));setImage(text(value.image));setImages(dedupeSafeImages(Array.isArray(value.images)?value.images.filter((item):item is string=>typeof item==='string'):[],text(value.source)));setColorwayImages(cleanColorwayGalleries(value.colorwayImages,text(value.source)));
            setShowSourceForm(value.showSourceForm===true);setNote(text(value.note));setWeightOrigin(text(value.weightOrigin));setVerified(value.verified===true);
            setSourceCheckStatus(value.sourceCheckStatus==='verified'||value.sourceCheckStatus==='failed'||value.sourceCheckStatus==='checking'?value.sourceCheckStatus:'idle');
            setImportedAt(typeof value.importedAt==='number'?value.importedAt:undefined);setSourceExpiresAt(typeof value.sourceExpiresAt==='number'?value.sourceExpiresAt:undefined);
            setFoundShipping(value.foundShipping&&typeof value.foundShipping.amount==='number'?{amount:value.foundShipping.amount,currency:text(value.foundShipping.currency),destination:text(value.foundShipping.destination)||undefined}:null);
          });
        }
      }
    }catch{}
    draftPersistenceReady.current=true;
  },[draftStorageKey,requestedUrl,catalogId,dealSeed]);

  useEffect(()=>{
    if(!draftPersistenceReady.current)return;
    const snapshot:LinkOrderDraftSnapshot={url,source,name,brand,declaration,currency,amount,shipping,shippingCurrency,shippingEstimated,weight,country,otherCountry,category,variant,variants,selectedColor,selectedSize,image,images,colorwayImages,showSourceForm,note,weightOrigin,verified,sourceCheckStatus,importedAt,sourceExpiresAt,foundShipping};
    try{sessionStorage.setItem(draftStorageKey,JSON.stringify(snapshot))}catch{}
  },[draftStorageKey,url,source,name,brand,declaration,currency,amount,shipping,shippingCurrency,shippingEstimated,weight,country,otherCountry,category,variant,variants,selectedColor,selectedSize,image,images,colorwayImages,showSourceForm,note,weightOrigin,verified,sourceCheckStatus,importedAt,sourceExpiresAt,foundShipping]);
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
    : [...new Set(variantsForColor.map(item => item.sizeLabel).filter((value): value is string => Boolean(value)))].join(' / ') || (lang==='ru'?'Размер / модель':lang==='uz'?'O‘lcham / model':'Size / model');
  // After a reload caused by a price change, pick the option the customer had chosen, if the store still lists it.
  const reselectVariant=useRef("");
  useEffect(()=>{
    const wanted=reselectVariant.current;
    if(!wanted||busy)return;
    reselectVariant.current="";
    const item=variants.find(value=>value.label===wanted);
    if(item)queueMicrotask(()=>applyVariantChoice(item));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[variants,busy]);
  function applyVariantChoice(item:ProductVariant|undefined,knownCurrency=true){
    if(!item){setVariant("");setSelectedSize("");setVerified(false);return}
    setVariant(item.label);setSelectedColor(item.color??"");setSelectedSize(item.size??"");
    if(item.price!==undefined&&knownCurrency)setAmount(String(item.price));else if(variants.some(value=>value.price!==undefined))setAmount("");
    if(item.image&&item.color!==selectedColor)setImage(item.image);setVerified(false);
  }
  /** Toggle an option in the selection; the last one touched sets the price shown in the form. */
  function togglePick(item:ProductVariant){
    setPicked(current=>{const next={...current};if(next[item.label])delete next[item.label];else next[item.label]=1;return next});
    applyVariantChoice(item);
    setAdded(null);
  }
  function setPickQuantity(label:string,quantity:number){
    setPicked(current=>({...current,[label]:quantity}));
    setVerified(false);
  }
  function selectColorway(color:string){
    if(color===selectedColor)return;
    const choices=variants.filter(item=>item.color===color);
    const first=choices.find(item=>item.available)??choices[0];
    const gallery=colorwayImages.find(item=>item.color===color)?.images??[];
    const nextImages=gallery.length?gallery:first?.image?[first.image]:[];
    setSelectedColor(color);setSelectedSize('');setVariant('');setVerified(false);
    setImages(nextImages);
    setImage(first?.image&&nextImages.includes(first.image)?first.image:nextImages[0]??'');
    if(choices.some(item=>item.price!==undefined))setAmount('');
    if(!choices.some(item=>item.size)&&first){applyVariantChoice(first);setPicked(current=>({...current,[first.label]:current[first.label]??1}))}
  }
  async function load(value = url) {
    let link: string;
    try {
      link = validateSource(value);
    } catch (e) {
      toast.error((e as Error).message);
      setShowSourceForm(true);
      return;
    }
    const linkSeed=catalogLinkSeed(catalogProducts,catalogId,requestedUrl,link);
    const linkDealSeed=link===requestedUrl?dealSeed:undefined;
    const linkIsCatalogFlow=Boolean(linkSeed||linkDealSeed);
    const linkSeedPrice=catalogLinkPrice(linkSeed);
    const linkFallbackOptions:ProductVariant[]=linkSeed?catalogOrderVariants(linkSeed):linkDealSeed?communityFallbackOptions(linkDealSeed).map(item=>({...item,available:true})):[];
    const linkSeedImages=linkSeed?dedupeSafeImages([linkSeed.image,...(linkSeed.sourceImages??[])],linkSeed.sourceUrl??link):linkDealSeed?.image?[linkDealSeed.image]:[];
    const linkBoxedWeight=catalogLinkWeight(linkSeed)??(linkDealSeed?Math.max(.1,communityEstimatedWeight(linkDealSeed)-.5):undefined);
    setUrl(link);
    setBusy(true);
    setSource(link);
    setVerified(false);
    setSourceCheckStatus('checking');
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
    setNote(linkDealSeed ? `Цена и фото сохранены из подборки на ${linkDealSeed.observedOn}. Atlas уточняет их в магазине.` : linkSeed ? `Товар из каталога ${linkSeed.store}. Atlas проверит цену и вариант в магазине.` : "");
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
        setVariants(partialVariants);
        setVariant(partialVariants.length===1?partialVariants[0].label:"");
        setPicked(partialVariants.length===1?{[partialVariants[0].label]:1}:{});
        const partialColor=selectedImportedColor(data,partialVariants,partialGalleries);
        setSelectedColor(partialColor);setSelectedSize("");
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
      const selectedIds = [sourceParams.get('variant'), sourceParams.get('var')].filter((value): value is string => Boolean(value));
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
            ? tx("Оценка Atlas; уточняется перед оформлением","Atlas bahosi; rasmiylashtirishdan oldin aniqlanadi","Atlas estimate; refined before checkout")
            : tx("Приблизительно по категории","Kategoriya bo‘yicha taxminan","Approximate by category"),
      );
      setImportedAt(data.fetchedAt ?? Date.now());
      setSourceExpiresAt(data.expiresAt);
      const sourceHasPrice=Boolean(data.currency&&currencies.includes(data.currency))&&Boolean(selectableVariants.length)&&(typeof data.price==='number'&&Number.isFinite(data.price)&&data.price>0||hasPricedVariants);
      setSourceCheckStatus(sourceHasPrice?'verified':'failed');
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
          !sourceHasPrice?tx("Цена или вариант не получены — заполните их вручную и подтвердите.","Narx yoki variant olinmadi — ularni qo‘lda kiriting va tasdiqlang.","Price or option was not returned — enter and confirm it manually."):"",
          selectableVariants.length<safeVariants.length?tx("Варианты без подтверждённой цены магазина не показаны.","Do‘kon tasdiqlagan narxi yo‘q variantlar ko‘rsatilmaydi.","Options without a store-confirmed price are not shown."):"",
          shippingMessage,
          data.currency && !currencies.includes(data.currency)
             ? tx("Валюта ", "Valyuta ", "Currency ") +
               data.currency +
               tx(" пока не поддерживается: укажите эквивалент в поддерживаемой валюте.", " hozircha qo‘llanmaydi: qo‘llab-quvvatlanadigan valyutada ekvivalent kiriting.", " is not supported yet: enter an equivalent in a supported currency.")
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (e) {
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
      setWeightOrigin(linkIsCatalogFlow&&linkSeed?tx("Вес задан Atlas для карточки каталога","Vazn Atlas katalog kartochkasi uchun belgilagan","Weight set by Atlas for this catalog item"):linkBoxedWeight ? tx("Оценка Atlas; уточняется перед оформлением","Atlas bahosi; rasmiylashtirishdan oldin aniqlanadi","Atlas estimate; refined before checkout") : tx("Приблизительно по категории","Kategoriya bo‘yicha taxminan","Approximate by category"));
      setSourceCheckStatus('failed');
      setShowSourceForm(false);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const loadKey=`${catalogId}:${requestedUrl}`;
    if (!requestedUrl || (catalogId&&catalogContextLoaded!==catalogId) || automaticallyLoaded.current === loadKey) return;
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
  }, [requestedUrl, catalogId, catalogContextLoaded]);
  // The options the customer chose, with quantities: from the option buttons, or the typed option.
  const picks: [string, number][] = variants.length
    ? Object.entries(picked).filter(([label]) => variants.some(item => item.label === label))
    : variant.trim() ? [[variant.trim(), manualQuantity]] : [];
  const pickedVariant = (label: string) => variants.find(item => item.label === label);
  const priceOf = (label: string) => pickedVariant(label)?.price ?? Number(amount);
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
  const shippingFree = shippingEstimated && storeShippingState === "free";
  const primaryProfile = state.deliveryProfiles.find(profile => profile.primary) ?? state.deliveryProfiles[0];
  const customsPreview = previewItems.length ? cartCustomsEstimate({ ...state, cart: previewItems }, pricing, { profile: primaryProfile }, { outsideUsed: false, help: false }) : null;
  const k = calcCopy[lang];
  const previewProduct: Product = {
    id: "preview",
    name: name || "Фото товара",
    brand: brand || (source ? new URL(source).hostname : ""),
    category,
    usd: 1,
    weight: 1,
    image,
    sourceUrl: source || undefined,
    variants: [""],
  };
  const lc = linkOrderCopy[lang];
  const cc = cartCopy[lang];
  const sourceHost = (() => { try { return source ? new URL(source).hostname.replace(/^www\./, "") : ""; } catch { return ""; } })();
  // The store link at the top: domain and path, no tracking parameters; the full address opens on click.
  const sourceShort = (() => { try { const parsed = new URL(source || url); return parsed.hostname.replace(/^www\./, "") + (parsed.pathname === "/" ? "" : parsed.pathname); } catch { return sourceHost || url; } })();
  const weightNote = weightBasis === "store" ? k.weightStore : weightBasis === "catalog" ? k.weightCatalog : weightBasis === "customer" ? k.weightCustomer : weightBasis === "title" ? k.weightTitle : k.weightEstimate(displayCategoryName(category, lang));
  // A confirmed import keeps the technical fields folded; anything unconfirmed stays open for review.
  const dataExpanded = dataOpen || sourceCheckStatus !== "verified";
  const sizePricesDiffer = new Set(variantsForColor.map(item => item.price).filter((value): value is number => value !== undefined)).size > 1;
  const countryText = country === "Другая страна" ? otherCountry.trim() || countryLabel(country, lang) : countryLabel(canonicalCountry(country), lang);
  const storePriceText = (() => {
    const value = Number(amount);
    if (!amount || !Number.isFinite(value)) return "—";
    try { return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
    catch { return `${amount} ${currency}`; }
  })();
  // The catalog's price before the store's discount (USD cards), crossed out here and kept with the cart item.
  // Then the chosen option's own "before" price, then the one the store gave for the whole product.
  const optionReference = variants.find(item => item.price !== undefined && item.price === Number(amount) && item.compareAtPrice)?.compareAtPrice;
  const referencePrice = (currentCatalogSeed && !currentCatalogSeed.priceNeedsConfirmation && currency === "USD" ? currentCatalogSeed.referenceUsd : undefined) ?? optionReference ?? importReference;
  const discount = storeDiscount({ usd: Number(amount), sourcePrice: Number(amount), sourceReferencePrice: referencePrice });
  const sourceFormat = (value: number) => { try { return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); } catch { return `${value} ${currency}`; } };
  const checkedTime = importedAt ? `${String(new Date(importedAt).getHours()).padStart(2, "0")}:${String(new Date(importedAt).getMinutes()).padStart(2, "0")}` : "";
  const dataSummary = [countryText, amount ? `${amount} ${currency}` : "", validBoxedWeight(weight) !== undefined ? `${weight} ${lc.kg}` : "", shippingEstimated ? `${lc.shippingReserve} ${shipping} ${shippingCurrency}` : lc.storeShipping(`${shipping} ${shippingCurrency}`)].filter(Boolean).join(" · ");
  return (
    <div className="lo-page">
      <header className="orders-head"><div><h1>{lc.title}</h1><p>{source && !busy ? lc.leadLoaded : lc.lead}</p></div></header>

      {(showSourceForm || !requestedUrl) && <form className="lo-link" onSubmit={(e) => { e.preventDefault(); void load(); }} aria-busy={busy}>
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
            setUrl(e.target.value);
            setSource("");
            setSourceCheckStatus('idle');
            setVerified(false);
            setShowSourceForm(true);
          }}
          placeholder={lc.placeholder}
        /></span>
        <button className="btn primary lo-link-submit" disabled={busy}>{busy ? <Loader2 className="spin" size={18} aria-hidden="true" /> : null}{busy ? c.get : lc.calculate}</button>
      </form>}
      {(showSourceForm || !requestedUrl) && !source && !busy && <><div className="lo-hints"><p>{lc.hint}</p><div className="home-hero-links"><Link href="/stores">{lc.stores}</Link><Link href="/batch-import">{lc.batch}</Link></div></div><BlankBill pricing={pricing} locale={lang}/></>}

      {(isSourcedFlow || source) && !showSourceForm && <div className="lo-source" aria-live="polite">
        {source && !busy
          ? <a className="lo-source-host" href={source} target="_blank" rel="noopener noreferrer" title={source}><Link2 size={16} aria-hidden="true" /><span>{sourceShort}</span><ExternalLink size={13} aria-hidden="true" /><span className="sr-only"> ({lc.openStore})</span></a>
          : <span className="lo-source-host"><Link2 size={16} aria-hidden="true" /><span>{sourceShort}</span></span>}
        {busy ? <span className="lo-source-loading" role="status"><Loader2 className="spin" size={16} aria-hidden="true" />{lc.loading}</span>
          : <button type="button" className="lo-source-link" onClick={() => setShowSourceForm(true)}>{lc.change}</button>}
      </div>}

      {added && <div className="lo-added" role="status">
        <Check size={20} aria-hidden="true" />
        <div><b>{tx(`В корзине: +${added.units} шт.`, `Savatda: +${added.units} dona`, `Added to cart: ${added.units} pcs`)}</b><small>{tx("Можно выбрать другой вариант или вставить ссылку на следующий товар — корзина сохранится.", "Boshqa variantni tanlash yoki keyingi tovar havolasini qo‘yish mumkin — savat saqlanadi.", "Choose another option or paste the next product link — your cart is kept.")}</small></div>
        <span className="lo-added-actions">
          <button type="button" className="btn secondary" onClick={() => { setAdded(null); setUrl(""); setSource(""); setShowSourceForm(true); window.setTimeout(() => document.getElementById("source-url")?.focus(), 0); }}><Link2 size={16} aria-hidden="true" />{tx("Следующий товар", "Keyingi tovar", "Next item")}</button>
          <Link className="btn primary" href="/cart"><ShoppingBag size={16} aria-hidden="true" />{tx("В корзину", "Savatga", "Go to cart")}</Link>
        </span>
      </div>}
      {!ready && <p className="lo-guest">{lc.guest}</p>}
      {note && !source && <div className="notice" role="status"><p>{note}</p></div>}
      {busy && <div className="basket-loading lo-loading" role="status"><Loader2 className="spin" size={18} aria-hidden="true" /> {lc.loading}</div>}

      {source && !busy && (
        <form
          id="link-order-form"
          className="lo-layout link-order-data-form"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              if(sourceCheckStatus==='checking'||sourceCheckStatus==='idle'){
                const message=tx('Загрузка ещё не завершилась. Дождитесь результата или вставьте ссылку повторно.','Yuklash hali tugamadi. Natijani kuting yoki havolani qayta kiriting.','Import has not finished. Wait for the result or enter the link again.');
                setFormIssue(message);toast.error(message);return;
              }
              const missing=[
                {id:'name',invalid:!name.trim(),message:tx('Введите название товара.','Tovar nomini kiriting.','Enter the item name.')},
                {id:'variant',invalid:!picks.length,message:tx('Выберите или укажите цвет, размер либо модель.','Rang, o‘lcham yoki modelni tanlang yoki kiriting.','Choose or enter a color, size, or model.')},
                {id:'variant',invalid:picks.some(([label,quantity])=>{const left=pickedVariant(label)?.quantity;return left!==undefined&&quantity>left}),message:tx('Для одного из вариантов выбрано больше, чем осталось у магазина.','Variantlardan biri uchun do‘konda qolganidan ko‘p tanlangan.','One option is chosen in a larger quantity than the store has left.')},
                {id:'other-country',invalid:country==='Другая страна'&&!otherCountry.trim(),message:tx('Укажите страну фактической отправки.','Haqiqiy jo‘natish mamlakatini kiriting.','Enter the actual dispatch country.')},
                {id:'amount',invalid:!Number.isFinite(Number(amount))||Number(amount)<=0,message:tx('Укажите цену товара больше нуля.','Tovar narxini noldan katta kiriting.','Enter an item price greater than zero.')},
                {id:'shipping',invalid:shipping===''||!Number.isFinite(Number(shipping))||Number(shipping)<0,message:tx('Укажите доставку магазина до склада Atlas; 0 — только если она бесплатная.','Do‘kondan Atlas omborigacha yetkazishni kiriting; 0 faqat bepul bo‘lsa.','Enter store-to-Atlas shipping; use 0 only when it is free.')},
                {id:'weight',invalid:validBoxedWeight(weight)===undefined,message:tx('Укажите вес товара с коробкой от 0,01 до 49,5 кг.','Qadoq bilan vaznni 0,01–49,5 kg oralig‘ida kiriting.','Enter boxed weight from 0.01 to 49.5 kg.')},
                {id:'data-verified',invalid:!verified,message:tx('Подтвердите, что проверили введённые данные и вариант.','Kiritilgan ma’lumotlar va variantni tekshirganingizni tasdiqlang.','Confirm that you reviewed the entered details and option.')},
              ].find(field=>field.invalid);
              if(missing){
                setFormIssue(missing.message);
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
              if (!ready) {
                if (status === 'loading') return;
                // The existing session draft retains the reviewed form; the
                // authenticated cart action still revalidates it on return.
                window.location.assign(signInPath(window.location.pathname + window.location.search));
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
                sourceShipping: Number(shipping),
                sourceShippingCurrency: shippingCurrency,
                sourceShippingUsd: toUsd(
                  Number(shipping),
                  shippingCurrency,
                  pricing.rates,
                ),
                sourceShippingEstimated: shippingEstimated,
                shippingKnown: true,
                boxedWeight: Number(weight),
                weightOrigin,
                weightBasis: weightBasis === "title" ? "estimate" : weightBasis,
                importedAt,
                sourceExpiresAt,
                sourceManuallyConfirmed:true,
                 imageOrigin: importedAt ? tx("страница магазина","do‘kon sahifasi","store page") : tx("ручной ввод","qo‘lda kiritish","manual entry"),
                declarationDescription: declaration || undefined,
              };
              setAdding(true);
              const note = comment.trim() || undefined;
              const ok = picks.length === 1
                ? await act({ type: "cart-add", product: productFor(picks[0][0]), variant: picks[0][0], quantity: picks[0][1], note })
                : await act({ type: "cart-add-many", items: picks.map(([label, quantity]) => ({ product: productFor(label), variant: label, quantity })), note });
              // The cart keeps what is already there; the customer can add more from this or another link.
              if (ok) {
                // The added line took the cart's speed; the speed chosen here applies to the whole cart (one speed per cart).
                if (previewSpeed !== cartSpeed) await act({ type: "cart-delivery-speed", speed: previewSpeed });
                setAdded({ lines: picks.length, units }); setComment(""); window.scrollTo({ top: 0, behavior: "smooth" });
              }
              // The store's price moved since this page loaded: load it again and keep the chosen option.
              else if (lastActionError()?.code === "err_34") { reselectVariant.current = picks[0][0]; void load(source); }
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setAdding(false);
            }
          }}
        >
          <div className="lo-sheet lo-sheet-pick">
          <section className={"lo-product" + (image ? "" : " lo-product-plain")} aria-labelledby="lo-product-name">
            {image && <div className="lo-gallery"><ProductGallery product={previewProduct} images={images.length?images:[image]} activeImage={image} onImageChange={setImage} locale={lang}/></div>}
            <div className="lo-product-copy">
              <p className="basket-brand">{[brand, sourceHost && brand !== sourceHost ? sourceHost : ""].filter(Boolean).join(" · ")}</p>
              <h2 id="lo-product-name">{name || (sourceCheckStatus === "failed" ? lc.unnamed : c.empty)}</h2>
              <p className="lo-store-price">{lc.storePrice}: <b>{storePriceText}</b>{discount && <WasPrice was={discount.was} percent={discount.percent} format={sourceFormat} />}{sourceCheckStatus === "verified" && checkedTime && <small> · {lc.checkedAt(checkedTime)}</small>}</p>
              {sourceCheckStatus === "failed" && <p className="lo-note warn" role="status"><AlertCircle size={16} aria-hidden="true" />{catalogProductFlow && amount
                ? tx('Магазин не подтвердил все данные. Расчёт предварительный: при отсутствии новой цены используется сохранённая цена каталога. Перед выкупом оператор уточнит стоимость. Проверьте вариант и подтвердите данные.','Do‘kon barcha ma’lumotlarni tasdiqlamadi. Hisob taxminiy: yangi narx bo‘lmasa, katalogdagi saqlangan narx ishlatiladi. Operator xariddan oldin narxni aniqlaydi. Variantni tekshirib, ma’lumotlarni tasdiqlang.','The store did not confirm all details. This is a preliminary estimate; without a new price, the saved catalog amount is used. An operator will confirm the cost before buyout. Review the option and confirm the details.')
                : lc.unconfirmed}</p>}
            </div>
          </section>

          <section className="lo-card lo-variant">
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
                <div className="lo-manual-option"><input id="variant" required maxLength={80} value={variant} aria-label={k.optionLabel} onChange={(e) => {setVariant(e.target.value);setVerified(false)}} placeholder={k.optionPlaceholder}/><Stepper value={manualQuantity} max={10} label={k.quantity} k={k} onChange={setManualQuantity}/></div>
              )}
            </div>
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
          </section>
          </div>

          {/* The bill in a folder: the sheet is the amount to pay, the slip holds the hold and customs that stay outside it. */}
          <div className="lo-sheet lo-sheet-bill">
          <aside className="lo-summary basket-summary folio" aria-labelledby="lo-summary-title">
            <div className="folio-sheet">
              <h2 id="lo-summary-title">{lc.total}</h2>
              {previewSums ? <>
                <DeliverySpeedSwitch value={previewSpeed} options={speedOptions} locale={lang} note={speedNote} compact onChange={(next) => { speedTouched.current = true; setPreviewSpeed(next); }}/>
                <CalcLines sums={previewSums} locale={lang} pricing={pricing} weightKg={previewWeight} storeShippingState={storeShippingState} speed={previewSpeed}/>
                <div className="basket-total bill-total"><span>{units > 1 ? `${k.lines.total} (${units} ${lang === "en" ? "pcs" : lang === "uz" ? "dona" : "шт."})` : k.lines.total}</span><strong><Money value={previewSums.total} locale={lang}/></strong></div>
                {/* The allowance in two lines; "Atlas pays customs for me" is chosen in the cart, for the whole order. */}
                {customsPreview && <CustomsPanel estimate={customsPreview} choices={{ outsideUsed: false, help: false }} locale={lang} pricing={pricing} profiles={primaryProfile ? [primaryProfile] : []} compact/>}
              </> : <p className="cabinet-empty">{picks.length ? lc.emptyTotal : tx("Выберите вариант, и мы покажем итог.", "Variantni tanlang, jamini ko‘rsatamiz.", "Choose an option to see the total.")}</p>}
            </div>
            {previewSums && previewSums.storeShippingHold > 0 && <section className="folio-outside" aria-labelledby="lo-outside-title">
              <h3 id="lo-outside-title">{k.outside}</h3>
              <HoldNote amount={previewSums.storeShippingHold} locale={lang} pricing={pricing}/>
            </section>}
          </aside>
          </div>

          <div className="lo-sheet lo-sheet-finish">
          <section className={"lo-card lo-data" + (dataExpanded ? " open" : "")}>
            <button type="button" className="lo-data-toggle" aria-expanded={dataExpanded} aria-controls="lo-data-fields" onClick={() => setDataOpen(!dataExpanded)}>
              <span><b>{lc.data}</b><small>{!dataExpanded ? dataSummary : sourceCheckStatus === "verified" ? lc.dataHint : lc.fillFromStore}</small></span>
              <span aria-hidden="true" className="lo-data-sign">{dataExpanded ? "−" : "+"}</span>
            </button>
            <div id="lo-data-fields" className="lo-data-fields" hidden={!dataExpanded}>
              <div className="field lo-name-field">
                <label htmlFor="name">{c.name}</label>
                <input id="name" required maxLength={140} value={name} readOnly={catalogProductFlow} className={catalogProductFlow?"catalog-locked-field":undefined} onChange={(e) => {
                  setName(e.target.value);setVerified(false);
                  // An Atlas estimate follows the name ("boots", "t-shirt"); a weight the customer or the store gave stays.
                  if(weightBasis==="estimate"||weightBasis==="title"){const estimate=estimateBoxedWeight(category,e.target.value);setWeight(String(estimate.kg));setWeightBasis(estimate.basis==="title"?"title":"estimate")}
                }} placeholder={c.namePlaceholder} />
              </div>
              <div className="lo-blocks">
                <fieldset className="lo-block">
                  <legend>{k.blocks.price}</legend>
                  <div className="lo-block-row">
                    <div className="field">
                      <label htmlFor="amount">{k.price}</label>
                      <input id="amount" type="number" inputMode="decimal" required min=".01" step=".01" value={amount} readOnly={catalogPriceLocked} className={catalogPriceLocked?"catalog-locked-field":undefined} onChange={(e) => {setAmount(e.target.value);setVerified(false)}} />
                    </div>
                    <div className="field lo-currency">
                      <label>{k.currency}</label>
                      <Choice label={k.currency} value={currency} disabled={catalogPriceLocked} className={catalogPriceLocked?"catalog-locked-field":undefined} onChange={(v) => { setCurrency(v);setVerified(false); }} options={currencies} />
                    </div>
                  </div>
                  {variants.some(item => item.price !== undefined) && picks.length > 1 && <small className="micro">{tx("У каждого выбранного варианта своя цена магазина.","Har bir tanlangan variantning o‘z do‘kon narxi bor.","Each chosen option keeps its own store price.")}</small>}
                </fieldset>
                <fieldset className="lo-block">
                  <legend>{k.blocks.storeShipping}</legend>
                  <div className="lo-block-row">
                    <div className="field">
                      <label htmlFor="shipping">{k.storeShippingAmount}, {shippingCurrency}</label>
                      {/* Unknown delivery from a store order above the threshold is free: the field shows the 0 that applies. */}
                      <input id="shipping" type="number" inputMode="decimal" required min="0" step=".01" value={shippingFree ? "0" : shipping} readOnly={catalogProductFlow || shippingFree} className={catalogProductFlow || shippingFree ? "catalog-locked-field" : undefined} onChange={(e) => { setShipping(e.target.value); setShippingEstimated(true); setVerified(false); }} />
                    </div>
                    <p className="lo-block-state">{shippingEstimated ? (storeShippingState === "free" ? k.lines.free : k.storeShippingUnknown) : k.storeShippingStated}</p>
                  </div>
                  <small className="micro">{catalogProductFlow && !shippingEstimated ? tx("Сумма доставки подтверждена Atlas при добавлении товара.","Yetkazish summasi tovar qo‘shilganda Atlas tomonidan tasdiqlangan.","Atlas confirmed this shipping amount when adding the item.") : k.storeShippingRule(freeFrom)}</small>
                  {foundShipping && shippingEstimated && !catalogProductFlow && <button type="button" className="btn secondary lo-found-shipping" onClick={() => {
                    if (!currencies.includes(foundShipping.currency)) {
                      toast.error(tx("Валюта ", "Valyuta ", "Currency ") + foundShipping.currency + tx(" пока не поддерживается: укажите эквивалент в поддерживаемой валюте.", " hozircha qo‘llanmaydi: qo‘llab-quvvatlanadigan valyutada ekvivalent kiriting.", " is not supported yet: enter an equivalent in a supported currency."));
                      return;
                    }
                    setShipping(String(foundShipping.amount));
                    setShippingCurrency(foundShipping.currency);
                    setShippingEstimated(false);
                    setVerified(false);
                  }}>{k.useStated}: {foundShipping.amount} {foundShipping.currency}{foundShipping.destination ? " · " + foundShipping.destination : ""}</button>}
                </fieldset>
                <fieldset className="lo-block">
                  <legend>{k.blocks.country}</legend>
                  <div className="field">
                    <label htmlFor="ship-country" className="sr-only">{c.shipCountry}</label>
                    <select id="ship-country" className={`select-control${catalogCountryLocked?" catalog-locked-field":""}`} disabled={catalogCountryLocked} value={canonicalCountry(country)} onChange={(e) => { setCountry(canonicalCountry(e.target.value)); setVerified(false); }}>
                      {countries.map((value) => <option key={value} value={value}>{countryLabel(value,lang)}</option>)}
                    </select>
                  </div>
                  {country === "Другая страна" && <div className="field">
                    <label htmlFor="other-country">{c.otherCountry}</label>
                    <input id="other-country" required maxLength={60} value={otherCountry} readOnly={catalogCountryLocked} className={catalogCountryLocked?"catalog-locked-field":undefined} onChange={(e) => setOtherCountry(e.target.value)} />
                  </div>}
                </fieldset>
                <fieldset className="lo-block">
                  <legend>{k.blocks.weight}</legend>
                  <div className="lo-block-row">
                    <div className="field">
                      <label htmlFor="category">{k.category}</label>
                      <select id="category" className={`select-control${catalogProductFlow?" catalog-locked-field":""}`} disabled={catalogProductFlow} value={canonicalCategory(category)} onChange={(e) => {
                        const canonical = canonicalCategory(e.target.value);
                        const estimate = estimateBoxedWeight(canonical, name);
                        setCategory(canonical);
                        setWeight(String(estimate.kg));
                        setWeightBasis(estimate.basis === "title" ? "title" : "estimate");
                        setWeightOrigin(tx("Оценка Atlas","Atlas bahosi","Atlas estimate"));
                        setVerified(false);
                      }}>
                        {weightCategories.map((value) => <option key={value} value={value}>{displayCategoryName(value,lang)}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="weight">{k.boxedWeight}</label>
                      <input id="weight" type="number" inputMode="decimal" required min=".01" max="49.5" step=".01" value={weight} readOnly={catalogProductFlow} className={catalogProductFlow?"catalog-locked-field":undefined}
                        onChange={(e) => { setWeight(e.target.value); setWeightBasis("customer"); setWeightOrigin(tx("Указан покупателем","Xaridor kiritdi","Entered by customer")); setVerified(false); }}
                        onBlur={() => {
                          if(catalogProductFlow)return;
                          const valid=validBoxedWeight(weight);
                          if(valid!==undefined){setWeight(String(valid));return}
                          const estimate=estimateBoxedWeight(category,name);
                          setWeight(String(estimate.kg));
                          setWeightBasis(estimate.basis==="title"?"title":"estimate");
                          setWeightOrigin(tx("Оценка Atlas","Atlas bahosi","Atlas estimate"));
                          toast.error(tx("Вес должен быть от 0,01 до 49,5 кг. Вернули оценку Atlas.","Og‘irlik 0,01–49,5 kg bo‘lishi kerak. Atlas bahosi qaytarildi.","Weight must be between 0.01 and 49.5 kg. The Atlas estimate was restored."));
                        }} />
                    </div>
                  </div>
                  <small className={"micro lo-weight-basis" + (weightBasis === "estimate" || weightBasis === "title" ? " estimate" : "")}>{weightNote}</small>
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
            <div className="basket-consent">
              <Checkbox id="data-verified" checked={verified} onCheckedChange={(v) => setVerified(v === true)} />
              <label htmlFor="data-verified">{c.verified}</label>
            </div>
            <button className="btn primary basket-cta" disabled={adding || status==='loading'}>{adding ? c.adding : ready ? k.addOptions(Math.max(1, picks.length), Math.max(1, units)) : lc.signinAdd}<ArrowRight size={18} aria-hidden="true" /></button>
            <ul className="basket-assurance"><li><ShieldCheck size={16} aria-hidden="true" />{cc.summary.assurance}</li><li><Info size={16} aria-hidden="true" />{c.freshText}</li></ul>
          </section>
          </div>
        </form>
      )}

      {source && !busy && <div className={"basket-sticky lo-sticky" + (ready ? "" : " guest")} role="region" aria-label={lc.total}>
        <div><span>{k.lines.total}</span><strong>{previewSums ? formatSum(previewSums.total, lang) : "—"}</strong></div>
        <button type="submit" form="link-order-form" className="btn primary" disabled={adding || status==='loading'}>{ready ? (adding ? c.adding : lc.addShort) : lc.signinAdd}<ArrowRight size={18} aria-hidden="true" /></button>
      </div>}
    </div>
  );
}
