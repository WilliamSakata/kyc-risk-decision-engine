# KYC Risk Decision Engine

> Status: ✅ implemented

## Goal

A service that receives a customer, queries an external risk-verification API, and decides whether to APPROVE, DENY, or send the customer to MANUAL_REVIEW based on a set of risk rules.

## Features

- Core domain isolated in hexagonal architecture, with no infrastructure dependencies
- Call to a mock external risk-verification API
- Simple rules engine: score + history → approve, deny, or send to manual review

## Stack

TypeScript. Core domain tested via TDD with in-memory fixtures — the suite runs without a database and without network access.

## Kubernetes

Not the focus of this project. A simple Dockerfile with docker-compose is enough; forcing k8s here would add complexity without demonstrating anything new.

## How to run

Locally, without Docker:

```bash
npm install
npm run mock-server   # terminal 1 — mock risk-verification service on port 4001
npm run dev            # terminal 2 — main service on port 3000
```

With Docker Compose:

```bash
docker compose up --build
```

Testing:

```bash
curl -X POST http://localhost:3000/risk-checks \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"cus_demo","customerName":"Jane Doe","country":"BR"}'
```

Running the tests:

```bash
npm test
npm run typecheck
npm run lint
```

### Sample outcomes against the shipped mock server

The mock server (`mock-risk-verification-server/server.ts`) derives a deterministic score from a hash of `customerId` (score ≥ 80 approves, ≤ 20 denies, otherwise manual review), and always flags `cus_sanctioned` as a sanctions hit regardless of score. Use these sample ids to exercise all three outcomes:

| `customerId`     | Score | Sanctions hit | Outcome         |
| ---------------- | ----- | -------------- | --------------- |
| `cus_clean`       | 91    | no             | `APPROVE`       |
| `cus_demo`        | 77    | no             | `MANUAL_REVIEW` |
| `cus_sanctioned`  | 40    | yes            | `DENY` (sanctions override, regardless of score) |
