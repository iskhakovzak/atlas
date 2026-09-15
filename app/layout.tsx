import type { Metadata } from "next";
import "./globals.css";
import "./atlas-design.css";
import "./finds.css";
import "./checkout-clarity.css";
import "./access.css";
import "./experience.css";
import { MarketProvider } from "@/lib/market/store";

export const metadata: Metadata = {
  title: "Atlas — покупки со всего мира",
  description: "Каталог товаров из зарубежных магазинов. Сравнивайте цены и рассчитывайте доставку в Узбекистан.",
  other: {
    "codex-preview": "development",
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
      <body className="antialiased"><MarketProvider>{children}</MarketProvider></body>
    </html>
  );
}
