"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Locale } from "@/lib/market/i18n";
import {withCyrillic} from '@/lib/market/uz-cyrl';

/** What the button copies: the label says it, so a tracking number is not announced as the order number. */
export type CopyWhat = "order" | "tracking" | "address" | "link" | "sku";

const copyLabels: Record<Locale, Record<CopyWhat, { copy: string; copied: string; failed: string }>> = /*@__PURE__*/withCyrillic({
  ru: {
    order: { copy: "Скопировать номер заказа", copied: "Номер заказа скопирован", failed: "Не удалось скопировать номер" },
    tracking: { copy: "Скопировать трек-номер", copied: "Трек-номер скопирован", failed: "Не удалось скопировать трек-номер" },
    address: { copy: "Скопировать получателя и адрес", copied: "Получатель и адрес скопированы", failed: "Не удалось скопировать адрес" },
    link: { copy: "Скопировать ссылку на товар", copied: "Ссылка скопирована", failed: "Не удалось скопировать ссылку" },
    sku: { copy: "Скопировать артикул магазина", copied: "Артикул скопирован", failed: "Не удалось скопировать артикул" },
  },
  uz: {
    order: { copy: "Buyurtma raqamini nusxalash", copied: "Buyurtma raqami nusxalandi", failed: "Raqamni nusxalab bo‘lmadi" },
    tracking: { copy: "Trek-raqamni nusxalash", copied: "Trek-raqam nusxalandi", failed: "Trek-raqamni nusxalab bo‘lmadi" },
    address: { copy: "Qabul qiluvchi va manzilni nusxalash", copied: "Qabul qiluvchi va manzil nusxalandi", failed: "Manzilni nusxalab bo‘lmadi" },
    link: { copy: "Tovar havolasini nusxalash", copied: "Havola nusxalandi", failed: "Havolani nusxalab bo‘lmadi" },
    sku: { copy: "Do‘kon artikulini nusxalash", copied: "Artikul nusxalandi", failed: "Artikulni nusxalab bo‘lmadi" },
  },
  en: {
    order: { copy: "Copy order number", copied: "Order number copied", failed: "Could not copy order number" },
    tracking: { copy: "Copy tracking number", copied: "Tracking number copied", failed: "Could not copy tracking number" },
    address: { copy: "Copy recipient and address", copied: "Recipient and address copied", failed: "Could not copy the address" },
    link: { copy: "Copy product link", copied: "Link copied", failed: "Could not copy the link" },
    sku: { copy: "Copy store SKU", copied: "SKU copied", failed: "Could not copy the SKU" },
  },
});

export function CopyText({ text, locale, what = "order" }: { text: string; locale: Locale; what?: CopyWhat }) {
  const [result, setResult] = useState<"idle" | "copied" | "failed">("idle");
  const labels = copyLabels[locale][what];

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
      {result === "copied" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      <span className="sr-only" aria-live="polite">{result === "idle" ? "" : label}</span>
    </button>
  );
}
