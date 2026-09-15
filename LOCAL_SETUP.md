# Atlas local setup

## Requirements

- Node.js 22.13+.
- npm and Git.
- Repository copy including .openai/hosting.json, drizzle and package-lock.json.

Do not move credentials, cookies, temporary Git tokens, .wrangler, .sites-runtime, dist or local D1 state between machines.

## First run

~~~
git clone <your-repository-url> atlas-uz
cd atlas-uz
npm ci
npm run lint
node --experimental-strip-types --test tests/*.test.mjs
npm run build
~~~

## Local development

~~~
npm run dev
~~~

For built Worker preview:

~~~
npm run build
npm start
~~~

With the local Worker running, execute the browser smoke test in another terminal:

~~~
npm run smoke:ui -- http://127.0.0.1:8787/
~~~

It launches an installed Chrome/Edge headlessly, clicks the catalog filter and product details, then verifies cart, orders and notifications navigation. Set ATLAS_BROWSER_PATH when the browser is installed elsewhere.

For the full guest/member access and responsive UI audit against the portable development server:

~~~
node scripts/audit-ui.mjs http://localhost:5173/
~~~

This local-only audit verifies protected routes, sign-in return paths, sign-out, customer denial of operator reads/writes, error recovery, semantic controls and 1440/800/390 px layouts. Screenshots and its JSON report are written under ignored `outputs/ui-audit`.

For the complete authenticated pre-release flow, start the Worker with `ATLAS_OPERATOR_EMAIL` configured for a disposable local operator, then run:

~~~
npm run smoke:auth -- http://127.0.0.1:8787/
~~~

The smoke uses a unique local customer and checks address checkout, simulated payment, private passport upload/deletion, masked identity, a test declaration, team assignment, internal note, parcel/tracking, warehouse settlement, delivery and email/SMS previews. It never contacts customs, external payment, carrier, identity or messaging providers.

The command prints the loopback URL. Local portable profile can simulate sign-in at:

~~~text
/signin-with-chatgpt?return_to=/
~~~

Hosted ChatGPT authentication is platform-owned. Use the private hosted site for real sign-in QA.

## Local D1

Build first, then apply the checked-in migration once:

~~~
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
  d1 execute DB --local --config dist/server/wrangler.json \
  --persist-to .wrangler/state --file drizzle/0000_overrated_justice.sql
~~~

Local D1 is separate from production. To start fresh locally, delete .wrangler/state intentionally, then apply migration again.

## Environment

| Value | How used |
| --- | --- |
| DB | Required D1 Worker binding, declared in .openai/hosting.json |
| ATLAS_OPERATOR_EMAIL | Hosted Worker secret, grants one email operator role |

Worker runtime reads env from cloudflare:workers, not process.env. Do not commit secret values. BUCKET stores private passport scans; local development uses Wrangler's local R2 state.

## Verification

~~~
npm run lint
node --experimental-strip-types --test tests/*.test.mjs
npm run build
~~~

Optional live Zara parser diagnostic:

~~~bash
node --experimental-strip-types - <<'JS'
import { fetchProduct } from './lib/importer/fetch.ts';
console.log(await fetchProduct('https://www.zara.com/ro/en/relaxed-fit-quilted-leather-jacket-p04416276.html?v1=549815761&v2=2732942'));
JS
~~~

Store response can change or block, so this is a diagnostic rather than a deterministic test.

## Hosting/deployment

The original project is configured for ChatGPT Sites. To retain that deployment, the local developer needs access to the same Sites project. Deploy by committing exact source; obtaining temporary Sites repo credential; pushing exact HEAD; packaging; saving a version with the exact SHA; deploying it with the site's current audience; polling completion.

For another host/account, create/configure a new D1 database and DB binding, apply migrations, set ATLAS_OPERATOR_EMAIL, provide auth, then document the new deployment path. Do not assume original Site project ID or D1 data is portable.

## New agent reading order

1. AGENTS.md
2. PROJECT_CONTEXT.md
3. ARCHITECTURE.md
4. TODO.md
5. Relevant source and tests
