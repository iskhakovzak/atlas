"use client";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Mail, Smartphone } from "lucide-react";
import { appleOffered, AppleButton, GoogleMark, loginCopy, OtpLogin, ProviderLink, TelegramBotLogin, TelegramLogin, type Methods } from "./login-view";
import type { Locale } from "@/lib/market/i18n";
import { withCyrillic } from "@/lib/market/uz-cyrl";

const words = /*@__PURE__*/withCyrillic({
  ru: { or: "или", phone: "По номеру телефона", email: "По электронной почте", back: "Все способы входа", loading: "Загружаем способы входа…" },
  uz: { or: "yoki", phone: "Telefon raqami orqali", email: "Elektron pochta orqali", back: "Barcha kirish usullari", loading: "Kirish usullari yuklanmoqda…" },
  en: { or: "or", phone: "With a phone number", email: "With email", back: "All sign-in methods", loading: "Loading sign-in methods…" },
});

type Tab = "phone" | "email" | null;

/**
 * Sign-in inside the checkout page (redesign stage 6): every method the site offers, side by side — Telegram, phone code,
 * email code, Google (and Apple where it is on). Codes and Telegram finish on this page (`onDone` reloads the account);
 * Google is a round trip through its own page that comes back here (`return_to=/cart/checkout`). The same flows and
 * server checks as /login (app/login-view.tsx).
 */
export function CheckoutSignIn({ locale, onDone }: { locale: Locale; onDone: () => void }) {
  const c = loginCopy(locale), w = words[locale];
  const [methods, setMethods] = useState<Methods | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>(null);
  const [error, setError] = useState<string | null>(null);
  const showError = useCallback((code?: string) => setError(code ? (code in c.errors ? c.errors[code as keyof typeof c.errors] : c.errors.fallback) : null), [c]);
  useEffect(() => {
    fetch("/api/auth/methods", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() as Promise<Methods> : Promise.reject(new Error(String(response.status))))
      .then(setMethods).catch(() => setFailed(true));
  }, []);
  const returnTo = "/cart/checkout";
  if (failed) return <div className="notice" role="status">{c.none}</div>;
  if (!methods) return <div className="login-skeleton" role="status"><span className="sr-only">{w.loading}</span><i aria-hidden="true" /><b aria-hidden="true" /><i aria-hidden="true" /></div>;
  const any = Boolean(methods.telegram || methods.phone || methods.email || methods.google || appleOffered(methods));
  if (!any) return <div className="notice" role="status">{c.none}</div>;
  return <div className="co-signin">
    {error && <div className="notice error" role="alert">{error}</div>}
    {tab ? <div className="login-panel">
      <button type="button" className="text-button login-back" onClick={() => { setTab(null); setError(null); }}><ArrowLeft size={16} aria-hidden="true" />{w.back}</button>
      <OtpLogin key={tab} channel={tab} c={c} dev={!!methods.devCodes} onDone={onDone} onError={showError} />
    </div> : <div className="login-panel">
      {methods.telegram && (methods.telegramBot ? <TelegramBotLogin locale={locale} onDone={onDone} onError={showError} /> : <TelegramLogin bot={methods.telegram} hint={c.telegramHint} onDone={onDone} onError={showError} />)}
      {methods.telegram && (methods.phone || methods.email || methods.google) && <div className="login-or" role="separator"><span>{w.or}</span></div>}
      <div className="login-choices co-signin-choices">
        {methods.phone && <button type="button" className={"btn " + (methods.telegram ? "secondary" : "primary") + " login-choice"} onClick={() => { setTab("phone"); setError(null); }}><Smartphone size={18} aria-hidden="true" />{w.phone}</button>}
        {methods.email && <button type="button" className="btn secondary login-choice" onClick={() => { setTab("email"); setError(null); }}><Mail size={18} aria-hidden="true" />{w.email}</button>}
        {methods.google && <ProviderLink provider="google" returnTo={returnTo} className="btn secondary login-choice"><GoogleMark />{c.googleButton}</ProviderLink>}
        {appleOffered(methods) && <AppleButton methods={methods} returnTo={returnTo} label={c.appleButton} className="btn login-choice apple" onDone={onDone} onError={showError} />}
      </div>
    </div>}
    <small className="login-legal">{c.legal.before}<a href="/terms">{c.legal.terms}</a>{c.legal.and}<a href="/privacy">{c.legal.privacy}</a>{c.legal.after}</small>
  </div>;
}
