import type { Extracted } from '../importer/extract.ts';
import { UnsupportedStoreError } from '../importer/fetch.ts';
import { manualFallbackAllowed, requiresMerchantSnapshot } from '../importer/manual-fallback.ts';
import { compareProductSnapshot } from '../importer/verify.ts';
import { applyAction, type Action } from './actions.ts';
import { checkCartSources } from './cart-check.ts';
import { canonicalCatalogUrl, type CatalogDocument } from './catalog-editor.ts';
import { communityCatalogProducts } from './community-deals.ts';
import { cartSignature, customsHelpChosen, products as serverProducts, renewCart, unknownStoreShippingUsd, type Pricing, type Product, type State } from './domain.ts';
import type { Policy } from './policy.ts';
import { validBoxedWeight } from './weight.ts';
import { toUsd } from './world.ts';

/**
 * The server core of POST /api/actions without D1: store checks, repricing and the domain action.
 * app/api/actions/route.ts keeps identity, limits, the revision check, persisting and the response.
 */

/** A refusal with an HTTP status and a localized error code (lib/market/i18n.ts). */
export class ActionError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.name = 'ActionError';
    this.status = status;
    this.code = code;
  }
}

/**
 * The status and code an error from prepareAction is answered with, when it carries a localized code:
 * an ActionError, or an Error with its own `code` such as 'err_61' (domain and action checks). Anything else
 * is answered with its message, as before. A code whose text needs values the caller does not have is left out.
 */
export function codedActionError(error: unknown): { status: number; code: string } | undefined {
  if (error instanceof ActionError) return { status: error.status, code: error.code };
  if (error instanceof UnsupportedStoreError || !(error instanceof Error)) return undefined;
  const code = Object.prototype.hasOwnProperty.call(error, 'code') ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && /^err_\d+$/.test(code) ? { status: 400, code } : undefined;
}

/** The revision the client saw is no longer the stored one: answer with the current state, write nothing. */
export const staleRevision = (sent: unknown, current: number) => sent !== current;

/** The unknown-delivery reserve the Atlas catalog sets for a product link (server data only). */
export type EditorialShipping = { sourceShippingUsd: number; sourceShippingEstimated: boolean };

/**
 * A published catalog card or a community deal with the same canonical store link: its delivery is the
 * operator's (or the bundled) record. Links outside the allowlist and unknown links have none.
 */
export function editorialShippingFor(document: CatalogDocument | undefined, sourceUrl: string | undefined): EditorialShipping | undefined {
  if (!sourceUrl) return undefined;
  const canonical = (value: string) => { try { return canonicalCatalogUrl(value); } catch { return undefined; } };
  const key = canonical(sourceUrl);
  if (!key) return undefined;
  const published = document?.entries.find(entry => entry.published && canonical(entry.published.sourceUrl) === key)?.published;
  if (published) return { sourceShippingUsd: published.sourceShippingUsd ?? unknownStoreShippingUsd, sourceShippingEstimated: published.sourceShippingEstimated ?? true };
  const deal = communityCatalogProducts.find(item => item.sourceUrl && canonical(item.sourceUrl) === key);
  if (deal) return { sourceShippingUsd: deal.sourceShippingUsd ?? unknownStoreShippingUsd, sourceShippingEstimated: deal.sourceShippingEstimated ?? true };
  return undefined;
}

/**
 * Owner's rule: unknown store delivery is free strictly above $50 from a store, else a hold of $10. The customer may
 * raise the hold of a link order, but never below $10, so a request cannot turn it into "free" below $50.
 * Catalog records are not passed here: their reserve is the operator's. Returns the same object when nothing changes.
 */
export function withReserveFloor(product: Product, pricing: Pick<Pricing, 'rates'>): Product {
  if (!product.sourceShippingEstimated) return product;
  let usd = 0;
  try { usd = toUsd(product.sourceShipping ?? 0, product.sourceShippingCurrency ?? product.sourceCurrency ?? 'USD', pricing.rates); } catch { usd = 0; }
  if (usd >= unknownStoreShippingUsd) return product;
  return { ...product, sourceShipping: unknownStoreShippingUsd, sourceShippingCurrency: 'USD', sourceShippingUsd: unknownStoreShippingUsd };
}

