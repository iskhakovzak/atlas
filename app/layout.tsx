import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { pageLocale } from "./page-locale";
import { SESSION_COOKIE } from "@/lib/auth/core";
import { rootMetadata } from "./route-metadata";
import { htmlLang } from "@/lib/market/uz-cyrl";
import { env } from "cloudflare:workers";
import "@fontsource-variable/inter/opsz.css";
// Manrope (only the wordmark uses it): the fontsource faces, with the letters of "atlas" in a 5.9 KB file of their own
// (app/fonts/manrope.css, written by scripts/wordmark-font.mjs).
import "./fonts/manrope.css";
// The design tokens (colours, type scale, radii, shadows, spacing, heights, motion) come first: every later file reads them.
import "./tokens.css";
import { preload } from "react-dom";
import interLatin from "@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2?url";
import interCyrillic from "@fontsource-variable/inter/files/inter-cyrillic-opsz-normal.woff2?url";
import manropeWordmark from "./fonts/manrope-atlas.woff2?url";
// Styles every page needs, in cascade order. Page-only layers are imported by their pages (app/admin, app/orders,
// app/cart…) and load after these, so they are kept to rules no later layer here overrides (10.10.2026).
// Rules only some routes or lazily loaded parts use were split out to app/styles/*.css (14.10.2026): each page or part
// imports its file itself, and every rule a later file here overrides stayed here, so keep this order and do not import
// app/styles here. Those files are linked after all of these (a shared one also after the page's own CSS), so a rule
// moved there wins ties it used to lose (tests/css-split.test.mjs).
import "./globals.css";
import "./atlas-design.css";
import "./finds.css";
import "./checkout-clarity.css";
import "./access.css";
import "./login.css";
import "./experience.css";
import "./home-polish.css";
import "./mobile-polish.css";
import "./customer-mobile.css";
import "./home.css";
import "./customer.css";
import "./theme-night.css";
import "./catalog.css";
import "./stores.css";
import "./mobile.css";
import "./refine.css";
import "./day-folio.css";
import "./native.css";
import "./store-marks.css";
import "./ambient.css";
import "./checkbox.css";
import "./press.css";
import "./header-panel.css";
import "./motion.css";
import "./link-inputs.css";
// Shared rules that need a width of 481px or more, linked with media in <head>: on phones they do not block the first paint.
import layoutDesktopHref from "./styles/layout-desktop.css?url";
import { MarketProvider } from "@/lib/market/store";
import { initialSettings } from "@/lib/market/initial-data";
import { AtlasThemeProvider } from "./theme-control";
// StorageNotice, PerformanceProbe and ImpactTracking: one chunk right after hydration (app/shell-extras.tsx).
import { ShellExtras } from "./shell-extras";
import { StaleBuildReload } from "./stale-build-reload";
import { NativeShell } from "./native-shell";
import { PressFeedback } from "./press-feedback";
import { AmbientBackdrop } from "./ambient-backdrop";
import { JsonLd } from "./json-ld";
import { siteGraph } from "@/lib/seo/structured-data";
import { impactHeadScript } from '@/lib/market/impact-tracking';

export async function generateMetadata(): Promise<Metadata> {
  return rootMetadata(await pageLocale(), { google: env.ATLAS_GOOGLE_SITE_VERIFICATION, yandex: env.ATLAS_YANDEX_VERIFICATION });
}

// Browser chrome matches the header. The site theme is chosen in the app, not by the OS,
// so app/theme-control.tsx switches this colour when the visitor turns the dark theme on.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Render in the visitor's language from the first byte: a `?lang=` version, the saved choice,
  // the browser language, then Uzbek.
  // The tariff from D1 goes into the first render too, so the sums on the home page do not change after /api/account answers.
  // The site content (contacts, legal entity, reviews…) comes from D1 as well, so the footer does not flicker after hydration.
  const [locale, { pricing, siteContent }] = await Promise.all([pageLocale(), initialSettings()]);
  // A session cookie (not verified here) lets the header and private pages render their signed-in shape at once
  // instead of the guest header and a "checking your session" card; /api/account still decides who is signed in.
  const sessionHint = (await cookies()).has(SESSION_COOKIE);
  // The fonts of the first screen load with the page instead of after the stylesheet, so text does not swap faces
  // a moment later: Inter (Latin, plus Cyrillic for Russian and Uzbek in Cyrillic) and Manrope for the wordmark.
  const font = { as: "font", type: "font/woff2", crossOrigin: "anonymous" } as const;
  preload(interLatin, font);
  if (locale === "ru" || locale === "oz") preload(interCyrillic, font);
  preload(manropeWordmark, font); // 5.9 KB: only the letters of "atlas" (scripts/wordmark-font.mjs), not the 24.8 KB Latin file
  return (
    <html lang={htmlLang(locale)} suppressHydrationWarning>
      <head><link rel="stylesheet" href={layoutDesktopHref} media="(min-width: 481px)" precedence="vite-rsc/importer-resources" /><script id="atlas-impact-bootstrap" type="text/javascript" dangerouslySetInnerHTML={{__html:impactHeadScript}} /></head>
      <body className="antialiased">
        <AmbientBackdrop />
        <AtlasThemeProvider>
          <MarketProvider initialLocale={locale} initialPricing={pricing} initialSiteContent={siteContent} sessionHint={sessionHint}>{children}<ShellExtras /><StaleBuildReload /><NativeShell /><PressFeedback /></MarketProvider>
        </AtlasThemeProvider>
        <JsonLd data={siteGraph(locale, siteContent.contacts, siteContent.legal)} />
      </body>
    </html>
  );
}
