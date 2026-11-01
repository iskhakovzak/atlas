import { productSchema, repriceCart, defaultDeliverySpeed, deliverySpeeds, type CartItem, type DeliverySpeed, type Pricing, type Product } from './domain.ts';
import type { Action } from './actions.ts';

/**
 * A guest's cart (redesign stage 6, 1 November 2026): what a visitor adds before signing in stays in this browser
 * (localStorage, versioned), the cart page and the header count work from it, and after sign-in every line moves into
 * the account through the ordinary `cart-add` action with `merge` — the server checks each one with its store and prices
 * it again (lib/market/actions-server.ts). Nothing here is trusted: the amounts shown to a guest are an estimate from
 * the public tariff, and the server never reads this storage. Pure helpers over a Storage-like object; every storage
 * call may throw (private mode, blocked site data) and then the guest simply has no saved cart.
 */
export type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };

export const guestCartKey = 'atlas:guest-cart';
/** Lives as long as a visitor plausibly comes back to finish (prices are checked again on the way anyway). */
export const guestCartTtlMs = 30 * 24 * 60 * 60_000;
export const maxGuestLines = 20;
export const maxGuestQuantity = 10;
const maxBytes = 400_000;
const clockSkewMs = 5 * 60_000;

/** One line: the product as its page showed it, the option, how many, the note; `problem` once a move into an account failed. */
export type GuestLine = {
  key: string; product: Product; variant: string; quantity: number; note?: string; addedAt: number;
  /** The page the line was added on (a path on this site), to open it again. */
  href?: string;
  problem?: { code?: string; message?: string; at: number };
};
export type GuestCart = { v: 1; savedAt: number; lines: GuestLine[]; speed?: DeliverySpeed };
export const emptyGuestCart = (now = 0): GuestCart => ({ v: 1, savedAt: now, lines: [] });

/** Equal product and option make one line (as the account cart does). */
export const guestLineKey = (product: Pick<Product, 'id'>, variant: string) => `${product.id}\u0000${variant}`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** A path on this site only (never another origin). */
export const safeHref = (value: unknown) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && value.length <= 2000 ? value : undefined;
const quantityOf = (value: unknown) => Number.isInteger(value) && Number(value) >= 1 ? Math.min(maxGuestQuantity, Number(value)) : undefined;

/** A stored cart, line by line; anything unreadable, foreign, too old or from the future reads as empty. */
export function parseGuestCart(raw: string | null | undefined, now = Date.now()): GuestCart {
  if (typeof raw !== 'string' || !raw || raw.length > maxBytes) return emptyGuestCart(now);
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return emptyGuestCart(now); }
  if (!isRecord(value) || value.v !== 1 || !Array.isArray(value.lines)) return emptyGuestCart(now);
  const savedAt = typeof value.savedAt === 'number' && Number.isFinite(value.savedAt) ? value.savedAt : NaN;
  if (!(savedAt <= now + clockSkewMs) || now - savedAt > guestCartTtlMs) return emptyGuestCart(now);
  const lines: GuestLine[] = [];
  for (const item of value.lines.slice(0, maxGuestLines)) {
    if (!isRecord(item) || typeof item.variant !== 'string' || !item.variant.trim() || item.variant.length > 200) continue;
    const product = productSchema.safeParse(item.product);
    const quantity = quantityOf(item.quantity);
    if (!product.success || !quantity || !product.data.variants.includes(item.variant)) continue;
    const key = guestLineKey(product.data, item.variant);
    if (lines.some((line) => line.key === key)) continue;
    const note = typeof item.note === 'string' && item.note.trim() ? item.note.trim().slice(0, 500) : undefined;
    const problem = isRecord(item.problem) && typeof item.problem.at === 'number'
      ? { at: item.problem.at, ...(typeof item.problem.code === 'string' ? { code: item.problem.code.slice(0, 20) } : {}), ...(typeof item.problem.message === 'string' ? { message: item.problem.message.slice(0, 300) } : {}) }
      : undefined;
    const href = safeHref(item.href);
    lines.push({ key, product: product.data, variant: item.variant, quantity, addedAt: typeof item.addedAt === 'number' ? item.addedAt : savedAt, ...(note ? { note } : {}), ...(href ? { href } : {}), ...(problem ? { problem } : {}) });
  }
  const speed = deliverySpeeds.find((item) => item === value.speed);
  return { v: 1, savedAt, lines, ...(speed ? { speed } : {}) };
}

export const serializeGuestCart = (cart: GuestCart, now = Date.now()) => JSON.stringify({ ...cart, v: 1, savedAt: now });

export type GuestAdd = { product: Product; variant: string; quantity: number; note?: string; href?: string };

/**
 * Adds lines: the same option again adds to its line (at most 10), a new one goes to the end. `full` when the cart already
 * holds 20 lines and a new one would not fit (nothing is added then: all or none, like `cart-add-many`).
 */
