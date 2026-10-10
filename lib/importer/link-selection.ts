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
