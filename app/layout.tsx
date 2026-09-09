import type { Metadata } from "next";
import "./globals.css";
import { MarketProvider } from "@/lib/market/store";

export const metadata: Metadata = {
  title: "Atlas — покупки со всего мира",
  description: "Покупки со всего мира с прозрачным расчётом доставки в Узбекистан. Тестовая версия.",
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
