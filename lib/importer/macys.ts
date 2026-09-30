import type { Extracted, ProductVariant } from './extract.ts';
import { safeImage } from './extract.ts';

export function extractMacysProduct(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!source.hostname.toLowerCase().includes('macys.com')) return;

  const m = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.*?\});/s);
  if (!m) return;
  try {
    const state = JSON.parse(m[1]);
    const product = state?.product?.productDetail?.product;
    if (!product) return;

    const title = product.detail?.name?.slice(0, 140);
    const price = product.pricing?.price?.tieredPrice?.[0]?.values?.[0]?.value ?? product.pricing?.price?.regularPrice?.values?.[0]?.value;
    const variants: ProductVariant[] = [];
    if (product.traits?.colors?.colorMap) {
      for (const color of Object.values(product.traits.colors.colorMap) as {name: string}[]) {
        if (product.traits?.sizes?.sizeMap) {
           for (const size of Object.values(product.traits.sizes.sizeMap) as {name: string}[]) {
             variants.push({
               label: `${color.name} · ${size.name}`,
               color: color.name,
               size: size.name,
               available: true,
             });
           }
        } else {
          variants.push({
            label: color.name,
            color: color.name,
            available: true,
          });
        }
      }
    }

    const images: string[] = [];
    if (product.imagery?.images) {
      for (const img of product.imagery.images) {
        const url = safeImage(`https://slimages.macysassets.com/is/image/MCY/products/${img.filePath}`, sourceUrl);
        if (url) images.push(url);
      }
    }

    return {
      title,
      brand: "Macy's",
      category: 'Одежда',
      declarationDescription: 'Одежда для личного пользования',
      price: typeof price === 'number' ? price : undefined,
      currency: 'USD',
      country: 'США',
      image: images[0],
      images: images.slice(0, 12),
      variants: variants.length ? variants.slice(0, 80) : undefined,
      warnings: [],
      sourceUrl,
      method: "Macy's API",
    };
  } catch {
    return;
  }
}
