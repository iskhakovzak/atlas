/**
 * The favourite heart's "pop" when something is saved (2 November 2026): set on the tapped button only for a save, never
 * on an unsave or on hearts that render already saved, and taken off when the animation is over (CSS: app/favorite-heart.css).
 */
export function popHeart(button: HTMLElement | null, saving: boolean) {
  if (!button || !saving) return;
  button.removeAttribute('data-pop');
  void button.offsetWidth;
  button.setAttribute('data-pop', '');
  window.setTimeout(() => button.removeAttribute('data-pop'), 420);
}
