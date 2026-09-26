"use client";

import { useEffect, useState } from "react";
import { useMarket } from "@/lib/market/store";

export function CookieConsent() {
  const { language } = useMarket();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("atlas-cookie-consent");
    if (!consent) {
      // Small timeout to avoid synchronous setState warning
      const timer = setTimeout(() => setShow(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("atlas-cookie-consent", "accepted");
    setShow(false);
  };

  if (!show) return null;

  const content = {
    ru: {
      text: "Мы используем файлы cookie и локальное хранилище для работы сайта, сохранения ваших настроек и соблюдения законов о данных.",
      button: "Принять",
    },
    uz: {
      text: "Biz sayt ishlashi, sozlamalaringizni saqlash va ma'lumotlar qonunchiligiga rioya qilish uchun cookie fayllari va mahalliy xotiradan foydalanamiz.",
      button: "Qabul qilish",
    },
    en: {
      text: "We use cookies and local storage to operate the site, save your preferences, and comply with data laws.",
      button: "Accept",
    },
  }[language ?? "ru"];

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-50 pointer-events-none">
      <div className="mx-auto max-w-2xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)] border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pointer-events-auto">
        <p className="text-sm text-slate-600 m-0 leading-relaxed">
          {content.text}
        </p>
        <button
          onClick={accept}
          className="bg-slate-900 text-white hover:bg-slate-800 transition-colors px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap w-full sm:w-auto flex-shrink-0"
        >
          {content.button}
        </button>
      </div>
    </div>
  );
}
