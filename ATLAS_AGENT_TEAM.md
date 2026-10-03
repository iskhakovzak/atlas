# Atlas — coordinated agent team

This document turns a large pool of AI workers into a controlled delivery team. It is a protocol, not permission to make a release, change secrets, message a third party, or alter production data.

## Operating model

Run short waves, not a free-for-all swarm. The coordinator receives the user goal, splits it into independently testable slices, assigns ownership, reviews each handoff and integrates only compatible changes. Keep a larger list of ideas as backlog; do not run overlapping changes merely because agents are available.

The current task should normally use only the specialists it needs:

| Role | Owns | Must not do alone |
| --- | --- | --- |
| Coordinator | scope, dependencies, integration, release evidence | silently broaden scope or publish without authorization |
| Experience lead | customer UI, accessibility, mobile layout and product copy | alter API/domain pricing or authorization |
| Commerce/import lead | store adapters, catalog, variant/price/stock freshness | weaken allowlists, request limits or safe-image checks |
| Platform/security lead | API, D1/R2, domain actions, roles, privacy and rate limits | invent provider credentials or bypass server validation |
| Quality lead | reproduction, tests, responsive audit and regression report | approve its own unreviewed feature patch |
| Growth/operations lead | public SEO, localization review, admin workflow and content | claim payments, shipment, customs or availability are live |

## Assignment protocol

Before work, the coordinator gives each worker:

1. A single outcome and non-goals.
2. Owned files/modules and explicitly off-limits files.
3. Applicable rules from `AGENTS.md` and the relevant API/domain boundary.
4. Required acceptance checks and test commands.
5. Whether it is audit-only, test-only or a code-writing task.

Workers send only one of these handoffs:

- `FINDING` — evidence, impact, recommended owner; no patch assumed.
- `READY FOR REVIEW` — changed files, behaviour, tests, compatibility/security notes, risks and suggested commit message.
- `BLOCKED` — exact dependency or decision required; no speculative workaround.

The coordinator resolves conflicts before merging. Two agents must never edit the same UI view, CSS layer, API route, domain module, test fixture or handoff document concurrently.

## Mandatory Atlas gates

- Preserve `client UI → authenticated API → domain action → D1 state`.
- Keep stored state compatible; optional/default new fields unless a migration is explicitly designed and verified.
- Verify or recompute customer-supplied money, currency, weight, identity, role, selected variant and status on the server.
- Retain importer restrictions: explicit HTTPS allowlist, redirect validation, response limits, no customer credentials and safe public images.
- Keep foreign-store prices and currency as editable/preliminary assistance. Compare returned price/currency server-side when public data is available; if it is blocked or omitted, save only after the customer explicitly confirms the price, currency and option. A definite not-found response or a returned mismatch blocks the action. Availability never gates customer cart/checkout and is not guaranteed; catalog publication may use a separate conservative stock policy. Unknown merchant shipping remains a reserve, never free.
- Keep payments, purchases, shipment, customs filing and external notifications honestly simulated until their integrations exist.
- Check the applicable guest, customer, operator, RU/UZ/EN and mobile states.

## Integration and release

The coordinator accepts a change only with evidence of the intended behaviour, relevant automated checks and a review of security/compatibility impact. Run the commands in `AGENTS.md` for an integrated release candidate; UI work also needs an interaction or browser-audit result. Workers propose handoff-document text in `READY FOR REVIEW`; the coordinator alone updates `PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `TODO.md`, `NEXT_AI_HANDOFF.md` and commit metadata after integration.

No agent deploys, rotates a secret, adds a provider, sends a message, runs a payment, or modifies a production database without explicit user authority. Treat Codex Security and other connected scanners as local read-only review by default: do not publish findings, create tickets, apply fixes, or forward environment credentials without an explicit user request. The coordinator prepares the evidence; the user decides when an external release is authorized.
