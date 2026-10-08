import {dedupeSafeImages, type Extracted, type ProductVariant} from './extract.ts';
import {isSupportedStoreHost} from './stores.ts';
import {sameMerchantRedirect} from './source-identity.ts';

/** Retain provider URLs only, never synthesize a SKU URL from a generic ID. */
export function safeVariantSourceUrl(value: unknown, sourceUrl: string): string|undefined {
  if(typeof value!=='string'||!value.trim()||value.length>4096) return;
  try {
    const source=new URL(sourceUrl),target=new URL(value,source);
    if(target.protocol!=='https:'||target.username||target.password||target.port||!isSupportedStoreHost(target.hostname)||!sameMerchantRedirect(source,target)) return;
    // Locale-less sibling paths can silently fall back to the server's region.
    const region=(url:URL)=>url.pathname.match(/^\/(?:[a-z]{2}[-_])?(us|es|de|gb|uk|fr|it|ro|cn|tr|jp|kr|ae|ca|au)(?:[-_/]|$)/i)?.[1].toLowerCase();
    if(region(source)&&region(target)!==region(source)) return;
    target.hash=''; return target.href;
  } catch { return; }
}

/** Omitted legacy stock evidence remains unknown for newly fetched snapshots. */
export function isConfirmedVariantAvailable(variant: Pick<ProductVariant,'available'|'availabilityKnown'|'quantity'>): boolean {
  return variant.available===true&&variant.availabilityKnown===true&&variant.quantity!==0;
}

/** Bounded normalization; no invented combinations, prices, availability or group relationships. */
export function normalizeMerchantVariants(extracted: Extracted): Extracted {
  const variants=extracted.variants?.slice(0,250).map(variant=>{
    const options=[...(variant.options??[]),
      ...(variant.color&&!variant.options?.some(o=>/color|colour|shade/i.test(o.name))?[{name:'Color',value:variant.color}]:[]),
      ...(variant.size&&!variant.options?.some(o=>/size|waist|band|cup|length|volume|dimension|format/i.test(o.name))?[{name:variant.sizeLabel||'Size',value:variant.size}]:[]),
    ].slice(0,16).filter(option=>option.name.trim()&&option.value.trim()).map(option=>({name:option.name.trim().slice(0,100),value:option.value.trim().slice(0,140)}));
    const images=dedupeSafeImages([variant.image,...(variant.images??[])],extracted.sourceUrl);
    return {...variant,sourceUrl:safeVariantSourceUrl(variant.sourceUrl,extracted.sourceUrl),options,images,image:images[0],
      // Extra independent axes must never collapse into an identical colour-size label.
      label:variant.label,
      availabilityKnown:variant.availabilityKnown===true,
      ...(variant.quantity===0?{available:false,availabilityKnown:true}:{})};
  });
  const labels=new Map<string,number>();
  for(const variant of variants??[]) labels.set(variant.label,(labels.get(variant.label)??0)+1);
  for(const variant of variants??[]) if((labels.get(variant.label)??0)>1) {
    const identity=[variant.productId,variant.id,variant.sellerId,variant.offerId].filter(Boolean).join(' / ');
    const axes=variant.options.map(option=>`${option.name}: ${option.value}`).join(' · ');
    variant.label=[axes.slice(0,90)||variant.label.slice(0,90),identity.slice(0,45)].filter(Boolean).join(' · ');
  }
  return {...extracted,variants,variantScope:extracted.variantScope??(extracted.selectedVariantColor?'color':'item'),
    variantsComplete:extracted.variantsComplete===true&&(extracted.variants?.length??0)<=250};
}
