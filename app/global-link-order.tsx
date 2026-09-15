"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, ExternalLink, Link2, Loader2, Scale, X } from "lucide-react";
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
export function GlobalLinkOrder() {
  const { ready, pricing, state, act, catalogProducts } = useMarket();
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
    [note, setNote] = useState(seed ? "Данные из подборки " + seed.store + " на " + seed.observedOn + ". Обновите страницу магазина или проверьте цену и вариант вручную. Вес и доставка предварительные." : dealSeed ? `Цена и фото сохранены из подборки на ${dealSeed.observedOn}. Atlas сейчас уточняет их в магазине.` : ""),
    [weightOrigin, setWeightOrigin] = useState("Оценка по категории"),
    [verified, setVerified] = useState(false),
    [manualAvailabilityRequired,setManualAvailabilityRequired]=useState(false),
    [storeOpened,setStoreOpened]=useState(false),
    [availabilityAnswer,setAvailabilityAnswer]=useState<'available'|'unavailable'|null>(null),
    [reportingAvailability,setReportingAvailability]=useState(false),
    [importedAt, setImportedAt] = useState<number | undefined>(),
    [sourceExpiresAt, setSourceExpiresAt] = useState<number | undefined>(),
    [foundShipping, setFoundShipping] = useState<{
      amount: number;
      currency: string;
      destination?: string;
    } | null>(null);
  const automaticallyLoaded = useRef<string | null>(null);
  const variantColors = useMemo(() => [...new Set(variants.map(item => item.color).filter((value): value is string => Boolean(value)))], [variants]);
  const variantsForColor = useMemo(() => selectedColor ? variants.filter(item => item.color === selectedColor) : variantColors.length ? [] : variants, [variants,selectedColor,variantColors]);
  const variantSizes = useMemo(() => [...new Set(variantsForColor.map(item => item.size).filter((value): value is string => Boolean(value)))], [variantsForColor]);
  const variantSizeLabel = useMemo(() => [...new Set(variantsForColor.map(item => item.sizeLabel).filter((value): value is string => Boolean(value)))].join(' / ') || 'Размер / модель', [variantsForColor]);
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
    setManualAvailabilityRequired(false);
    setStoreOpened(false);
    setAvailabilityAnswer(null);
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
    setCountry(inferredCountry ?? "Другая страна");
    setOtherCountry("");
    setCategory(seed?.category ?? (dealSeed ? communityProductCategory(dealSeed) : "Другое"));
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
        body: JSON.stringify({ url: link }),
      });
      const data: Extracted & {
        error?: string;
        fetchedAt?: number;
        expiresAt?: number;
        cached?: boolean;
      } = await response.json();
      if (!response.ok)
        throw Error(data.error ?? "Не удалось получить данные магазина.");
      setSource(data.sourceUrl);
      setName(data.title ?? seed?.name ?? dealSeed?.title ?? "");
      setBrand(data.brand ?? seed?.brand ?? dealSeed?.store ?? new URL(data.sourceUrl).hostname);
      setImage(data.image ?? seed?.image ?? dealSeed?.image ?? "");
      setImages(data.images?.length ? data.images : data.image ? [data.image] : seed?.image ? [seed.image] : dealSeed?.image ? [dealSeed.image] : []);
      const nextCategory =
        data.category ??
        seed?.category ??
        inferProductCategory(data.title ?? "", data.brand ?? "");
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
      const nextCountry = data.country ?? seed?.country ?? inferStorefrontCountry(data.sourceUrl, data.currency);
      if (nextCountry) {
        setCountry(nextCountry);
        if (!data.currency || !currencies.includes(data.currency))
          setCurrency(currencyForCountry(nextCountry) ?? "USD");
      }
      const importedWeight=validBoxedWeight(data.boxedWeight);
      setWeight(String(importedWeight ?? fallbackBoxedWeight ?? estimatedBoxedWeight(nextCategory)));
      setWeightOrigin(
        importedWeight
          ? data.weightKind === "shipping"
            ? "Вес отправления со страницы"
            : "Вес товара со страницы — коробку нужно проверить"
          : fallbackBoxedWeight
            ? "Оценка Atlas; уточняется перед оформлением"
            : "Приблизительно по категории",
      );
      setImportedAt(data.fetchedAt ?? Date.now());
      setSourceExpiresAt(data.expiresAt);
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
          ? "На странице указана доставка " +
            data.shipping +
            " " +
            (data.shippingCurrency ?? "") +
            (data.shippingDestination
              ? " для " + data.shippingDestination
              : "") +
            ". Это доставка от магазина до склада Atlas."
          : "";
      setNote(
        [
          data.title
            ? "Название и доступные данные загружены."
            : "Не все данные опубликованы.",
          data.cached ? "Использованы недавно проверенные данные." : "",
          ...data.warnings,
          shippingMessage,
          data.currency && !currencies.includes(data.currency)
            ? "Валюта " +
              data.currency +
              " пока не поддерживается: укажите эквивалент в поддерживаемой валюте."
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (e) {
      setNote(dealSeed ? `Магазин не отдал свежие данные. Показываем цену и варианты из подборки на ${dealSeed.observedOn}; перед добавлением Atlas попробует проверить их снова.` : seed ? "Магазин не отдал свежие данные. Сохранили цену и фото из каталога; перед добавлением Atlas попробует проверить их снова." : (e as Error).message + " Доступен ручной ввод.");
      setWeight(String(fallbackBoxedWeight ?? estimatedBoxedWeight(category)));
      setWeightOrigin(fallbackBoxedWeight ? "Оценка Atlas; уточняется перед оформлением" : "Приблизительно по категории");
      setManualAvailabilityRequired(Boolean(seed||dealSeed));
      if (!dealSeed && !seed) setShowSourceForm(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!ready || !requestedUrl || automaticallyLoaded.current === requestedUrl) return;
    automaticallyLoaded.current = requestedUrl;
    setUrl(requestedUrl);
    setShowSourceForm(false);
    void load(requestedUrl);
    // `load` intentionally reads the current form state; this effect runs once per requested product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestedUrl]);
  async function reportAvailability(answer:'available'|'unavailable'){
    const productId=seed?.id??dealSeed?.id;
    if(!productId||!source)return;
    setReportingAvailability(true);
    try{
      const response=await fetch('/api/catalog-availability',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,sourceUrl:source,answer,variant:variant||undefined})});
      const data=await response.json() as {error?:string};
      if(!response.ok)throw Error(data.error??'Не удалось отправить сообщение.');
      setAvailabilityAnswer(answer);
      setVerified(false);
      toast.success(answer==='available'?'Наличие подтверждено. Спасибо!':'Администратор получил сообщение и проверит товар.');
    }catch(error){toast.error((error as Error).message)}finally{setReportingAvailability(false)}
  }
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
  const visibleStoreGroups = featuredStoreGroups.map(group => ({
    ...group,
    stores: group.stores.filter(store => !normalizedStoreSearch || `${store.name} ${store.root} ${store.focus}`.toLowerCase().includes(normalizedStoreSearch)),
  })).filter(group => group.stores.length);
  const featuredRoots = new Set<string>(featuredStoreGroups.flatMap(group => group.stores.map(store => store.root)));
  const otherStoreRoots = supportedStoreRoots.filter(root => !featuredRoots.has(root) && (!normalizedStoreSearch || root.includes(normalizedStoreSearch)));
  return (
    <>
      <PageHeading
        overline="ПОКУПКИ СО ВСЕГО МИРА"
        title={isSourcedFlow ? "Выберите свой вариант" : "Заказ по ссылке"}
        description={isSourcedFlow ? "Проверьте размер и цену перед добавлением." : "Вставьте ссылку — Atlas заполнит доступные данные."}
      />
      <div className="link-layout">
        <section className="surface link-form">
          {isSourcedFlow && !showSourceForm && <div className="notice" role="status">{busy ? <><Loader2 className="spin" size={18}/> Загружаем цену и варианты из магазина…</> : <>Товар уже выбран. Проверьте вариант и добавьте его в корзину.</>}<button type="button" className="text-button" onClick={() => setShowSourceForm(true)}>Изменить ссылку</button></div>}
          {(showSourceForm || !requestedUrl) && <>
          <div className="step-heading">
            <b>01</b>
            <div>
              <h2>Ссылка на товар</h2>
              <p>eBay, Zara, Mango, Amazon и другие магазины.</p>
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
              <label htmlFor="source-url">Страница магазина</label>
              <input
                id="source-url"
                type="url"
                required
                value={url}
                disabled={busy}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setSource("");
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
              {busy ? "Получаем данные…" : "Загрузить товар"}
            </button>
          </form>
          <details className="import-store-directory">
            <summary>Магазины для заказа по ссылке · {supportedStoreRoots.length}</summary>
            <p className="micro">Выбирайте региональную витрину по ссылке. Испания часто выгодна на распродажах одежды и косметики, но Atlas считает итог с доставкой — одна страна не бывает дешевле для всех товаров.</p>
            <input type="search" aria-label="Поиск магазина" placeholder="Магазин или категория" value={storeSearch} onChange={event => setStoreSearch(event.target.value)} />
            <div className="store-region-grid">
              {visibleStoreGroups.map(group => <section key={group.region} className="store-region">
                <div><h3>{group.region}</h3><p>{group.hint}</p></div>
                <div className="import-store-links featured">
                  {group.stores.map(store => <a key={`${group.region}-${store.root}`} href={`https://${store.root}`} target="_blank" rel="noopener noreferrer"><span><b>{store.name}</b><em>{store.focus}</em></span>{hasEnhancedStoreImport(store.root)&&<small>цена + варианты</small>}</a>)}
                </div>
              </section>)}
            </div>
            {otherStoreRoots.length>0&&<details className="all-store-list" open={Boolean(normalizedStoreSearch)}><summary>{normalizedStoreSearch?'Другие совпадения':'Все остальные магазины'} · {otherStoreRoots.length}</summary><div className="import-store-links">
              {otherStoreRoots.map(host => <a key={host} href={`https://${host}`} target="_blank" rel="noopener noreferrer">{host}{hasEnhancedStoreImport(host)&&<small>цена + варианты</small>}</a>)}
            </div></details>}
            {!visibleStoreGroups.length&&!otherStoreRoots.length&&<p className="notice">Такого магазина пока нет в списке. Можно прислать его оператору для проверки.</p>}
          </details>
          </>}
          {!ready && (
            <p className="notice">
              Войдите в личный кабинет: автозагрузка защищена от
              злоупотреблений, а товар сохранится в вашей корзине.
            </p>
          )}
          {note && (
            <div className="notice" role="status">
              {source ? <><a className="text-link source-check-link" href={source} target="_blank" rel="noopener noreferrer">Открыть оригинал в магазине <ExternalLink size={15}/></a><details className="import-status-details"><summary>Что загрузилось и что нужно проверить</summary><p>{note}</p></details></> : <p>{note}</p>}
            </div>
          )}
          {manualAvailabilityRequired&&source&&<section className="availability-check" aria-labelledby="availability-check-title">
            <div><b id="availability-check-title">Проверьте наличие в магазине</b><p>Откройте страницу товара, посмотрите выбранный размер или вариант и вернитесь сюда с ответом.</p></div>
            <a className="btn secondary" href={source} target="_blank" rel="noopener noreferrer" onClick={()=>setStoreOpened(true)}>Открыть магазин<ExternalLink size={17}/></a>
            <div className="availability-actions" aria-label="Результат проверки наличия">
              <button type="button" className="btn secondary" disabled={!storeOpened||reportingAvailability} onClick={()=>void reportAvailability('available')}><Check size={17}/>Есть в наличии</button>
              <button type="button" className="btn secondary danger" disabled={!storeOpened||reportingAvailability} onClick={()=>void reportAvailability('unavailable')}><X size={17}/>Нет в наличии</button>
            </div>
            {!storeOpened&&<small>Сначала откройте страницу магазина — после возврата кнопки ответа станут доступны.</small>}
            {availabilityAnswer==='available'&&<p className="availability-result ok">Спасибо. Можно проверить остальные данные и продолжить.</p>}
            {availabilityAnswer==='unavailable'&&<p className="availability-result bad">Товар не будет добавлен. Администратор получил сообщение для проверки и снятия карточки.</p>}
          </section>}
          {source && !busy && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if(manualAvailabilityRequired&&availabilityAnswer!=='available')throw Error('Сначала проверьте наличие товара в магазине.');
                  if (!name.trim() || !variant.trim() || !verified)
                    throw Error(
                      "Проверьте данные и подтвердите страну отправки.",
                    );
                  if (country === "Другая страна" && !otherCountry.trim())
                    throw Error("Введите страну отправки.");
                  if (shipping === "")
                    throw Error(
                      "Укажите доставку магазина; 0 — только если она бесплатная.",
                    );
                  const img = image ? safeImage(image, source) : "";
                  if (image && !img)
                    throw Error(
                      "Изображение должно иметь публичный HTTPS-адрес.",
                    );
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
                    imageOrigin: importedAt
                      ? "страница магазина"
                      : "ручной ввод",
                    declarationDescription: declaration || undefined,
                  };
                  price(p.usd, p.weight, 1, p.sourceShippingUsd, pricing);
                  setAdding(true);
                  const added = await act({ type: "cart-add", product: p, variant: variant.trim() });
                  if (added) toast.success("Товар добавлен в корзину", { action: { label: "Открыть корзину", onClick: () => window.location.assign("/cart") } });
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
                  <h2>Проверьте данные</h2>
                </div>
              </div>
              <div className="field">
                <label htmlFor="name">Название товара</label>
                <input
                  id="name"
                  required
                  maxLength={140}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Название со страницы магазина"
                />
              </div>
              <div className="two-fields">
                <div className="field">
                  <label>Страна фактической отправки</label>
                  <Choice
                    label="Страна отправки"
                    value={country}
                    onChange={(v) => {
                      setCountry(v);
                      setVerified(false);
                    }}
                    options={countries}
                  />
                </div>
                <div className="field">
                  <label>Валюта магазина</label>
                  <Choice
                    label="Валюта"
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
                  <label htmlFor="other-country">Укажите страну</label>
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
                  <label htmlFor="amount">Цена товара, {currency}</label>
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
                    До склада Atlas, {shippingCurrency}{" "}
                    {shippingEstimated ? "(изменить)" : ""}
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
                    Использовать доставку до склада Atlas: {foundShipping.amount}{" "}
                    {foundShipping.currency}
                    {foundShipping.destination ? " · " + foundShipping.destination : ""}
                  </button>
                )}
              </div>
              <p className="micro">
                Это доставка от магазина до склада Atlas. Если магазин её не публикует, используется изменяемый
                резерв $10. После выкупа менеджер укажет фактическую сумму, а
                разница вернётся на баланс.
              </p>
              <div className="two-fields">
                <div className="field">
                  <label>Категория</label>
                  <Choice
                    label="Категория"
                    value={category}
                    onChange={(v) => {
                      setCategory(v);
                      setWeight(String(estimatedBoxedWeight(v)));
                      setWeightOrigin("Приблизительно по категории");
                    }}
                    options={weightCategories}
                  />
                </div>
                <div className="field">
                  <label htmlFor="weight">Вес товара с коробкой, кг</label>
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
                      setWeightOrigin("Указан покупателем");
                    }}
                    onBlur={() => {
                      const valid=validBoxedWeight(weight);
                      if(valid!==undefined){setWeight(String(valid));return}
                      setWeight(String(estimatedBoxedWeight(category)));
                      setWeightOrigin("Приблизительно по категории");
                      toast.error("Вес должен быть от 0,01 до 49,5 кг. Вернули безопасную оценку.");
                    }}
                  />
                </div>
              </div>
              <details className="quote-details"><summary>Как уточняется вес доставки</summary><div className="weight-formula">
                <Scale size={23} />
                <div>
                  <strong>
                    {estimatedWeight ? estimatedWeight.toFixed(2) : "—"} кг для
                    расчёта
                  </strong>
                  <p>
                    {weight || "Вес с коробкой"} + 0,3 кг упаковка + 0,2 кг
                    запас; минимум к оплате — 1 кг
                  </p>
                  <small>
                    {weightOrigin}. После склада — перерасчёт по фактическому
                    или объёмному весу.
                  </small>
                </div>
              </div></details>
              <div className="field variant-matrix">
                <label htmlFor="variant">Вариант товара</label>
                {variants.length && (variantColors.length||variantSizes.length) ? <>
                  {variantColors.length>0&&<div className="variant-step"><div><b>Цвет</b><span>{selectedColor||'Выберите цвет'}</span></div><div className="variant-options">{variantColors.map(color=>{const choices=variants.filter(item=>item.color===color),available=choices.some(item=>item.available);return <button type="button" key={color} disabled={!available} aria-pressed={selectedColor===color} onClick={()=>{setSelectedColor(color);setSelectedSize('');const purchasable=choices.filter(item=>item.available);if(!purchasable.some(item=>item.size)&&purchasable[0])applyVariantChoice(purchasable[0]);else{setVariant('');setVerified(false)}}}>{color}{!available&&<small>Нет</small>}</button>})}</div></div>}
                  {(variantColors.length===0||selectedColor)&&variantSizes.length>0&&<div className="variant-step"><div><b>{variantSizeLabel}</b><span>{selectedSize||'Выберите вариант'}</span></div><div className="variant-options sizes">{variantSizes.map(size=>{const choices=variantsForColor.filter(item=>item.size===size),choice=choices.find(item=>item.available),price=choice?.price;return <button type="button" key={size} disabled={!choice} aria-pressed={selectedSize===size} onClick={()=>applyVariantChoice(choice)}><span>{size}</span>{choice&&price!==undefined&&<small>{price} {currency}</small>}{!choice&&<small>Нет</small>}</button>})}</div></div>}
                  {!variantColors.length&&!variantSizes.length&&<Choice label="Вариант" value={variant} onChange={value=>applyVariantChoice(variants.find(item=>item.label===value))} options={variants.filter(item=>item.available).map(item=>item.label)}/>}
                  <input id="variant" value={variant} readOnly required className="sr-only" aria-label="Выбранный вариант"/>
                </> : variants.length ? <Choice label="Вариант" value={variant} onChange={value=>applyVariantChoice(variants.find(item=>item.label===value))} options={variants.filter(item=>item.available).map(item=>item.label)}/> : (
                  <input
                    id="variant"
                    required
                    maxLength={80}
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    placeholder="Например: EU 42, чёрный"
                  />
                )}
              </div>
              <details className="image-edit">
                <summary>Фото товара — автоматически или по ссылке</summary>
                <div className="field">
                  <label htmlFor="image">Адрес изображения</label>
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
                  Я проверил данные и выбранный вариант.
                </label>
              </div>
              <button className="btn primary" disabled={!verified || adding || (manualAvailabilityRequired&&availabilityAnswer!=='available')}>
                {adding ? "Добавляем в корзину…" : "В корзину"}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </section>
        <aside className="surface quote-preview">
          {image && (
            <div className="import-photo">
              <ProductImage product={previewProduct} />
            </div>
          )}
          {images.length > 1 && (
            <div className="import-gallery" aria-label="Фотографии магазина">
              {images.map((photo, index) => <button type="button" key={photo} aria-label={`Фото ${index + 1}`} aria-pressed={image === photo} onClick={() => setImage(photo)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={`Ракурс ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" />
              </button>)}
            </div>
          )}
          <span className="eyebrow">
            {country === "Другая страна" ? otherCountry || country : country} →
            Узбекистан
          </span>
          <h2>{name || "Ваш товар появится здесь"}</h2>
          {importedAt && (
            <details className="micro source-freshness"><summary>Когда проверены данные</summary><p>
              Данные страницы проверены {new Date(importedAt).toLocaleString("ru-RU")}.
              {sourceExpiresAt
                ? ` Автообновление после ${new Date(sourceExpiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}.`
                : ""}{" "}
              Перед оформлением ещё раз сверьте цену и наличие.
            </p></details>
          )}
          {declaration && (
            <details className="declaration-preview"><summary>Черновик декларации</summary>
              <span>{declaration}</span>
            </details>
          )}
          {preview ? (
            <>
              <details className="quote-details"><summary>Состав стоимости</summary><CostLines q={preview} shippingUnknown={shipping === ""} />
              {shippingEstimated && (
                <p className="warning-text">
                  $10 — временный резерв доставки магазина. Менеджер проверит
                  сумму после оформления.
                </p>
              )}
              </details><div className="summary-total">
                <span>
                  {shipping === ""
                    ? "Промежуточный итог"
                    : "С доставкой, ориентир"}
                </span>
                <strong>{money(preview.total)}</strong>
              </div>
              <CustomsEstimate valueUsd={toUsd(Number(amount), currency, pricing.rates)} grossKg={Number(weight) || undefined} fx={pricing.fx} locale={state.communication.language}/>
            </>
          ) : (
            <p>Вставьте ссылку или заполните цену и вес.</p>
          )}
          <p className="micro">
            Расчёт использует настроенные тарифы Atlas, а не котировку перевозчика.
            Курс, маршрут, таможня и сроки уточняются до выкупа.
          </p>
        </aside>
      </div>
    </>
  );
}
