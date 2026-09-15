import type { Extracted, ProductVariant } from './extract.ts';
import type { Product } from '../market/domain.ts';

const sameAmount = (left: number, right: number) => Math.abs(left - right) < 0.005;

function currentVariant(product: Product, selectedLabel: string, extracted: Extracted): ProductVariant | undefined {
  const variants = extracted.variants ?? [];
  if (!variants.length) return;
  const selected = product.sourceVariantId
    ? variants.find(item => item.id === product.sourceVariantId)
    : variants.find(item => item.label === selectedLabel);
  if (!selected) throw Error('Выбранный вариант больше не найден в магазине. Загрузите товар заново.');
  if (!selected.available) throw Error('Выбранный вариант закончился в магазине. Выберите другой.');
  return selected;
}

export function verifyProductSnapshot(product: Product, selectedLabel: string, extracted: Extracted, now = Date.now()): Product {
  if (!product.sourceUrl || !product.sourceCurrency || product.sourcePrice === undefined) throw Error('Для проверки не хватает ссылки, цены или валюты товара.');
  const variant = currentVariant(product, selectedLabel, extracted);
  const currency = extracted.currency?.toUpperCase();
  if (!currency || currency !== product.sourceCurrency.toUpperCase()) throw Error('Магазин изменил валюту витрины. Загрузите товар заново.');
  const price = variant?.price ?? extracted.price;
  if (price === undefined) throw Error('Магазин не подтвердил цену выбранного варианта.');
  if (!sameAmount(price, product.sourcePrice)) throw Error(`Цена изменилась: было ${product.sourcePrice} ${currency}, сейчас ${price} ${currency}. Обновите товар.`);
  return {...product,sourcePrice:price,sourceVariantId:variant?.id??product.sourceVariantId,image:variant?.image??product.image,importedAt:now,sourceExpiresAt:now+10*60_000};
}
