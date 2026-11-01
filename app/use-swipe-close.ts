'use client';
import {useRef, type PointerEvent} from 'react';

/**
 * The grip on top of a bottom sheet (polish, 1 November 2026): dragging it down moves the sheet with the finger and,
 * past 80 px, closes it — the grip promised that and the sheets (Radix Dialog) had no drag. The "×", Esc and a tap on
 * the dimmed page still close it. Spread the handlers on the grip element; it needs `touch-action: none`.
 */
export function useSwipeClose(close: () => void) {
  const drag = useRef<{y: number; panel: HTMLElement; dy: number} | null>(null);
  const finish = (event: PointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current.dy > 80) { close(); return; }
    current.panel.style.transition = 'transform 200ms cubic-bezier(.22, 1, .36, 1)';
    current.panel.style.transform = '';
  };
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      const panel = event.currentTarget.closest<HTMLElement>('[role="dialog"]');
      if (!panel || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      panel.style.transition = 'none';
      drag.current = {y: event.clientY, panel, dy: 0};
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = drag.current;
      if (!current) return;
      current.dy = Math.max(0, event.clientY - current.y);
      current.panel.style.transform = `translateY(${current.dy}px)`;
    },
    onPointerUp: finish,
    onPointerCancel: finish,
  };
}
