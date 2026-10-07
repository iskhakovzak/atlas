export const catalogImportBatchSize = 10;

export function chunkCatalogIds(ids: string[], size = catalogImportBatchSize) {
  if (!Number.isInteger(size) || size < 1) throw new Error('Chunk size must be a positive integer.');
  return Array.from({ length: Math.ceil(ids.length / size) }, (_, index) => ids.slice(index * size, (index + 1) * size));
}

// Operators paste links from chats, spreadsheets and store pages: several per
// line, wrapped in text, with trailing punctuation or tracking parameters.
const urlPattern = /\bhttps?:\/\/[^\s<>"'()\[\]{}]+/gi;
const trackingParam = /^(utm_.+|gclid|fbclid|mc_cid|mc_eid|ref|ref_|_pos|_sid|_ss|_psq|_kx|srsltid|cmpid|icid|ranMID|ranEAID|ranSiteID)$/i;

/** Normalize one pasted link: HTTPS, no hash, no tracking parameters. Returns undefined for anything that is not a web URL. */
export function normalizeCatalogImportLink(value: string) {
  const trimmed = value.trim().replace(/[.,;:!?…»)\]}]+$/u, '');
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  let url: URL;
  try { url = new URL(trimmed); } catch { return undefined; }
  if (!url.hostname.includes('.') || url.username || url.password) return undefined;
  url.protocol = 'https:';
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (trackingParam.test(key)) url.searchParams.delete(key);
  return url.href.replace(/\?$/, '');
}

export type CatalogImportQueue = {
  /** Unique normalized links in paste order. */
  links: string[];
  /** Extra mentions of a link already in `links`. */
  duplicates: number;
  /** Non-empty lines that contained no web link at all. */
  invalid: string[];
};

export function parseCatalogImportQueue(value: string): CatalogImportQueue {
  const links: string[] = [], invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const found = [...line.matchAll(urlPattern)].map(match => normalizeCatalogImportLink(match[0])).filter((link): link is string => Boolean(link));
    if (!found.length) { invalid.push(line.slice(0, 120)); continue; }
    for (const link of found) {
      if (seen.has(link)) { duplicates++; continue; }
      seen.add(link);
      links.push(link);
    }
  }
  return { links, duplicates, invalid };
}

/** Drop the imported links from the textarea while keeping failed, unprocessed and non-link lines in place. */
export function removeImportedCatalogLinks(value: string, imported: string[]) {
  const completed = new Set(imported.map(link => normalizeCatalogImportLink(link) ?? link.trim()));
  if (!completed.size) return value;
  return value
    .split(/\r?\n/)
    .flatMap(line => {
      const matches = [...line.matchAll(urlPattern)];
      if (!matches.length) return [line];
      let next = line, remaining = 0;
      for (const match of matches) {
        const normalized = normalizeCatalogImportLink(match[0]);
        if (normalized && completed.has(normalized)) next = next.replace(match[0], '');
        else remaining++;
      }
      // A line whose links were all imported goes away with its comment; a line that still has a link keeps its text.
      if (!remaining) return [];
      return [next === line ? line : next.replace(/\s{2,}/g, ' ').trim()];
    })
    .join('\n');
}
