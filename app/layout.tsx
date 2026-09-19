import type { Metadata } from "next";
import "./globals.css";
import "./atlas-design.css";
import "./finds.css";
import "./checkout-clarity.css";
import "./access.css";
import "./experience.css";
import { MarketProvider } from "@/lib/market/store";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Atlas",
      url: "https://atlas-uz-market.ishakovzak0.chatgpt.site",
      description:
        "Purchasing intermediary and logistics agent for international shopping in Uzbekistan.",
      areaServed: "UZ",
    },
    {
      "@type": "WebSite",
      name: "Atlas",
      url: "https://atlas-uz-market.ishakovzak0.chatgpt.site",
      inLanguage: ["ru", "uz", "en"],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL("https://atlas-uz-market.ishakovzak0.chatgpt.site"),
  title: {
    default: "Atlas — покупки со всего мира",
    template: "%s · Atlas",
  },
  description:
    "Находите товары в зарубежных магазинах, проверяйте варианты и получайте предварительный расчёт доставки в Узбекистан.",
  applicationName: "Atlas",
  category: "shopping",
  creator: "Atlas",
  alternates: { canonical: "/" },
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
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Atlas — покупки со всего мира",
    description:
      "Зарубежные магазины, понятный предварительный расчёт и доставка в Узбекистан.",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <MarketProvider>{children}</MarketProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
