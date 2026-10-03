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

For the complete authenticated pre-release flow, start the Worker with a disposable local operator and dev sign-in codes, then run the smoke:

~~~
npm start -- --var ATLAS_AUTH_DEV_CODES:true --var ATLAS_OPERATOR_EMAIL:operator@atlas.local
npm run smoke:auth -- http://127.0.0.1:8787/
~~~

The smoke signs in through the real email-code endpoint with a unique local customer and checks address checkout, simulated payment, private passport upload/deletion, masked identity, a test declaration, team assignment, internal note, parcel/tracking, warehouse settlement, delivery and email/SMS previews. It never contacts customs, external payment, carrier, identity or messaging providers.

### Local sign-in

Atlas has its own sign-in at `/login` (Telegram, phone + SMS code, email code, Google). On `npm run dev`, or on `npm start` with `ATLAS_AUTH_DEV_CODES=true`, phone and email sign-in work without providers: the code is not sent and appears on the login screen instead. This happens only for loopback hosts (`localhost`, `127.0.0.1`, `::1`) and never on a public host. Sign in with the email from `ATLAS_OPERATOR_EMAIL` to reach the operator screens. Telegram and Google appear only when their settings below are present; Telegram also needs the bot's domain set with BotFather `/setdomain`, so it cannot be tested on localhost.

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
| ATLAS_OPERATOR_EMAIL | Hosted Worker secret, grants one email operator role. Only email-code or Google sign-in carries a verified email, so phone/Telegram accounts can never be operators |
| ATLAS_AUTH_SECRET | Recommended secret pepper for stored sign-in code hashes |
| RESEND_API_KEY, ATLAS_AUTH_EMAIL_FROM | Email-code sign-in through Resend; the sender domain must be verified in Resend |
| ESKIZ_EMAIL, ESKIZ_PASSWORD | Phone sign-in through Eskiz.uz SMS (+998 numbers only). Optional: ESKIZ_FROM (default `4546`), ATLAS_SMS_TEMPLATE with `{code}`; Eskiz must approve the message text |
| TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME | Telegram Login Widget. Create the bot with @BotFather and set its domain to the public site with `/setdomain` |
| GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET | Google sign-in (OAuth web client). Authorized redirect URI: `https://<site>/api/auth/google/callback` |
| ATLAS_AUTH_DEV_CODES | Local only: `true` shows sign-in codes on screen for loopback requests of a built Worker. Never set it on a hosted site |

Each sign-in method is offered only when its settings are present. Worker runtime reads env from cloudflare:workers, not process.env. Do not commit secret values. BUCKET stores private passport scans; local development uses Wrangler's local R2 state.

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

## GitLab Ultimate mirror and CI

`.gitlab-ci.yml` is prepared to run Atlas lint, domain/security tests and the production build on Node 22. It also includes GitLab-managed dependency scanning v2, SAST (with Advanced SAST enabled when the project license supports it) and secret detection. These scans report findings in GitLab; they do not deploy the Sites app or connect to D1.

The existing GitHub repository remains the source of truth so GitHub-based tools such as Jules keep working. In the GitLab project, configure a one-way pull mirror from `https://github.com/iskhakovzak/atlas.git` under Settings > Repository > Mirroring repositories. Choose Pull, and enable pipeline triggers for mirror updates only when the upstream is trusted. Do not push commits to the downstream mirror or enable bidirectional mirroring.

After the first sync, validate `.gitlab-ci.yml` in the GitLab Pipeline Editor, run a pipeline, and confirm the quality and security jobs complete. A first historic secret scan is a separate one-time operation; do not keep historic scanning enabled on every pipeline. Keep production credentials out of this verification pipeline. The GitLab project and account must be connected before the mirror or pipeline can be inspected from Codex.

## New agent reading order

1. AGENTS.md
2. PROJECT_CONTEXT.md
3. ARCHITECTURE.md
4. TODO.md
5. Relevant source and tests
