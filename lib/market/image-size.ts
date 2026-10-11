// Store photos are saved at the store's full size (Amazon 1500 px, Nike 1070 px, Target 800 px) while a card shows
// 150-250 px and a cart line 52-80 px. sizedImage asks the store's own image server for a copy about `px` wide, for
// the URL schemes below only; any other address comes back unchanged. The saved address never changes: this is
// display only, and ProductImage falls back to the original when the smaller copy fails to load. Each rule was
// checked against the live servers (11.10.2026): Walmart ignores odnWidth, Salesforce stores (demandware) answer
// ?sw= with a much heavier PNG and Samsung only knows fixed presets, so those are left as they are.

const EBAY_SIZES = [140, 225, 300, 400, 500, 640, 960, 1600];
// Demo products saved before 11.10.2026 keep their .jpg address (the files stay in public/images); the .webp copy
// next to it is 2-5 times lighter.
const DEMO_JPG = /^\/images\/(sneaker|backpack|headphones)\.jpg$/;

export function sizedImage(src: string, px: number): string {
  if (DEMO_JPG.test(src)) return src.replace(/\.jpg$/, '.webp');
  if (!src || !/^https:\/\//i.test(src) || !(px > 0)) return src;
  let url: URL;
  try { url = new URL(src); } catch { return src; }
  const host = url.hostname.toLowerCase(), size = Math.round(px);
  // Amazon: the size sits in the file name, "71abc._AC_SL1500_.jpg" (SL/UL the longer side, SX/UX the width,
  // SY/UY the height). Only the number changes: dropping or adding "AC" would crop the white margins differently.
  if (host === 'm.media-amazon.com' && url.pathname.startsWith('/images/I/')) {
    const path = url.pathname.replace(/(\._(?:[A-Z]{2}_)*(?:SL|UL|SX|UX|SY|UY))(\d+)(_\.(?:jpe?g|png|webp)$)/i,
      (whole, head: string, value: string, tail: string) => Number(value) > size ? head + size + tail : whole);
    if (path === url.pathname) return src;
    url.pathname = path;
    return url.toString();
  }
  // eBay: fixed sizes in the file name, "s-l1600.jpg"; never larger than the saved one.
  if (host === 'i.ebayimg.com') {
    const match = url.pathname.match(/\/s-l(\d+)\.(jpe?g|png|webp)$/i);
    if (!match) return src;
    const want = EBAY_SIZES.find((value) => value >= size) ?? 1600;
    if (want >= Number(match[1])) return src;
    url.pathname = url.pathname.replace(/\/s-l\d+\./i, `/s-l${want}.`);
    return url.toString();
  }
  // Nike: the first path segment is a named transformation ("t_web_pdp_535_v2", "t_default"); a plain width replaces
  // it and the automatic format is kept (added when the URL had none).
  if (host === 'static.nike.com') {
    const match = url.pathname.match(/^\/a\/images\/t_[^/]+\/([^/]*)/);
    if (!match) return src;
    url.pathname = url.pathname.replace(/^\/a\/images\/t_[^/]+\//, match[1].startsWith('f_auto') ? `/a/images/w_${size}/` : `/a/images/w_${size},f_auto/`);
    return url.toString();
  }
  // Scene7 (Target, Apple): wid/hei in the query; the height keeps the saved proportion.
  if (host.endsWith('.scene7.com') || host === 'store.storeimages.cdn-apple.com') {
    const wid = Number(url.searchParams.get('wid')), hei = Number(url.searchParams.get('hei'));
    if (wid && wid <= size) return src;
    url.searchParams.set('wid', String(size));
    if (wid && hei) url.searchParams.set('hei', String(Math.round(hei * size / wid)));
    else url.searchParams.delete('hei');
    return url.toString();
  }
  // Shopify: ?width= on the CDN.
  if (host === 'cdn.shopify.com' || url.pathname.includes('/cdn/shop/')) {
    const width = Number(url.searchParams.get('width'));
    if (width && width <= size) return src;
    url.searchParams.set('width', String(size));
    return url.toString();
  }
  // Wolverine brands (Merrell, Saucony, Sperry): named presets, dw-large is 1280 px and dw-medium 600 px.
  if (host === 'thekit.wolverineworldwide.com' && url.searchParams.get('preset') === 'dw-large' && size <= 600) {
    url.searchParams.set('preset', 'dw-medium');
    return url.toString();
  }
  return src;
}

/** srcset for a photo shown at most about `px` wide: the store's copies at half and full `px`, so a card that ends up
 * small (a desktop grid, a phone at DPR 1) takes the lighter one. Undefined when the store has no such copies. */
export function sizedSrcSet(src: string, px: number): string | undefined {
  const half = Math.round(px / 2), small = sizedImage(src, half), large = sizedImage(src, px);
  if (small === src || small === large) return undefined;
  return `${small} ${half}w, ${large} ${Math.round(px)}w`;
}

/** onError of an <img> showing sizedImage(original): the first failure retries the store's own address and returns
 * true; after that (or when nothing was resized) it returns false and the caller shows its fallback. */
export function retryOriginal(image: HTMLImageElement, original: string): boolean {
  // Remembered per address: React may reuse the element for another product.
  if (image.dataset.original === original || image.getAttribute('src') === original) return false;
  image.dataset.original = original;
  // A srcset would keep choosing the resized copy over src.
  image.removeAttribute('srcset');
  image.src = original;
  return true;
}