/** The delivery a request claims as stated by the store, without a store response to confirm it, becomes the reserve. */
export function withoutClaimedShipping(product: Product): Product {
  if (product.sourceShippingEstimated) return product;
  return { ...product, sourceShippingEstimated: true, sourceShipping: unknownStoreShippingUsd, sourceShippingCurrency: 'USD', sourceShippingUsd: unknownStoreShippingUsd, shippingKnown: true };
}

/** The catalog's delivery record for a line, as cart-add applies it. Returns the same object when it already matches. */
export function withEditorialShipping(product: Product, record: EditorialShipping): Product {
  if (product.sourceShippingEstimated === record.sourceShippingEstimated && product.sourceShippingUsd === record.sourceShippingUsd && product.sourceShipping === record.sourceShippingUsd && product.sourceShippingCurrency === 'USD') return product;
  return { ...product, sourceShipping: record.sourceShippingUsd, sourceShippingUsd: record.sourceShippingUsd, sourceShippingCurrency: 'USD', sourceShippingEstimated: record.sourceShippingEstimated };
}

export type PrepareDeps = {
  fetchProduct: (url: string) => Promise<Extracted>;
  pricing: Pricing;
  policy: Policy;
  operator: boolean;
  now: number;
  recentCheckMs: number;
  /** The catalog's delivery record for this product link, if any; never taken from the request. */
  editorialShipping?: (product: Pick<Product, 'sourceUrl'>) => EditorialShipping | undefined | Promise<EditorialShipping | undefined>;
};

export type PreparedAction = {
  next: State;
  /** Set when the cart was repriced (new store price, new tariff, a product to load again): save `next`, refuse the action. */
  refusal?: string;
  /** The first live store response of a cart-add, for the customer catalog draft. */
  verifiedSource?: Extracted;
};

/**
 * Checks the action against the stores and the current tariff, then applies it. Mutates `action` like the
 * route always did: the verified products of a cart-add and a checkout signature renewed with the same totals.
 */
