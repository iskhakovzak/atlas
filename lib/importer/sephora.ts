import type { Extracted } from './extract.ts';
import { safeImage } from './extract.ts';

export function extractSephoraProduct(html: string, sourceUrl: string): Extracted | undefined {
  const source = new URL(sourceUrl);
  if (!source.hostname.toLowerCase().includes('sephora.com')) return;

  const m = html.match(/<script[^>]*id="linkJSON"[^>]*>([^<]+)<\/script>/i);
  if (!m) return;
  try {
    const data = JSON.parse(m[1]);
    const product = Array.isArray(data) ? data.find((item: { '@type': string }) => item['@type'] === 'Product') : data['@type'] === 'Product' ? data : undefined;
    if (!product) return;

    const title = product.name?.slice(0, 140);
    const brand = typeof product.brand === 'object' ? product.brand.name : product.brand;
    const priceStr = Array.isArray(product.offers) ? product.offers[0]?.price : product.offers?.price;
    const price = priceStr ? parseFloat(priceStr) : undefined;
    const currency = Array.isArray(product.offers) ? product.offers[0]?.priceCurrency : product.offers?.priceCurrency;

    const images: string[] = [];
    if (product.image) {
      if (Array.isArray(product.image)) {
        for (const img of product.image) {
          const url = safeImage(img, sourceUrl);
          if (url) images.push(url);
        }
      } else {
        const url = safeImage(product.image, sourceUrl);
        if (url) images.push(url);
      }
    }

    return {
      title,
      brand,
      category: 'Красота',
      declarationDescription: 'Косметика для личного пользования',
      price: typeof price === 'number' && !isNaN(price) ? price : undefined,
      currency: currency || 'USD',
      country: 'США',
      image: images[0],
      images: images.slice(0, 12),
      warnings: [],
      sourceUrl,
      method: "Sephora JSON-LD",
    };
  } catch {
    return;
  }
}
