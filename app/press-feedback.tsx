'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { haptic, isNative } from '@/lib/native/bridge';
import { startNavigationFeedback, stopNavigationFeedback } from '@/lib/market/navigation-feedback';

// Buttons and button-like links that sink under the finger and spring back (styles: press.css).
const PRESSABLE = '.btn, .cart-link, .icon-btn, .variant-options button, .lo-stepper button, .find-save, .mobile-nav a, .store-tile, .stores-popular button, .catalog-categories > button, .home-stores a';
// Main actions also get a light tick on phones: in the apps through the native haptics, on Android in the browser through vibration.
const MAIN_ACTION = '.btn.primary, .cart-link';

/**
 * One listener for the whole site, nothing per button:
 * - the pressed element gets data-press="down", then "up" (the spring back), and the point under the finger for the soft light;
 * - a link that opens another page shows a thin progress line at the top until it arrives, so a press on "Order"
 *   never looks ignored. Site links (components/site-link.tsx) start it themselves and change the page in place;
 *   here it starts for the remaining full loads (plain <a>), and stops when the address changes.
 */
export function PressFeedback() {
  const pathname = usePathname();
  // A move to another page starts at its top; back/forward returns to the place the page was left. The router skipped
  // the first when it thought the new page's top was already visible (the cart opened mid-page), and lost the second
  // while the page was still filling in (12 October 2026). The router saves the place into a history entry when the page
  // is left, so an entry that has one is a return (back/forward) and a fresh entry is a new visit.
  const firstPage = useRef(true);
  // The next page is on screen (an in-place change): the line and the lit button stop.
  useEffect(() => {
    stopNavigationFeedback();
    if (firstPage.current) { firstPage.current = false; return; }
    const saved = (history.state as { __vinext_scrollY?: unknown } | null)?.__vinext_scrollY;
    if (typeof saved === 'number') {
      if (saved <= 0) return;
      // The page may still be loading its list: try again while it grows, give up after a second or on the first touch.
      const started = Date.now();
      let timer = 0;
      const stop = () => { window.clearTimeout(timer); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); };
      const step = () => {
        if (Math.abs(window.scrollY - saved) > 2) window.scrollTo({ top: saved, behavior: 'instant' });
        if (Math.abs(window.scrollY - saved) <= 2 || Date.now() - started > 1000) { stop(); return; }
        timer = window.setTimeout(step, 50);
      };
      window.addEventListener('wheel', stop, { passive: true });
      window.addEventListener('touchstart', stop, { passive: true });
      step();
      return stop;
    }
    if (!location.hash && window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  useEffect(() => {
    let pressed: HTMLElement | null = null;
    let pointer = '';

    const release = () => {
      if (!pressed) return;
      const element = pressed;
      pressed = null;
      element.dataset.press = 'up';
    };
    const onDown = (event: PointerEvent) => {
      pointer = event.pointerType;
      if (event.button !== 0) return;
      const element = (event.target as Element | null)?.closest<HTMLElement>(PRESSABLE);
      if (!element || element.matches(':disabled, [aria-disabled="true"]')) return;
      release();
      const box = element.getBoundingClientRect();
      // The box and the pointer are window pixels; under CSS zoom (the 27"+ home sheets, app/home-wide-rail.css)
      // the light's own pixels are smaller, so divide by the element's zoom (1 everywhere else and in older browsers).
      const zoom = (element as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom || 1;
      element.style.setProperty('--press-x', `${Math.round((event.clientX - box.left) / zoom)}px`);
      element.style.setProperty('--press-y', `${Math.round((event.clientY - box.top) / zoom)}px`);
      element.style.setProperty('--press-size', `${Math.round(Math.hypot(box.width, box.height) / zoom)}px`);
      // Restart the animation when the same button is pressed again quickly.
      delete element.dataset.press;
      void element.offsetWidth;
      element.dataset.press = 'down';
      pressed = element;
    };
    const onAnimationEnd = (event: AnimationEvent) => {
      const element = event.target as HTMLElement;
      if (event.animationName === 'press-up' && element.dataset.press === 'up') delete element.dataset.press;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const action = target?.closest<HTMLElement>(MAIN_ACTION);
      if (action && !action.matches(':disabled, [aria-disabled="true"]')) {
        if (isNative()) void haptic('light');
        else if (pointer === 'touch' && typeof navigator.vibrate === 'function') navigator.vibrate(8);
      }
      // Read after every other handler: a link that the page handled itself (sheet, menu, copy) is not a navigation.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = target?.closest<HTMLAnchorElement>('a[href]');
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const next = new URL(link.href, location.href);
      // Other sites open in their own way; /api/ links are files (CSV exports) that never replace the page.
      if (next.origin !== location.origin || next.pathname.startsWith('/api/') || (next.pathname === location.pathname && next.search === location.search)) return;
      startNavigationFeedback(link.matches(PRESSABLE) ? link : null);
    };
    // Back/forward from the browser cache shows the old page as it was left: clean it.
    const onPageShow = () => stopNavigationFeedback();

    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', release, { passive: true });
    document.addEventListener('dragstart', release);
    document.addEventListener('animationend', onAnimationEnd);
    window.addEventListener('click', onClick);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', release);
      document.removeEventListener('pointercancel', release);
      document.removeEventListener('dragstart', release);
      document.removeEventListener('animationend', onAnimationEnd);
      window.removeEventListener('click', onClick);
      window.removeEventListener('pageshow', onPageShow);
      stopNavigationFeedback();
    };
  }, []);
  return <div className="nav-progress" aria-hidden="true" />;
}
