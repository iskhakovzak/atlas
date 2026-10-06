import { safeImage, type ProductColorwayGallery, type ProductVariant } from '../importer/extract.ts';
import type { Action } from './actions.ts';
import { validateSource } from './domain.ts';

/**
 * What the link-order page keeps on this device, so leaving the page and coming back (or signing in) loses nothing:
 * a draft per product page (localStorage, 24 h, at most five), a pointer to the draft the customer was last working on,
 * and the cart add a guest asked for before signing in (30 min). Pure helpers over a Storage-like object, so tests run
 * without a browser. Every storage call may throw (private mode, blocked site data): callers get `null`/`false` and the
 * page works without it. Nothing here is trusted by the server, which checks every cart add against the store again.
 * A draft saved while signed in carries a tag of that account and is never shown to another account or a guest on the
 * same device (a shared computer); a guest's draft has no tag and follows the guest into the account they sign in to.
 */
export type StorageLike = {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const draftPrefix = 'atlas:link-order:draft:';
export const lastDraftKey = 'atlas:link-order:last';
export const pendingCartAddKey = 'atlas:link-order:pending-add';
export const draftTtlMs = 24 * 60 * 60_000;
/** A guest's cart add lives as long as a sign-in plausibly takes; the cart sends only one fresher than `pendingCartFreshMs`. */
export const pendingTtlMs = 30 * 60_000;
export const pendingCartFreshMs = 15 * 60_000;
export const maxDrafts = 5;
export const maxDraftBytes = 300_000;
export const maxPicks = 50;
export const maxComment = 500;
export const maxQuantity = 10;
/** A clock a little ahead of ours is tolerated; a draft "from the future" beyond this is not. */
const clockSkewMs = 5 * 60_000;

export type CheckStatus = 'idle' | 'checking' | 'verified' | 'failed';
export type DraftSpeed = 'express' | 'standard';
export type WeightBasis = 'store' | 'estimate' | 'title' | 'catalog' | 'customer';
/** Fields Atlas filled from the store: shown locked on the page, as read-only lines. */
export type LockFields = { name: boolean; price: boolean; shipping: boolean; country: boolean; category: boolean; weight: boolean };
export type FoundShipping = { amount: number; currency: string; destination?: string } | null;
/** The page a draft belongs to: the requested link and, for a catalog card or a community deal, its ID. */
export type DraftPlace = { pageUrl: string; catalogId: string; dealId: string };

export type LinkOrderDraft = DraftPlace & {
  v: 2; savedAt: number; done: boolean;
  /** `ownerTag` of the account it was saved under; empty for a guest. */
  owner: string;
  url: string; source: string; name: string; brand: string; declaration: string;
  /** `basePrice`: the store's product price, for options without their own (a store check only). */
  currency: string; amount: string; basePrice?: number; importReference?: number;
  shipping: string; shippingCurrency: string; shippingEstimated: boolean; foundShipping: FoundShipping;
  weight: string; weightBasis: WeightBasis; weightOrigin: string;
  country: string; otherCountry: string; category: string;
  variant: string; variants: ProductVariant[]; selectedColor: string; selectedSize: string;
  image: string; images: string[]; colorwayImages?: ProductColorwayGallery[];
  showSourceForm: boolean; note: string; verified: boolean;
  sourceCheckStatus: CheckStatus; importedAt?: number; sourceExpiresAt?: number; locks?: LockFields;
  /** The customer's choice: option label → quantity, the typed option's quantity, the comment and the speed they picked. */
  picked: Record<string, number>; manualQuantity: number; comment: string; previewSpeed?: DraftSpeed;
};
export type DraftInput = Omit<LinkOrderDraft, 'v' | 'savedAt'>;

/** What the customer chose, applied again after the product is loaded anew. */
export type DraftChoices = {
  picked: Record<string, number>; variant: string; selectedColor: string; selectedSize: string;
  manualQuantity: number; comment: string; previewSpeed?: DraftSpeed;
  /** An option the customer typed because the store listed none, with its quantity. */
  manualOption?: { label: string; quantity: number };
  /** Values the customer typed because the store gave none; used only if the store still gives none. */
  manual?: Pick<LinkOrderDraft, 'name' | 'currency' | 'amount' | 'shipping' | 'shippingCurrency' | 'shippingEstimated' | 'weight' | 'weightBasis' | 'weightOrigin' | 'country' | 'otherCountry' | 'category'>;
};

export type CartAddAction = Extract<Action, { type: 'cart-add' | 'cart-add-many' }>;
/** A guest's "add to cart", kept until they sign in; the server checks it like any other cart add. */
export type PendingCartAdd = {
  v: 1; savedAt: number; expiresAt: number;
  action: CartAddAction; speed?: DraftSpeed; returnTo: string; draftKey: string; lines: number; units: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 3000, fallback = '') => typeof value === 'string' ? value.slice(0, max) : fallback;
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const positive = (value: unknown) => { const number = finite(value); return number !== undefined && number > 0 ? number : undefined; };
const statuses: readonly CheckStatus[] = ['idle', 'checking', 'verified', 'failed'];
const bases: readonly WeightBasis[] = ['store', 'estimate', 'title', 'catalog', 'customer'];
const lockNames = ['name', 'price', 'shipping', 'country', 'category', 'weight'] as const;
/** A link as the page accepts it (https, a real host), or empty. */
const checkedLink = (value: unknown) => { const link = text(value, 4000).trim(); if (!link) return ''; try { validateSource(link); return link; } catch { return ''; } };

/**
 * A short tag for the signed-in account ('' for a guest): drafts saved under one account are not shown to another one on
 * this device. FNV-1a of the e-mail and the account's creation time; it only tells accounts apart, it protects nothing.
 */
export function ownerTag(user: { email?: string; createdAt?: number } | null | undefined): string {
  if (!user) return '';
  const value = `${(user.email ?? '').trim().toLowerCase()}|${user.createdAt ?? ''}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193) >>> 0; }
  return 'a' + hash.toString(16).padStart(8, '0');
}

/** A guest's draft is anyone's on this device (it follows them into their account); an account's draft is only its own. */
export const draftVisible = (draft: Pick<LinkOrderDraft, 'owner'>, viewer: string | null) => !draft.owner || draft.owner === viewer;

/** Storage key part for a page; empty when there is no link yet (nothing to keep). */
export function draftKeyFor(place: Partial<DraftPlace>): string {
  const pageUrl = text(place.pageUrl, 4000).trim();
  if (!pageUrl) return '';
  const catalogId = text(place.catalogId, 200).trim(), dealId = text(place.dealId, 200).trim();
  return catalogId ? `catalog:${catalogId}:${pageUrl}` : dealId ? `deal:${dealId}:${pageUrl}` : `url:${pageUrl}`;
}

/** The page address of a draft, keeping unrelated query parameters (a language choice) of the current address. */
export function draftAddress(place: Partial<DraftPlace>, currentSearch = ''): string {
  const params = new URLSearchParams(currentSearch);
  for (const name of ['url', 'catalog', 'deal']) params.delete(name);
  if (place.pageUrl) params.set('url', place.pageUrl);
  if (place.catalogId) params.set('catalog', place.catalogId);
  else if (place.dealId) params.set('deal', place.dealId);
  const query = params.toString();
  return '/order-by-link' + (query ? '?' + query : '');
}

/** Option label → quantity from 1 to 10, at most 50 options; anything else is dropped. */
export function cleanPicks(value: unknown): Record<string, number> {
  const picks: Record<string, number> = {};
  if (!isRecord(value)) return picks;
  for (const [label, quantity] of Object.entries(value)) {
    if (Object.keys(picks).length >= maxPicks) break;
    const number = finite(quantity);
    if (!label.trim() || label.length > 200 || number === undefined || number < 1) continue;
    picks[label] = Math.min(maxQuantity, Math.floor(number));
  }
  return picks;
}

function cleanVariant(value: unknown): ProductVariant | undefined {
  if (!isRecord(value)) return undefined;
  const label = text(value.label, 200).trim();
  if (!label) return undefined;
  const variant: ProductVariant = { label, available: value.available !== false };
  for (const key of ['id', 'size', 'sizeLabel', 'color', 'image'] as const) if (typeof value[key] === 'string') variant[key] = text(value[key], 3000);
  if (typeof value.availabilityKnown === 'boolean') variant.availabilityKnown = value.availabilityKnown;
  for (const key of ['price', 'compareAtPrice', 'quantity', 'quantityMoreThan'] as const) { const number = finite(value[key]); if (number !== undefined && number >= 0) variant[key] = number; }
  return variant;
}

function cleanGalleries(value: unknown): ProductColorwayGallery[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, 20).flatMap(entry => {
    if (!isRecord(entry) || typeof entry.color !== 'string' || !Array.isArray(entry.images)) return [];
    const images = entry.images.filter((item): item is string => typeof item === 'string').map(item => item.slice(0, 3000)).slice(0, 12);
    return images.length ? [{ color: entry.color.slice(0, 140), images }] : [];
  });
}

function cleanLocks(value: unknown): LockFields | undefined {
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(lockNames.map(name => [name, value[name] === true])) as LockFields;
}

/** A stored draft, checked field by field; `null` for garbage, another version, a missing link, or older than 24 hours. */
export function parseDraft(raw: string | null | undefined, now = Date.now()): LinkOrderDraft | null {
  if (typeof raw !== 'string' || !raw || raw.length > maxDraftBytes) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || value.v !== 2) return null;
  const savedAt = finite(value.savedAt);
  if (savedAt === undefined || savedAt > now + clockSkewMs || now - savedAt > draftTtlMs) return null;
  // A link or a photo that would not pass the page's own checks never comes back (a damaged or foreign entry).
  const source = checkedLink(value.source);
  const status = statuses.find(item => item === value.sourceCheckStatus);
  if (!source || !status) return null;
  const photo = (item: unknown) => safeImage(text(item, 3000), source) ?? '';
  const found = isRecord(value.foundShipping) && finite(value.foundShipping.amount) !== undefined
    ? { amount: finite(value.foundShipping.amount)!, currency: text(value.foundShipping.currency, 8), ...(typeof value.foundShipping.destination === 'string' && value.foundShipping.destination ? { destination: text(value.foundShipping.destination, 200) } : {}) }
    : null;
  const speed = value.previewSpeed === 'express' || value.previewSpeed === 'standard' ? value.previewSpeed : undefined;
  const quantity = finite(value.manualQuantity);
  return {
    v: 2, savedAt, done: value.done === true, owner: /^a[0-9a-f]{8}$/.test(text(value.owner, 16)) ? text(value.owner, 16) : '',
    pageUrl: checkedLink(value.pageUrl), catalogId: text(value.catalogId, 200), dealId: text(value.dealId, 200),
    url: text(value.url, 4000), source, name: text(value.name, 300), brand: text(value.brand, 300), declaration: text(value.declaration, 600),
    currency: text(value.currency, 8, 'USD') || 'USD', amount: text(value.amount, 32), basePrice: positive(value.basePrice), importReference: positive(value.importReference),
    shipping: text(value.shipping, 32, '10'), shippingCurrency: text(value.shippingCurrency, 8, 'USD') || 'USD', shippingEstimated: value.shippingEstimated !== false, foundShipping: found,
    weight: text(value.weight, 32), weightBasis: bases.find(item => item === value.weightBasis) ?? 'estimate', weightOrigin: text(value.weightOrigin, 300),
    country: text(value.country, 120), otherCountry: text(value.otherCountry, 60), category: text(value.category, 120),
    variant: text(value.variant, 200),
    variants: Array.isArray(value.variants) ? value.variants.slice(0, 250).flatMap(item => {
      const option = cleanVariant(item);
      if (option?.image !== undefined) { const safe = photo(option.image); if (safe) option.image = safe; else delete option.image; }
      return option ? [option] : [];
    }) : [],
    selectedColor: text(value.selectedColor, 200), selectedSize: text(value.selectedSize, 200),
    image: photo(value.image), images: Array.isArray(value.images) ? value.images.slice(0, 24).map(photo).filter(Boolean) : [],
    colorwayImages: cleanGalleries(value.colorwayImages),
    showSourceForm: value.showSourceForm === true, note: text(value.note, 2000), verified: value.verified === true,
    sourceCheckStatus: status, importedAt: positive(value.importedAt), sourceExpiresAt: positive(value.sourceExpiresAt), locks: cleanLocks(value.locks),
    picked: cleanPicks(value.picked), manualQuantity: quantity !== undefined && quantity >= 1 ? Math.min(maxQuantity, Math.floor(quantity)) : 1,
    comment: text(value.comment, maxComment), previewSpeed: speed,
  };
}

/** JSON for storage, `savedAt` first (pruning reads it without parsing), trimmed to 300 KB; `null` if it cannot fit. */
export function serializeDraft(input: DraftInput, now = Date.now()): string | null {
  const base = {
    ...input, v: 2 as const, savedAt: now,
    variants: input.variants.slice(0, 250), images: input.images.slice(0, 24), colorwayImages: input.colorwayImages?.slice(0, 20),
    picked: cleanPicks(input.picked), comment: input.comment.slice(0, maxComment),
  };
  // `v` and `savedAt` lead the JSON whatever the input carries.
  const stamped = (value: object) => JSON.stringify(value, (key, item) => key === '' ? { v: 2, savedAt: now, ...item } : item);
  const full = stamped(base);
  if (full.length <= maxDraftBytes) return full;
  // Too big: drop what a reload brings back (colorway galleries, option photos); the choice itself stays.
  const lean = stamped({ ...base, colorwayImages: undefined, variants: base.variants.map(item => ({ ...item, image: undefined })), images: base.images.slice(0, 6) });
  return lean.length <= maxDraftBytes ? lean : null;
}

/**
 * How to bring a draft back: "full" shows it as it was (a fresh store check of a plain link, nothing to reload);
 * "choices" loads the product again and then applies what the customer had chosen (a stale or failed check,
 * a catalog card or a community deal, whose data the page rebuilds from the catalog and the store).
 */
export function restoreMode(draft: LinkOrderDraft, now = Date.now()): 'full' | 'choices' {
  const nikeNeedsGallery = /^https:\/\/(?:www\.)?nike\.com\//i.test(draft.source) && !draft.colorwayImages;
  const fresh = draft.sourceCheckStatus === 'verified' && (draft.sourceExpiresAt ?? 0) > now && !nikeNeedsGallery;
  return fresh && !draft.catalogId && !draft.dealId ? 'full' : 'choices';
}

export function draftChoices(draft: LinkOrderDraft): DraftChoices {
  const choices: DraftChoices = {
    picked: cleanPicks(draft.picked), variant: draft.variant, selectedColor: draft.selectedColor, selectedSize: draft.selectedSize,
    manualQuantity: draft.manualQuantity, comment: draft.comment, previewSpeed: draft.previewSpeed,
  };
  if (!draft.variants.length && draft.variant.trim()) choices.manualOption = { label: draft.variant.trim(), quantity: draft.manualQuantity };
  // Typed by the customer only when the store did not answer; a catalog card or a deal rebuilds these from its record.
  if (draft.sourceCheckStatus === 'failed' && !draft.catalogId && !draft.dealId) {
    const { name, currency, amount, shipping, shippingCurrency, shippingEstimated, weight, weightBasis, weightOrigin, country, otherCountry, category } = draft;
    choices.manual = { name, currency, amount, shipping, shippingCurrency, shippingEstimated, weight, weightBasis, weightOrigin, country, otherCountry, category };
  }
  return choices;
}

/** The chosen options that the reloaded product still sells, with quantities kept within its stock; the rest are named, never swapped. */
export function keepPicks(saved: Record<string, number>, variants: ReadonlyArray<Pick<ProductVariant, 'label' | 'quantity'>>): { picked: Record<string, number>; missing: string[] } {
  const picked: Record<string, number> = {}, missing: string[] = [];
  for (const [label, quantity] of Object.entries(cleanPicks(saved))) {
    const option = variants.find(item => item.label === label);
    if (!option || option.quantity === 0) { missing.push(label); continue; }
    picked[label] = Math.max(1, Math.min(quantity, maxQuantity, option.quantity ?? maxQuantity));
  }
  return { picked, missing };
}

/** The choice inside a cart add, to select it again after the product is reloaded. */
export function choicesFromAction(action: CartAddAction, speed?: DraftSpeed): DraftChoices {
  const lines = action.type === 'cart-add' ? [{ variant: action.variant, quantity: action.quantity ?? 1 }] : action.items;
  const picked = cleanPicks(Object.fromEntries(lines.map(line => [line.variant, line.quantity])));
  return { picked, variant: lines[0]?.variant ?? '', selectedColor: '', selectedSize: '', manualQuantity: lines[0]?.quantity ?? 1, comment: text(action.note, maxComment), previewSpeed: speed };
}

// ---------- Draft storage ----------

/** `localStorage`, or `null` where it is blocked; never throws. */
export function browserStorage(): StorageLike | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; }
}

export function readDraft(storage: StorageLike | null, key: string, now = Date.now()): LinkOrderDraft | null {
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(draftPrefix + key);
    const draft = parseDraft(raw, now);
    if (raw && !draft) storage.removeItem(draftPrefix + key);
    return draft && !draft.done ? draft : null;
  } catch { return null; }
}

const savedAtOf = (raw: string | null) => Number(/^\{"v":2,"savedAt":(\d+)/.exec(raw ?? '')?.[1] ?? NaN);

/** Drops expired and unreadable drafts and keeps the five newest (always keeping `keep`). */
export function pruneDrafts(storage: StorageLike | null, now = Date.now(), keep = ''): void {
  if (!storage) return;
  try {
    const found: { key: string; savedAt: number }[] = [];
    for (let index = 0; index < storage.length; index++) {
      const name = storage.key(index);
      if (name?.startsWith(draftPrefix)) found.push({ key: name, savedAt: savedAtOf(storage.getItem(name)) });
    }
    const live = found.filter(item => Number.isFinite(item.savedAt) && item.savedAt <= now + clockSkewMs && now - item.savedAt <= draftTtlMs);
    const stale = found.filter(item => !live.includes(item));
    live.sort((a, b) => b.savedAt - a.savedAt);
    const kept = live.filter(item => item.key === draftPrefix + keep).concat(live.filter(item => item.key !== draftPrefix + keep)).slice(0, maxDrafts);
    for (const item of [...stale, ...live.filter(entry => !kept.includes(entry))]) storage.removeItem(item.key);
    const last = storage.getItem(lastDraftKey);
    if (last && !kept.some(item => item.key === draftPrefix + last)) storage.removeItem(lastDraftKey);
  } catch { /* storage blocked: nothing to prune */ }
}

/** Saves the draft and, unless it is done, makes it the one to come back to. */
export function writeDraft(storage: StorageLike | null, key: string, input: DraftInput, now = Date.now(), prune = false): boolean {
  if (!storage || !key) return false;
  const json = serializeDraft(input, now);
  if (!json) return false;
  try {
    if (prune) pruneDrafts(storage, now, key);
    try { storage.setItem(draftPrefix + key, json); }
    catch {
      // Full: other drafts go first, then one more try.
      for (let index = storage.length - 1; index >= 0; index--) { const name = storage.key(index); if (name?.startsWith(draftPrefix) && name !== draftPrefix + key) storage.removeItem(name); }
      storage.setItem(draftPrefix + key, json);
    }
    if (input.done) { if (storage.getItem(lastDraftKey) === key) storage.removeItem(lastDraftKey); }
    else storage.setItem(lastDraftKey, key);
    return true;
  } catch { return false; }
}

/** After the item went to the cart: the draft is not offered again and is no longer "the last one". */
export function markDraftDone(storage: StorageLike | null, key: string, now = Date.now()): void {
  if (!storage || !key) return;
  try {
    const draft = parseDraft(storage.getItem(draftPrefix + key), now);
    if (draft && !draft.done) writeDraft(storage, key, { ...draft, done: true }, now);
    if (storage.getItem(lastDraftKey) === key) storage.removeItem(lastDraftKey);
  } catch { /* nothing to mark */ }
}

export function removeDraft(storage: StorageLike | null, key: string): void {
  if (!storage || !key) return;
  try { storage.removeItem(draftPrefix + key); if (storage.getItem(lastDraftKey) === key) storage.removeItem(lastDraftKey); } catch { /* blocked */ }
}

/** The customer started something new: opening the page without a link no longer brings the last draft back. */
export function forgetLastDraft(storage: StorageLike | null): void {
  try { storage?.removeItem(lastDraftKey); } catch { /* blocked */ }
}

/** The unfinished draft the customer was last working on, if it is still fresh (whoever saved it: check `draftVisible`). */
export function readLastDraft(storage: StorageLike | null, now = Date.now()): LinkOrderDraft | null {
  if (!storage) return null;
  try {
    const key = storage.getItem(lastDraftKey);
    if (!key) return null;
    const draft = readDraft(storage, key, now);
    if (!draft || draftKeyFor(draft) !== key) { storage.removeItem(lastDraftKey); return null; }
    return draft;
  } catch { return null; }
}

const ownerOf = (raw: string | null) => { try { const value: unknown = JSON.parse(raw ?? ''); return isRecord(value) && typeof value.owner === 'string' ? value.owner : ''; } catch { return ''; } };

/**
 * Once it is known who is on this device (`viewer`: an account tag, or '' for a guest), drafts another account saved are
 * removed, with the pointer to them: after signing out, the next person never gets them back.
 */
export function forgetOtherAccounts(storage: StorageLike | null, viewer: string): void {
  if (!storage) return;
  try {
    const names: string[] = [];
    for (let index = 0; index < storage.length; index++) { const name = storage.key(index); if (name?.startsWith(draftPrefix)) names.push(name); }
    for (const name of names) { const owner = ownerOf(storage.getItem(name)); if (owner && owner !== viewer) storage.removeItem(name); }
    const last = storage.getItem(lastDraftKey);
    if (last && storage.getItem(draftPrefix + last) === null) storage.removeItem(lastDraftKey);
  } catch { /* blocked */ }
}

/** Whether this device keeps what the page writes (false in a blocked or full storage): the guest's promise depends on it. */
export function storageWritable(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try { storage.setItem('atlas:link-order:probe', '1'); storage.removeItem('atlas:link-order:probe'); return true; } catch { return false; }
}

// ---------- A guest's cart add, kept through sign-in ----------

function cleanProduct(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' && value.name.trim().length > 0 && value.name.length <= 140
    && typeof value.usd === 'number' && Number.isFinite(value.usd) && value.usd > 0 && Array.isArray(value.variants) && value.variants.length > 0;
}
const quantityOk = (value: unknown) => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= maxQuantity;
const variantOk = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 200;

/** Structure only; the server validates the action in full and checks it against the store. */
export function isCartAddAction(value: unknown): value is CartAddAction {
  if (!isRecord(value) || (value.note !== undefined && (typeof value.note !== 'string' || value.note.length > maxComment))) return false;
  if (value.type === 'cart-add') return cleanProduct(value.product) && variantOk(value.variant) && (value.quantity === undefined || quantityOk(value.quantity));
  if (value.type === 'cart-add-many') return Array.isArray(value.items) && value.items.length >= 1 && value.items.length <= 20
    && value.items.every(item => isRecord(item) && cleanProduct(item.product) && variantOk(item.variant) && quantityOk(item.quantity));
  return false;
}

const safePath = (value: unknown) => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && value.length <= 6000 ? value : '/order-by-link';

export function parsePendingCartAdd(raw: string | null | undefined, now = Date.now()): PendingCartAdd | null {
  if (typeof raw !== 'string' || !raw || raw.length > maxDraftBytes) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!isRecord(value) || value.v !== 1 || !isCartAddAction(value.action)) return null;
  const savedAt = finite(value.savedAt), expiresAt = finite(value.expiresAt);
  if (savedAt === undefined || expiresAt === undefined || savedAt > now + clockSkewMs || expiresAt <= now || expiresAt - savedAt > pendingTtlMs) return null;
  const lines = value.action.type === 'cart-add' ? 1 : value.action.items.length;
  const units = value.action.type === 'cart-add' ? value.action.quantity ?? 1 : value.action.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    v: 1, savedAt, expiresAt, action: value.action,
    speed: value.speed === 'express' || value.speed === 'standard' ? value.speed : undefined,
    returnTo: safePath(value.returnTo), draftKey: text(value.draftKey, 4200), lines, units,
  };
}

export function savePendingCartAdd(storage: StorageLike | null, input: { action: CartAddAction; speed?: DraftSpeed; returnTo: string; draftKey: string }, now = Date.now()): boolean {
  if (!storage || !isCartAddAction(input.action)) return false;
  const json = JSON.stringify({ v: 1, savedAt: now, expiresAt: now + pendingTtlMs, action: input.action, speed: input.speed, returnTo: safePath(input.returnTo), draftKey: input.draftKey });
  if (json.length > maxDraftBytes) return false;
  try { storage.setItem(pendingCartAddKey, json); return storage.getItem(pendingCartAddKey) === json; } catch { return false; }
}

/** Which kept add a page may send: the link page only its own product's, the cart only a fresh one. */
export type PendingFilter = { draftKey?: string; maxAgeMs?: number };
const fits = (pending: PendingCartAdd, filter: PendingFilter, now: number) =>
  (filter.draftKey === undefined || pending.draftKey === filter.draftKey) && (filter.maxAgeMs === undefined || now - pending.savedAt <= filter.maxAgeMs);

/** The kept add, if there is one this page may send; an expired or unreadable one is removed on the way. */
function peekPendingCartAdd(storage: StorageLike, now: number): PendingCartAdd | null {
  const raw = storage.getItem(pendingCartAddKey);
  if (raw === null) return null;
  const pending = parsePendingCartAdd(raw, now);
  if (!pending) storage.removeItem(pendingCartAddKey);
  return pending;
}

export function hasPendingCartAdd(storage: StorageLike | null, now = Date.now(), filter: PendingFilter = {}): boolean {
  if (!storage) return false;
  try { const pending = peekPendingCartAdd(storage, now); return Boolean(pending && fits(pending, filter, now)); } catch { return false; }
}

/** Takes the guest's cart add out of storage before it is sent, so a second tab or a second render cannot send it again. */
export function takePendingCartAdd(storage: StorageLike | null, now = Date.now(), filter: PendingFilter = {}): PendingCartAdd | null {
  if (!storage) return null;
  try {
    const pending = peekPendingCartAdd(storage, now);
    if (!pending || !fits(pending, filter, now)) return null;
    storage.removeItem(pendingCartAddKey);
    if (storage.getItem(pendingCartAddKey) !== null) return null;
    return pending;
  } catch { return null; }
}

/**
 * Drops the kept add (only the one for `draftKey`, when given): the guest came back without signing in, or changed
 * the choice it was made from. Signing in later then adds what is on screen, not an older choice.
 */
export function discardPendingCartAdd(storage: StorageLike | null, draftKey?: string, now = Date.now()): void {
  if (!storage) return;
  try {
    const raw = storage.getItem(pendingCartAddKey);
    if (raw === null) return;
    const pending = parsePendingCartAdd(raw, now);
    if (draftKey === undefined || !pending || pending.draftKey === draftKey) storage.removeItem(pendingCartAddKey);
  } catch { /* blocked */ }
}
