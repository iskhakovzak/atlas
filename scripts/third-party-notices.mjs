// Writes public/third-party-notices.txt: every package the site ships (the production dependencies with everything
// they pull in, plus the few build-time packages whose code runs in the served bundle or server), with its licence
// and the licence/notice files the package carries. Runs before `npm run dev` and `npm run build`
// (scripts/run-framework.mjs), so the VPS image builds it from the lockfile it installed; not committed.
// `node scripts/third-party-notices.mjs --check` prints the summary without writing.
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public", "third-party-notices.txt");
// Build tooling whose own code ends up in what runs in production (the server entry, the RSC runtime).
// Only these packages themselves: their build-time dependencies do not ship.
const shippedTooling = ["vinext", "react-server-dom-webpack", "@vitejs/plugin-rsc"];
const noticeFile = /^(licen[cs]e|copying|notice|authors)(\..*)?$/i;

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

/** Node's lookup: the package's own node_modules first, then each parent's, up to the project. */
function locate(name, fromDir) {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name, "package.json");
    if (existsSync(candidate)) return dirname(candidate);
    if (dir === root || dirname(dir) === dir) return null;
  }
}

function licenseOf(pkg) {
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license && typeof pkg.license.type === "string") return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((item) => item.type ?? item).join(" OR ");
  return "UNKNOWN";
}

function repositoryOf(pkg) {
  const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  return repo ? repo.replace(/^git\+/, "").replace(/\.git$/, "") : pkg.homepage ?? "";
}

export function collect() {
  const top = readJson(join(root, "package.json"));
  const found = new Map();
  const queue = [...Object.keys(top.dependencies ?? {}).map((name) => [name, root, true]), ...shippedTooling.map((name) => [name, root, false])];
  while (queue.length) {
    const [name, from, follow] = queue.shift();
    const dir = locate(name, from);
    if (!dir) continue;
    const pkg = readJson(join(dir, "package.json"));
    const key = `${pkg.name}@${pkg.version}`;
    if (found.has(key)) continue;
    const files = readdirSync(dir).filter((file) => noticeFile.test(file)).sort();
    found.set(key, { name: pkg.name, version: pkg.version, license: licenseOf(pkg), repository: repositoryOf(pkg), dir, files });
    if (!follow) continue;
    for (const dep of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.optionalDependencies ?? {})]) queue.push([dep, dir, true]);
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
}

// The OCR engine copied to public/ocr/ embeds Tesseract (Apache-2.0); its upstream ships no NOTICE file, so the
// attribution Apache-2.0 §4 asks for is written out here, with the licence comments of the copied worker bundle.
function tesseractNotice() {
  const worker = join(root, "node_modules", "tesseract.js", "dist", "worker.min.js.LICENSE.txt");
  return [
    "Tesseract OCR (https://github.com/tesseract-ocr/tesseract), compiled to WebAssembly in tesseract.js-core and served",
    "from /ocr/ for reading the passport's machine-readable zone in the browser. Copyright the Tesseract OCR authors,",
    "Google LLC and contributors. Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0).",
    "The English model (eng.traineddata, from tesseract-ocr/tessdata_best, Apache-2.0) is packaged by @tesseract.js-data/eng.",
    ...(existsSync(worker) ? ["", "Licence comments of tesseract.js/dist/worker.min.js (served as /ocr/worker.min.js):", readFileSync(worker, "utf8").trim()] : []),
  ].join("\n");
}

export function render(packages, now = new Date()) {
  const line = "=".repeat(78);
  const counts = new Map();
  for (const item of packages) counts.set(item.license, (counts.get(item.license) ?? 0) + 1);
  const parts = [
    "Atlas — third-party software notices",
    `Generated ${now.toISOString().slice(0, 10)} from the installed packages by scripts/third-party-notices.mjs.`,
    `${packages.length} packages. Licences: ${[...counts].sort((a, b) => b[1] - a[1]).map(([name, count]) => `${name} ${count}`).join(", ")}.`,
    "",
    "Summary",
    ...packages.map((item) => `- ${item.name} ${item.version} — ${item.license}${item.repository ? ` — ${item.repository}` : ""}`),
    "",
    line,
    "NOTICE: Tesseract OCR",
    line,
    tesseractNotice(),
  ];
  for (const item of packages) {
    parts.push("", line, `${item.name} ${item.version}`, `License: ${item.license}`, ...(item.repository ? [`Source: ${item.repository}`] : []), line);
    if (!item.files.length) parts.push("(The package carries no licence file; its package.json declares the licence above.)");
    for (const file of item.files) {
      parts.push(`--- ${relative(item.dir, join(item.dir, file))} ---`, readFileSync(join(item.dir, file), "utf8").replace(/\r\n/g, "\n").trim());
    }
  }
  return parts.join("\n") + "\n";
}

/** Writes public/third-party-notices.txt; returns how many packages it lists. */
export function writeThirdPartyNotices() {
  const packages = collect();
  writeFileSync(output, render(packages));
  return packages.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--check")) {
    const packages = collect();
    const unknown = packages.filter((item) => item.license === "UNKNOWN");
    console.log(`${packages.length} packages, ${unknown.length} without a declared licence${unknown.length ? ": " + unknown.map((item) => item.name).join(", ") : ""}`);
  } else {
    writeThirdPartyNotices();
  }
}
