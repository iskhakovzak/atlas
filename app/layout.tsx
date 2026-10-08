import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { pageLocale } from "./page-locale";
import { SESSION_COOKIE } from "@/lib/auth/core";
import { rootMetadata } from "./route-metadata";
import { htmlLang } from "@/lib/market/uz-cyrl";
import { env } from "cloudflare:workers";
import "@fontsource-variable/inter/opsz.css";
import "@fontsource-variable/manrope/wght.css";
import { preload } from "react-dom";
import interLatin from "@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2?url";
import interCyrillic from "@fontsource-variable/inter/files/inter-cyrillic-opsz-normal.woff2?url";
import manropeLatin from "@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url";
import "./globals.css";
import "./atlas-design.css";
import "./catalog-admin.css";
import "./finds.css";
import "./checkout-clarity.css";
import "./access.css";
import "./login.css";
import "./experience.css";
import "./catalog-import.css";
import "./home-polish.css";
import "./dark-theme.css";
import "./mobile-polish.css";
import "./customer-mobile.css";
import "./operator-mobile.css";
import "./home.css";
import "./customer.css";
import "./theme-night.css";
import "./catalog.css";
import "./stores.css";
import "./pages.css";
import "./mobile.css";
import "./refine.css";
import "./day-folio.css";
import "./native.css";
import "./home-chapters.css";
import "./tariffs.css";
import "./home-wide-rail.css";
import "./home-wide-content.css";
import "./store-marks.css";
import "./ambient.css";
import "./folio-outside.css";
import "./home-wide-decor.css";
import "./orders-groups.css";
import "./cart-select.css";
import "./accounting.css";
import "./admin-investor.css";
import "./site-content-admin.css";
import "./checkbox.css";
import "./press.css";
import "./header-panel.css";
import "./motion.css";
import { MarketProvider } from "@/lib/market/store";
import { initialPricing, initialSiteContent } from "@/lib/market/initial-data";
import { StorageNotice } from "./storage-notice";
import { AtlasThemeProvider } from "./theme-control";
import { PerformanceProbe } from "./performance-probe";
import { NativeShell } from "./native-shell";
import { PressFeedback } from "./press-feedback";
import { AmbientBackdrop } from "./ambient-backdrop";
import { JsonLd } from "./json-ld";
import { siteGraph } from "@/lib/seo/structured-data";
import { ImpactTracking } from './impact-tracking';
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
  const [locale, pricing, siteContent] = await Promise.all([pageLocale(), initialPricing(), initialSiteContent()]);
  // A session cookie (not verified here) lets the header and private pages render their signed-in shape at once
  // instead of the guest header and a "checking your session" card; /api/account still decides who is signed in.
  const sessionHint = (await cookies()).has(SESSION_COOKIE);
  // The fonts of the first screen load with the page instead of after the stylesheet, so text does not swap faces
  // a moment later: Inter (Latin, plus Cyrillic for Russian and Uzbek in Cyrillic) and Manrope for the wordmark.
  const font = { as: "font", type: "font/woff2", crossOrigin: "anonymous" } as const;
  preload(interLatin, font);
  if (locale === "ru" || locale === "oz") preload(interCyrillic, font);
  preload(manropeLatin, font);
  return (
    <html lang={htmlLang(locale)} suppressHydrationWarning>
      <head><script id="atlas-impact-bootstrap" type="text/javascript" dangerouslySetInnerHTML={{__html:impactHeadScript}} /></head>
      <body className="antialiased">
        <AmbientBackdrop />
        <AtlasThemeProvider>
          <MarketProvider initialLocale={locale} initialPricing={pricing} initialSiteContent={siteContent} sessionHint={sessionHint}>{children}<StorageNotice /><PerformanceProbe /><NativeShell /><PressFeedback /><ImpactTracking /></MarketProvider>
        </AtlasThemeProvider>
        <JsonLd data={siteGraph(locale, siteContent.contacts, siteContent.legal)} />
      </body>
    </html>
  );
}
