"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {pickLocale} from '@/lib/market/uz-cyrl';
import type {Locale} from '@/lib/market/i18n';

export function SafeDeleteButton({ onConfirm, label, itemName, locale }: {
  onConfirm: () => Promise<boolean> | boolean;
  label: string;
  itemName: string;
  locale: Locale;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!confirming || pending) return;
    const timer = window.setTimeout(() => setConfirming(false), 5000);
    return () => window.clearTimeout(timer);
  }, [confirming, pending]);
  const text = pickLocale({ ru: "Подтвердить удаление", uz: "O‘chirishni tasdiqlash", en: "Confirm removal" }, locale);
  return <button type="button" className={`remove-item${confirming ? " confirming" : ""}`} disabled={pending}
    aria-label={`${confirming ? text : label}: ${itemName}`}
    onClick={async () => {
      if (!confirming) { setConfirming(true); return; }
      setPending(true);
      try { await onConfirm(); } finally { setPending(false); setConfirming(false); }
    }}>
    {confirming ? <AlertTriangle size={16} /> : <Trash2 size={16} />}
    <span>{confirming ? text : label}</span>
  </button>;
}