export async function prepareAction(state: State, action: Action, deps: PrepareDeps): Promise<PreparedAction> {
  const { pricing: currentPricing, policy: currentPolicy, now } = deps;
  let verifiedSource: Extracted | undefined;
  let refusal: string | undefined;
  if (action.type === 'cart-add' || action.type === 'cart-add-many') {
    const items = action.type === 'cart-add' ? [{ product: action.product, variant: action.variant }] : action.items;
    // Several options of one product share one request to the store.
    const fetched = new Map<string, Promise<{ value?: Extracted; error?: unknown }>>();
    for (const item of items) {
      // Only the server records when a product was last checked and how many units the store reports.
      item.product = { ...item.product, sourceCheckedAt: undefined, stockQuantity: undefined, stockMoreThan: undefined, stockSource: undefined };
      const url = item.product.sourceUrl;
      if (!url) continue;
      // A catalog card's delivery is the operator's record, whatever the request says about it.
      const editorial = await deps.editorialShipping?.(item.product);
      if (editorial) item.product = { ...item.product, sourceShipping: editorial.sourceShippingUsd, sourceShippingUsd: editorial.sourceShippingUsd, sourceShippingCurrency: 'USD', sourceShippingEstimated: editorial.sourceShippingEstimated };
      if (requiresMerchantSnapshot(item.product)) {
        let result = fetched.get(url);
        if (!result) { result = deps.fetchProduct(url).then(value => ({ value }), error => ({ error })); fetched.set(url, result); }
        const { value, error } = await result;
        if (!value) { if (!manualFallbackAllowed(item.product, item.variant, error)) throw error; }
        else {
          verifiedSource ??= value;
          const check = compareProductSnapshot(item.product, item.variant, value, now, { editorialShipping: Boolean(editorial) });
          if (check.status === 'blocked') throw new ActionError(400, check.code);
          // The page showed an older price or another store delivery than the store states (or claims one it does not
          // state): the customer reloads it and sees the new total before adding.
          if (check.status === 'changed') throw new ActionError(409, 'err_34');
          item.product = check.product;
          // A shipping weight the store publishes is used unless the customer entered their own.
          const storeWeight = value.weightKind === 'shipping' ? validBoxedWeight(value.boxedWeight) : undefined;
          if (storeWeight !== undefined && item.product.weightBasis !== 'customer') item.product = { ...item.product, boxedWeight: storeWeight, weightBasis: 'store' };
        }
      }
      // Without a live store response (a blocked store, a link outside the allowlist) there is no store-stated delivery:
      // a "known" amount in the request is not believed, the line gets Atlas's reserve (outside the total, free above $50).
      if (!editorial && !item.product.sourceCheckedAt) item.product = withoutClaimedShipping(item.product);
      if (!editorial) item.product = withReserveFloor(item.product, deps.pricing);
    }
    if (action.type === 'cart-add') action.product = items[0].product;
  }
  if (action.type === 'cart-check' || action.type === 'checkout') {
    // Store delivery of a line is the catalog's record only when the catalog has one for its link; the rest
    // get what the store states, or Atlas's reserve when it states none.
    const editorialRecords = new Map<string, EditorialShipping>();
    if (deps.editorialShipping) {
      for (const url of new Set(state.cart.flatMap(item => item.product.sourceUrl ? [item.product.sourceUrl] : []))) {
        const record = await deps.editorialShipping({ sourceUrl: url });
        if (record) editorialRecords.set(url, record);
      }
    }
    const editorial = (product: Pick<Product, 'sourceUrl'>) => Boolean(product.sourceUrl && editorialRecords.has(product.sourceUrl));
    // A reserve below the owner's minimum saved before it was enforced (or sent by a crafted request) is raised first.
    let raised = false;
    // A catalog line takes the catalog's current record (a line saved before the operator changed it, or crafted, is corrected);
    // a line never checked with the store has no stated delivery and keeps (or gets) the reserve.
    const floored = state.cart.map(item => {
      if (!item.product.sourceUrl) {
        // A line without a store link is priced only from the server's own product list (a line crafted before that was enforced is corrected).
        const known = serverProducts.find(product => product.id === item.product.id);
        if (!known || !known.variants.includes(item.variant)) throw new ActionError(400, 'err_73');
        if (JSON.stringify(known) === JSON.stringify(item.product)) return item;
        raised = true;
        return { ...item, product: structuredClone(known) };
      }
      const record = editorialRecords.get(item.product.sourceUrl);
      const product = record
        ? withEditorialShipping(item.product, record)
        : withReserveFloor(item.product.sourceCheckedAt ? item.product : withoutClaimedShipping(item.product), currentPricing);
      if (product === item.product) return item;
      raised = true;
      return { ...item, product };
    });
    const checked = await checkCartSources(floored, deps.fetchProduct, currentPricing, now, deps.recentCheckMs, { editorial });
    state = { ...state, cart: checked.cart };
    // A line priced before the tariff changed, or without (with) the customs fee the customer (no longer) chose.
    const tariffChanged = state.cart.some(item => item.quote.tariffVersion !== currentPricing.version || Boolean(item.quote.customsHelp) !== customsHelpChosen(state));
    // The raised reserve is outside the total, but the customer sees the new hold before the order is placed.
    const holdChanged = raised && renewCart(state, now, currentPricing).cart.some((item, index) => (item.quote.storeShippingHold ?? 0) !== (state.cart[index].quote.storeShippingHold ?? 0) || item.quote.total !== state.cart[index].quote.total);
    const unreachableOnly = checked.blocked.length > 0 && checked.blocked.every(id => state.cart.find(item => item.id === id)?.sourceIssue?.kind === 'unreachable');
    refusal = checked.blocked.length ? (unreachableOnly ? 'err_38' : 'err_36') : checked.changed.length ? 'err_35' : tariffChanged || holdChanged ? 'err_37' : undefined;
    if (refusal) state = renewCart(state, now, currentPricing);
    else if (action.type === 'checkout' && state.cart.some(item => now >= item.quote.expiresAt)) {
      // Only the 15-minute hold ran out: with the same amounts the customer already saw, go on.
      const renewed = renewCart(state, now, currentPricing);
      const sameTotals = renewed.cart.every((item, index) => item.quote.total === state.cart[index].quote.total);
      if (!sameTotals) refusal = 'err_37';
      else if (action.signature === cartSignature(state.cart)) action.signature = cartSignature(renewed.cart);
      state = renewed;
    }
  }
  const next = refusal ? state : applyAction(state, action, deps.operator, currentPricing, currentPolicy);
  return { next, refusal, verifiedSource };
}
