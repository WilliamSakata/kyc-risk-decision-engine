# KYC Risk Decision Engine — Design

Date: 2026-09-23
Status: Approved

## Goal

A service that receives a customer, calls an external risk-verification
check, and decides whether to approve, deny, or send the customer to
manual review, based on composable risk rules. The project's purpose is
to demonstrate hexagonal architecture with a domain core that has zero
infrastructure dependencies, developed test-first.

## Scope

In scope:

- Domain: composable risk rules, a decision engine that aggregates rule
  votes by severity, and the value objects/entities the rules operate on.
- Application: one use case (`EvaluateRiskCheck`) orchestrating the ports.
- Inbound adapter: a single HTTP endpoint (`POST /risk-checks`).
- Outbound adapters: an HTTP adapter for the external risk-verification
  check (calling a real mock server over the network), and an in-memory
  adapter for customer history.
- A standalone mock risk-verification server, run alongside the app via
  Docker Compose.
- Unit tests (domain + application, no I/O) and one thin HTTP integration
  test that exercises the real wiring end to end.

Out of scope:

- Persistence beyond the in-memory history adapter (no real database).
- A manual-review resolution workflow (a human acting on a pending
  `MANUAL_REVIEW` case later). The decision is returned synchronously and
  that is the end of this service's responsibility for that case.
- Kubernetes manifests — a `Dockerfile` and `docker-compose.yml` are
  enough per the project's PRD.

## Architecture

Single TypeScript package, hexagonal architecture expressed as folders
(no monorepo/workspaces — the domain is small enough that folder-level
separation plus a lint rule is sufficient):

```
kyc-risk-decision-engine/
  src/
    domain/
      value-objects/
        Decision.ts               # { outcome, reasons }
        RiskVerificationResult.ts # { score, sanctionsListHit }
        CustomerHistory.ts        # { wasEverDenied, priorCheckCount }
      rules/
        RiskRule.ts                # interface: evaluate(ctx) -> RuleVote
        ScoreThresholdRule.ts
        PriorDenialRule.ts
        SanctionsListRule.ts
      services/
        RiskDecisionEngine.ts      # aggregates RuleVote[] into a Decision
    application/
      ports/
        RiskVerificationPort.ts    # verify(customer): Promise<RiskVerificationResult>
        CustomerHistoryPort.ts     # getHistory / recordDecision
      use-cases/
        EvaluateRiskCheck.ts
      dtos/
        EvaluateRiskCheckInput.ts
        EvaluateRiskCheckOutput.ts
    adapters/
      inbound/http/
        app.ts                     # Express app factory (for tests)
        riskCheckRouter.ts
      outbound/risk-verification/
        HttpRiskVerificationAdapter.ts
      outbound/history/
        InMemoryCustomerHistoryRepository.ts
    config/
      env.ts
    main.ts                        # composition root: wires adapters, starts server
  mock-risk-verification-server/
    server.ts                      # tiny Express app simulating the external check
  tests/
    unit/                          # mirrors domain/ and application/
    integration/                   # supertest against the real app + real HTTP adapter
  docker-compose.yml
  Dockerfile
  package.json
  tsconfig.json
  vitest.config.ts
  .eslintrc / eslint config with eslint-plugin-boundaries
```

`eslint-plugin-boundaries` enforces that `domain/` never imports from
`application/` or `adapters/`, and `application/` never imports from
`adapters/` — only the composition root (`main.ts`) is allowed to wire
concrete adapters to ports.

## Domain model

- **`RuleVote`** — `{ outcome: 'APPROVE' | 'DENY' | 'MANUAL_REVIEW', reason: string }`.
  A rule with nothing to flag votes `APPROVE` (the weakest outcome), so it
  never influences the final decision unless every rule agrees.
- **`RiskRule`** — interface: `evaluate(context: RiskEvaluationContext): RuleVote`.
- **`RiskEvaluationContext`** — the input every rule evaluates against:
  `{ verification: RiskVerificationResult, history: CustomerHistory }`.
- Concrete rules:
  - `ScoreThresholdRule` — score ≥ 80 → `APPROVE`; score ≤ 20 → `DENY`;
    otherwise → `MANUAL_REVIEW`.
  - `PriorDenialRule` — `history.wasEverDenied === true` → `MANUAL_REVIEW`;
    otherwise → `APPROVE` (neutral).
  - `SanctionsListRule` — `verification.sanctionsListHit === true` →
    `DENY`; otherwise → `APPROVE` (neutral).