export function addGuestLines(cart: GuestCart, items: GuestAdd[], now = Date.now()): { cart: GuestCart; full: boolean } {
  const lines = cart.lines.map((line) => ({ ...line }));
  for (const item of items) {
    if (!item.product.variants.includes(item.variant)) continue;
    const key = guestLineKey(item.product, item.variant);
    const quantity = Math.max(1, Math.min(maxGuestQuantity, Math.floor(item.quantity)));
    const note = item.note?.trim().slice(0, 500) || undefined;
    const href = safeHref(item.href);
    const found = lines.find((line) => line.key === key);
    if (found) {
      // The newer product data replaces the older (the page was just shown); a failed move is tried again.
      Object.assign(found, { product: item.product, quantity: Math.min(maxGuestQuantity, found.quantity + quantity), addedAt: now, problem: undefined, ...(note ? { note } : {}), ...(href ? { href } : {}) });
      continue;
    }
    if (lines.length >= maxGuestLines) return { cart, full: true };
    lines.push({ key, product: item.product, variant: item.variant, quantity, addedAt: now, ...(note ? { note } : {}), ...(href ? { href } : {}) });
  }
  return { cart: { ...cart, savedAt: now, lines }, full: false };
}

export function setGuestQuantity(cart: GuestCart, key: string, quantity: number, now = Date.now()): GuestCart {
  const value = Math.max(1, Math.min(maxGuestQuantity, Math.floor(quantity)));
  return { ...cart, savedAt: now, lines: cart.lines.map((line) => line.key === key ? { ...line, quantity: value } : line) };
}

export const removeGuestLines = (cart: GuestCart, keys: string[], now = Date.now()): GuestCart =>
  ({ ...cart, savedAt: now, lines: cart.lines.filter((line) => !keys.includes(line.key)) });

export const setGuestSpeed = (cart: GuestCart, speed: DeliverySpeed, now = Date.now()): GuestCart => ({ ...cart, savedAt: now, speed });

/** Units in the cart (the header and the bottom bar count them). Lines that failed to move are not counted. */
export const guestUnits = (cart: GuestCart) => cart.lines.reduce((sum, line) => sum + (line.problem ? 0 : line.quantity), 0);
/** Lines still waiting to move into an account. */
export const pendingGuestLines = (cart: GuestCart) => cart.lines.filter((line) => !line.problem);

/**
 * The guest's lines as cart lines priced with the public tariff, the way the account cart prices them (one parcel per
 * store, minimum weight, store-delivery hold). An estimate for the page only: the server prices again on the move.
 */
export function estimateGuestCart(cart: GuestCart, pricing: Pricing, now = Date.now()): CartItem[] {
  const speed = cart.speed ?? defaultDeliverySpeed;
  const items = pendingGuestLines(cart).map((line): CartItem => ({
    id: line.key, product: line.product, variant: line.variant, quantity: line.quantity, requestedServiceIds: [], deliverySpeed: speed,
    // repriceCart writes every quote; this one only has to be well formed.
    quote: { id: line.key, createdAt: now, expiresAt: now, merchandise: 0, service: 0, shipping: 0, reserve: 0, total: 0, weight: 1, tariffVersion: pricing.version },
    ...(line.note ? { note: line.note } : {}),
  }));
  try { return repriceCart(items, now, pricing, false); } catch { return []; }
}

/** The action that moves one line into the account (POST /api/actions; the server checks it with the store). */
export const mergeActionFor = (line: GuestLine): Extract<Action, { type: 'cart-add' }> =>
  ({ type: 'cart-add', product: line.product, variant: line.variant, quantity: line.quantity, ...(line.note ? { note: line.note } : {}), merge: true });

/** Marks a line that could not move (shown in the cart with the reason and a link to its page) or removes one that did. */
export function settleGuestLine(cart: GuestCart, key: string, outcome: { moved: true } | { moved: false; code?: string; message?: string }, now = Date.now()): GuestCart {
  if (outcome.moved) return removeGuestLines(cart, [key], now);
  return { ...cart, savedAt: now, lines: cart.lines.map((line) => line.key === key ? { ...line, problem: { at: now, ...(outcome.code ? { code: outcome.code } : {}), ...(outcome.message ? { message: outcome.message.slice(0, 300) } : {}) } } : line) };
}

// ---------- Browser storage ----------

export function guestStorage(): StorageLike | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}
export function readGuestCart(storage: StorageLike | null, now = Date.now()): GuestCart {
  if (!storage) return emptyGuestCart(now);
  try { return parseGuestCart(storage.getItem(guestCartKey), now); } catch { return emptyGuestCart(now); }
}
/** Saves (an empty cart removes the entry); false when this browser keeps nothing. */
export function writeGuestCart(storage: StorageLike | null, cart: GuestCart, now = Date.now()): boolean {
  if (!storage) return false;
  try {
    if (!cart.lines.length && !cart.speed) { storage.removeItem(guestCartKey); return true; }
    const json = serializeGuestCart(cart, now);
    if (json.length > maxBytes) return false;
    storage.setItem(guestCartKey, json);
    return storage.getItem(guestCartKey) === json;
  } catch { return false; }
}
