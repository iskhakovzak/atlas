"use client";
import { useSyncExternalStore } from "react";
import { addGuestLines, emptyGuestCart, guestCartKey, guestStorage, readGuestCart, removeGuestLines, setGuestQuantity, setGuestSpeed, writeGuestCart, type GuestAdd, type GuestCart } from "@/lib/market/guest-cart";
import type { DeliverySpeed } from "@/lib/market/domain";

/**
 * The guest's browser cart as a React store (redesign stage 6): every component that reads it (the header count, the
 * cart page, the checkout) re-renders when it changes in this tab or another one. Writes go through `updateGuestCart`.
 */
const changed = "atlas:guest-cart-changed";
const listeners = new Set<() => void>();
let cached: { raw: string | null; cart: GuestCart } | null = null;
const server = emptyGuestCart(0);

function rawValue() { try { return guestStorage()?.getItem(guestCartKey) ?? null; } catch { return null; } }
function snapshot(): GuestCart {
  const raw = rawValue();
  if (cached && cached.raw === raw) return cached.cart;
  cached = { raw, cart: readGuestCart(guestStorage()) };
  return cached.cart;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === null || event.key === guestCartKey) listener(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changed, listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); window.removeEventListener(changed, listener); };
}

/** Applies a change to the stored cart; false when this browser keeps nothing (private mode, full storage). */
export function updateGuestCart(change: (cart: GuestCart) => GuestCart): boolean {
  const storage = guestStorage();
  const ok = writeGuestCart(storage, change(readGuestCart(storage)));
  cached = null;
  try { window.dispatchEvent(new Event(changed)); } catch { /* no window */ }
  return ok;
}

export function useGuestCart() {
  const cart = useSyncExternalStore(subscribe, snapshot, () => server);
  return {
    cart,
    add: (items: GuestAdd[]) => { let full = false; const ok = updateGuestCart((current) => { const next = addGuestLines(current, items); full = next.full; return next.cart; }); return { ok: ok && !full, full }; },
    setQuantity: (key: string, quantity: number) => updateGuestCart((current) => setGuestQuantity(current, key, quantity)),
    remove: (keys: string[]) => updateGuestCart((current) => removeGuestLines(current, keys)),
    setSpeed: (speed: DeliverySpeed) => updateGuestCart((current) => setGuestSpeed(current, speed)),
  };
}

// ---------- Moving into the account (app/guest-cart-merge.tsx) ----------
let merging = false;
const mergeListeners = new Set<() => void>();
export function setGuestMerging(value: boolean) { merging = value; for (const listener of mergeListeners) listener(); }
export const isGuestMerging = () => merging;
export function useGuestMerging() {
  return useSyncExternalStore((listener) => { mergeListeners.add(listener); return () => { mergeListeners.delete(listener); }; }, () => merging, () => false);
}
