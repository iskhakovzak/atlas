'use client';

import { useEffect, useState } from 'react';

/** Sheets (catalog filters, the product sheet) slide up from the bottom on phones and in from the right elsewhere. */
export function useSheetSide() {
  const [side, setSide] = useState<'bottom' | 'right'>('right');
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setSide(media.matches ? 'bottom' : 'right');
    queueMicrotask(update);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return side;
}
