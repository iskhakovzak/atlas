// What the page shows between a tap on a link and the next page: the thin line at the top (press.css .nav-progress),
// a light running across a link button, and the tapped bottom-bar tab lit at once (mobile.css). Used by the in-place
// page changes of components/site-link.tsx and by the full page loads that app/press-feedback.tsx still sees.
let timer = 0;

export function startNavigationFeedback(link?: HTMLElement | null) {
  if (typeof document === 'undefined') return;
  stopNavigationFeedback();
  if (link) link.dataset.opening = '';
  document.documentElement.setAttribute('data-navigating', '');
  // A page that never comes (offline, a download): the line does not stay forever.
  timer = window.setTimeout(stopNavigationFeedback, 15000);
}

export function stopNavigationFeedback() {
  if (typeof document === 'undefined') return;
  window.clearTimeout(timer);
  document.documentElement.removeAttribute('data-navigating');
  document.querySelectorAll<HTMLElement>('[data-opening]').forEach(element => element.removeAttribute('data-opening'));
}
