import type { Quote } from './domain.ts';

export type AtlasServiceQuote = Pick<Quote, 'service' | 'buyout' | 'conversion' | 'shipping' | 'deliveryMargin'>;

/** Grouped display only; the underlying quote components and calculations stay separate. */
export function atlasServiceTotal(quote: AtlasServiceQuote) {
  return quote.service + (quote.buyout ?? 0) + (quote.conversion ?? 0) + quote.shipping + (quote.deliveryMargin ?? 0);
}
