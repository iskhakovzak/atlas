// Performance budget (3 November 2026): Lighthouse mobile (its default: simulated slow 4G, 4× CPU slowdown) against
// the home page, the catalog and one product page of a running Atlas, then a check against the budget below.
//
//   npm run perf:budget -- http://127.0.0.1:8797
//   npm run perf:budget -- https://staging.example --product /catalog/p/some-id --runs 3
//
// Lighthouse comes through `npx` (pinned version, not a project dependency) and drives the installed Chrome or Edge
// (CHROME_PATH overrides the search). With several runs the median of each metric is compared. Exit codes: 0 within
// budget, 1 over budget, 2 Lighthouse could not measure a page. Do not point it at production in a loop: each run
// loads every page with an empty cache.
import {spawnSync} from 'node:child_process';
import {existsSync, mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';

const LIGHTHOUSE = 'lighthouse@12.6.0';
// A guard against regressions, not the goal: set from the local VPS build on 3 November 2026 (median of 3 runs:
// / LCP 6270 ms, TBT 20 ms, score 65; /catalog LCP 6691 ms, TBT 103 ms, score 63; product LCP 8130 ms, TBT 53 ms,
// score 61; CLS ≤ 0.006 everywhere) with about 20 % headroom for run-to-run noise. CLS uses Google's "good" limit.
// Google's own "good" LCP is 2.5 s: lower these numbers as the pages get faster.
export const budget = {
  '/': {lcpMs: 7500, cls: 0.1, tbtMs: 200, score: 55},
  '/catalog': {lcpMs: 8000, cls: 0.1, tbtMs: 300, score: 55},
  product: {lcpMs: 9500, cls: 0.1, tbtMs: 250, score: 52},
};

export function parseArgs(argv) {
  const options = {base: '', product: '', runs: 1};
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--product') options.product = argv[++index] ?? '';
    else if (value === '--runs') options.runs = Math.max(1, Math.min(9, Number(argv[++index]) || 1));
    else if (!value.startsWith('--') && !options.base) options.base = value;
    else throw new Error(`Unknown argument ${value}`);
  }
  if (!/^https?:\/\//.test(options.base)) throw new Error('Usage: npm run perf:budget -- <base URL> [--product /catalog/p/<id>] [--runs N]');
  options.base = options.base.replace(/\/+$/, '');
  return options;
}

const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
};

/** The numbers the budget checks, from one Lighthouse JSON report. */
export function metricsFromReport(report) {
  const audit = id => report.audits?.[id]?.numericValue;
  const metrics = {lcpMs: audit('largest-contentful-paint'), cls: audit('cumulative-layout-shift'), tbtMs: audit('total-blocking-time'), fcpMs: audit('first-contentful-paint'), score: report.categories?.performance?.score == null ? undefined : report.categories.performance.score * 100};
  if ([metrics.lcpMs, metrics.cls, metrics.tbtMs, metrics.score].some(value => typeof value !== 'number' || Number.isNaN(value))) {
    throw new Error(report.runtimeError?.message ?? 'Lighthouse report without performance metrics');
  }
  return metrics;
}

