import { extractSharedLink, sharedLinkTarget } from "@/lib/market/shared-link";

// "Поделиться → Atlas": the installed site's Web Share Target (public/manifest.webmanifest, share_target)
// and the Android app (mobile/…/MainActivity.java) open /share?url=…&text=…&title=… with what a store
// app shared. The first web link opens the order-by-link page; the importer checks the store as usual.
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const link = extractSharedLink(params.get("url"), params.get("text"), params.get("title"));
  return new Response(null, { status: 303, headers: { Location: sharedLinkTarget(link), "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
