import type { Extracted, ProductVariant } from './extract.ts';
import { unknownStoreShippingUsd, type Product, type SourceIssueKind } from '../market/domain.ts';
import { currencies } from '../market/world.ts';

const sameAmount = (left: number, right: number) => Math.abs(left - right) < 0.005;

function matchingVariant(product: Pick<Product, 'sourceVariantId'>, selectedLabel: string, variants: ProductVariant[]): ProductVariant | undefined {
  const selected = product.sourceVariantId
    ? variants.find(item => item.id === product.sourceVariantId)
    : variants.find(item => item.label === selectedLabel);
  // A legacy label may be renamed or omitted. Reject only a contradiction the
  // merchant actually returned: the requested label belongs to another ID.
  if (selected && product.sourceVariantId && selected.label !== selectedLabel
    && variants.some(item => item.label === selectedLabel && item.id && item.id !== product.sourceVariantId)) {
    throw Error('Выбранный вариант не совпадает с артикулом магазина. Загрузите товар заново.');
  }
  return selected;
}

function currentVariant(product: Product, selectedLabel: string, extracted: Extracted): ProductVariant | undefined {
  const variants = extracted.variants ?? [];
  const selected = matchingVariant(product, selectedLabel, variants);
  // Some merchants expose a single product option with a generated label. A
  // catalog/editorial fallback may use a different neutral label (for
  // example, "Указанный вариант"), even though there is no real choice to
  // make. Treat that as the same option, but only when both snapshots contain
  // exactly one option and no persisted merchant option id is available. We
  // The exact live option is preferred, but may be omitted by a buyer-confirmed
  // fallback. In that case the product-level price remains the live check.
  const normalized = !selected && !product.sourceVariantId && product.variants.length === 1 && variants.length === 1
    ? variants[0]
    : undefined;
  return selected ?? normalized;
}

export type SourcePriceChange = { previousPrice: number; price: number; currency: string; previousShipping?: number; shipping?: number };
/**
 * A product snapshot compared with the live store: the same, changed (price or stated store delivery;
 * the returned product carries the store's current values) or blocked (currency, option or price
 * could not be confirmed, so the customer has to load the product again).
 */
export type SnapshotCheck =
  | { status: 'same'; product: Product }
  | { status: 'changed'; product: Product; change: SourcePriceChange }
  | { status: 'blocked'; kind: Exclude<SourceIssueKind, 'unreachable'>; code: SnapshotErrorCode; message: string };
/** Localized error codes of the blocked outcomes (lib/market/i18n.ts); `message` stays the Russian text kept in the cart. */
export type SnapshotErrorCode = 'err_67' | 'err_68' | 'err_69' | 'err_70' | 'err_71';
export type SnapshotOptions = {
  /**
   * The line's store delivery is the Atlas catalog's record (server data, never the request): a reserve is kept as it
   * is and a confirmed delivery is compared only in its own currency. Otherwise the store's response decides it.
   */
  editorialShipping?: boolean;
};

