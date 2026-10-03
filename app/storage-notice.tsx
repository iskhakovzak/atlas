"use client";

import { useEffect, useState } from "react";
import Link from "@/components/site-link";
import { useMarket } from "@/lib/market/store";

const KEY = "atlas-storage-notice-v1";

export function StorageNotice() {
  const { state } = useMarket();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setVisible(localStorage.getItem(KEY) !== "dismissed"); }
      catch { setVisible(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  const copy = {
    ru: { text: "Atlas сохраняет язык и необходимые для работы сайта данные в браузере.", details: "Как используются данные", dismiss: "Понятно" },
    uz: { text: "Atlas til va sayt ishlashi uchun zarur ma’lumotlarni brauzerda saqlaydi.", details: "Ma’lumotlardan foydalanish", dismiss: "Tushunarli" },
    en: { text: "Atlas stores your language and data needed for the site to work in your browser.", details: "How data is used", dismiss: "Got it" },
  }[state.communication.language];
  return <aside className="storage-notice" aria-label={copy.details}>
    <p>{copy.text} <Link href="/legal#privacy">{copy.details}</Link></p>
    <button type="button" onClick={() => { try { localStorage.setItem(KEY, "dismissed"); } catch {} setVisible(false); }}>{copy.dismiss}</button>
  </aside>;
}
