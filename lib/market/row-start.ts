import { useLayoutEffect, useRef } from 'react';

// A horizontal row with scroll snapping whose cards change after the first paint: the server draws the cards it can
// (no account, catalog still loading), the browser adds or reorders some, and Chrome scrolls the row to keep the card
// it had snapped, so the row opened one card in (catalog sets, store showcase; 10.10.2026). Until the row is touched it
// goes back to its first card whenever its cards change. Spread the result on the row element.
// Not on mount: a fresh row already starts at 0, and writing scrollLeft there forced a layout of the whole page in the
// middle of hydration (~180 ms on a slow phone, 26.10.2026).
export function useRowAtStart<T extends HTMLElement>(cards: string) {
  const ref = useRef<T>(null), touched = useRef(false), shown = useRef(cards);
  useLayoutEffect(() => {
    if (shown.current === cards) return;
    shown.current = cards;
    if (cards && !touched.current && ref.current) ref.current.scrollLeft = 0;
  }, [cards]);
  const touch = () => { touched.current = true; };
  return { ref, onPointerDown: touch, onWheel: touch, onFocus: touch };
}
