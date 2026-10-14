'use client';
import type { ReactNode } from 'react';
import { CircleHelp } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** The bubble of components/info-tip.tsx (Radix Popover). Its code is fetched when the page is idle or on the first press
 *  of a "?"; it replaces the plain button only once that "?" is pressed, with `defaultOpen` so the bubble opens as it mounts. */
export function InfoTipPopover({ children, name, defaultOpen }: { children: ReactNode; name: string; defaultOpen?: boolean }) {
  return <Popover defaultOpen={defaultOpen}>
    <PopoverTrigger asChild><button type="button" className="info-tip" aria-label={name}><CircleHelp size={17} aria-hidden="true" /></button></PopoverTrigger>
    <PopoverContent className="info-tip-bubble" side="bottom" align="center" sideOffset={8} collisionPadding={16}>{children}</PopoverContent>
  </Popover>;
}