/** Budget lines a page breaks (empty when it is within budget). */
export function overBudget(metrics, limits) {
  const failures = [];
  if (metrics.lcpMs > limits.lcpMs) failures.push(`LCP ${Math.round(metrics.lcpMs)} ms > ${limits.lcpMs} ms`);
  if (metrics.cls > limits.cls) failures.push(`CLS ${metrics.cls.toFixed(3)} > ${limits.cls}`);
  if (metrics.tbtMs > limits.tbtMs) failures.push(`TBT ${Math.round(metrics.tbtMs)} ms > ${limits.tbtMs} ms`);
  if (metrics.score < limits.score) failures.push(`score ${Math.round(metrics.score)} < ${limits.score}`);
  return failures;
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = process.platform === 'win32'
    ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).flatMap(root => [
      path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe')])
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return candidates.find(candidate => existsSync(candidate)) ?? '';
}

async function firstProductPath(base) {
  const response = await fetch(base + '/catalog', {headers: {'Accept-Language': 'ru'}});
  if (!response.ok) throw new Error(`GET /catalog: ${response.status}`);
  const match = /href="(\/catalog\/p\/[^"?#]+)/.exec(await response.text());
  if (!match) throw new Error('No product link on /catalog: pass --product /catalog/p/<id>');
  return match[1];
}

// npm's own npx script, started with this Node: no shell, so the arguments need no quoting (npx is a .cmd on Windows).
function npxCommand() {
  const bin = path.dirname(process.execPath);
  const script = [path.join(bin, 'node_modules', 'npm', 'bin', 'npx-cli.js'), path.join(bin, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js')].find(existsSync);
  return script ? [process.execPath, [script]] : ['npx', []];
}

function lighthouseOnce(url, chrome, output) {
  const [command, prefix] = npxCommand();
  const args = [...prefix, '-y', LIGHTHOUSE, url, '--quiet', '--output=json', `--output-path=${output}`, '--only-categories=performance',
    '--form-factor=mobile', '--chrome-flags=--headless=new --no-first-run --no-default-browser-check --disable-extensions'];
  const result = spawnSync(command, args, {encoding: 'utf8', env: {...process.env, CHROME_PATH: chrome}, timeout: 180_000});
  // chrome-launcher on Windows can fail to delete its profile folder after a complete run: the report still counts.
  if (!existsSync(output)) throw new Error(`Lighthouse failed for ${url}: ${(result.stderr || result.stdout || String(result.error ?? result.status)).trim().slice(-600)}`);
  return metricsFromReport(JSON.parse(readFileSync(output, 'utf8')));
}

function lighthouse(url, chrome, directory, run) {
  const output = attempt => path.join(directory, `report-${run}-${attempt}-${Date.now()}.json`);
  // A trace that fails to record (NO_NAVSTART, NO_FCP …) is Lighthouse's own flake: measured once more before failing.
  try { return lighthouseOnce(url, chrome, output(0)); }
  catch { return lighthouseOnce(url, chrome, output(1)); }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const chrome = findChrome();
  if (!chrome) throw new Error('Chrome or Edge not found: set CHROME_PATH');
  const product = options.product || await firstProductPath(options.base);
  const pages = [['/', '/'], ['/catalog', '/catalog'], ['product', product]];
  const directory = mkdtempSync(path.join(tmpdir(), 'atlas-perf-budget-'));
  let failed = false, broken = false;
  try {
    console.log(`Lighthouse mobile, ${options.runs} run(s) per page, ${options.base}`);
    for (const [key, pagePath] of pages) {
      const url = options.base + pagePath, samples = [];
      try {
        for (let run = 0; run < options.runs; run++) samples.push(lighthouse(url, chrome, directory, run));
      } catch (error) {
        broken = true;
        console.log(`✗ ${pagePath}: ${error.message}`);
        continue;
      }
      const metrics = Object.fromEntries(Object.keys(samples[0]).map(name => [name, median(samples.map(sample => sample[name]))]));
      const failures = overBudget(metrics, budget[key]);
      failed ||= failures.length > 0;
      console.log(`${failures.length ? '✗' : '✓'} ${pagePath}  LCP ${Math.round(metrics.lcpMs)} ms · CLS ${metrics.cls.toFixed(3)} · TBT ${Math.round(metrics.tbtMs)} ms · FCP ${Math.round(metrics.fcpMs)} ms · score ${Math.round(metrics.score)}${failures.length ? '  — ' + failures.join('; ') : ''}`);
    }
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
  process.exitCode = broken ? 2 : failed ? 1 : 0;
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/perf-budget.mjs')) {
  main().catch(error => { console.error(error.message); process.exitCode = 2; });
}
