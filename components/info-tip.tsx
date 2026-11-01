'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { pickLocale } from '@/lib/market/uz-cyrl';
import { loadChunk } from '@/lib/market/stale-build';

type PopoverModule = typeof import('./info-tip-popover');
let loaded: PopoverModule | null = null;
let loading: Promise<PopoverModule> | null = null;
/** Radix Popover (and the shared utils chunk with tailwind-merge) stays out of the first load of the page (14.10.2026):
 *  its code is fetched when the page is idle, or at once when a "?" is pressed or focused. A failed fetch is forgotten,
 *  so the next attempt starts a new one. */
function importInfoTipPopover(): Promise<PopoverModule> {
  loading ??= import('./info-tip-popover').then((module) => (loaded = module), (error: unknown) => { loading = null; throw error; });
  return loading;
}
/** Fetching ahead of a press: a failure stays quiet (no page reload without a press). */
function warmInfoTipPopover() {
  if (!loaded) void importInfoTipPopover().catch(() => {});
}
/** A press: a fetch that failed ahead of it is tried once more. Chrome remembers a module that failed to load until the
 *  page reloads, so there the second try fails at once too, and loadChunk reloads the page once (lib/market/stale-build.ts),
 *  as for every lazy part: after a deploy or a network failure. */
export function loadInfoTipPopover(): Promise<PopoverModule> {
  return loadChunk(() => importInfoTipPopover().catch(() => importInfoTipPopover()));
}

/** Secondary text behind a "?" on phones (owner, 11.10.2026: text that must be there but matters less clutters the screen).
 *  The page keeps the same text as an element with the class `tip-text`: wider screens show that text and no button;
 *  phones (up to 760 px, mobile.css) hide it and show this button, whose bubble holds the text.
 *  Until it is pressed, the button is a plain one with the attributes Radix gives its trigger (same look and the same
 *  name and role for assistive tech); a press loads the bubble's code if needed and opens it. The Radix button replaces
 *  the plain one only then, so focus never jumps away while the plain one is focused: the open bubble takes it, and
 *  closing the bubble gives it back to the Radix button, as Radix always does. */
export function InfoTip({ children, locale, label }: { children: ReactNode; locale: string; label?: string }) {
  const name = label ?? pickLocale({ ru: 'Подробнее', uz: 'Batafsil', en: 'More info' }, locale);
  const [pressed, setPressed] = useState<PopoverModule | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (pressed) return;
    // Only a "?" on screen (phones, the product sheet, the cart summary) fetches the bubble's code while the page is idle.
    const warm = () => { if (button.current?.getClientRects().length) warmInfoTipPopover(); };
    if (typeof window.requestIdleCallback === 'function') { const id = window.requestIdleCallback(warm, { timeout: 3000 }); return () => window.cancelIdleCallback(id); }
    const timer = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(timer);
  }, [pressed]);
  if (pressed) return <pressed.InfoTipPopover name={name} defaultOpen>{children}</pressed.InfoTipPopover>;
  return <button ref={button} type="button" className="info-tip" aria-label={name} aria-haspopup="dialog" aria-expanded="false" data-state="closed" data-slot="popover-trigger"
    onPointerDown={warmInfoTipPopover} onFocus={warmInfoTipPopover} onClick={() => { void loadInfoTipPopover().then(setPressed, () => {}); }}><CircleHelp size={18} aria-hidden="true" /></button>;
}
