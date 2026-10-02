import type { Metadata, Viewport } from "next";
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
import { MarketProvider } from "@/lib/market/store";
import { StorageNotice } from "./storage-notice";
import { AtlasThemeProvider } from "./theme-control";
import { PerformanceProbe } from "./performance-probe";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Atlas",
      url: "https://atlasmarket.uz",
      logo: "https://atlasmarket.uz/og-image.png",
      description:
        "Purchasing intermediary and logistics agent for international shopping in Uzbekistan.",
      areaServed: "UZ",
    },
    {
      "@type": "WebSite",
      name: "Atlas",
      url: "https://atlasmarket.uz",
      inLanguage: ["ru", "uz", "en"],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://atlasmarket.uz"),
  title: {
    default: "Atlas — покупки со всего мира",
    template: "%s · Atlas",
  },
  description:
    "Находите товары в зарубежных магазинах, проверяйте варианты и получайте предварительный расчёт доставки в Узбекистан.",
  applicationName: "Atlas",
  category: "shopping",
  creator: "Atlas",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    alternateLocale: ["uz_UZ", "en_US"],
    siteName: "Atlas",
    title: "Atlas — покупки со всего мира",
    description:
      "Зарубежные магазины, понятный предварительный расчёт и доставка в Узбекистан.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Atlas — покупки в зарубежных магазинах с доставкой в Узбекистан" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Atlas — покупки со всего мира",
    description:
      "Зарубежные магазины, понятный предварительный расчёт и доставка в Узбекистан.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased">
        <AtlasThemeProvider>
          <MarketProvider>{children}<StorageNotice /><PerformanceProbe /></MarketProvider>
        </AtlasThemeProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
