"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "@/components/site-link";
import { useMarket } from "@/lib/market/store";
import { consentDocuments, consentVersion, missingConsents } from "@/lib/market/account-delete";
import {withCyrillic} from '@/lib/market/uz-cyrl';

const KEY = "atlas-consent-v1";
// The previous storage notice: a visitor who dismissed it is not asked twice for the same thing.
const LEGACY_KEY = "atlas-storage-notice-v1";

const copy = /*@__PURE__*/withCyrillic({
  ru: { text: "Atlas обрабатывает данные для заказов и доставки. На сайте Impact учитывает партнёрские переходы и показы страниц.", privacy: "Политика конфиденциальности", terms: "Условия использования", more: "Правила работы", accept: "Принимаю", label: "Согласие на обработку данных" },
  uz: { text: "Atlas buyurtma va yetkazish uchun ma’lumotlarga ishlov beradi. Saytda Impact hamkor havolalari va sahifa ko‘rishlarini hisobga oladi.", privacy: "Maxfiylik siyosati", terms: "Foydalanish shartlari", more: "Ishlash qoidalari", accept: "Qabul qilaman", label: "Ma’lumotlarga ishlov berishga rozilik" },
  en: { text: "Atlas processes data for orders and delivery. On the website, Impact measures partner links and page impressions.", privacy: "Privacy policy", terms: "Terms of use", more: "How Atlas works", accept: "I accept", label: "Data-processing consent" },
});

const compactCopy = /*@__PURE__*/withCyrillic({
  ru: { summary: "Данные и правила Atlas", show: "Подробнее", hide: "Свернуть" },
  uz: { summary: "Atlas ma’lumotlari va qoidalari", show: "Batafsil", hide: "Yig‘ish" },
  en: { summary: "Atlas data and terms", show: "Details", hide: "Collapse" },
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
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
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
  const compact = compactCopy[state.communication.language];
  function accept() {
    try { localStorage.setItem(KEY, consentVersion); } catch {}
    window.dispatchEvent(new Event('atlas:consent-accepted'));
    setVisible(false);
    if (ready && !sent.current && missingConsents(state).length) {
      sent.current = true;
      void act({ type: "consent-accept", documents: [...consentDocuments], version: consentVersion }).then(ok => { sent.current = false; if (!ok) setVisible(true); });
    }
  }
  return <aside className="storage-notice" data-expanded={expanded} role="region" aria-label={c.label}>
    <div className="storage-notice-summary"><p>{compact.summary}</p><button type="button" className="storage-notice-details" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(value => !value)}>{expanded ? compact.hide : compact.show}</button></div>
    <p id={detailsId} className="storage-notice-full">{c.text} <Link href="/privacy">{c.privacy}</Link> · <Link href="/terms">{c.terms}</Link> · <Link href="/legal">{c.more}</Link></p>
    <button type="button" className="storage-notice-accept" onClick={accept}>{c.accept}</button>
  </aside>;
}
