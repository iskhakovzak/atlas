import type { CSSProperties } from 'react';
import type { StoreBrand } from '@/lib/market/store-brands';
import { storeMarkRatios } from '@/lib/market/store-marks';

// A stable soft colour per brand for the monogram of stores without a logo file.
const tints = ['#e8efe9', '#e9edf6', '#f4ece2', '#efe8f3', '#e6f0f1', '#f3e9e9'];
function tint(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tints[hash % tints.length];
}

/** Marks that already spell the store's name: next to them the name is not repeated. */
export const storeWordmarks = new Set(['aliexpress', 'bose', 'dell', 'dior', 'ebay', 'fnac', 'hm', 'hp', 'ikea', 'jbl', 'lenovo', 'lg', 'newegg', 'nikon', 'northface', 'otto', 'samsung', 'sony', 'uniqlo', 'walmart', 'zara']);
export const hasStoreMark = (key: string) => storeMarkRatios[key] !== undefined;

/**
 * A store's vector mark (public/store-marks, Simple Icons) drawn in the text colour through a CSS mask: crisp at any
 * size and readable in both themes. `height` in px; the width follows the mark, capped at `maxWidth`.
 */
export function StoreMark({ brandKey, height, maxWidth = height * 4 }: { brandKey: string; height: number; maxWidth?: number }) {
  const ratio = storeMarkRatios[brandKey] ?? 1;
  const width = Math.min(height * ratio, maxWidth);
  const style = { width, height: Math.round((width / ratio) * 10) / 10, '--mark': `url(/store-marks/${brandKey}.svg)` } as CSSProperties;
  return <span className="store-mark" style={style} aria-hidden="true" />;
}

/**
 * Store icon on a plate. A store with a vector mark shows it in the text colour on the page's surface (both themes);
 * the rest keep their raster icon on a white plate (logos are drawn for light backgrounds, so the plate stays white in dark mode too).
 * `loading` is lazy by default; shelves above the fold (popular stores, the stores you ordered from) pass 'eager'.
 */
export function StoreLogo({ brand, size = 40, loading = 'lazy' }: { brand: Pick<StoreBrand, 'key' | 'name' | 'logo'>; size?: number; loading?: 'eager' | 'lazy' }) {
  // Padding scales with the plate (a % padding would follow the parent's width instead).
  const style = { width: size, height: size, padding: Math.round(size * 0.1) };
  // In a square plate a mark wider than 3:1 would be a thin line; those stores keep their raster icon there.
  if (hasStoreMark(brand.key) && storeMarkRatios[brand.key] <= 3) {
    // The mark fits a box inside the plate: wide wordmarks by width (a wider box), tall ones by height.
    const ratio = storeMarkRatios[brand.key], box = Math.round(size * (ratio > 2 ? 0.78 : 0.64));
    return <span className="store-logo store-logo-vector" style={{ width: size, height: size }} aria-hidden="true"><StoreMark brandKey={brand.key} height={ratio > 1 ? box / ratio : box} maxWidth={box} /></span>;
  }
  // Fixed 96px icons served from /public; there is no image optimizer to hand them to.
  // eslint-disable-next-line @next/next/no-img-element
  if (brand.logo) return <span className="store-logo" style={style} aria-hidden="true"><img src={`/store-logos/${brand.key}.webp`} alt="" width={size} height={size} loading={loading} decoding="async" /></span>;
  const letters = brand.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2);
  return <span className="store-logo store-logo-mono" style={{ ...style, padding: 0, background: tint(brand.key), fontSize: Math.round(size * 0.38) }} aria-hidden="true">{letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase()}</span>;
}