- **`RiskDecisionEngine`** (domain service) — runs every rule against the
  context, picks the most severe outcome across all votes
  (`DENY` > `MANUAL_REVIEW` > `APPROVE`), and builds the final `Decision`
  with only the `reasons` from votes that match that winning severity
  (routine "nothing to flag" reasons from neutral votes are not surfaced).
- **`Decision`** (value object) — `{ outcome, reasons: string[] }`.

Rules are added by implementing `RiskRule` and registering the instance
in the `RiskDecisionEngine`'s rule list at the composition root — no
change to the engine itself is needed to add a rule.

## Ports and adapters

- **`RiskVerificationPort`** — `verify(customer: { customerId, customerName, country }): Promise<RiskVerificationResult>`.
  Implemented by `HttpRiskVerificationAdapter`, which makes a real HTTP
  call (via `fetch`) to the standalone mock server. This is a genuine
  network boundary — timeouts and connection errors are real, not
  simulated in-process.
- **`CustomerHistoryPort`** — `getHistory(customerId): Promise<CustomerHistory>`
  and `recordDecision(customerId, decision: Decision): Promise<void>`.
  Implemented by `InMemoryCustomerHistoryRepository`, which acts as the
  project's only "database". Recording each decision closes a
  demonstrable loop: evaluating the same customer twice, after a first
  `DENY`, causes `PriorDenialRule` to fire on the second call.
- **Inbound HTTP adapter** — `riskCheckRouter` exposes `POST /risk-checks`,
  validates the body with `zod`, calls `EvaluateRiskCheck`, and maps the
  `Decision` to an HTTP response. It contains no business logic.

### Infra-failure fallback

If `RiskVerificationPort.verify` throws (timeout, connection refused,
non-2xx from the mock server), `EvaluateRiskCheck` treats this as a
`MANUAL_REVIEW` outcome with reason `"risk verification unavailable"`,
rather than propagating a 5xx to the caller. Rationale: the system must
never *approve* a customer it could not verify, but an infrastructure
failure is not sufficient grounds to hard-deny a legitimate customer
either — routing to manual review is the safe default in both
directions. This behavior is asserted by a dedicated unit test on the
use case (with a port fake that throws) and is the one piece of behavior
that lives in the application layer rather than the domain layer, since
it is about tolerating a port failure, not a business rule.

## API

**`POST /risk-checks`**

Request:

```json
{ "customerId": "cus_123", "customerName": "Jane Doe", "country": "BR" }
```

Response `200`:

```json
{
  "customerId": "cus_123",
  "decision": "MANUAL_REVIEW",
  "reasons": ["score 55 is in the manual review range (21-79)"],
  "riskScore": 55
}
```

Response `400` — invalid payload (zod validation error details).

The client never sends a risk score; the service always fetches it from
`RiskVerificationPort`.

## Testing strategy (TDD)

Written test-first, in this order:

1. **Domain** — each `RiskRule` and `RiskDecisionEngine`, pure unit
   tests, no I/O, table-driven over score/history/verification
   combinations.
2. **Application** — `EvaluateRiskCheck` tested against in-memory fakes
   of both ports (including a fake that throws, for the fallback path).
   Still no real network, no real Express app.
3. **Integration** — one `supertest` suite that boots the real Express
   app wired to the real `HttpRiskVerificationAdapter`, pointed at the
   mock server started for the test run. Proves the composition root
   wires correctly; does not re-test domain rule combinations already
   covered in (1).

Vitest is the test runner across all three levels.

## Local environment

`docker-compose.yml` runs two services: `app` (this service, built from
the `Dockerfile`) and `mock-risk-verification-server` (the standalone
Express app in `mock-risk-verification-server/`). No Kubernetes per the
project's PRD — orchestration is not the point of this project.

## What it demonstrates

- Real DDD: a domain layer (`domain/`) that has zero imports from
  infrastructure, enforced by lint, not just by convention.
- Real TDD: the rules and decision engine are built test-first against
  in-memory fixtures, and the suite's domain/application layers run with
  no database and no network.
- A composable rules engine (strategy pattern) instead of a single
  hardcoded `if` chain — adding a new risk rule doesn't touch existing
  ones.
- A deliberate, explained fallback decision for infra failure — showing
  production judgment, not just happy-path code.
