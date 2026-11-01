import { headers } from "next/headers";
import { pageLocaleHeader, renderLocale, supportedLocale, type Locale } from "@/lib/market/i18n";

/** Language the server renders this request in, shared by the layout and every page's metadata. */
export async function pageLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  return renderLocale(requestHeaders.get(pageLocaleHeader), requestHeaders.get("cookie"), requestHeaders.get("accept-language"));
}

/** The `?lang=` version this request asked for (middleware.ts passes it on in a header it always rewrites), or null. */
export async function requestedPageLocale(): Promise<Locale | null> {
  return supportedLocale((await headers()).get(pageLocaleHeader));
}
