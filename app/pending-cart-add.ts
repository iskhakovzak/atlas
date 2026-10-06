"use client";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useMarket } from "@/lib/market/store";
import { cartDeliverySpeed, type CartItem, type DeliverySpeed } from "@/lib/market/domain";
import type { Action } from "@/lib/market/actions";
import {
  browserStorage,
  discardPendingCartAdd,
  forgetOtherAccounts,
  hasPendingCartAdd,
  markDraftDone,
  ownerTag,
  pruneDrafts,
  takePendingCartAdd,
  type CartAddAction,
  type PendingCartAdd,
  type PendingFilter,
} from "@/lib/market/link-order-draft";

/**
 * What became of a guest's cart add after sign-in: added (with the cart's delivery speed afterwards, and whether the
 * cart kept its own speed instead of the one the guest picked), refused because the store price moved, or refused.
 */
export type PendingCartAddResult =
  | { status: "added"; pending: PendingCartAdd; speed: DeliverySpeed; speedKept: boolean }
  | { status: "changed" | "failed"; pending: PendingCartAdd; code?: string; message?: string };

type Live = {
  ready: boolean;
  cart: CartItem[];
  act: (action: Action) => Promise<boolean>;
  lastActionError: () => { code?: string; message?: string } | null;
  onResult: (result: PendingCartAddResult) => void;
};

/** One run per tab (StrictMode renders, the link page and the cart). */
let running = false;

/** Units already in the cart for the lines of this add: a lost response that did add them is not sent twice. */
function unitsInCart(cart: CartItem[], action: CartAddAction) {
  const lines = action.type === "cart-add" ? [{ product: action.product, variant: action.variant }] : action.items;
  return cart.reduce((sum, item) => sum + (lines.some(line => line.product.id === item.product.id && line.variant === item.variant) ? item.quantity : 0), 0);
}

/** Holds a lock shared by this site's tabs while `task` runs; another tab holding it skips (that tab sends the add). */
async function exclusively<T>(task: () => Promise<T>): Promise<T | undefined> {
  const locks = typeof navigator !== "undefined" && "locks" in navigator ? navigator.locks : undefined;
  if (!locks?.request) return task();
  return locks.request("atlas-pending-cart-add", { ifAvailable: true }, async lock => lock ? task() : undefined);
}

const pause = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

async function send(live: MutableRefObject<Live>, filter: PendingFilter): Promise<PendingCartAddResult | undefined> {
  const storage = browserStorage();
  // Out of storage before it is sent: a second render or tab finds nothing, so the item cannot be added twice.
  const pending = takePendingCartAdd(storage, Date.now(), filter);
  if (!pending) return undefined;
  const cartWasEmpty = live.current.cart.length === 0;
  const speedBefore = cartDeliverySpeed(live.current.cart);
  const unitsBefore = unitsInCart(live.current.cart, pending.action);
  const arrived = () => unitsInCart(live.current.cart, pending.action) > unitsBefore;
  let errorBefore = live.current.lastActionError();
  let ok = false, staleRetried = false;
  for (let attempt = 0; attempt < 5 && live.current.ready; attempt++) {
    ok = await live.current.act(pending.action);
    if (ok) break;
    const error = live.current.lastActionError();
    if (error !== errorBefore) {
      // A refusal without a code is the server's "the data changed" (another tab or request wrote first); its answer
      // carries the current cart. Once: wait for it, and send again with it unless the item is already there.
      if (error?.code || staleRetried) break;
      staleRetried = true; errorBefore = error;
      await pause(300);
      if (arrived()) { ok = true; break; }
      continue;
    }
    // No new reason: another request was in flight (the account's own first save) or the answer was lost.
    // Wait, and send again only if the cart did not get the item meanwhile.
    await pause(700);
    if (arrived()) { ok = true; break; }
  }
  // A response dropped while the account was read again may still have added it: the cart decides.
  if (!ok) { await pause(700); if (arrived()) ok = true; }
  if (ok) {
    markDraftDone(storage, pending.draftKey);
    // The added lines took the cart's speed. The guest's choice applies only to a cart that was empty: older items
    // the guest could not see keep the speed the customer chose for them (one speed per cart).
    const wanted = pending.speed && pending.speed !== speedBefore ? pending.speed : undefined;
    const applied = Boolean(wanted && cartWasEmpty) && await live.current.act({ type: "cart-delivery-speed", speed: wanted! });
    return { status: "added", pending, speed: applied ? wanted! : speedBefore, speedKept: Boolean(wanted && !cartWasEmpty) };
  }
  const error = live.current.lastActionError();
  const fresh = error !== errorBefore || staleRetried ? error : null;
  return { status: fresh?.code === "err_34" ? "changed" : "failed", pending, code: fresh?.code, message: fresh?.message };
}

/**
 * Sends the cart add a guest asked for before signing in, once, as soon as the account is loaded and `enabled`
 * (the link page waits until its product is shown). Used by the link-order page (`filter.draftKey`: only its own
 * product) and the cart (`filter.maxAgeMs`: only a fresh one). `sending` is true from the moment one is found.
 * Also keeps this device's link-order storage tidy once it is known who is here: drafts of another account go,
 * and a guest's kept add goes when the guest comes back without having signed in.
 */
export function usePendingCartAdd(enabled: boolean, onResult: (result: PendingCartAddResult) => void, filter: PendingFilter = {}) {
  const { ready, status, user, state, act, lastActionError } = useMarket();
  const [sending, setSending] = useState(false);
  const live = useRef<Live>({ ready, cart: state.cart, act, lastActionError, onResult });
  useEffect(() => { live.current = { ready, cart: state.cart, act, lastActionError, onResult }; });
  const viewer = status === "authenticated" ? ownerTag(user) : status === "guest" ? "" : null;
  useEffect(() => {
    if (viewer === null) return;
    const storage = browserStorage();
    pruneDrafts(storage);
    forgetOtherAccounts(storage, viewer);
    if (viewer === "") discardPendingCartAdd(storage);
  }, [viewer]);
  const { draftKey, maxAgeMs } = filter;
  useEffect(() => {
    const only: PendingFilter = { draftKey, maxAgeMs };
    if (!ready || !enabled || running || !hasPendingCartAdd(browserStorage(), Date.now(), only)) return;
    let started = false;
    queueMicrotask(() => setSending(true));
    // A short pause lets the account's own first request (a saved language) go first.
    const timer = window.setTimeout(() => {
      if (running) { setSending(false); return; }
      running = true; started = true;
      void exclusively(() => send(live, only))
        .then(result => { if (result) live.current.onResult(result); })
        .catch(() => undefined)
        .finally(() => { running = false; setSending(false); });
    }, 80);
    return () => { window.clearTimeout(timer); if (!started) queueMicrotask(() => setSending(false)); };
  }, [ready, enabled, draftKey, maxAgeMs]);
  return { sending };
}
