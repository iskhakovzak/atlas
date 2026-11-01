import type { Quote } from './domain.ts';

export type AtlasServiceQuote = Pick<Quote, 'service' | 'buyout' | 'conversion' | 'shipping' | 'deliveryMargin'>;

export function atlasServiceBreakdown(quote: AtlasServiceQuote) {
  return {
    service: quote.service + (quote.buyout ?? 0) + (quote.conversion ?? 0),
    international: quote.shipping + (quote.deliveryMargin ?? 0),
  };
}

/**
 * The bill as the cart, the checkout and the orders show it (owner, 2 November 2026): «Сервис Atlas» is the Atlas fee with
 * the fee for paying customs through Atlas when chosen; international delivery is a line of its own. Display only: the
 * quote's own components and every calculation stay as they are.
 */
export function billLines(quote: AtlasServiceQuote & Pick<Quote, 'customsHelp'>) {
  const parts = atlasServiceBreakdown(quote);
  return { service: parts.service + (quote.customsHelp ?? 0), delivery: parts.international };
}
