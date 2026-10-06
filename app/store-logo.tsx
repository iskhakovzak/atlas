import type { StoreBrand } from '@/lib/market/store-brands';

// A stable soft colour per brand for the monogram of stores without a logo file.
const tints = ['#e8efe9', '#e9edf6', '#f4ece2', '#efe8f3', '#e6f0f1', '#f3e9e9'];
function tint(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tints[hash % tints.length];
}

/**
 * Store icon on a white plate (logos are drawn for light backgrounds, so the plate stays white in dark mode too).
 * `loading` is lazy by default; shelves above the fold (popular stores, the stores you ordered from) pass 'eager'.
 */
export function StoreLogo({ brand, size = 40, loading = 'lazy' }: { brand: Pick<StoreBrand, 'key' | 'name' | 'logo'>; size?: number; loading?: 'eager' | 'lazy' }) {
  // Padding scales with the plate (a % padding would follow the parent's width instead).
  const style = { width: size, height: size, padding: Math.round(size * 0.1) };
  // Fixed 96px icons served from /public; there is no image optimizer to hand them to.
  // eslint-disable-next-line @next/next/no-img-element
  if (brand.logo) return <span className="store-logo" style={style} aria-hidden="true"><img src={`/store-logos/${brand.key}.webp`} alt="" width={size} height={size} loading={loading} decoding="async" /></span>;
  const letters = brand.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2);
  return <span className="store-logo store-logo-mono" style={{ ...style, padding: 0, background: tint(brand.key), fontSize: Math.round(size * 0.38) }} aria-hidden="true">{letters.charAt(0).toUpperCase() + letters.slice(1).toLowerCase()}</span>;
}
