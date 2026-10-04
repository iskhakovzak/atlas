import type { Extracted, ProductVariant } from './extract.ts';
import type { Product, SourceIssueKind } from '../market/domain.ts';

const sameAmount = (left: number, right: number) => Math.abs(left - right) < 0.005;

function currentVariant(product: Product, selectedLabel: string, extracted: Extracted): ProductVariant | undefined {
  const variants = extracted.variants ?? [];
  const selected = product.sourceVariantId
    ? variants.find(item => item.id === product.sourceVariantId)
    : variants.find(item => item.label === selectedLabel);
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
  | { status: 'blocked'; kind: Exclude<SourceIssueKind, 'unreachable'>; message: string };

export function compareProductSnapshot(product: Product, selectedLabel: string, extracted: Extracted, now = Date.now()): SnapshotCheck {
  if (!product.sourceUrl || !product.sourceCurrency || product.sourcePrice === undefined)
    return { status: 'blocked', kind: 'price', message: 'Для проверки не хватает ссылки, цены или валюты товара.' };
  const variant = currentVariant(product, selectedLabel, extracted);
  const currency = extracted.currency?.toUpperCase();
  if (!currency || currency !== product.sourceCurrency.toUpperCase())
    return { status: 'blocked', kind: 'currency', message: 'Магазин изменил валюту витрины. Загрузите товар заново.' };
  // A merchant may omit a selected option (or all options) from its current
  // public response. Availability is not a gate; for a customer-confirmed
  // order we can still verify the published product price and currency.
  if (!variant && !product.sourceManuallyConfirmed)
    return { status: 'blocked', kind: 'variant', message: 'Выбранный вариант не удалось сверить с данными магазина. Подтвердите его вручную.' };
  const price = variant?.price ?? extracted.price;
  if (price === undefined) return { status: 'blocked', kind: 'price', message: 'Магазин не подтвердил цену выбранного варианта.' };
  // Stock is known only when the store reports a count (eBay); otherwise it stays unknown, never guessed.
  if (variant?.quantity === 0)
    return { status: 'blocked', kind: 'stock', message: 'Этого варианта больше нет в наличии у магазина.' };
  const stockKnown = variant?.quantity !== undefined || variant?.quantityMoreThan !== undefined;
  const next: Product = {
    ...product, sourcePrice: price, sourceVariantId: variant?.id ?? product.sourceVariantId, image: variant?.image ?? product.image, importedAt: now, sourceExpiresAt: now + 10 * 60_000, sourceCheckedAt: now,
    stockQuantity: variant?.quantity, stockMoreThan: variant?.quantity === undefined ? variant?.quantityMoreThan : undefined, stockSource: stockKnown ? 'ebay' : undefined,
  };
  const change: SourcePriceChange = { previousPrice: product.sourcePrice, price, currency };
  let changed = !sameAmount(price, product.sourcePrice);
  // Store delivery the page stated (not Atlas's editable reserve) is part of the price too.
  const shippingCurrency = (extracted.shippingCurrency ?? extracted.currency)?.toUpperCase();
  if (!product.sourceShippingEstimated && product.sourceShipping !== undefined && extracted.shipping !== undefined
    && shippingCurrency === (product.sourceShippingCurrency ?? product.sourceCurrency).toUpperCase()
    && !sameAmount(extracted.shipping, product.sourceShipping)) {
    next.sourceShipping = extracted.shipping;
    change.previousShipping = product.sourceShipping;
    change.shipping = extracted.shipping;
    changed = true;
  }
  return changed ? { status: 'changed', product: next, change } : { status: 'same', product: next };
}

/** The strict form used where a change must stop the action: returns the refreshed product or throws. */
export function verifyProductSnapshot(product: Product, selectedLabel: string, extracted: Extracted, now = Date.now()): Product {
  const check = compareProductSnapshot(product, selectedLabel, extracted, now);
  if (check.status === 'blocked') throw Error(check.message);
  if (check.status === 'changed') {
    const { previousPrice, price, currency, previousShipping, shipping } = check.change;
    if (previousPrice !== price) throw Error(`Цена изменилась: было ${previousPrice} ${currency}, сейчас ${price} ${currency}. Обновите товар.`);
    throw Error(`Доставка магазина изменилась: было ${previousShipping}, сейчас ${shipping}. Обновите товар.`);
  }
  return check.product;
}

/** Verify any price/currency the merchant did return before using a buyer-confirmed fallback. */
export function verifyKnownSnapshotFields(product:Product,selectedLabel:string,partial:Pick<Extracted,'currency'|'price'|'variants'>){
  if(!product.sourceCurrency||product.sourcePrice===undefined)return;
  const currency=partial.currency?.toUpperCase();
  if(currency&&currency!==product.sourceCurrency.toUpperCase())throw Error('Магазин изменил валюту витрины. Обновите товар.');
  const variants=partial.variants??[];
  const variant=product.sourceVariantId?variants.find(item=>item.id===product.sourceVariantId):variants.find(item=>item.label===selectedLabel);
  const price=variant?.price??partial.price;
  if(price!==undefined&&!currency)throw Error('Магазин показал цену без валюты. Проверьте валюту товара и загрузите ссылку заново.');
  if(price!==undefined&&!sameAmount(price,product.sourcePrice))throw Error(`Цена изменилась: было ${product.sourcePrice} ${currency}, сейчас ${price} ${currency}. Обновите товар.`);
}
