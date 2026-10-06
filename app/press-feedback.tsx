'use client';
import { useEffect } from 'react';
import { haptic, isNative } from '@/lib/native/bridge';

// Buttons and button-like links that sink under the finger and spring back (styles: press.css).
const PRESSABLE = '.btn, .cart-link, .icon-btn, .variant-options button, .lo-stepper button, .find-save, .mobile-nav a, .store-tile, .stores-popular button, .catalog-categories > button, .home-stores a';
// Main actions also get a light tick on phones: in the apps through the native haptics, on Android in the browser through vibration.
const MAIN_ACTION = '.btn.primary, .cart-link';

/**
 * One listener for the whole site, nothing per button:
 * - the pressed element gets data-press="down", then "up" (the spring back), and the point under the finger for the soft light;
 * - a link button that opens another page shows a thin progress line at the top: every page here is a full load,
 *   so without it a press on "Order" looks ignored until the next page arrives.
 */
export function PressFeedback() {
  useEffect(() => {
    let pressed: HTMLElement | null = null;
    let pointer = '';
    let progressTimer = 0;

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
      element.style.setProperty('--press-x', `${Math.round(event.clientX - box.left)}px`);
      element.style.setProperty('--press-y', `${Math.round(event.clientY - box.top)}px`);
      element.style.setProperty('--press-size', `${Math.round(Math.hypot(box.width, box.height))}px`);
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

    const stopProgress = () => {
      window.clearTimeout(progressTimer);
      document.documentElement.removeAttribute('data-navigating');
      document.querySelectorAll<HTMLElement>('[data-opening]').forEach(element => element.removeAttribute('data-opening'));
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
      if (link.matches(PRESSABLE)) link.dataset.opening = '';
      document.documentElement.setAttribute('data-navigating', '');
      // A download or a page that never comes: the line does not stay forever.
      window.clearTimeout(progressTimer);
      progressTimer = window.setTimeout(stopProgress, 15000);
    };
    // Back/forward from the browser cache shows the old page as it was left: clean it.
    const onPageShow = () => stopProgress();

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
      stopProgress();
    };
  }, []);
  return <div className="nav-progress" aria-hidden="true" />;
}
