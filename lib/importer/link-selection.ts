import {isEbayStoreHost} from './stores.ts';

export function ebayVariantSourceUrl(source:string,id?:string){
  try { const url=new URL(source);if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&isEbayStoreHost(url.hostname)&&id&&/^\d{1,20}$/.test(id)) {url.searchParams.set('var',id);return url.href;} }catch{ /* keep the validated source */ }
  return source;
}

/** Most links bind one colour; eBay seller groups offer their full colour/size matrix. */
export function variantsForSourceColor<T extends { color?: string }>(
  variants: T[],
  sourceColor?: string,
  sourceUrl?: string,
): T[] {
  if (sourceUrl) {
    try { if (isEbayStoreHost(new URL(sourceUrl).hostname)) return variants; } catch { /* retain ordinary colour matching */ }
  }
  const color = sourceColor?.trim();
  if (!color) return variants;
  const exactColor = variants.filter(variant => variant.color?.trim() === color);
  return exactColor.length ? exactColor : variants;
}
