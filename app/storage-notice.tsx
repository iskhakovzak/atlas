"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Cookie } from "lucide-react";
import Link from "@/components/site-link";
import { useMarket } from "@/lib/market/store";
import { consentDocuments, consentVersion, missingConsents } from "@/lib/market/account-delete";
import { consentChangeEvent, consentOpenEvent, cookieConsentVersion, makeCookieChoice, writeCookieChoice, type CookieChoice } from "@/lib/market/cookie-consent";
import { withCyrillic } from "@/lib/market/uz-cyrl";
import "./consent.css";

const copy = /*@__PURE__*/withCyrillic({
  ru: {
    label: "Настройки cookies", title: "Мы используем cookies",
    body: "Необходимые — чтобы работали вход и корзина. Аналитику и партнёрские ссылки включим только с вашего согласия.",
    more: "Подробнее", all: "Принять всё", necessary: "Только необходимые", customise: "Настроить", collapse: "Свернуть", save: "Сохранить выбор",
    docs: ["Выбирая, вы принимаете ", "Условия использования", " и ", "Политику конфиденциальности", "."],
    always: "Всегда",
    categories: {
      necessary: ["Необходимые", "Вход, корзина, язык и тема, защита от злоупотреблений и отчёты об ошибках. Работают всегда."],
      analytics: ["Аналитика", "Скорость страниц без привязки к вам — чтобы ускорять сайт."],
      partners: ["Партнёрские ссылки", "Impact учитывает переходы по партнёрским ссылкам магазинов."],
    },
  },
  uz: {
    label: "Cookie sozlamalari", title: "Biz cookie-fayllardan foydalanamiz",
    body: "Zarurlari — kirish va savat ishlashi uchun. Analitika va hamkor havolalarini faqat roziligingiz bilan yoqamiz.",
    more: "Batafsil", all: "Hammasini qabul qilish", necessary: "Faqat zarurlari", customise: "Sozlash", collapse: "Yig‘ish", save: "Tanlovni saqlash",
    docs: ["Tanlov orqali siz ", "Foydalanish shartlari", " va ", "Maxfiylik siyosati", "ni qabul qilasiz."],
    always: "Doim",
    categories: {
      necessary: ["Zarur", "Kirish, savat, til va mavzu, suiiste’moldan himoya va xatolar haqida hisobotlar. Doim ishlaydi."],
      analytics: ["Analitika", "Sahifalar tezligi, sizga bog‘lanmagan holda — saytni tezlashtirish uchun."],
      partners: ["Hamkor havolalari", "Impact do‘konlarning hamkor havolalari bo‘yicha o‘tishlarni hisobga oladi."],
    },
  },
  en: {
    label: "Cookie settings", title: "We use cookies",
    body: "Necessary ones keep sign-in and the cart working. Analytics and partner links stay off unless you allow them.",
    more: "Learn more", all: "Accept all", necessary: "Necessary only", customise: "Customise", collapse: "Collapse", save: "Save choice",
    docs: ["By choosing, you accept the ", "Terms of use", " and the ", "Privacy policy", "."],
    always: "Always on",
    categories: {
      necessary: ["Necessary", "Sign-in, cart, language and theme, abuse protection and error reports. Always on."],
      analytics: ["Analytics", "Page speed, not linked to you — so we can make the site faster."],
      partners: ["Partner links", "Impact counts visits through stores’ partner links."],
    },
  },
});

type Phase = "hidden" | "shown" | "leaving";
const deviceStorage = () => { try { return window.localStorage; } catch { return null; } };
const reducedMotion = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

/**
 * Cookie consent card (2 November 2026; web and the apps). Asks once per `cookieConsentVersion`: "Accept all" and
 * "Necessary only" side by side at the same size, "Customise" opens the switches (optional ones start off). It comes
 * back with the switches from the footer link "Data settings" and from /account/settings (`consentOpenEvent`).
 * A signed-in customer's choice is also saved in the account (action `cookie-consent`). While the account still lacks
 * the current privacy policy and terms (state.consents), the card says so and either choice records them — never
 * automatically from a device flag, which may belong to someone else. Not shown on /login; nothing is blocked while open.
 */
/** What the card never covers on a phone: the bottom bar (with its raised centre button) and the pinned bars above it. */
const keepClearOf = ".mobile-nav, .mobile-nav a, .mobile-nav a > *, .co-paybar, .basket-sticky:not(.is-hidden), main[data-view=\"link\"] .lo-sticky";

