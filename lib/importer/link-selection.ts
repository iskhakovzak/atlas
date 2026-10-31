import {isEbayStoreHost} from './stores.ts';
import {safeVariantSourceUrl} from './variant-normalization.ts';
import {dedupeSafeImages,type ProductVariant,type ProductColorwayGallery} from './extract.ts';

export function variantSourceUrl(source:string,variant?:Pick<ProductVariant,'id'|'sourceUrl'>){
  return safeVariantSourceUrl(variant?.sourceUrl,source)??ebayVariantSourceUrl(source,variant?.id);
}

export function variantGallery(variant:ProductVariant|undefined,galleries:ProductColorwayGallery[],source:string):string[]{
  if(!variant)return [];
  const gallery=variant.colorId?galleries.find(g=>g.colorId===variant.colorId):galleries.find(g=>g.color===variant.color&&!g.colorId);
  return dedupeSafeImages([...(variant.image?[variant.image]:[]),...(variant.images??[]),...(gallery?.images??[])],source,12);
}

/** The preview follows the browsed colour/size, independently of accumulated cart picks. */
export function variantDisplayPrices(variants:{color?:string;size?:string;price?:number;available:boolean;quantity?:number}[],color?:string,size?:string){
  const choices=variants.filter(v=>v.available&&v.quantity!==0&&(!color||v.color===color));
  const exact=size?choices.filter(v=>v.size===size):[];
  return [...new Set((exact.length?exact:choices).map(v=>v.price).filter((p):p is number=>p!==undefined&&Number.isFinite(p)&&p>0))].sort((a,b)=>a-b);
}

export function ebayVariantSourceUrl(source:string,id?:string){
  try { const url=new URL(source);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&isEbayStoreHost(url.hostname)&&id&&/^\d{1,20}$/.test(id)) {url.searchParams.set('var',id);return url.href;} }catch{ /* keep the validated source */ }
  return source;
}

/** Most links bind one colour; eBay seller groups offer their full colour/size matrix. */
export function variantsForSourceColor<T extends { color?: string }>(
  variants: T[],
  sourceColor?: string,
  sourceUrl?: string,
  scope?: 'group'|'color'|'item',
): T[] {
  if(scope==='group')return variants;
  if (sourceUrl) {
    try { if (isEbayStoreHost(new URL(sourceUrl).hostname)) return variants; } catch { /* retain ordinary colour matching */ }
  }
  const color = sourceColor?.trim();
  if (!color) return variants;
  const exactColor = variants.filter(variant => variant.color?.trim() === color);
  return exactColor.length ? exactColor : variants;
}

/**
 * An option the page listed without a price but with its own store page (Amazon: every ASIN but the open one). The
 * order form loads that page when the option is chosen, instead of borrowing another option's price.
 */
export function priceLoadable(variant: Pick<ProductVariant,'price'|'sourceUrl'> | undefined, source?: string): boolean {
  return Boolean(variant && variant.price === undefined && variant.sourceUrl && (!source || safeVariantSourceUrl(variant.sourceUrl, source)));
}

/**
 * The options of a sibling page merged into the ones on screen, by store ID: a price, stock answer or photo the new
 * page gives replaces the unknown one, and options the first page left out (its other colours' sizes) are added
 * after their colour. Nothing known is overwritten with "unknown".
 */
export function mergeLoadedVariants(current: ProductVariant[], loaded: ProductVariant[], limit = 600): ProductVariant[] {
  const byId = new Map(loaded.filter(item => item.id).map(item => [item.id!, item]));
  const merged = current.map(item => {
    const fresh = item.id ? byId.get(item.id) : undefined;
    if (!fresh) return item;
    byId.delete(item.id!);
    return {
      ...item,
      price: fresh.price ?? item.price,
      compareAtPrice: fresh.compareAtPrice ?? item.compareAtPrice,
      ...(fresh.availabilityKnown !== false || item.availabilityKnown === false ? {available: fresh.available, availabilityKnown: fresh.availabilityKnown} : {}),
      image: item.image ?? fresh.image,
    };
  });
  for (const fresh of byId.values()) {
    if (merged.length >= limit || merged.some(item => item.label === fresh.label)) continue;
    const after = merged.map(item => item.color).lastIndexOf(fresh.color);
    merged.splice(after < 0 ? merged.length : after + 1, 0, fresh);
  }
  return merged;
}
