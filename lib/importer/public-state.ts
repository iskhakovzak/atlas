/** Read public JSON data only. Merchant JavaScript is never evaluated. */
export function publicJsonAssignment(html: string, key: 'window.productObject' | 'Shopify.currency'): unknown {
  const pattern = key === 'window.productObject' ? /\bwindow\.productObject\s*=\s*([\[{])/g : /\bShopify\.currency\s*=\s*([\[{])/g;
  let attempts = 0;
  for (const match of html.matchAll(pattern)) {
    if (++attempts > 4) break;
    const start = match.index + match[0].length - 1;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < Math.min(html.length, start + 2_500_000); i++) {
      const character = html[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === '{' || character === '[') depth++;
      else if ((character === '}' || character === ']') && --depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  return undefined;
}

export function publicJsonStates(html: string): unknown[] {
  const roots: unknown[] = [];
  const ids = new Set(['__NEXT_DATA__', '__PRELOADED_STATE__', '__INITIAL_STATE__', '__APOLLO_STATE__', 'product-data', 'product-json', 'ProductJson']);
  let count = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const id = match[1].match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!ids.has(id ?? '') && !/\btype\s*=\s*["']application\/json["']/i.test(match[1])) continue;
    if (++count > 32) break;
    if (match[2].length > 2_500_000) continue;
    try { roots.push(JSON.parse(match[2])); } catch { /* Incomplete public state is not product evidence. */ }
  }
  // Older storefronts publish the same JSON through fixed state assignments.
  // Consume only a balanced JSON literal after '=', never expressions/calls.
  let assignments = 0;
  for (const match of html.matchAll(/(?:window\.)?(?:__INITIAL_STATE__|__PRELOADED_STATE__|__APOLLO_STATE__|productArticleDetails)\s*=\s*([\[{])/g)) {
    if (++assignments > 32 || roots.length >= 32) break;
    const start = match.index + match[0].length - 1;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < Math.min(html.length, start + 2_500_000); i++) {
      const character = html[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === '{' || character === '[') depth++;
      else if ((character === '}' || character === ']') && --depth === 0) {
        try { roots.push(JSON.parse(html.slice(start, i + 1))); } catch { /* No executable fallback. */ }
        break;
      }
    }
  }
  return roots;
}
