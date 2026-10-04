import type { Product } from './domain.ts';
import { estimatedBoxedWeight, validBoxedWeight } from './weight.ts';
import { packagingKg } from './world.ts';

/** URL equality alone does not make a customer-pasted link an Atlas catalog order. */
export function catalogLinkSeed<T extends Product>(products: T[], catalogId: string, requestedUrl: string, link = requestedUrl): T | undefined {
  if (!catalogId || !requestedUrl || link !== requestedUrl) return undefined;
  return products.find(product => product.id === catalogId && product.sourceUrl === requestedUrl);
}

/** A dated catalog amount is a fallback estimate, never a fresh merchant check. */
export function catalogLinkPrice(product: Product | undefined): { amount: number; currency: string } | undefined {
  if (!product || !Number.isFinite(product.sourcePrice) || Number(product.sourcePrice) <= 0 || !product.sourceCurrency) return undefined;
  return { amount: product.sourcePrice!, currency: product.sourceCurrency };
}

export function catalogLinkWeight(product: Product | undefined): number | undefined {
  if (!product) return undefined;
  return validBoxedWeight(product.boxedWeight) ?? validBoxedWeight(product.weight - packagingKg) ?? estimatedBoxedWeight(product.category);
}
