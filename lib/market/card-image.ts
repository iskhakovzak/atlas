/**
 * A smaller copy of a store photo for cards, the cart and order rows (≤ ~300 CSS px, 600 px covers 2× screens).
 * Only CDNs whose resize parameter was checked on real photos; the stored URL never changes and the gallery
 * keeps the original. Measured 11.10.2026 on the catalog: Amazon 75–172 KB → 20–44 KB, Shopify 88 → 39 KB.
 * Walmart is left alone: its resized copy comes back as a heavier JPEG instead of AVIF.
 */
export const cardImageWidth = 600;

export function cardImage(src: string): string {
  let url: URL;
  try { url = new URL(src); } catch { return src; }
  const host = url.hostname;
  if (host === 'cdn.shopify.com' || url.pathname.includes('/cdn/shop/')) {
    if (!url.searchParams.has('width')) url.searchParams.set('width', String(cardImageWidth));
    return url.href;
  }
  // Amazon: the size is a suffix before the extension (…/I/31ol4e40VQL._AC_SL600_.jpg); an existing suffix is replaced.
  if (host === 'm.media-amazon.com' && url.pathname.startsWith('/images/I/')) {
    const resized = url.pathname.replace(/^(\/images\/I\/[^./]+)(?:\.[^/]*)?\.(jpe?g|png|webp)$/i, `$1._AC_SL${cardImageWidth}_.$2`);
    if (resized === url.pathname) return src;
    url.pathname = resized;
    return url.href;
  }
  if (host.endsWith('.scene7.com') || host === 'store.storeimages.cdn-apple.com') {
    url.searchParams.set('wid', String(cardImageWidth));
    url.searchParams.delete('hei');
    return url.href;
  }
  return src;
}
