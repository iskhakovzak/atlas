import { useLayoutEffect, useRef } from 'react';

// A horizontal row with scroll snapping whose cards change after the first paint: the server draws the cards it can
// (no account, catalog still loading), the browser adds or reorders some, and Chrome scrolls the row to keep the card
// it had snapped, so the row opened one card in (catalog sets, store showcase; 10.10.2026). Until the row is touched it
// goes back to its first card whenever its cards change. Spread the result on the row element.
export function useRowAtStart<T extends HTMLElement>(cards: string) {
  const ref = useRef<T>(null), touched = useRef(false);
  useLayoutEffect(() => { if (cards && !touched.current && ref.current) ref.current.scrollLeft = 0; }, [cards]);
  const touch = () => { touched.current = true; };
  return { ref, onPointerDown: touch, onWheel: touch, onFocus: touch };
}
