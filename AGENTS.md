# Atlas: instructions for the next agent

Before any work, read PROJECT_CONTEXT.md, ARCHITECTURE.md and TODO.md, then inspect the relevant code and tests.

## Rules

- Preserve the current flow: client UI → authenticated API → domain action → D1 state.
- Do not rewrite working modules only for style. Make small, compatible changes.
- Keep old stored orders/carts/accounts compatible. New state fields must remain optional in Zod schemas unless a migration exists.
- Never delete a product feature without an explicit product decision.
- Server code must validate/recompute customer-supplied USD conversion, weight, account identity, role and state.
- Keep importer security: explicit store allowlist; HTTPS only; no credentials/ports; redirect validation; timeout/body limits; safe images.
- Keep writes scoped to authenticated identity and same-origin requests. Only ATLAS_OPERATOR_EMAIL grants operator access.
- Do not present demo FX/tariffs/customs content as live commercial quotes.
- Payments, purchase and delivery are simulated. Never imply a card charge or real shipment exists.

## Product invariants

- Import is editable assistance; it never guarantees stock, price, shipping or customs clearance.
- Quote lines stay separate: item, service, buyout, conversion, merchant shipping, international shipping, delivery margin, international reserve and optional services. Preserve older optional fee fields with zero/default values.
- International shipping weight is boxed weight + 0.3 kg packaging + 0.2 kg safety allowance, applied once.
- International freight has a 1 kg minimum per merchant parcel. Cart lines from the same source host and dispatch country share one parcel allowance; the server recomputes and allocates that parcel quote across the lines.
- Unknown merchant shipping gets an editable $10 reserve; it is never silently free shipping.
- Manager-confirmed merchant shipping below reserve credits balance; higher amount requires customer approval.
- Warehouse actual/dimensional settlement also refunds or requests approval.
- Warehouse service offers are server-owned in the versioned pricing settings; new cart/order service fields remain optional so old state still parses. Checkout selections are requests, not consent to a future charge or work. Snapshot the configured terms, require operator feasibility/price confirmation and the customer's explicit exact-price approval before any simulated completion, or record an operator unavailable reason; block weighing while requests remain unresolved.
- Do not present warehouse-service rates or the completion flag as live commercial prices or physical fulfilment. Keep insurance disabled until insurer, coverage, exclusions and claims handling are verified; do not enable it through ordinary admin pricing edits.
- Checkout requires customs consent.
- Zara adapter must retain selected colour, available sizes, price, photo and RON support.

## Completion

- Update these handoff documents after meaningful product, architecture, API, persistence, environment or deployment changes.
- Add new known issues to TODO.md.
- Run:

~~~
npm run lint
node --experimental-strip-types --test tests/*.test.mjs
npm run build
~~~

- State any verification that could not be run.
- Never commit local runtime folders, credentials, cookies, build output or D1 state.

## Coordinated work

- For a multi-agent objective, read `ATLAS_AGENT_TEAM.md` before delegating. Use one writer per file family, require a structured handoff, and let the coordinator alone integrate or publish.
