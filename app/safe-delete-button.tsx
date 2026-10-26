"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {pickLocale} from '@/lib/market/uz-cyrl';
import type {Locale} from '@/lib/market/i18n';

export function SafeDeleteButton({ onConfirm, label, itemName, locale, confirmLabel, onArm, instant }: {
  onConfirm: () => Promise<boolean> | boolean;
  label: string;
  itemName: string;
  locale: Locale;
  /** The second-tap text when the action is not a removal, e.g. «Подтвердить отвязку». */
  confirmLabel?: string;
  /** Told when the button waits for the second tap (true) and when it stops waiting (false), e.g. to show a warning. */
  onArm?: (armed: boolean) => void;
  /** One tap is enough: the action itself offers «Вернуть» afterwards (cart lines), so a second tap only slows people down. */
  instant?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  // The latest callback without restarting the 5-second wait on every render of the parent.
  const arm = useRef(onArm);
  useEffect(() => { arm.current = onArm; });
  useEffect(() => {
    if (!confirming || pending) return;
    const timer = window.setTimeout(() => { setConfirming(false); arm.current?.(false); }, 5000);
    return () => window.clearTimeout(timer);
  }, [confirming, pending]);
  const text = confirmLabel ?? pickLocale({ ru: "Подтвердить удаление", uz: "O‘chirishni tasdiqlash", en: "Confirm removal" }, locale);
  return <button type="button" className={`remove-item${confirming ? " confirming" : ""}`} disabled={pending}
    aria-label={`${confirming ? text : label}: ${itemName}`}
    onClick={async () => {
      if (!confirming && !instant) { setConfirming(true); onArm?.(true); return; }
      setPending(true);
      try { await onConfirm(); } finally { setPending(false); setConfirming(false); onArm?.(false); }
    }}>
    {confirming ? <AlertTriangle size={16} /> : <Trash2 size={16} />}
    <span>{confirming ? text : label}</span>
  </button>;
}
