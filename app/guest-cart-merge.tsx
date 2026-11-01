"use client";
import { useEffect, useRef } from "react";
import { useMarket } from "@/lib/market/store";
import { toast } from "@/lib/market/toast";
import { guestStorage, mergeActionFor, pendingGuestLines, readGuestCart, settleGuestLine } from "@/lib/market/guest-cart";
import { checkoutCopy } from "@/lib/market/checkout-copy";
import { setGuestMerging, updateGuestCart } from "./use-guest-cart";

const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Moves the guest's browser cart into the account once the account is loaded (redesign stage 6): one ordinary `cart-add`
 * per line, with `merge`, so the server checks each with its store and prices it at the current tariff. A line that moved
 * leaves the browser; one the store refused stays, marked, for the cart page to explain. One tab does it at a time
 * (Web Locks), and a lost answer is not sent twice: the account's cart decides whether the line arrived.
 * Mounted once by app/marketplace.tsx on every page.
 */
export function GuestCartMerge() {
  const { ready, state, act, lastActionError } = useMarket();
  const live = useRef({ cart: state.cart, act, lastActionError });
  useEffect(() => { live.current = { cart: state.cart, act, lastActionError }; });
  const started = useRef(false);
  const locale = state.communication.language;
  useEffect(() => {
    if (!ready) { started.current = false; return; }
    if (started.current || !pendingGuestLines(readGuestCart(guestStorage())).length) return;
    started.current = true;
    const words = checkoutCopy[locale].merge;
    const run = async () => {
      setGuestMerging(true);
      let moved = 0, failed = 0;
      // A minute of slack for a device clock behind the server's.
      const startedAt = Date.now() - 60_000;
      try {
        for (const line of pendingGuestLines(readGuestCart(guestStorage()))) {
          const units = () => live.current.cart.reduce((sum, item) => sum + (item.product.id === line.product.id && item.variant === line.variant ? item.quantity : 0), 0);
          const before = units();
          let ok = false, error: { code?: string; message?: string } | null = null;
          for (let attempt = 0; attempt < 2 && !ok; attempt++) {
            const errorBefore = live.current.lastActionError();
            ok = await live.current.act(mergeActionFor(line), { queue: true });
            if (ok) break;
            const now = live.current.lastActionError();
            error = now !== errorBefore ? now : null;
            // No new reason (a dropped answer) or a refusal without a code (another tab wrote first; the answer carried
            // the fresh account): the account's cart says whether the line arrived before it is sent once more.
            if (error?.code) break;
            await pause(error ? 300 : 700);
            if (units() > before) { ok = true; break; }
          }
          if (ok) {
            moved++;
            updateGuestCart((cart) => settleGuestLine(cart, line.key, { moved: true }));
          } else {
            failed++;
            updateGuestCart((cart) => settleGuestLine(cart, line.key, { moved: false, code: error?.code, message: error?.message }));
          }
        }
      } finally { setGuestMerging(false); }
      // The lines whose store price moved meanwhile carry the change (shown on each line in the cart and at checkout).
      await pause(50);
      const changed = live.current.cart.filter((item) => (item.priceChange?.at ?? 0) >= startedAt).length;
      // act() said each refusal in its own toast; one summary replaces them.
      if (failed) toast.dismiss();
      if (moved) toast.success(words.moved(moved) + (changed ? " " + words.priceChanged(changed) : ""));
      if (failed) toast.error(words.failed(failed), { action: { label: words.open, onClick: () => window.location.assign("/cart") } });
    };
    const locks = typeof navigator !== "undefined" && "locks" in navigator ? navigator.locks : undefined;
    // Another tab holding the lock moves the cart itself; this one only follows the storage.
    void (locks?.request ? locks.request("atlas-guest-cart-merge", { ifAvailable: true }, async (lock) => { if (lock) await run(); }) : run()).catch(() => setGuestMerging(false));
  }, [ready, locale]);
  return null;
}
