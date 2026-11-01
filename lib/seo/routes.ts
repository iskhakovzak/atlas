// Public page families the redesign adds (1 November 2026): their URL shapes, and whether the sitemap may list them.
// A family is listed only once its page exists, so the sitemap never sends a crawler to a 404. Turn a flag on in the
// same change that adds the route; tests/seo-sitemap.test.mjs fails if a flag is on while the page file is missing.

export const seoRoutes: { productPages: boolean; storePages: boolean; deliveryPage: boolean } = {
  /** app/catalog/p/[id]/page.tsx (redesign stage 5). */
  productPages: false,
  /** app/stores/[slug]/page.tsx (redesign stage 8). */
  storePages: false,
  /** app/delivery/page.tsx (redesign stage 8). */
  deliveryPage: false,
};

/** The page file each flag stands for, relative to the repository root. */
export const seoRouteFiles: Record<keyof typeof seoRoutes, string> = {
  productPages: 'app/catalog/p/[id]/page.tsx',
  storePages: 'app/stores/[slug]/page.tsx',
  deliveryPage: 'app/delivery/page.tsx',
};

/** A catalog product's page. */
export function productPath(id: string): string {
  return `/catalog/p/${encodeURIComponent(id)}`;
}

/** A store's page. */
export function storePath(slug: string): string {
  return `/stores/${encodeURIComponent(slug)}`;
}
