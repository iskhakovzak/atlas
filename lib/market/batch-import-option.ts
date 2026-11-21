import {dedupeSafeImages,inferProductCategory,type Extracted,type ProductVariant} from '../importer/extract.ts';
import {variantGallery,variantSourceUrl} from '../importer/link-selection.ts';
import {isOrderableVariant} from '../importer/variant-normalization.ts';
import {unknownStoreShippingUsd,type Pricing,type Product} from './domain.ts';
import {estimateBoxedWeight,validBoxedWeight} from './weight.ts';
import {currencies,paddedWeight,toUsd} from './world.ts';

export type BatchImportSource=Extracted&{fetchedAt?:number;expiresAt?:number};
type BatchOptionError='data'|'currency'|'option'|'stock'|'price';

export function batchCurrency(value?:string){
  const code=value?.trim().toUpperCase();
  return code&&currencies.includes(code)?code:undefined;
}

export function batchOptions(data:BatchImportSource){
  const variants=data.variants??[];
  // Only a single listed item can use the page amount without an explicit option price.
  const basePrice=variants.length===1&&data.variantScope!=='group'?data.price:undefined;
  return variants.map(variant=>{
    const amount=variant.price??basePrice;
    const price=typeof amount==='number'&&Number.isFinite(amount)&&amount>0?amount:undefined;
    return {variant,price,orderable:isOrderableVariant(variant)&&Boolean(variant.label.trim())};
  });
}

export function batchOptionGallery(data:BatchImportSource,variant?:ProductVariant){
  const photos=variantGallery(variant,data.colorwayImages??[],data.sourceUrl);
  const anotherColor=variant&&data.variantScope==='group'&&(variant.color||variant.colorId)
    &&(!data.selectedVariantColor||variant.color!==data.selectedVariantColor);
  return photos.length||anotherColor?photos:dedupeSafeImages([data.image,...(data.images??[])],data.sourceUrl,12);
}

export function batchCartProduct(data:BatchImportSource,selected:number|null,pricing:Pick<Pricing,'rates'>):
 {product:Product;variant:string}|{error:BatchOptionError}{
  if(!data.title?.trim()||!data.country?.trim())return {error:'data'};
  const currency=batchCurrency(data.currency);
  if(!currency||!pricing.rates[currency])return {error:'currency'};
  const options=batchOptions(data);
  const choice=selected===null?undefined:options[selected];
  if(!choice||!choice.variant.label.trim())return {error:'option'};
  if(!choice.orderable)return {error:'stock'};
  if(choice.price===undefined)return {error:'price'};
  const {variant,price}=choice;
  const usd=toUsd(price,currency,pricing.rates);
  if(!(usd>0)||usd>10000)return {error:'price'};
  const category=data.category??inferProductCategory(data.title,data.brand??'');
  const storeWeight=validBoxedWeight(data.boxedWeight);
  const boxedWeight=storeWeight??estimateBoxedWeight(category,data.title).kg;
  const quotedCurrency=batchCurrency(data.shippingCurrency??currency);
  const delivery=typeof data.shipping==='number'&&Number.isFinite(data.shipping)&&data.shipping>=0&&quotedCurrency&&pricing.rates[quotedCurrency]
    ?{amount:data.shipping,currency:quotedCurrency,estimated:false}
    :{amount:unknownStoreShippingUsd,currency:'USD',estimated:true};
  const sourceUrl=variantSourceUrl(data.sourceUrl,variant);
  const sourceImages=batchOptionGallery(data,variant);
  const duplicateLabel=options.some(option=>option.variant!==variant&&option.variant.label===variant.label);
  const nativeIdentity=duplicateLabel?JSON.stringify([variant.productId,variant.id,variant.sellerId,variant.offerId,variant.colorId,variant.options]):'';
  return {variant:variant.label,product:{
    id:sourceUrl+'#'+variant.label+nativeIdentity,
    name:data.title.trim(),
    brand:data.brand??new URL(data.sourceUrl).hostname,
    category,usd,weight:paddedWeight(boxedWeight),image:sourceImages[0]??'',sourceImages,sourceUrl,
    sourceVariantId:variant.id,sourceProductId:variant.productId,sourceSellerId:variant.sellerId,
    sourceOfferId:variant.offerId,sourceColorId:variant.colorId,sourceOptions:variant.options,
    variants:[variant.label],country:data.country,sourceCurrency:currency,sourcePrice:price,
    sourceShipping:delivery.amount,sourceShippingCurrency:delivery.currency,
    sourceShippingUsd:delivery.estimated?unknownStoreShippingUsd:toUsd(delivery.amount,delivery.currency,pricing.rates),
    sourceShippingEstimated:delivery.estimated,shippingKnown:true,boxedWeight,
    weightBasis:storeWeight===undefined?'estimate':'store',
    weightOrigin:storeWeight===undefined?'Оценка Atlas; склад взвесит посылку':'со страницы магазина',
    importedAt:data.fetchedAt,sourceExpiresAt:data.expiresAt,declarationDescription:data.declarationDescription,
  }};
}