export function StorageNotice({ choice, known }: { choice: CookieChoice | null; known: boolean }) {
  const { state, ready, act } = useMarket();
  const pathname = usePathname() ?? "";
  const [phase, setPhase] = useState<Phase>("hidden");
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, partners: false });
  const panelId = useId();
  const titleId = useId();
  const card = useRef<HTMLElement>(null);
  const leaveTimer = useRef<number | undefined>(undefined);
  const missingKey = ready ? missingConsents(state).join(",") : "";
  const needed = known && (choice === null || missingKey.length > 0);
  const onLogin = pathname.startsWith("/login");

  // Asked by itself: after the first paint and a short pause, so the card is never the page's largest paint.
  useEffect(() => {
    if (!needed || onLogin || phase !== "hidden") return;
    let frame = 0;
    const timer = window.setTimeout(() => { frame = window.requestAnimationFrame(() => setPhase("shown")); }, 700);
    return () => { window.clearTimeout(timer); window.cancelAnimationFrame(frame); };
  }, [needed, onLogin, phase]);

  // The footer link and the settings page open it with the switches, showing the choice in force.
  useEffect(() => {
    const open = () => {
      window.clearTimeout(leaveTimer.current);
      setDraft({ analytics: choice?.analytics === true, partners: choice?.partners === true });
      setSettings(true);
      setPhase("shown");
      window.requestAnimationFrame(() => card.current?.querySelector<HTMLElement>("[role=switch]:not(:disabled)")?.focus({ preventScroll: true }));
    };
    window.addEventListener(consentOpenEvent, open);
    return () => window.removeEventListener(consentOpenEvent, open);
  }, [choice]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  // Phones: the stylesheet places the card above the bottom bar and the pinned pay/cart/product bars by their usual
  // heights; a bar that grew (a two-line button in Uzbek, a 360 px screen) would still reach under it. While the card is
  // up it is lifted, when needed, to 12 px above the highest of those bars as measured.
  useEffect(() => {
    if (phase === "hidden") return;
    const place = () => {
      const element = card.current;
      if (!element) return;
      element.style.removeProperty("bottom");
      if (!window.matchMedia("(max-width: 760px)").matches) return;
      const height = window.innerHeight;
      let top = height;
      for (const bar of document.querySelectorAll<HTMLElement>(keepClearOf)) {
        const box = bar.getBoundingClientRect();
        if (!box.height || box.top < height * 0.4 || getComputedStyle(bar).visibility === "hidden") continue;
        top = Math.min(top, box.top);
      }
      const needed = Math.ceil(height - top + 12), current = parseFloat(getComputedStyle(element).bottom) || 0;
      if (needed > current) element.style.bottom = `${needed}px`;
    };
    place();
    const timer = window.setInterval(place, 400);
    window.addEventListener("resize", place);
    return () => { window.clearInterval(timer); window.removeEventListener("resize", place); };
  }, [phase]);

  if (phase === "hidden" || (onLogin && phase === "shown" && !settings)) return null;
  const c = copy[state.communication.language];
  const docsMissing = missingKey.length > 0;

  function decide(allow: { analytics: boolean; partners: boolean }) {
    const next = makeCookieChoice(allow);
    writeCookieChoice(deviceStorage(), next);
    window.dispatchEvent(new Event(consentChangeEvent));
    if (ready) {
      void act({ type: "cookie-consent", version: cookieConsentVersion, analytics: next.analytics, partners: next.partners }, { queue: true });
      if (missingConsents(state).length) void act({ type: "consent-accept", documents: [...consentDocuments], version: consentVersion }, { queue: true });
    }
    setPhase("leaving");
    leaveTimer.current = window.setTimeout(() => { setPhase("hidden"); setSettings(false); }, reducedMotion() ? 120 : 200);
  }

  const toggle = (key: "analytics" | "partners") => setDraft((value) => ({ ...value, [key]: !value[key] }));
  const row = (key: "necessary" | "analytics" | "partners") => {
    const [name, text] = c.categories[key];
    const fixed = key === "necessary";
    const on = fixed || draft[key];
    return <li key={key} className="consent-row">
      <div className="consent-row-text"><span id={`${panelId}-${key}`}>{name}</span><small>{text}</small></div>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={`${panelId}-${key}`} disabled={fixed} className="consent-switch" onClick={fixed ? undefined : () => toggle(key)}>
        <span aria-hidden="true" />{fixed && <em>{c.always}</em>}
      </button>
    </li>;
  };

  return <aside ref={card} className="consent-card" data-phase={phase} data-settings={settings} role="region" aria-labelledby={titleId}>
    <div className="consent-head">
      <span className="consent-icon" aria-hidden="true"><Cookie /></span>
      <div className="consent-copy">
        <p id={titleId} className="consent-title">{c.title}</p>
        <p className="consent-body">{c.body} <Link href="/privacy#privacy-cookies">{c.more}</Link></p>
        {docsMissing && <p className="consent-docs">{c.docs[0]}<Link href="/terms">{c.docs[1]}</Link>{c.docs[2]}<Link href="/privacy">{c.docs[3]}</Link>{c.docs[4]}</p>}
      </div>
    </div>
    <div className="consent-panel" id={panelId} data-open={settings} aria-hidden={!settings} inert={!settings}>
      <div className="consent-panel-inner"><ul aria-label={c.label}>{row("necessary")}{row("analytics")}{row("partners")}</ul></div>
    </div>
    <div className="consent-actions">
      <button type="button" className="consent-btn" onClick={() => decide({ analytics: true, partners: true })}>{c.all}</button>
      {settings
        ? <button type="button" className="consent-btn" onClick={() => decide(draft)}>{c.save}</button>
        : <button type="button" className="consent-btn" onClick={() => decide({ analytics: false, partners: false })}>{c.necessary}</button>}
    </div>
    <button type="button" className="consent-customise" aria-expanded={settings} aria-controls={panelId} onClick={() => setSettings((value) => !value)}>{settings ? c.collapse : c.customise}</button>
  </aside>;
}
