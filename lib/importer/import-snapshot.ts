import type { Extracted } from './extract.ts';

/** Only an object with the shape returned by fetchProduct counts as a stored observation. */
export function parseImportSnapshot(payload: string): Extracted | undefined {
  let value: unknown;
  try { value = JSON.parse(payload); } catch { return undefined; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.sourceUrl !== 'string' || !Array.isArray(record.warnings)) return undefined;
  if (record.price !== undefined && (typeof record.price !== 'number' || !Number.isFinite(record.price))) return undefined;
  if (record.currency !== undefined && typeof record.currency !== 'string') return undefined;
  if (record.variants !== undefined && !Array.isArray(record.variants)) return undefined;
  return record as Extracted;
}
