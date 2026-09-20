"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, ExternalLink, Link2, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarket } from "@/lib/market/store";
import {
  price,
  money,
  validateSource,
  type Product,
} from "@/lib/market/domain";
import { featuredStoreGroups, supportedStoreRoots } from "@/lib/importer/stores";
import { hasEnhancedStoreImport } from "@/lib/importer/shopify";
import { countries, currencies, currencyForCountry, toUsd, paddedWeight } from "@/lib/market/world";
import { estimatedBoxedWeight, validBoxedWeight, weightCategories } from "@/lib/market/weight";
import {
  safeImage,
  inferProductCategory,
  inferStorefrontCountry,
  type Extracted,
  type ProductVariant,
} from "@/lib/importer/extract";
import { Choice, CostLines, PageHeading, ProductImage } from "./market-ui";
import { CustomsEstimate } from "./customs-estimate";
import {
  communityDeals,
  communityEstimatedWeight,
  communityFallbackOptions,
  communityProductCategory,
  hasSelectableDimensions,
} from "@/lib/market/community-deals";

type LinkOrderDraftSnapshot={
  url:string;source:string;name:string;brand:string;declaration:string;currency:string;amount:string;shipping:string;shippingCurrency:string;shippingEstimated:boolean;weight:string;country:string;otherCountry:string;category:string;variant:string;variants:ProductVariant[];selectedColor:string;selectedSize:string;image:string;images:string[];showSourceForm:boolean;note:string;weightOrigin:string;verified:boolean;sourceCheckStatus:'idle'|'checking'|'verified'|'failed';importedAt?:number;sourceExpiresAt?:number;foundShipping:{amount:number;currency:string;destination?:string}|null;
};
const countryAliases:Record<string,string>={'United States':'США','US':'США','AQSh':'США','Spain':'Испания','Ispaniya':'Испания','Germany':'Германия','Germaniya':'Германия','United Kingdom':'Великобритания','Buyuk Britaniya':'Великобритания','France':'Франция','Fransiya':'Франция','Italy':'Италия','Italiya':'Италия','Romania':'Румыния','Ruminiya':'Румыния','China':'Китай','Xitoy':'Китай','Turkey':'Турция','Turkiya':'Турция','Japan':'Япония','Yaponiya':'Япония','South Korea':'Южная Корея','Janubiy Koreya':'Южная Корея','United Arab Emirates':'ОАЭ','BAA':'ОАЭ','Canada':'Канада','Kanada':'Канада','Australia':'Австралия','Avstraliya':'Австралия','Other country':'Другая страна','Boshqa mamlakat':'Другая страна'};
const categoryAliases:Record<string,string>={'Shoes':'Обувь','Oyoq kiyim':'Обувь','Clothing':'Одежда','Kiyim':'Одежда','Electronics':'Электроника','Elektronika':'Электроника','Accessories':'Аксессуары','Aksessuarlar':'Аксессуары','Beauty & care':'Красота и уход','Go‘zallik va parvarish':'Красота и уход','Home & living':'Дом и быт','Uy va maishiy':'Дом и быт','Sports':'Спорт','Boshqa':'Другое','Other':'Другое'};
const canonicalCountry=(value:string)=>countryAliases[value]??value;
const canonicalCategory=(value:string)=>categoryAliases[value]??value;
export function GlobalLinkOrder() {
  const { ready, pricing, state, act, catalogProducts } = useMarket();
  const lang=state.communication.language;
  const c=lang==='ru'?{over:'ПОКУПКИ СО ВСЕГО МИРА',choose:'Выберите свой вариант',order:'Заказ по ссылке',checkPrice:'Проверьте размер и цену перед добавлением.',paste:'Вставьте ссылку — Atlas заполнит доступные данные.',loading:'Загружаем цену и варианты из магазина…',selected:'Товар уже выбран. Проверьте вариант и добавьте его в корзину.',edit:'Изменить ссылку',linkStep:'Ссылка на товар',stores:'eBay, Zara, Mango, Amazon и другие магазины.',storePage:'Страница магазина',get:'Получаем данные…',load:'Загрузить товар',directory:'Магазины для заказа по ссылке',storeHint:'Выбирайте региональную витрину по ссылке. Atlas считает итог с доставкой.',search:'Магазин или категория',enhanced:'цена + варианты',otherMatches:'Другие совпадения',allStores:'Все остальные магазины',notFound:'Такого магазина пока нет в списке. Можно прислать его оператору для проверки.',login:'Войдите в личный кабинет: автозагрузка защищена, а товар сохранится в вашей корзине.',original:'Открыть оригинал в магазине',loaded:'Что загрузилось и что нужно проверить',availability:'Проверьте наличие в магазине',availabilityHint:'Откройте страницу товара, проверьте выбранный размер или вариант и вернитесь с ответом.',openStore:'Открыть магазин',available:'Есть в наличии',unavailable:'Нет в наличии',openFirst:'Сначала откройте страницу магазина — после возврата кнопки ответа станут доступны.',thanks:'Спасибо. Можно проверить остальные данные и продолжить.',removed:'Товар не будет добавлен. Администратор получил сообщение для проверки.',dataStep:'Проверьте данные',name:'Название товара',namePlaceholder:'Название со страницы магазина',shipCountry:'Страна фактической отправки',countryLabel:'Страна отправки',currency:'Валюта магазина',otherCountry:'Укажите страну',price:'Цена товара',atlasShipping:'До склада Atlas',change:'изменить',useShipping:'Использовать доставку до склада Atlas',shippingNote:'Это доставка от магазина до склада Atlas. Если магазин её не публикует, используется изменяемый резерв $10.',category:'Категория',weight:'Вес товара с коробкой, кг',weightDetails:'Как уточняется вес доставки',forCalc:'для расчёта',variant:'Вариант товара',color:'Цвет',size:'Размер / модель',selectColor:'Выберите цвет',selectVariant:'Выберите вариант',none:'Нет',photo:'Фото товара — автоматически или по ссылке',image:'Адрес изображения',verified:'Я проверил данные и выбранный вариант.',add:'В корзину',adding:'Добавляем в корзину…',gallery:'Фотографии магазина',uz:'Узбекистан',empty:'Ваш товар появится здесь',fresh:'Когда проверены данные',freshText:'Перед оформлением ещё раз сверьте цену и наличие.',declaration:'Черновик декларации',cost:'Состав стоимости',reserve:'$10 — временный резерв доставки магазина. Менеджер проверит сумму после оформления.',subtotal:'Промежуточный итог',estimate:'С доставкой, ориентир',emptyQuote:'Вставьте ссылку или заполните цену и вес.',foot:'Расчёт использует настроенные тарифы Atlas, а не котировку перевозчика. Курс, маршрут, таможня и сроки уточняются до выкупа.'}:{over:lang==='uz'?'DUNYODAN XARIDLAR':'SHOP THE WORLD',choose:lang==='uz'?'Variantni tanlang':'Choose your option',order:lang==='uz'?'Havola orqali buyurtma':'Order by link',checkPrice:lang==='uz'?'Qo‘shishdan oldin o‘lcham va narxni tekshiring.':'Check the size and price before adding.',paste:lang==='uz'?'Havolani kiriting — Atlas ma’lumotlarni to‘ldiradi.':'Paste a link — Atlas will fill in the details.',loading:lang==='uz'?'Do‘kondan narx va variantlar yuklanmoqda…':'Loading price and options from the store…',selected:lang==='uz'?'Tovar tanlandi. Variantni tekshirib savatga qo‘shing.':'The item is selected. Check the option and add it to your cart.',edit:lang==='uz'?'Havolani o‘zgartirish':'Change link',linkStep:lang==='uz'?'Tovar havolasi':'Item link',stores:lang==='uz'?'eBay, Zara, Mango, Amazon va boshqa do‘konlar.':'eBay, Zara, Mango, Amazon and more.',storePage:lang==='uz'?'Do‘kon sahifasi':'Store page',get:lang==='uz'?'Ma’lumot olinmoqda…':'Getting product data…',load:lang==='uz'?'Tovarni yuklash':'Load item',directory:lang==='uz'?'Havola orqali buyurtma do‘konlari':'Stores for link orders',storeHint:lang==='uz'?'Havola orqali mintaqaviy vitrinani tanlang. Atlas yetkazish bilan hisoblaydi.':'Choose a regional storefront. Atlas calculates the total with delivery.',search:lang==='uz'?'Do‘kon yoki kategoriya':'Store or category',enhanced:lang==='uz'?'narx + variantlar':'price + options',otherMatches:lang==='uz'?'Boshqa moslar':'Other matches',allStores:lang==='uz'?'Boshqa barcha do‘konlar':'All other stores',notFound:lang==='uz'?'Bu do‘kon ro‘yxatda yo‘q. Tekshirish uchun operatorga yuborishingiz mumkin.':'This store is not listed yet. Send it to an operator for review.',login:lang==='uz'?'Kabinetga kiring: avtomatik yuklash himoyalangan va tovar savatda saqlanadi.':'Sign in: automatic import is protected and the item will be saved to your cart.',original:lang==='uz'?'Do‘kondagi asl sahifani ochish':'Open original store page',loaded:lang==='uz'?'Nimalar yuklandi va nimani tekshirish kerak':'What loaded and what to check',availability:lang==='uz'?'Do‘kondagi mavjudlikni tekshiring':'Check availability in the store',availabilityHint:lang==='uz'?'Tovar sahifasini oching, tanlangan o‘lcham yoki variantni tekshiring va javob bilan qayting.':'Open the item page, check the selected size or option, and return with your answer.',openStore:lang==='uz'?'Do‘konni ochish':'Open store',available:lang==='uz'?'Mavjud':'In stock',unavailable:lang==='uz'?'Mavjud emas':'Out of stock',openFirst:lang==='uz'?'Avval do‘kon sahifasini oching — qaytgach javob tugmalari yoqiladi.':'Open the store page first; the answer buttons will unlock when you return.',thanks:lang==='uz'?'Rahmat. Qolgan ma’lumotlarni tekshirib davom eting.':'Thanks. Check the remaining details to continue.',removed:lang==='uz'?'Tovar qo‘shilmaydi. Administrator tekshiradi.':'The item will not be added. An administrator will review it.',dataStep:lang==='uz'?'Ma’lumotlarni tekshiring':'Check the details',name:lang==='uz'?'Tovar nomi':'Item name',namePlaceholder:lang==='uz'?'Do‘kon sahifasidagi nom':'Name from the store page',shipCountry:lang==='uz'?'Haqiqiy jo‘natish mamlakati':'Actual dispatch country',countryLabel:lang==='uz'?'Jo‘natish mamlakati':'Dispatch country',currency:lang==='uz'?'Do‘kon valyutasi':'Store currency',otherCountry:lang==='uz'?'Mamlakatni kiriting':'Enter country',price:lang==='uz'?'Tovar narxi':'Item price',atlasShipping:lang==='uz'?'Atlas omborigacha':'To Atlas warehouse',change:lang==='uz'?'o‘zgartirish':'edit',useShipping:lang==='uz'?'Atlas omborigacha yetkazishni ishlatish':'Use delivery to Atlas warehouse',shippingNote:lang==='uz'?'Bu do‘kondan Atlas omborigacha yetkazish. Ko‘rsatilmasa, o‘zgartiriladigan $10 zaxira ishlatiladi.':'This is store-to-Atlas delivery. If unpublished, an editable $10 reserve is used.',category:lang==='uz'?'Kategoriya':'Category',weight:lang==='uz'?'Qutidagi og‘irlik, kg':'Boxed weight, kg',weightDetails:lang==='uz'?'Yetkazish og‘irligi qanday aniqlanadi':'How delivery weight is refined',forCalc:lang==='uz'?'hisoblash uchun':'for calculation',variant:lang==='uz'?'Tovar varianti':'Item option',color:lang==='uz'?'Rang':'Color',size:lang==='uz'?'O‘lcham / model':'Size / model',selectColor:lang==='uz'?'Rangni tanlang':'Choose a color',selectVariant:lang==='uz'?'Variantni tanlang':'Choose an option',none:lang==='uz'?'Yo‘q':'Unavailable',photo:lang==='uz'?'Tovar surati — avtomatik yoki havola orqali':'Product photo — automatic or by link',image:lang==='uz'?'Rasm manzili':'Image URL',verified:lang==='uz'?'Ma’lumot va variantni tekshirdim.':'I checked the details and selected option.',add:lang==='uz'?'Savatga':'Add to cart',adding:lang==='uz'?'Savatga qo‘shilmoqda…':'Adding to cart…',gallery:lang==='uz'?'Do‘kon rasmlari':'Store photos',uz:lang==='uz'?'O‘zbekiston':'Uzbekistan',empty:lang==='uz'?'Tovaringiz shu yerda paydo bo‘ladi':'Your item will appear here',fresh:lang==='uz'?'Ma’lumot qachon tekshirildi':'When the data was checked',freshText:lang==='uz'?'Rasmiylashtirishdan oldin narx va mavjudlikni yana tekshiring.':'Check price and availability again before checkout.',declaration:lang==='uz'?'Deklaratsiya qoralamasi':'Declaration draft',cost:lang==='uz'?'Narx tarkibi':'Cost breakdown',reserve:lang==='uz'?'$10 — do‘kon yetkazishi uchun vaqtinchalik zaxira. Menejer rasmiylashtirilgach tekshiradi.':'$10 is a temporary store-delivery reserve. A manager will verify it after the order.',subtotal:lang==='uz'?'Oraliq jami':'Interim total',estimate:lang==='uz'?'Yetkazish bilan taxmin':'Estimate with delivery',emptyQuote:lang==='uz'?'Havolani kiriting yoki narx va og‘irlikni to‘ldiring.':'Paste a link or enter price and weight.',foot:lang==='uz'?'Hisob Atlas tariflari bilan qilinadi, tashuvchi kotirovkasi emas. Kurs, yo‘nalish, bojxona va muddatlar xaridgacha aniqlanadi.':'The estimate uses Atlas tariffs, not a carrier quote. Rate, route, customs and timing are confirmed before purchase.'};
  const tx=(ru:string,uz:string,en:string)=>lang==='ru'?ru:lang==='uz'?uz:en;
  const searchParams = useSearchParams();
  const requestedUrl = searchParams.get("url") ?? "";
  const isSourcedFlow = Boolean(requestedUrl);
  const dealSeed = communityDeals.find(item => item.id === searchParams.get("deal") && item.url === requestedUrl);
  const dealOptions = dealSeed ? communityFallbackOptions(dealSeed).map(item => ({ ...item, available: true })) : [];
  const dealBoxedWeight = dealSeed ? Math.max(0.1, communityEstimatedWeight(dealSeed) - 0.5) : undefined;
  const seed = catalogProducts.find(item => item.sourceUrl === requestedUrl);
  const fallbackOptions: ProductVariant[] = seed ? seed.variants.map(label => ({ label, available: true })) : dealOptions;
  const fallbackBoxedWeight = seed?.boxedWeight ?? dealBoxedWeight;
  const [url, setUrl] = useState(() => searchParams.get("url") ?? ""),
    [source, setSource] = useState(seed?.sourceUrl ?? dealSeed?.url ?? ""),
    [name, setName] = useState(seed?.name ?? dealSeed?.title ?? ""),
    [brand, setBrand] = useState(seed?.brand ?? dealSeed?.store ?? ""),
    [declaration, setDeclaration] = useState(""),
    [currency, setCurrency] = useState("USD"),
    [amount, setAmount] = useState(seed ? String(seed.sourcePrice) : dealSeed ? String(dealSeed.price) : ""),
    [shipping, setShipping] = useState("10"),
    [shippingCurrency, setShippingCurrency] = useState("USD"),
    [shippingEstimated, setShippingEstimated] = useState(true),
    [weight, setWeight] = useState(fallbackBoxedWeight ? String(fallbackBoxedWeight) : ""),
    [country, setCountry] = useState("США"),
    [otherCountry, setOtherCountry] = useState(""),
    [category, setCategory] = useState(seed?.category ?? (dealSeed ? communityProductCategory(dealSeed) : "Другое")),
    [variant, setVariant] = useState(fallbackOptions.length === 1 ? fallbackOptions[0].label : ""),
    [variants, setVariants] = useState<ProductVariant[]>(fallbackOptions),
    [selectedColor, setSelectedColor] = useState(""),
    [selectedSize, setSelectedSize] = useState(""),
    [image, setImage] = useState(seed?.image ?? dealSeed?.image ?? ""),
    [images, setImages] = useState<string[]>(dealSeed?.image ? [dealSeed.image] : []),
    [storeSearch, setStoreSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false),
    [showSourceForm, setShowSourceForm] = useState(() => !requestedUrl),
    [note, setNote] = useState(seed ? "Данные из подборки " + seed.store + " на " + seed.observedOn + ". Atlas автоматически проверяет цену и вариант перед добавлением. Вес и доставка предварительные." : dealSeed ? `Цена и фото сохранены из подборки на ${dealSeed.observedOn}. Atlas сейчас автоматически уточняет их в магазине.` : ""),
    [weightOrigin, setWeightOrigin] = useState(tx("Оценка по категории","Kategoriya bo‘yicha taxmin","Category estimate")),
    [verified, setVerified] = useState(false),
    [sourceCheckStatus, setSourceCheckStatus] = useState<'idle'|'checking'|'verified'|'failed'>('idle'),
    [importedAt, setImportedAt] = useState<number | undefined>(),
    [sourceExpiresAt, setSourceExpiresAt] = useState<number | undefined>(),
    [foundShipping, setFoundShipping] = useState<{
      amount: number;
      currency: string;
      destination?: string;
    } | null>(null);
  const automaticallyLoaded = useRef<string | null>(null);
  const automaticRetryFor = useRef<string | null>(null);
  const draftStorageKey=`atlas:link-order:${requestedUrl||'manual'}`;
  const draftRestored=useRef(false),draftCanSkipAutomaticLoad=useRef(false),draftPersistenceReady=useRef(false);

  useEffect(()=>{
    draftRestored.current=false;draftCanSkipAutomaticLoad.current=false;draftPersistenceReady.current=false;
    try{
      const raw=sessionStorage.getItem(draftStorageKey);
      if(raw&&raw.length<300000){
        const value=JSON.parse(raw) as Partial<LinkOrderDraftSnapshot>;
        const usable=typeof value==='object'&&value!==null&&typeof value.source==='string'&&value.source.length>0&&typeof value.sourceCheckStatus==='string';
        const fresh=usable&&value.sourceCheckStatus==='verified'&&typeof value.sourceExpiresAt==='number'&&value.sourceExpiresAt>Date.now();
        if(usable&&(fresh||(!requestedUrl&&value.source))){
          const text=(item:unknown,fallback='')=>typeof item==='string'?item:fallback;
          draftRestored.current=true;draftCanSkipAutomaticLoad.current=Boolean(fresh);
          queueMicrotask(()=>{
            setUrl(text(value.url,requestedUrl));setSource(text(value.source));setName(text(value.name));setBrand(text(value.brand));setDeclaration(text(value.declaration));
            setCurrency(text(value.currency,'USD'));setAmount(text(value.amount));setShipping(text(value.shipping,'10'));setShippingCurrency(text(value.shippingCurrency,'USD'));setShippingEstimated(value.shippingEstimated!==false);
            setWeight(text(value.weight));setCountry(canonicalCountry(text(value.country,'Другая страна')));setOtherCountry(text(value.otherCountry));setCategory(canonicalCategory(text(value.category,'Другое')));setVariant(text(value.variant));
            setVariants(Array.isArray(value.variants)?value.variants.slice(0,250):[]);setSelectedColor(text(value.selectedColor));setSelectedSize(text(value.selectedSize));setImage(text(value.image));setImages(Array.isArray(value.images)?value.images.filter((item):item is string=>typeof item==='string').slice(0,12):[]);
            setShowSourceForm(value.showSourceForm===true);setNote(text(value.note));setWeightOrigin(text(value.weightOrigin));setVerified(value.verified===true);
            setSourceCheckStatus(value.sourceCheckStatus==='verified'||value.sourceCheckStatus==='failed'||value.sourceCheckStatus==='checking'?value.sourceCheckStatus:'idle');
            setImportedAt(typeof value.importedAt==='number'?value.importedAt:undefined);setSourceExpiresAt(typeof value.sourceExpiresAt==='number'?value.sourceExpiresAt:undefined);
            setFoundShipping(value.foundShipping&&typeof value.foundShipping.amount==='number'?{amount:value.foundShipping.amount,currency:text(value.foundShipping.currency),destination:text(value.foundShipping.destination)||undefined}:null);
          });
        }
      }
    }catch{}
    draftPersistenceReady.current=true;
  },[draftStorageKey,requestedUrl]);

  useEffect(()=>{
    if(!draftPersistenceReady.current)return;
    const snapshot:LinkOrderDraftSnapshot={url,source,name,brand,declaration,currency,amount,shipping,shippingCurrency,shippingEstimated,weight,country,otherCountry,category,variant,variants,selectedColor,selectedSize,image,images,showSourceForm,note,weightOrigin,verified,sourceCheckStatus,importedAt,sourceExpiresAt,foundShipping};
    try{sessionStorage.setItem(draftStorageKey,JSON.stringify(snapshot))}catch{}
  },[draftStorageKey,url,source,name,brand,declaration,currency,amount,shipping,shippingCurrency,shippingEstimated,weight,country,otherCountry,category,variant,variants,selectedColor,selectedSize,image,images,showSourceForm,note,weightOrigin,verified,sourceCheckStatus,importedAt,sourceExpiresAt,foundShipping]);
  const variantColors = useMemo(() => [...new Set(variants.map(item => item.color).filter((value): value is string => Boolean(value)))], [variants]);
  const variantsForColor = useMemo(() => selectedColor ? variants.filter(item => item.color === selectedColor) : variantColors.length ? [] : variants, [variants,selectedColor,variantColors]);
  const variantSizes = useMemo(() => [...new Set(variantsForColor.map(item => item.size).filter((value): value is string => Boolean(value)))], [variantsForColor]);
  const variantSizeLabel = useMemo(() => [...new Set(variantsForColor.map(item => item.sizeLabel).filter((value): value is string => Boolean(value)))].join(' / ') || (lang==='ru'?'Размер / модель':lang==='uz'?'O‘lcham / model':'Size / model'), [variantsForColor,lang]);
  function applyVariantChoice(item:ProductVariant|undefined,knownCurrency=true){
    if(!item||!item.available){setVariant("");setSelectedSize("");setVerified(false);return}
    setVariant(item.label);setSelectedColor(item.color??"");setSelectedSize(item.size??"");
    if(item.price!==undefined&&knownCurrency)setAmount(String(item.price));else if(variants.some(value=>value.price!==undefined))setAmount("");
    if(item.image)setImage(item.image);setVerified(false);
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
    setUrl(link);
    setBusy(true);
    setSource(link);
    setVerified(false);
    setSourceCheckStatus('checking');
    setName(seed?.name ?? dealSeed?.title ?? "");
    setBrand(seed?.brand ?? dealSeed?.store ?? "");
    setDeclaration("");
    setAmount(seed?.sourcePrice !== undefined ? String(seed.sourcePrice) : dealSeed ? String(dealSeed.price) : "");
    setCurrency(seed?.sourceCurrency ?? "USD");
    setShipping("10");
    setShippingCurrency("USD");
    setShippingEstimated(true);
    setImage(seed?.image ?? dealSeed?.image ?? "");
    setImages(seed?.image ? [seed.image] : dealSeed?.image ? [dealSeed.image] : []);
    setImportedAt(undefined);
    setSourceExpiresAt(undefined);
    setWeight(fallbackBoxedWeight ? String(fallbackBoxedWeight) : "");
    const inferredCountry = seed?.country ?? inferStorefrontCountry(link, seed?.sourceCurrency);
    setCountry(canonicalCountry(inferredCountry ?? "Другая страна"));
    setOtherCountry("");
    setCategory(canonicalCategory(seed?.category ?? (dealSeed ? communityProductCategory(dealSeed) : "Другое")));
    setVariant(fallbackOptions.length === 1 ? fallbackOptions[0].label : "");
    setVariants(fallbackOptions);
    setSelectedColor("");
    setSelectedSize("");
    setNote(dealSeed ? `Цена и фото сохранены из подборки на ${dealSeed.observedOn}. Atlas уточняет их в магазине.` : "");
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
        fetchedAt?: number;
        expiresAt?: number;
        cached?: boolean;
      } = await response.json();
      if (!response.ok)
        throw Error(data.error ?? tx("Не удалось получить данные магазина.", "Do‘kon ma’lumotlarini olib bo‘lmadi.", "Could not load store data."));
      setSource(data.sourceUrl);
      setName(data.title ?? seed?.name ?? dealSeed?.title ?? "");
      setBrand(data.brand ?? seed?.brand ?? dealSeed?.store ?? new URL(data.sourceUrl).hostname);
      setImage(data.image ?? seed?.image ?? dealSeed?.image ?? "");
      setImages(data.images?.length ? data.images : data.image ? [data.image] : seed?.image ? [seed.image] : dealSeed?.image ? [dealSeed.image] : []);
      const nextCategory = canonicalCategory(
        data.category ??
        seed?.category ??
        inferProductCategory(data.title ?? "", data.brand ?? ""),
      );
      setCategory(nextCategory);
      setDeclaration(data.declarationDescription ?? "");
      setCurrency(
        currencies.includes(data.currency ?? "") ? data.currency! : "USD",
      );
      const knownCurrency = currencies.includes(data.currency ?? "");
      if (data.price !== undefined && knownCurrency) setAmount(String(data.price));
      else if (seed?.sourcePrice !== undefined) setAmount(String(seed.sourcePrice));
      else if (dealSeed) setAmount(String(dealSeed.price));
      const receivedVariants = data.variants ?? [];
      const importedVariants = hasSelectableDimensions(fallbackOptions) && !hasSelectableDimensions(receivedVariants)
        ? fallbackOptions
        : receivedVariants.length
          ? receivedVariants
          : fallbackOptions;
      const safeVariants = knownCurrency ? importedVariants : importedVariants.map(item => ({...item, price: undefined}));
      const availableVariants = safeVariants.filter(v => v.available);
      setVariants(safeVariants);
      const selectedId = new URL(data.sourceUrl).searchParams.get('variant');
      const selectedVariant = availableVariants.find(item => item.id && item.id === selectedId)
        ?? (availableVariants.length === 1 ? availableVariants[0] : undefined);
      if (selectedVariant) {
        setVariant(selectedVariant.label);
        setSelectedColor(selectedVariant.color??"");
        setSelectedSize(selectedVariant.size??"");
        if (selectedVariant.price !== undefined && knownCurrency) setAmount(String(selectedVariant.price));
        if (selectedVariant.image) setImage(selectedVariant.image);
      } else {
        const colors=[...new Set(availableVariants.map(item=>item.color).filter((value):value is string=>Boolean(value)))];
        if(colors.length===1)setSelectedColor(colors[0]);
      }
      const nextCountry = canonicalCountry(data.country ?? seed?.country ?? inferStorefrontCountry(data.sourceUrl, data.currency) ?? "Другая страна");
      setCountry(nextCountry);
      if (!data.currency || !currencies.includes(data.currency))
        setCurrency(currencyForCountry(nextCountry) ?? "USD");
      const importedWeight=validBoxedWeight(data.boxedWeight);
      setWeight(String(importedWeight ?? fallbackBoxedWeight ?? estimatedBoxedWeight(nextCategory)));
      setWeightOrigin(
        importedWeight
          ? data.weightKind === "shipping"
            ? tx("Вес отправления со страницы","Sahifadagi jo‘natma og‘irligi","Shipping weight from page")
            : tx("Вес товара со страницы — коробку нужно проверить","Sahifadagi tovar og‘irligi — qutini tekshirish kerak","Product weight from page; verify the box")
          : fallbackBoxedWeight
            ? tx("Оценка Atlas; уточняется перед оформлением","Atlas bahosi; rasmiylashtirishdan oldin aniqlanadi","Atlas estimate; refined before checkout")
            : tx("Приблизительно по категории","Kategoriya bo‘yicha taxminan","Approximate by category"),
      );
      setImportedAt(data.fetchedAt ?? Date.now());
      setSourceExpiresAt(data.expiresAt);
      setSourceCheckStatus('verified');
      // Shipping may depend on destination/session; require explicit confirmation even if found.
      if (data.shipping !== undefined) {
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
        data.shipping !== undefined
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
      setNote(dealSeed ? tx(`Магазин не ответил сразу. Показываем сохранённые данные подборки на ${dealSeed.observedOn}; Atlas автоматически повторит проверку перед добавлением.`, `Do‘kon darhol javob bermadi. ${dealSeed.observedOn} dagi saqlangan tanlov ma’lumotlari ko‘rsatilmoqda; Atlas qo‘shishdan oldin avtomatik qayta tekshiradi.`, `The store did not respond immediately. Showing the saved ${dealSeed.observedOn} collection data; Atlas will retry automatically before adding.`) : seed ? tx("Магазин не ответил сразу. Каталожные данные показаны, но Atlas автоматически проверит источник перед добавлением.", "Do‘kon darhol javob bermadi. Katalog ma’lumotlari ko‘rsatilmoqda, lekin Atlas qo‘shishdan oldin manbani avtomatik tekshiradi.", "The store did not respond immediately. Catalog data is shown, but Atlas will automatically verify the source before adding.") : `${(e as Error).message} ${tx("Atlas не сможет добавить товар, пока источник не подтвердит цену и наличие.", "Manba narx va mavjudlikni tasdiqlamaguncha Atlas tovarni qo‘sha olmaydi.", "Atlas cannot add the item until the source confirms price and availability.")}`);
      setWeight(String(fallbackBoxedWeight ?? estimatedBoxedWeight(category)));
      setWeightOrigin(fallbackBoxedWeight ? tx("Оценка Atlas; уточняется перед оформлением","Atlas bahosi; rasmiylashtirishdan oldin aniqlanadi","Atlas estimate; refined before checkout") : tx("Приблизительно по категории","Kategoriya bo‘yicha taxminan","Approximate by category"));
      setSourceCheckStatus('failed');
      if (!dealSeed && !seed) setShowSourceForm(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!ready || !requestedUrl || automaticallyLoaded.current === requestedUrl) return;
    if(draftRestored.current&&draftCanSkipAutomaticLoad.current){
      automaticallyLoaded.current=requestedUrl;
      setShowSourceForm(false);
      return;
    }
    automaticallyLoaded.current = requestedUrl;
    setUrl(requestedUrl);
    setShowSourceForm(false);
    void load(requestedUrl);
    // `load` intentionally reads the current form state; this effect runs once per requested product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestedUrl]);
  useEffect(() => {
    if (sourceCheckStatus !== 'failed' || !source || automaticRetryFor.current === source) return;
    automaticRetryFor.current = source;
    const timer = window.setTimeout(() => void load(source), 1200);
    return () => window.clearTimeout(timer);
    // The retry is intentionally keyed only by the checked source. `load`
    // reads the current form state and is recreated on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCheckStatus, source]);
  let preview: ReturnType<typeof price> | null = null,
    estimatedWeight = 0;
  try {
    if (amount && weight) {
      estimatedWeight = paddedWeight(Number(weight));
      preview = price(
        toUsd(Number(amount), currency, pricing.rates),
        estimatedWeight,
        1,
        shipping
          ? toUsd(Number(shipping), shippingCurrency, pricing.rates)
          : 0,
        pricing,
      );
    }
  } catch {}
  const previewProduct: Product = {
    id: "preview",
    name: name || "Фото товара",
    brand: brand || (source ? new URL(source).hostname : ""),
    category,
    usd: 1,
    weight: 1,
    image,
    variants: [""],
  };
  const normalizedStoreSearch = storeSearch.trim().toLowerCase();
  const localCountry=(value:string)=>{const canonical=canonicalCountry(value);return lang==='ru'?canonical:lang==='uz'?(canonical==='США'?'AQSh':canonical==='Другая страна'?'Boshqa mamlakat':canonical==='Великобритания'?'Buyuk Britaniya':canonical==='Германия'?'Germaniya':canonical==='Испания'?'Ispaniya':canonical==='Франция'?'Fransiya':canonical):canonical==='США'?'United States':canonical==='Другая страна'?'Other country':canonical==='Великобритания'?'United Kingdom':canonical==='Германия'?'Germany':canonical==='Испания'?'Spain':canonical==='Франция'?'France':canonical;};
  const localizedCountries=countries.map(localCountry);
  const categoryLabel=(value:string)=>{const canonical=canonicalCategory(value);return lang==='ru'?canonical:lang==='uz'?({'Обувь':'Oyoq kiyim','Одежда':'Kiyim','Электроника':'Elektronika','Аксессуары':'Aksessuarlar','Красота и уход':'Go‘zallik va parvarish','Дом и быт':'Uy va maishiy','Спорт':'Sport','Другое':'Boshqa'}[canonical]??canonical):({'Обувь':'Shoes','Одежда':'Clothing','Электроника':'Electronics','Аксессуары':'Accessories','Красота и уход':'Beauty & care','Дом и быт':'Home & living','Спорт':'Sports','Другое':'Other'}[canonical]??canonical);};
  const localizedCategories=weightCategories.map(categoryLabel);
  const visibleStoreGroups = featuredStoreGroups.map(group => ({
    ...group,
    stores: group.stores.filter(store => !normalizedStoreSearch || `${store.name} ${store.root} ${store.focus}`.toLowerCase().includes(normalizedStoreSearch)),
  })).filter(group => group.stores.length);
  const featuredRoots = new Set<string>(featuredStoreGroups.flatMap(group => group.stores.map(store => store.root)));
  const otherStoreRoots = supportedStoreRoots.filter(root => !featuredRoots.has(root) && (!normalizedStoreSearch || root.includes(normalizedStoreSearch)));
  return (
    <>
      <PageHeading overline={c.over} title={isSourcedFlow ? c.choose : c.order} description={isSourcedFlow ? c.checkPrice : c.paste}/>
      <div className="link-layout">
        <section className="surface link-form">
          {isSourcedFlow && !showSourceForm && <div className="notice" role="status">{busy ? <><Loader2 className="spin" size={18}/> {c.loading}</> : <>{c.selected}</>}<button type="button" className="text-button" onClick={() => setShowSourceForm(true)}>{c.edit}</button></div>}
          {(showSourceForm || !requestedUrl) && <>
          <div className="step-heading">
            <b>01</b>
            <div>
              <h2>{c.linkStep}</h2>
              <p>{c.stores}</p>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void load();
            }}
            aria-busy={busy}
          >
            <div className="field">
              <label htmlFor="source-url">{c.storePage}</label>
              <input
                id="source-url"
                type="url"
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
                placeholder="https://www.ebay.es/itm/…"
              />
            </div>
            <button className="btn primary" disabled={busy || !ready}>
              {busy ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <Link2 size={18} />
              )}{" "}
              {busy ? c.get : c.load}
            </button>
          </form>
          <details className="import-store-directory">
            <summary>{c.directory} · {supportedStoreRoots.length}</summary>
            <p className="micro">{c.storeHint}</p>
            <input type="search" aria-label={c.search} placeholder={c.search} value={storeSearch} onChange={event => setStoreSearch(event.target.value)} />
            <div className="store-region-grid">
              {visibleStoreGroups.map(group => <section key={group.region} className="store-region">
                <div><h3>{group.region}</h3><p>{group.hint}</p></div>
                <div className="import-store-links featured">
                  {group.stores.map(store => <a key={`${group.region}-${store.root}`} href={`https://${store.root}`} target="_blank" rel="noopener noreferrer"><span><b>{store.name}</b><em>{store.focus}</em></span>{hasEnhancedStoreImport(store.root)&&<small>{c.enhanced}</small>}</a>)}
                </div>
              </section>)}
            </div>
            {otherStoreRoots.length>0&&<details className="all-store-list" open={Boolean(normalizedStoreSearch)}><summary>{normalizedStoreSearch?c.otherMatches:c.allStores} · {otherStoreRoots.length}</summary><div className="import-store-links">
              {otherStoreRoots.map(host => <a key={host} href={`https://${host}`} target="_blank" rel="noopener noreferrer">{host}{hasEnhancedStoreImport(host)&&<small>{c.enhanced}</small>}</a>)}
            </div></details>}
            {!visibleStoreGroups.length&&!otherStoreRoots.length&&<p className="notice">{c.notFound}</p>}
          </details>
          </>}
          {!ready && (
            <p className="notice">{c.login}</p>
          )}
          {note && (
            <div className="notice" role="status">
              {source ? <><a className="text-link source-check-link" href={source} target="_blank" rel="noopener noreferrer">{c.original} <ExternalLink size={15}/></a><details className="import-status-details"><summary>{c.loaded}</summary><p>{note}</p></details></> : <p>{note}</p>}
            </div>
          )}
          {source&&sourceCheckStatus!=='verified'&&<p className="micro source-auto-status" role="status">
            {sourceCheckStatus==='checking'
              ? tx('Atlas автоматически проверяет цену и наличие…','Atlas narx va mavjudlikni avtomatik tekshirmoqda…','Atlas is checking price and availability automatically…')
              : sourceCheckStatus==='failed'
                ? <>{tx('Магазин пока не ответил. Товар нельзя добавить, пока Atlas не подтвердит данные.','Do‘kon hozircha javob bermadi. Atlas ma’lumotlarni tasdiqlamaguncha tovarni qo‘shib bo‘lmaydi.','The store has not responded yet. The item cannot be added until Atlas confirms the data.')} <button type="button" className="text-button" disabled={busy} onClick={() => void load(source)}>{tx('Повторить проверку','Tekshiruvni qayta urinish','Retry check')}</button></>
                : tx('Atlas проверит магазин перед добавлением.','Atlas qo‘shishdan oldin do‘konni tekshiradi.','Atlas will check the store before adding the item.')}
          </p>}
          {source && !busy && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if(sourceCheckStatus!=='verified')throw Error(tx('Дождитесь автоматической проверки магазина.','Do‘konning avtomatik tekshiruvi tugashini kuting.','Wait for the automatic store check to finish.'));
                  if (!name.trim() || !variant.trim() || !verified)
                     throw Error(tx("Проверьте данные и подтвердите страну отправки.","Ma’lumotlarni tekshirib, jo‘natish mamlakatini tasdiqlang.","Check the details and confirm the dispatch country."));
                  if (country === "Другая страна" && !otherCountry.trim())
                     throw Error(tx("Введите страну отправки.","Jo‘natish mamlakatini kiriting.","Enter the dispatch country."));
                  if (shipping === "")
                     throw Error(tx("Укажите доставку магазина; 0 — только если она бесплатная.","Do‘kon yetkazishini kiriting; 0 faqat bepul bo‘lsa.","Enter store shipping; use 0 only when it is free."));
                  const img = image ? safeImage(image, source) : "";
                  if (image && !img)
                     throw Error(tx("Изображение должно иметь публичный HTTPS-адрес.","Rasm ommaviy HTTPS manziliga ega bo‘lishi kerak.","The image must have a public HTTPS URL."));
                  const p: Product = {
                    id: source + "#" + variant.trim(),
                    name: name.trim(),
                    brand: brand || new URL(source).hostname,
                    category,
                    usd: toUsd(Number(amount), currency, pricing.rates),
                    weight: paddedWeight(Number(weight)),
                    image: img ?? "",
                    sourceUrl: source,
                    sourceVariantId: variants.find(item => item.label === variant.trim())?.id,
                    variants: [variant.trim()],
                    country:
                      country === "Другая страна"
                        ? otherCountry.trim()
                        : country,
                    sourceCurrency: currency,
                    sourcePrice: Number(amount),
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
                    importedAt,
                    sourceExpiresAt,
                     imageOrigin: importedAt ? tx("страница магазина","do‘kon sahifasi","store page") : tx("ручной ввод","qo‘lda kiritish","manual entry"),
                    declarationDescription: declaration || undefined,
                  };
                  price(p.usd, p.weight, 1, p.sourceShippingUsd, pricing);
                  setAdding(true);
                  const added = await act({ type: "cart-add", product: p, variant: variant.trim() });
                   if (added) toast.success(tx("Товар добавлен в корзину","Tovar savatga qo‘shildi","Item added to cart"), { action: { label: tx("Открыть корзину","Savatni ochish","Open cart"), onClick: () => window.location.assign("/cart") } });
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setAdding(false);
                }
              }}
            >
              <div className="step-heading second-step">
                <b>02</b>
                <div>
                  <h2>{c.dataStep}</h2>
                </div>
              </div>
              <div className="field">
                <label htmlFor="name">{c.name}</label>
                <input
                  id="name"
                  required
                  maxLength={140}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={c.namePlaceholder}
                />
              </div>
              <div className="two-fields">
                <div className="field">
                  <label>{c.shipCountry}</label>
                  <Choice
                    label={c.countryLabel}
                    value={localCountry(country)}
                    onChange={(v) => {
                      setCountry(canonicalCountry(countries.find(value=>localCountry(value)===v)??v));
                      setVerified(false);
                    }}
                    options={localizedCountries}
                  />
                </div>
                <div className="field">
                  <label>{c.currency}</label>
                  <Choice
                    label={c.currency}
                    value={currency}
                    onChange={(v) => {
                      setCurrency(v);
                      setVerified(false);
                    }}
                    options={currencies}
                  />
                </div>
              </div>
              {country === "Другая страна" && (
                <div className="field">
                  <label htmlFor="other-country">{c.otherCountry}</label>
                  <input
                    id="other-country"
                    required
                    maxLength={60}
                    value={otherCountry}
                    onChange={(e) => setOtherCountry(e.target.value)}
                  />
                </div>
              )}
              <div className="two-fields">
                <div className="field">
                  <label htmlFor="amount">{c.price}, {currency}</label>
                  <input
                    id="amount"
                    type="number"
                    required
                    min=".01"
                    step=".01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="shipping">
                    {c.atlasShipping}, {shippingCurrency}{" "}
                    {shippingEstimated ? `(${c.change})` : ""}
                  </label>
                  <input
                    id="shipping"
                    type="number"
                    required
                    min="0"
                    step=".01"
                    value={shipping}
                    onChange={(e) => {
                      setShipping(e.target.value);
                      setShippingEstimated(true);
                      setVerified(false);
                    }}
                  />
                </div>
              </div>
              <div>
                {foundShipping && shippingEstimated && (
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => {
                      if (!currencies.includes(foundShipping.currency)) {
                        toast.error(
                          "Валюта доставки не поддерживается: укажите эквивалент в USD.",
                        );
                        return;
                      }
                      setShipping(String(foundShipping.amount));
                      setShippingCurrency(foundShipping.currency);
                      setShippingEstimated(false);
                      setVerified(false);
                    }}
                  >
                    {c.useShipping}: {foundShipping.amount}{" "}
                    {foundShipping.currency}
                    {foundShipping.destination ? " · " + foundShipping.destination : ""}
                  </button>
                )}
              </div>
              <p className="micro">{c.shippingNote}</p>
              <div className="two-fields">
                <div className="field">
                  <label>{c.category}</label>
                  <Choice
                    label={c.category}
                    value={categoryLabel(category)}
                    onChange={(v) => {
                      const canonical=canonicalCategory(weightCategories.find(value=>categoryLabel(value)===v)??v);
                      setCategory(canonical);
                      setWeight(String(estimatedBoxedWeight(canonical)));
                      setWeightOrigin(tx("Приблизительно по категории","Kategoriya bo‘yicha taxminan","Estimated by category"));
                    }}
                    options={localizedCategories}
                  />
                </div>
                <div className="field">
                  <label htmlFor="weight">{c.weight}</label>
                  <input
                    id="weight"
                    type="number"
                    inputMode="decimal"
                    required
                    min=".01"
                    max="49.5"
                    step=".01"
                    value={weight}
                    onChange={(e) => {
                      setWeight(e.target.value);
                      setWeightOrigin(tx("Указан покупателем","Xaridor kiritdi","Entered by customer"));
                    }}
                    onBlur={() => {
                      const valid=validBoxedWeight(weight);
                      if(valid!==undefined){setWeight(String(valid));return}
                      setWeight(String(estimatedBoxedWeight(category)));
                      setWeightOrigin(tx("Приблизительно по категории","Kategoriya bo‘yicha taxminan","Estimated by category"));
                      toast.error(tx("Вес должен быть от 0,01 до 49,5 кг. Вернули безопасную оценку.","Og‘irlik 0,01–49,5 kg bo‘lishi kerak. Xavfsiz baho qaytarildi.","Weight must be between 0.01 and 49.5 kg. A safe estimate was restored."));
                    }}
                  />
                </div>
              </div>
              <details className="quote-details"><summary>{c.weightDetails}</summary><div className="weight-formula">
                <Scale size={23} />
                <div>
                  <strong>
                     {estimatedWeight ? estimatedWeight.toFixed(2) : "—"} {lang==='ru'?'кг':'kg'} {c.forCalc}
                  </strong>
                  <p>
                     {weight || c.weight} + 0,3 {lang==='ru'?'кг':'kg'} {tx('упаковка','qadoq','packaging')} + 0,2 {lang==='ru'?'кг':'kg'} {tx('запас','zaxira','allowance')}; {tx('минимум к оплате — 1 кг','minimal to‘lov — 1 kg','1 kg minimum billed')}
                  </p>
                  <small>
                    {weightOrigin}. {tx("После склада — перерасчёт по фактическому или объёмному весу.","Ombordan so‘ng haqiqiy yoki hajmiy og‘irlik bo‘yicha qayta hisoblanadi.","After warehouse intake, the actual or dimensional weight is settled.")}
                  </small>
                </div>
              </div></details>
              <div className="field variant-matrix">
                <label htmlFor="variant">{c.variant}</label>
                {variants.length && (variantColors.length||variantSizes.length) ? <>
                  {variantColors.length>0&&<div className="variant-step"><div><b>{c.color}</b><span>{selectedColor||c.selectColor}</span></div><div className="variant-options">{variantColors.map(color=>{const choices=variants.filter(item=>item.color===color),available=choices.some(item=>item.available);return <button type="button" key={color} disabled={!available} aria-pressed={selectedColor===color} onClick={()=>{setSelectedColor(color);setSelectedSize('');const purchasable=choices.filter(item=>item.available);if(!purchasable.some(item=>item.size)&&purchasable[0])applyVariantChoice(purchasable[0]);else{setVariant('');setVerified(false)}}}>{color}{!available&&<small>{c.none}</small>}</button>})}</div></div>}
                  {(variantColors.length===0||selectedColor)&&variantSizes.length>0&&<div className="variant-step"><div><b>{variantSizeLabel||c.size}</b><span>{selectedSize||c.selectVariant}</span></div><div className="variant-options sizes">{variantSizes.map(size=>{const choices=variantsForColor.filter(item=>item.size===size),choice=choices.find(item=>item.available),price=choice?.price;return <button type="button" key={size} disabled={!choice} aria-pressed={selectedSize===size} onClick={()=>applyVariantChoice(choice)}><span>{size}</span>{choice&&price!==undefined&&<small>{price} {currency}</small>}{!choice&&<small>{c.none}</small>}</button>})}</div></div>}
                   {!variantColors.length&&!variantSizes.length&&<Choice label={c.variant} value={variant} onChange={value=>applyVariantChoice(variants.find(item=>item.label===value))} options={variants.filter(item=>item.available).map(item=>item.label)}/>}
                   <input id="variant" value={variant} readOnly required className="sr-only" aria-label={c.variant}/>
                 </> : variants.length ? <Choice label={c.variant} value={variant} onChange={value=>applyVariantChoice(variants.find(item=>item.label===value))} options={variants.filter(item=>item.available).map(item=>item.label)}/> : (
                  <input
                    id="variant"
                    required
                    maxLength={80}
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    placeholder={lang==='ru'?"Например: EU 42, чёрный":lang==='uz'?"Masalan: EU 42, qora":"For example: EU 42, black"}
                  />
                )}
              </div>
              <details className="image-edit">
                <summary>{c.photo}</summary>
                <div className="field">
                  <label htmlFor="image">{c.image}</label>
                  <input
                    id="image"
                    type="url"
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://…/product.jpg"
                  />
                </div>
              </details>
              <div className="consent">
                <Checkbox
                  id="data-verified"
                  checked={verified}
                  onCheckedChange={(v) => setVerified(v === true)}
                />
                <label htmlFor="data-verified">
                  {c.verified}
                </label>
              </div>
              <button className="btn primary" disabled={!verified || adding || sourceCheckStatus!=='verified'}>
                {adding ? c.adding : c.add}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </section>
        <aside className="surface quote-preview">
          {image && (
            <div className="import-photo">
              <ProductImage product={previewProduct} locale={lang} />
            </div>
          )}
          {images.length > 1 && (
            <div className="import-gallery" aria-label={c.gallery}>
              {images.map((photo, index) => <button type="button" key={photo} aria-label={`${c.gallery} ${index + 1}`} aria-pressed={image === photo} onClick={() => setImage(photo)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={photo} alt={`${c.gallery} ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" />
              </button>)}
            </div>
          )}
          <span className="eyebrow">
            {country === "Другая страна" ? otherCountry || country : country} → {c.uz}
          </span>
          <h2>{name || c.empty}</h2>
          {importedAt && (
            <details className="micro source-freshness"><summary>{c.fresh}</summary><p>
              {tx("Данные страницы проверены","Sahifa ma’lumotlari tekshirildi","Page data checked")} {new Date(importedAt).toLocaleString(lang==='ru'?'ru-RU':lang==='uz'?'uz-UZ':'en-US')}.
              {tx('Перед добавлением в корзину и оформлением Atlas снова запросит магазин.', 'Savatga qo‘shish va rasmiylashtirishdan oldin Atlas do‘kondan yana so‘raydi.', 'Atlas asks the store again before adding to cart and checkout.')}
            </p></details>
          )}
          {declaration && (
            <details className="declaration-preview"><summary>{c.declaration}</summary>
              <span>{declaration}</span>
            </details>
          )}
          {preview ? (
            <>
              <details className="quote-details"><summary>{c.cost}</summary><CostLines q={preview} shippingUnknown={shipping === ""} locale={lang}/>
              {shippingEstimated && (
                <p className="warning-text">
                  {c.reserve}
                </p>
              )}
              </details><div className="summary-total">
                <span>
                  {shipping === ""
                    ? c.subtotal
                    : c.estimate}
                </span>
                <strong>{money(preview.total)}</strong>
              </div>
              <CustomsEstimate valueUsd={toUsd(Number(amount), currency, pricing.rates)} grossKg={Number(weight) || undefined} fx={pricing.fx} locale={state.communication.language}/>
            </>
          ) : (
            <p>{c.emptyQuote}</p>
          )}
          <p className="micro">
            {c.foot}
          </p>
        </aside>
      </div>
    </>
  );
}
