"use client";

import { useState, useEffect } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

export function SafeDeleteButton({ onConfirm, label, itemName, locale = 'ru' }: { onConfirm: () => void, label: string, itemName?: string, locale?: 'ru'|'uz'|'en' }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (confirming) {
      const timer = setTimeout(() => setConfirming(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [confirming]);

  const confirmText = locale === 'uz' ? 'Aniqmi?' : locale === 'en' ? 'Sure?' : 'Точно?';
  const ariaConfirm = locale === 'uz' ? 'Aniq o‘chirasizmi?' : locale === 'en' ? 'Are you sure?' : 'Точно удалить?';

  return (
    <button
      type="button"
      className={`remove-item ${confirming ? 'confirming' : ''}`}
      aria-label={`${confirming ? ariaConfirm : label} ${itemName ?? ''}`}
      onClick={() => {
        if (confirming) {
          onConfirm();
        } else {
          setConfirming(true);
        }
      }}
    >
      {confirming ? <AlertTriangle size={16} className="text-red-500" /> : <Trash2 size={16} />}
      <span style={{ color: confirming ? '#e7000b' : undefined }}>{confirming ? confirmText : label}</span>
    </button>
  );
}
