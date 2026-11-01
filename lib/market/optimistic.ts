// Instant, optimistic changes (owner, 2 November 2026: "нажал — сразу среагировало, запрос идёт фоном; убрал — сразу
// убралось"). Only actions that move no money and need no store answer are applied on the device before the server
// confirms them, with the same domain functions the server runs (lib/market/actions.ts), so a sum shown in between is
// the same computation; the server's state then replaces it. Adding to the cart, promo codes, payment, imports and
// sign-in are never optimistic: they need the server or a store.
import { changeQuantity, customsHelpChosen, markNotificationsRead, repriceCart, setCartSelection, tariff, type Pricing, type State } from './domain.ts';

export type OptimisticAction =
  | { type: 'favorite'; id: string }
  | { type: 'cart-quantity'; id: string; quantity: number }
  | { type: 'cart-select'; ids: string[]; selected: boolean }
  | { type: 'cart-remove'; id: string; ids?: string[] }
  | { type: 'notifications-read' };

const optimisticTypes = new Set(['favorite', 'cart-quantity', 'cart-select', 'cart-remove', 'notifications-read']);

/** Whether an action is shown at once and confirmed in the background. */
export function isOptimistic(action: { type: string }): action is OptimisticAction {
  return optimisticTypes.has(action.type);
}

/**
 * The state as it will be once the server accepts the action, or undefined when it cannot be applied here (a line
 * already gone, a quantity over the store's stock): such an action simply waits for the server's answer.
 */
export function applyOptimistic(state: State, action: OptimisticAction, pricing: Pricing = tariff, now = Date.now()): State | undefined {
  try {
    switch (action.type) {
      case 'favorite':
        return { ...state, favorites: state.favorites.includes(action.id) ? state.favorites.filter(id => id !== action.id) : [...state.favorites, action.id] };
      case 'cart-quantity':
        return changeQuantity(state, action.id, action.quantity, now, pricing);
      case 'cart-select':
        return setCartSelection(state, action.ids, action.selected, now, pricing);
      case 'cart-remove': {
        const gone = new Set(action.ids ?? [action.id]);
        if (!state.cart.some(item => gone.has(item.id))) return undefined;
        return { ...state, cart: repriceCart(state.cart.filter(item => !gone.has(item.id)), now, pricing, customsHelpChosen(state)) };
      }
      case 'notifications-read':
        return markNotificationsRead(state);
    }
  } catch {
    return undefined;
  }
}

/**
 * What the screen shows: the server's last state with the actions still on their way applied on top, in the order they
 * were made. An action that no longer applies (the server state moved on) is skipped, never forced.
 */
export function withPending(server: State, pending: readonly OptimisticAction[], pricing: Pricing = tariff, now = Date.now()): State {
  return pending.reduce((state, action) => applyOptimistic(state, action, pricing, now) ?? state, server);
}
