"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Link2, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarket } from "@/lib/market/store";
import {
  price,
  money,
  validateSource,
  type Product,
} from "@/lib/market/domain";
import { visibleMerchantFinds } from "@/lib/market/catalog";
import { countries, currencies, toUsd, paddedWeight } from "@/lib/market/world";
import {
  safeImage,
  inferProductCategory,
  type Extracted,
  type ProductVariant,
} from "@/lib/importer/extract";
import { Choice, CostLines, PageHeading, ProductImage } from "./market-ui";
import { CustomsEstimate } from "./customs-estimate";
const priors: Record<string, number> = {
  Обувь: 1.3,
  Одежда: 0.6,
  Электроника: 1,
  Аксессуары: 0.7,
  "Красота и уход": 0.6,
  "Дом и быт": 2,
  Спорт: 1,
  Другое: 1.5,
};
export function GlobalLinkOrder({ select }: { select: (p: Product) => void }) {
  const { ready, pricing, state } = useMarket();
  const searchParams = useSearchParams();
  const seed = visibleMerchantFinds().find(item => item.sourceUrl === searchParams.get("url"));
  const [url, setUrl] = useState(() => searchParams.get("url") ?? ""),
    [source, setSource] = useState(seed?.sourceUrl ?? ""),
    [name, setName] = useState(seed?.name ?? ""),
    [brand, setBrand] = useState(seed?.brand ?? ""),
    [declaration, setDeclaration] = useState(""),
    [currency, setCurrency] = useState("USD"),
    [amount, setAmount] = useState(seed ? String(seed.sourcePrice) : ""),
    [shipping, setShipping] = useState("10"),
    [shippingCurrency, setShippingCurrency] = useState("USD"),
    [shippingEstimated, setShippingEstimated] = useState(true),
    [weight, setWeight] = useState(seed ? String(seed.boxedWeight) : ""),
    [country, setCountry] = useState("США"),
    [otherCountry, setOtherCountry] = useState(""),
    [category, setCategory] = useState(seed?.category ?? "Другое"),
    [variant, setVariant] = useState(""),
    [variants, setVariants] = useState<ProductVariant[]>([]),
    [image, setImage] = useState(seed?.image ?? ""),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(seed ? "Данные из подборки " + seed.store + " на " + seed.observedOn + ". Обновите страницу магазина или проверьте цену и вариант вручную. Вес и доставка предварительные." : ""),
    [weightOrigin, setWeightOrigin] = useState("Оценка по категории"),
    [verified, setVerified] = useState(false),
    [importedAt, setImportedAt] = useState<number | undefined>(),
    [sourceExpiresAt, setSourceExpiresAt] = useState<number | undefined>(),
    [foundShipping, setFoundShipping] = useState<{
      amount: number;
      currency: string;
      destination?: string;
    } | null>(null);
  async function load() {
    let link: string;
    try {
      link = validateSource(url);
    } catch (e) {
      toast.error((e as Error).message);
      return;
    }
    setBusy(true);
    setSource(link);
    setVerified(false);
    setName("");
    setBrand("");
    setDeclaration("");
    setAmount("");
    setShipping("10");
    setShippingCurrency("USD");
    setShippingEstimated(true);
    setImage("");
    setImportedAt(undefined);
    setSourceExpiresAt(undefined);
    setWeight("");
    setVariant("");
    setVariants([]);
    setNote("");
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
      setName(data.title ?? "");
      setBrand(data.brand ?? new URL(data.sourceUrl).hostname);
      setImage(data.image ?? "");
      const nextCategory =
        data.category ??
        inferProductCategory(data.title ?? "", data.brand ?? "");
      setCategory(nextCategory);
      setDeclaration(data.declarationDescription ?? "");
      setCurrency(
        currencies.includes(data.currency ?? "") ? data.currency! : "USD",
      );
      if (data.price !== undefined) setAmount(String(data.price));
      const availableVariants = (data.variants ?? []).filter(
        (v) => v.available,
      );
      setVariants(availableVariants);
      if (availableVariants.length === 1)
        setVariant(availableVariants[0].label);
      if (data.country) setCountry(data.country);
      setWeight(String(data.boxedWeight ?? priors[nextCategory]));
      setWeightOrigin(
        data.boxedWeight
          ? data.weightKind === "shipping"
            ? "Вес отправления со страницы"
            : "Вес товара со страницы — коробку нужно проверить"
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
            ". Проверьте, что это стоимость до вашего склада."
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
      setNote((e as Error).message + " Доступен ручной ввод.");
      setWeight(String(priors[category]));
      setWeightOrigin("Приблизительно по категории");
    } finally {
      setBusy(false);
    }
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
  return (
    <>
      <PageHeading
        overline="ПОКУПКИ СО ВСЕГО МИРА"
        title="Нашли товар? Пришлите ссылку."
        description="Получим доступные данные страницы. Всё можно проверить и исправить вручную."
      />
      <div className="link-layout">
        <section className="surface link-form">
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
          {!ready && (
            <p className="notice">
              Войдите в личный кабинет: автозагрузка защищена от
              злоупотреблений, а товар сохранится в вашей корзине.
            </p>
          )}
          {note && (
            <div className="notice" role="status">
              {note}
            </div>
          )}
          {source && !busy && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                try {
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
                  select(p);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <div className="step-heading second-step">
                <b>02</b>
                <div>
                  <h2>Проверьте данные</h2>
                  <p>
                    Цена зависит от выбранного размера, продавца и адреса
                    доставки.
                  </p>
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
                    Доставка магазина, {shippingCurrency}{" "}
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
                    Использовать доставку со страницы: {foundShipping.amount}{" "}
                    {foundShipping.currency}
                    {foundShipping.destination
                      ? " → " + foundShipping.destination
                      : " (адрес нужно проверить)"}
                  </button>
                )}
              </div>
              <p className="micro">
                Если магазин не публикует доставку, используется изменяемый
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
                      setWeight(String(priors[v]));
                      setWeightOrigin("Приблизительно по категории");
                    }}
                    options={Object.keys(priors)}
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
                    запас
                  </p>
                  <small>
                    {weightOrigin}. После склада — перерасчёт по фактическому
                    или объёмному весу.
                  </small>
                </div>
              </div></details>
              <div className="field">
                <label htmlFor="variant">Размер, цвет или модель</label>
                {variants.length ? (
                  <Choice
                    label="Размер и цвет"
                    value={variant}
                    onChange={(v) => {
                      setVariant(v);
                      const selectedVariant = variants.find(
                        (item) => item.label === v,
                      );
                      if (selectedVariant?.price !== undefined)
                        setAmount(String(selectedVariant.price));
                      if (selectedVariant?.image)
                        setImage(selectedVariant.image);
                      setVerified(false);
                    }}
                    options={variants.map((item) => item.label)}
                  />
                ) : (
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
                  Проверил страну отправки, валюту, вариант, цену и доставку
                  магазина.
                </label>
              </div>
              <button className="btn primary" disabled={!verified}>
                Проверить расчёт
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
          <span className="eyebrow">
            {country === "Другая страна" ? otherCountry || country : country} →
            Узбекистан
          </span>
          <h2>{name || "Ваш товар появится здесь"}</h2>
          {importedAt && (
            <p className="micro source-freshness">
              Данные страницы проверены {new Date(importedAt).toLocaleString("ru-RU")}.
              {sourceExpiresAt
                ? ` Автообновление после ${new Date(sourceExpiresAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}.`
                : ""}{" "}
              Перед оформлением ещё раз сверьте цену и наличие.
            </p>
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
