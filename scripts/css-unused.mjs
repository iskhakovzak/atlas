// Finds (and with --write removes) CSS selectors in app/*.css that require a class no source file uses.
//   node scripts/css-unused.mjs          report only
//   node scripts/css-unused.mjs --write  rewrite the files
//
// A class counts as used when its name appears anywhere in app/, components/ or lib/ sources
// (strings, identifiers, comments), which errs on the side of keeping CSS. A word ending in "-"
// (for example `status-${x}` or 'detail-'+id) counts as a prefix. A selector is removed
// only when a class outside :not()/:has() is missing, or when every alternative of an :is()/:where()
// is; :is() lists are never rewritten because that could change specificity. Whole rules go when
// none of their selectors is left. Check the result with `npm run e2e -- --compare <run>`.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import postcss from "postcss";

const write = process.argv.includes("--write");
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function files(dir, extensions) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : files(path, extensions);
    return extensions.includes(extname(name)) ? [path] : [];
  });
}

// Classes that appear at runtime without being written in our sources.
const runtimePrefixes = ["lucide", "sonner", "toaster", "toast"];
const used = new Set();
const prefixes = new Set(runtimePrefixes);
for (const file of ["app", "components", "lib"].flatMap((dir) => files(join(root, dir), [".ts", ".tsx"]))) {
  // Plain word scan instead of parsing literals: quotes in comments or regexes cannot hide a class.
  for (const token of readFileSync(file, "utf8").match(/[\w/:.[\]%-]+/g) ?? []) {
    used.add(token);
    for (const piece of token.split(/[^\w-]+/)) {
      if (!piece) continue;
      used.add(piece);
      if (piece.endsWith("-") && piece.length >= 3) prefixes.add(piece);
    }
  }
}
// Tailwind-style names such as "group/tabs" are known when every part is.
const known = (name) => used.has(name) || [...prefixes].some((prefix) => name.startsWith(prefix)) || (/[/:]/.test(name) && name.split(/[/:]/).every((part) => used.has(part)));

function splitTopLevel(value, separator = ",") {
  const out = []; let depth = 0, current = "", quote = "";
  for (const char of value) {
    if (quote) { current += char; if (char === quote) quote = ""; continue; }
    if (char === '"' || char === "'") { quote = char; current += char; continue; }
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth--;
    if (char === separator && depth === 0) { out.push(current); current = ""; continue; }
    current += char;
  }
  out.push(current);
  return out.map((part) => part.trim()).filter(Boolean);
}

// Returns false when the selector can never match because of a class nobody uses.
function alive(selector) {
  let rest = "", i = 0;
  while (i < selector.length) {
    const fn = selector.slice(i).match(/^:(is|where|not|has|matches|any)\(/i);
    if (!fn) { rest += selector[i++]; continue; }
    let depth = 1, j = i + fn[0].length;
    for (; j < selector.length && depth; j++) { if (selector[j] === "(") depth++; else if (selector[j] === ")") depth--; }
    const inner = selector.slice(i + fn[0].length, j - 1);
    const name = fn[1].toLowerCase();
    if ((name === "is" || name === "where" || name === "matches" || name === "any") && !splitTopLevel(inner).some(alive)) return false;
    rest += " ";
    i = j;
  }
  for (const match of rest.replace(/\[[^\]]*\]/g, "").matchAll(/\.((?:\\.|[\w-])+)/g)) {
    const name = match[1].replace(/\\(.)/g, "$1");
    if (!known(name)) return false;
  }
  return true;
}

const report = [];
let before = 0, after = 0;
for (const name of readdirSync(join(root, "app")).filter((file) => file.endsWith(".css"))) {
  const path = join(root, "app", name);
  const css = readFileSync(path, "utf8");
  const ast = postcss.parse(css, { from: path });
  let removedRules = 0, removedSelectors = 0;
  ast.walkRules((rule) => {
    if (rule.parent?.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    const selectors = splitTopLevel(rule.selector);
    const keep = selectors.filter(alive);
    if (keep.length === selectors.length) return;
    removedSelectors += selectors.length - keep.length;
    report.push(`${name}:${rule.source.start.line}  ${selectors.filter((selector) => !alive(selector)).join(" , ").replace(/\s+/g, " ").slice(0, 200)}`);
    if (!keep.length) { rule.remove(); removedRules++; } else rule.selector = keep.join(", ");
  });
  // Drop at-rules emptied by the removals.
  ast.walkAtRules((atRule) => { if (/^(media|supports|container)$/i.test(atRule.name) && atRule.nodes && !atRule.nodes.length) atRule.remove(); });
  const output = ast.toString();
  before += css.length; after += output.length;
  if (removedSelectors) report.unshift(`${name}: ${removedSelectors} selectors, ${removedRules} rules, ${css.length - output.length} bytes`);
  if (write && output !== css) writeFileSync(path, output);
}
console.log(report.join("\n"));
console.log(`\napp/*.css: ${before} → ${after} bytes (−${before - after}, ${((1 - after / before) * 100).toFixed(1)}%)${write ? " written" : " (report only)"}`);
console.log(`classes known from sources: ${used.size}, dynamic prefixes: ${[...prefixes].filter((p) => !runtimePrefixes.includes(p)).slice(0, 40).join(" ")}`);
