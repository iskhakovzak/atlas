import type { Extracted, ProductVariant } from './extract.ts';
import type { Product } from '../market/domain.ts';

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

export function verifyProductSnapshot(product: Product, selectedLabel: string, extracted: Extracted, now = Date.now()): Product {
  if (!product.sourceUrl || !product.sourceCurrency || product.sourcePrice === undefined) throw Error('Для проверки не хватает ссылки, цены или валюты товара.');
  const variant = currentVariant(product, selectedLabel, extracted);
  const currency = extracted.currency?.toUpperCase();
  if (!currency || currency !== product.sourceCurrency.toUpperCase()) throw Error('Магазин изменил валюту витрины. Загрузите товар заново.');
  // A merchant may omit a selected option (or all options) from its current
  // public response. Availability is not a gate; for a customer-confirmed
  // order we can still verify the published product price and currency.
  if (!variant && !product.sourceManuallyConfirmed) throw Error('Выбранный вариант не удалось сверить с данными магазина. Подтвердите его вручную.');
  const price = variant?.price ?? extracted.price;
  if (price === undefined) throw Error('Магазин не подтвердил цену выбранного варианта.');
  if (!sameAmount(price, product.sourcePrice)) throw Error(`Цена изменилась: было ${product.sourcePrice} ${currency}, сейчас ${price} ${currency}. Обновите товар.`);
  return {...product,sourcePrice:price,sourceVariantId:variant?.id??product.sourceVariantId,image:variant?.image??product.image,importedAt:now,sourceExpiresAt:now+10*60_000};
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
