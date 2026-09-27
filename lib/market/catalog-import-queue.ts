export const catalogImportBatchSize = 10;

export function parseCatalogImportQueue(value: string) {
  const raw = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const links = [...new Set(raw)];
  return { links, duplicates: raw.length - links.length };
}

export function removeImportedCatalogLinks(value: string, imported: string[]) {
  const completed = new Set(imported.map(link => link.trim()));
  return value
    .split(/\r?\n/)
    .filter(line => !completed.has(line.trim()))
    .join('\n');
}
