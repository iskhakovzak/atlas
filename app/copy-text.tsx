"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Locale } from "@/lib/market/i18n";

const copyLabels: Record<Locale, { copy: string; copied: string; failed: string }> = {
  ru: { copy: "Скопировать номер заказа", copied: "Номер заказа скопирован", failed: "Не удалось скопировать номер" },
  uz: { copy: "Buyurtma raqamini nusxalash", copied: "Buyurtma raqami nusxalandi", failed: "Raqamni nusxalab bo‘lmadi" },
  en: { copy: "Copy order number", copied: "Order number copied", failed: "Could not copy order number" },
};

export function CopyText({ text, locale }: { text: string; locale: Locale }) {
  const [result, setResult] = useState<"idle" | "copied" | "failed">("idle");
  const labels = copyLabels[locale];

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await navigator.clipboard.writeText(text);
      setResult("copied");
      window.setTimeout(() => setResult("idle"), 1800);
    } catch {
      setResult("failed");
      window.setTimeout(() => setResult("idle"), 2600);
    }
  }

  const label = result === "copied" ? labels.copied : result === "failed" ? labels.failed : labels.copy;
  return (
    <button className="copy-text-btn" type="button" onClick={() => void copy()} aria-label={label} title={label}>
      {result === "copied" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{result === "idle" ? "" : label}</span>
    </button>
  );
}
