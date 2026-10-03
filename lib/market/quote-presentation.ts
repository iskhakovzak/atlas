import type { Quote } from './domain.ts';

export type AtlasServiceQuote = Pick<Quote, 'service' | 'buyout' | 'conversion' | 'shipping' | 'deliveryMargin'>;

export function atlasServiceBreakdown(quote: AtlasServiceQuote) {
  return {
    service: quote.service + (quote.buyout ?? 0) + (quote.conversion ?? 0),
    international: quote.shipping + (quote.deliveryMargin ?? 0),
  };
}

/** Grouped display only; the underlying quote components and calculations stay separate. */
export function atlasServiceTotal(quote: AtlasServiceQuote) {
  const parts = atlasServiceBreakdown(quote);
  return parts.service + parts.international;
}
