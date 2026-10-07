"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/site-link";
import { useMarket } from "@/lib/market/store";
import { consentDocuments, consentVersion, missingConsents } from "@/lib/market/account-delete";
import {withCyrillic} from '@/lib/market/uz-cyrl';

const KEY = "atlas-consent-v1";
// The previous storage notice: a visitor who dismissed it is not asked twice for the same thing.
const LEGACY_KEY = "atlas-storage-notice-v1";

const copy = withCyrillic({
  ru: { text: "Atlas обрабатывает ваши данные, чтобы считать заказы и доставлять посылки.", privacy: "Политика конфиденциальности", terms: "Условия использования", more: "Подробнее", accept: "Принимаю", label: "Согласие на обработку данных" },
  uz: { text: "Atlas buyurtmalarni hisoblash va jo‘natmalarni yetkazish uchun ma’lumotlaringizga ishlov beradi.", privacy: "Maxfiylik siyosati", terms: "Foydalanish shartlari", more: "Batafsil", accept: "Qabul qilaman", label: "Ma’lumotlarga ishlov berishga rozilik" },
  en: { text: "Atlas processes your data to price orders and deliver parcels.", privacy: "Privacy policy", terms: "Terms of use", more: "Learn more", accept: "I accept", label: "Data-processing consent" },
});

function stored(): string | null {
  try { return localStorage.getItem(KEY) ?? (localStorage.getItem(LEGACY_KEY) === "dismissed" ? "legacy" : null); } catch { return null; }
}

/**
 * Data-processing consent gate (web and the apps): one bottom sheet, accepted once per document version.
 * A guest's acceptance is remembered on the device. A signed-in customer is asked until this account holds
 * the current version of both documents (state.consents), even when the device flag is already set: the
 * flag may belong to another person's acceptance, so consent-accept is only ever sent from the Accept
 * button, never recorded automatically. Hidden while the session is still loading. Nothing is blocked
 * while it is open.
 */
export function StorageNotice() {
  const { state, status, ready, act } = useMarket();
  const [visible, setVisible] = useState(false);
  const sent = useRef(false);
  // The documents this account still has to accept, as a stable key: a refresh that changes nothing about
  // the consents must not re-derive the sheet (and so must not make it flicker).
  const missingKey = ready ? missingConsents(state).join(",") : "";
  useEffect(() => {
    if (status === "loading") return;
    // setTimeout: localStorage is read after hydration, so the first render matches the server HTML.
    const timer = window.setTimeout(() => setVisible(ready ? missingKey.length > 0 : stored() !== consentVersion), 0);
    return () => window.clearTimeout(timer);
  }, [status, ready, missingKey]);
  if (!visible) return null;
  const c = copy[state.communication.language];
  function accept() {
    try { localStorage.setItem(KEY, consentVersion); } catch {}
    setVisible(false);
    if (ready && !sent.current && missingConsents(state).length) {
      sent.current = true;
      void act({ type: "consent-accept", documents: [...consentDocuments], version: consentVersion }).then(ok => { sent.current = false; if (!ok) setVisible(true); });
    }
  }
  return <aside className="storage-notice" role="region" aria-label={c.label}>
    <p>{c.text} <Link href="/privacy">{c.privacy}</Link> · <Link href="/terms">{c.terms}</Link> · <Link href="/legal">{c.more}</Link></p>
    <button type="button" onClick={accept}>{c.accept}</button>
  </aside>;
}
