/** A product link is bound to one exact merchant colorway; sibling colors belong in the catalog. */
export function variantsForSourceColor<T extends { color?: string }>(
  variants: T[],
  sourceColor?: string,
): T[] {
  const color = sourceColor?.trim();
  if (!color) return variants;
  const exactColor = variants.filter(variant => variant.color?.trim() === color);
  return exactColor.length ? exactColor : variants;
}
