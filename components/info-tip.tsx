'use client';
import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { pickLocale } from '@/lib/market/uz-cyrl';

/** Secondary text behind a "?" on phones (owner, 11.10.2026: text that must be there but matters less clutters the screen).
 *  The page keeps the same text as an element with the class `tip-text`: wider screens show that text and no button;
 *  phones (up to 760 px, mobile.css) hide it and show this button, whose bubble holds the text. */
export function InfoTip({ children, locale, label }: { children: ReactNode; locale: string; label?: string }) {
  const name = label ?? pickLocale({ ru: 'Подробнее', uz: 'Batafsil', en: 'More info' }, locale);
  return <Popover>
    <PopoverTrigger asChild><button type="button" className="info-tip" aria-label={name}><CircleHelp size={17} aria-hidden="true" /></button></PopoverTrigger>
    <PopoverContent className="info-tip-bubble" side="bottom" align="center" sideOffset={8} collisionPadding={16}>{children}</PopoverContent>
  </Popover>;
}
