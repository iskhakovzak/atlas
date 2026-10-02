/** A deliberate horizontal gesture; vertical scrolling and taps do not change photos. */
export function gallerySwipeStep(dx: number, dy: number, width: number): number {
  if (![dx, dy, width].every(Number.isFinite) || width <= 0) return 0;
  if (Math.abs(dx) < Math.max(36, width * 0.12) || Math.abs(dx) < Math.abs(dy) * 1.25) return 0;
  return dx < 0 ? 1 : -1;
}