export function compareProductSnapshot(product: Product, selectedLabel: string, extracted: Extracted, now = Date.now(), options: SnapshotOptions = {}): SnapshotCheck {
  if (!product.sourceUrl || !product.sourceCurrency || product.sourcePrice === undefined)
    return { status: 'blocked', kind: 'price', code: 'err_67', message: 'Для проверки не хватает ссылки, цены или валюты товара.' };
  const variant = currentVariant(product, selectedLabel, extracted);
  const currency = extracted.currency?.toUpperCase();
  if (!currency || currency !== product.sourceCurrency.toUpperCase())
    return { status: 'blocked', kind: 'currency', code: 'err_68', message: 'Магазин изменил валюту витрины. Загрузите товар заново.' };
  // A merchant may omit a selected option (or all options) from its current
  // public response. A legacy confirmed snapshot can still verify its base
  // price; a returned, explicitly sold-out option is blocked below.
  if (!variant && !product.sourceManuallyConfirmed)
    return { status: 'blocked', kind: 'variant', code: 'err_69', message: 'Выбранный вариант не удалось сверить с данными магазина. Подтвердите его вручную.' };
  const price = variant?.price ?? extracted.price;
  if (price === undefined) return { status: 'blocked', kind: 'price', code: 'err_70', message: 'Магазин не подтвердил цену выбранного варианта.' };
  // Stock is known only when the store reports a count (eBay); otherwise it stays unknown, never guessed.
  if (variant?.quantity === 0 || variant?.available === false && variant.availabilityKnown !== false)
    return { status: 'blocked', kind: 'stock', code: 'err_71', message: 'Этого варианта больше нет в наличии у магазина.' };
  const stockKnown = variant?.quantity !== undefined || variant?.quantityMoreThan !== undefined;
  const next: Product = {
    ...product, sourcePrice: price, sourceVariantId: variant?.id ?? product.sourceVariantId, image: variant?.image ?? product.image, importedAt: now, sourceExpiresAt: now + 10 * 60_000, sourceCheckedAt: now,
    stockQuantity: variant?.quantity, stockMoreThan: variant?.quantity === undefined ? variant?.quantityMoreThan : undefined, stockSource: stockKnown ? 'ebay' : undefined,
  };
  const change: SourcePriceChange = { previousPrice: product.sourcePrice, price, currency };
  let changed = !sameAmount(price, product.sourcePrice);
  // Store delivery is the server's call, never the request's. A delivery the store states decides the amount and the
  // currency and goes into the total; without one the line keeps (or gets) Atlas's unknown-delivery reserve, held
  // outside the total. Only the Atlas catalog's record (editorialShipping) stays as the operator set it.
  const shippingCurrency = (extracted.shippingCurrency ?? extracted.currency)?.toUpperCase();
  const claimedCurrency = (product.sourceShippingCurrency ?? product.sourceCurrency).toUpperCase();
  if (options.editorialShipping) {
    // A catalog reserve is not compared; a delivery the operator confirmed is compared in its own currency, as before.
    if (!product.sourceShippingEstimated && product.sourceShipping !== undefined && extracted.shipping !== undefined
      && shippingCurrency === claimedCurrency && !sameAmount(extracted.shipping, product.sourceShipping)) {
      next.sourceShipping = extracted.shipping;
      change.previousShipping = product.sourceShipping;
      change.shipping = extracted.shipping;
      changed = true;
    }
  } else if (extracted.shipping !== undefined && shippingCurrency && currencies.includes(shippingCurrency)) {
    const shipping = extracted.shipping;
    if (product.sourceShippingEstimated || product.sourceShipping === undefined || claimedCurrency !== shippingCurrency || !sameAmount(shipping, product.sourceShipping)) {
      next.sourceShippingEstimated = false;
      next.sourceShipping = shipping;
      next.sourceShippingCurrency = shippingCurrency;
      next.shippingKnown = true;
      // A claimed reserve was never charged, and an amount in another currency is not comparable: the whole stated delivery is new.
      change.previousShipping = product.sourceShippingEstimated || claimedCurrency !== shippingCurrency ? undefined : product.sourceShipping;
      change.shipping = shipping;
      changed = true;
    }
  } else if (!product.sourceShippingEstimated && product.sourceShipping !== undefined) {
    // The store states no delivery, so a "known" delivery in the request cannot be confirmed: Atlas's reserve replaces
    // it (outside the total, free above the store threshold) and the claimed amount leaves the total.
    next.sourceShippingEstimated = true;
    next.sourceShipping = unknownStoreShippingUsd;
    next.sourceShippingCurrency = 'USD';
    next.shippingKnown = true;
    change.previousShipping = product.sourceShipping;
    change.shipping = 0;
    changed = true;
  }
  return changed ? { status: 'changed', product: next, change } : { status: 'same', product: next };
}

/** The strict form used where a change must stop the action: returns the refreshed product or throws. */
export function verifyProductSnapshot(product: Product, selectedLabel: string, extracted: Extracted, now = Date.now()): Product {
  const check = compareProductSnapshot(product, selectedLabel, extracted, now);
  if (check.status === 'blocked') throw Error(check.message);
  // A delivery the store does not state becomes Atlas's reserve: it leaves the total, so it alone never stops the action.
  const toReserve = check.status === 'changed' && check.change.price === check.change.previousPrice
    && Boolean(check.product.sourceShippingEstimated) && !product.sourceShippingEstimated;
  if (check.status === 'changed' && !toReserve) {
    const { previousPrice, price, currency, previousShipping, shipping } = check.change;
    if (previousPrice !== price) throw Error(`Цена изменилась: было ${previousPrice} ${currency}, сейчас ${price} ${currency}. Обновите товар.`);
    throw Error(`Доставка магазина изменилась: было ${previousShipping ?? 0}, сейчас ${shipping}. Обновите товар.`);
  }
  return check.product;
}

/** Verify any price/currency the merchant did return before using a buyer-confirmed fallback. */
export function verifyKnownSnapshotFields(product:Product,selectedLabel:string,partial:Pick<Extracted,'currency'|'price'|'variants'>){
  if(!product.sourceCurrency||product.sourcePrice===undefined)return;
  const currency=partial.currency?.toUpperCase();
  if(currency&&currency!==product.sourceCurrency.toUpperCase())throw Error('Магазин изменил валюту витрины. Обновите товар.');
  const variants=partial.variants??[];
  const variant=matchingVariant(product,selectedLabel,variants);
  const price=variant?.price??partial.price;
  if(price!==undefined&&!currency)throw Error('Магазин показал цену без валюты. Проверьте валюту товара и загрузите ссылку заново.');
  if(price!==undefined&&!sameAmount(price,product.sourcePrice))throw Error(`Цена изменилась: было ${product.sourcePrice} ${currency}, сейчас ${price} ${currency}. Обновите товар.`);
}
