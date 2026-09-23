# KYC Risk Decision Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hexagonal-architecture TypeScript service that evaluates a customer against composable risk rules (score threshold, prior denial, sanctions list) and returns APPROVE, DENY, or MANUAL_REVIEW, with a domain core that has zero infrastructure dependencies and is developed test-first.

**Architecture:** Single-package hexagonal architecture (`domain/` → `application/` → `adapters/`), with `eslint-plugin-boundaries` enforcing that inner layers never import outer ones. Persistence is in-memory only; the external risk check is a real HTTP call to a standalone mock server, run alongside the app via Docker Compose.

**Tech Stack:** Node.js 22, TypeScript (strict, CommonJS), Express, Zod, Vitest, Supertest, `tsx` (dev/prod runner, no build step), ESLint + `eslint-plugin-boundaries`.

**Spec:** `docs/superpowers/specs/2026-09-23-kyc-risk-decision-engine-design.md`

## Global Constraints

- TypeScript `strict: true`. `domain/` and `application/` must never import from `adapters/` — enforced by `eslint-plugin-boundaries`, not just convention.
- Persistence is in-memory only (`InMemoryCustomerHistoryRepository`) — no Postgres, no external database. This was explicitly decided to keep this project as the portfolio's only "no heavy infra" project.
- No Kubernetes manifests — only `Dockerfile` and `docker-compose.yml`.
- Vitest is the test runner for all three test levels (domain unit, application/adapter unit, integration).
- The external risk-verification call is a real network call (Node's global `fetch`) against a real HTTP server in every test that exercises it — never an in-process stub standing in for the HTTP boundary itself.
- Package manager: npm.

---

### Task 1: Project scaffold, tooling, and domain types

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.eslintrc.cjs`
- Create: `src/domain/value-objects/Decision.ts`
- Create: `src/domain/value-objects/RiskVerificationResult.ts`
- Create: `src/domain/value-objects/CustomerHistory.ts`
- Create: `src/domain/rules/RiskRule.ts`

**Interfaces:**
- Produces:
  - `DecisionOutcome = 'APPROVE' | 'DENY' | 'MANUAL_REVIEW'`
  - `Decision { outcome: DecisionOutcome; reasons: string[] }`
  - `RiskVerificationResult { score: number; sanctionsListHit: boolean }`
  - `CustomerHistory { wasEverDenied: boolean; priorCheckCount: number }`
  - `RiskEvaluationContext { verification: RiskVerificationResult; history: CustomerHistory }`
  - `RuleVote { outcome: DecisionOutcome; reason: string }`
  - `RiskRule { evaluate(context: RiskEvaluationContext): RuleVote }`

This task has no behavior to test (pure types and config), so it is verified by type-checking and linting instead of Vitest.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "kyc-risk-decision-engine",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "dev": "tsx src/main.ts",
    "mock-server": "tsx mock-risk-verification-server/server.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts"
  },
  "dependencies": {
    "express": "^4.19.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.5.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^7.16.0",
    "@typescript-eslint/parser": "^7.16.0",
    "eslint": "^8.57.0",
    "eslint-plugin-boundaries": "^4.2.2",
    "supertest": "^7.0.0",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "mock-risk-verification-server", "tests"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `.eslintrc.cjs`**

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'boundaries'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    node: true,
    es2022: true,
  },
  settings: {
    'boundaries/elements': [
      { type: 'domain', pattern: 'src/domain/**' },
      { type: 'application', pattern: 'src/application/**' },
      { type: 'adapters', pattern: 'src/adapters/**' },
      { type: 'config', pattern: 'src/config/**' },
      { type: 'main', pattern: 'src/main.ts' },
    ],
  },
  rules: {
    'boundaries/element-types': [
      2,
      {
        default: 'disallow',
        rules: [
          { from: 'domain', allow: ['domain'] },
          { from: 'application', allow: ['domain', 'application'] },
          { from: 'adapters', allow: ['domain', 'application', 'adapters', 'config'] },
          { from: 'config', allow: ['config'] },
          { from: 'main', allow: ['domain', 'application', 'adapters', 'config'] },
        ],
      },
    ],
  },
};
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `package-lock.json` and `node_modules/`.

- [ ] **Step 6: Create the `Decision` value object**

`src/domain/value-objects/Decision.ts`:

```ts
export type DecisionOutcome = 'APPROVE' | 'DENY' | 'MANUAL_REVIEW';

export interface Decision {
  outcome: DecisionOutcome;
  reasons: string[];
}
```

- [ ] **Step 7: Create the `RiskVerificationResult` value object**

`src/domain/value-objects/RiskVerificationResult.ts`:

```ts
export interface RiskVerificationResult {
  score: number;
  sanctionsListHit: boolean;
}
```

- [ ] **Step 8: Create the `CustomerHistory` value object**

`src/domain/value-objects/CustomerHistory.ts`:

```ts
export interface CustomerHistory {
  wasEverDenied: boolean;
  priorCheckCount: number;
}
```

- [ ] **Step 9: Create the `RiskRule` interface**

`src/domain/rules/RiskRule.ts`:

```ts
import { RiskVerificationResult } from '../value-objects/RiskVerificationResult';
import { CustomerHistory } from '../value-objects/CustomerHistory';
import { DecisionOutcome } from '../value-objects/Decision';

export interface RiskEvaluationContext {
  verification: RiskVerificationResult;
  history: CustomerHistory;
}

export interface RuleVote {
  outcome: DecisionOutcome;
  reason: string;
}

export interface RiskRule {
  evaluate(context: RiskEvaluationContext): RuleVote;
}
```

- [ ] **Step 10: Verify tooling**

Run: `npm run typecheck`
Expected: exits 0, no errors.

Run: `npm run lint`
Expected: exits 0, no errors (no `.ts` files under `adapters/` or `application/` exist yet, so the boundaries rule has nothing to flag).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .eslintrc.cjs src/
git commit -m "chore: scaffold tooling and domain value objects"
```

---

### Task 2: `ScoreThresholdRule` (TDD)

**Files:**
- Create: `src/domain/rules/ScoreThresholdRule.ts`
- Test: `tests/unit/domain/rules/ScoreThresholdRule.test.ts`

**Interfaces:**
- Consumes: `RiskRule`, `RiskEvaluationContext`, `RuleVote` from `src/domain/rules/RiskRule.ts` (Task 1)
- Produces: `ScoreThresholdRule` class implementing `RiskRule`

- [ ] **Step 1: Write the failing test**

`tests/unit/domain/rules/ScoreThresholdRule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ScoreThresholdRule } from '../../../../src/domain/rules/ScoreThresholdRule';
import { RiskEvaluationContext } from '../../../../src/domain/rules/RiskRule';

function contextWithScore(score: number): RiskEvaluationContext {
  return {
    verification: { score, sanctionsListHit: false },
    history: { wasEverDenied: false, priorCheckCount: 0 },
  };
}

describe('ScoreThresholdRule', () => {
  const rule = new ScoreThresholdRule();

  it('votes APPROVE when score is at or above 80', () => {
    expect(rule.evaluate(contextWithScore(80)).outcome).toBe('APPROVE');
    expect(rule.evaluate(contextWithScore(100)).outcome).toBe('APPROVE');
  });

  it('votes DENY when score is at or below 20', () => {
    expect(rule.evaluate(contextWithScore(20)).outcome).toBe('DENY');
    expect(rule.evaluate(contextWithScore(0)).outcome).toBe('DENY');
  });

  it('votes MANUAL_REVIEW when score is between 21 and 79', () => {
    expect(rule.evaluate(contextWithScore(21)).outcome).toBe('MANUAL_REVIEW');
    expect(rule.evaluate(contextWithScore(79)).outcome).toBe('MANUAL_REVIEW');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/domain/rules/ScoreThresholdRule.test.ts`
Expected: FAIL — cannot find module `../../../../src/domain/rules/ScoreThresholdRule`.

- [ ] **Step 3: Implement `ScoreThresholdRule`**

`src/domain/rules/ScoreThresholdRule.ts`:

```ts
import { RiskRule, RiskEvaluationContext, RuleVote } from './RiskRule';

export class ScoreThresholdRule implements RiskRule {
  evaluate(context: RiskEvaluationContext): RuleVote {
    const { score } = context.verification;

    if (score >= 80) {
      return { outcome: 'APPROVE', reason: `score ${score} is at or above the approval threshold (80)` };
    }

    if (score <= 20) {
      return { outcome: 'DENY', reason: `score ${score} is at or below the denial threshold (20)` };
    }

    return { outcome: 'MANUAL_REVIEW', reason: `score ${score} is in the manual review range (21-79)` };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/domain/rules/ScoreThresholdRule.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/rules/ScoreThresholdRule.ts tests/unit/domain/rules/ScoreThresholdRule.test.ts
git commit -m "feat: add ScoreThresholdRule"
```

---

### Task 3: `PriorDenialRule` (TDD)

**Files:**
- Create: `src/domain/rules/PriorDenialRule.ts`
- Test: `tests/unit/domain/rules/PriorDenialRule.test.ts`

**Interfaces:**
- Consumes: `RiskRule`, `RiskEvaluationContext`, `RuleVote` from `src/domain/rules/RiskRule.ts` (Task 1)
- Produces: `PriorDenialRule` class implementing `RiskRule`

- [ ] **Step 1: Write the failing test**

`tests/unit/domain/rules/PriorDenialRule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PriorDenialRule } from '../../../../src/domain/rules/PriorDenialRule';
import { RiskEvaluationContext } from '../../../../src/domain/rules/RiskRule';

function contextWithHistory(wasEverDenied: boolean): RiskEvaluationContext {
  return {
    verification: { score: 50, sanctionsListHit: false },
    history: { wasEverDenied, priorCheckCount: 1 },
  };
}

describe('PriorDenialRule', () => {
  const rule = new PriorDenialRule();

  it('votes MANUAL_REVIEW when the customer has a prior denial', () => {
    expect(rule.evaluate(contextWithHistory(true)).outcome).toBe('MANUAL_REVIEW');
  });

  it('votes APPROVE when the customer has no prior denial', () => {
    expect(rule.evaluate(contextWithHistory(false)).outcome).toBe('APPROVE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/domain/rules/PriorDenialRule.test.ts`
Expected: FAIL — cannot find module `../../../../src/domain/rules/PriorDenialRule`.

- [ ] **Step 3: Implement `PriorDenialRule`**

`src/domain/rules/PriorDenialRule.ts`:

```ts
import { RiskRule, RiskEvaluationContext, RuleVote } from './RiskRule';

export class PriorDenialRule implements RiskRule {
  evaluate(context: RiskEvaluationContext): RuleVote {
    if (context.history.wasEverDenied) {
      return { outcome: 'MANUAL_REVIEW', reason: 'customer has a prior denial on record' };
    }

    return { outcome: 'APPROVE', reason: 'no prior denial on record' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/domain/rules/PriorDenialRule.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/rules/PriorDenialRule.ts tests/unit/domain/rules/PriorDenialRule.test.ts
git commit -m "feat: add PriorDenialRule"
```

---

### Task 4: `SanctionsListRule` (TDD)

**Files:**
- Create: `src/domain/rules/SanctionsListRule.ts`
- Test: `tests/unit/domain/rules/SanctionsListRule.test.ts`

**Interfaces:**
- Consumes: `RiskRule`, `RiskEvaluationContext`, `RuleVote` from `src/domain/rules/RiskRule.ts` (Task 1)
- Produces: `SanctionsListRule` class implementing `RiskRule`

- [ ] **Step 1: Write the failing test**

`tests/unit/domain/rules/SanctionsListRule.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SanctionsListRule } from '../../../../src/domain/rules/SanctionsListRule';
import { RiskEvaluationContext } from '../../../../src/domain/rules/RiskRule';

function contextWithSanctionsHit(sanctionsListHit: boolean): RiskEvaluationContext {
  return {
    verification: { score: 90, sanctionsListHit },
    history: { wasEverDenied: false, priorCheckCount: 0 },
  };
}

describe('SanctionsListRule', () => {
  const rule = new SanctionsListRule();

  it('votes DENY when the customer matches the sanctions list, regardless of score', () => {
    expect(rule.evaluate(contextWithSanctionsHit(true)).outcome).toBe('DENY');
  });

  it('votes APPROVE when there is no sanctions list match', () => {
    expect(rule.evaluate(contextWithSanctionsHit(false)).outcome).toBe('APPROVE');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/domain/rules/SanctionsListRule.test.ts`
Expected: FAIL — cannot find module `../../../../src/domain/rules/SanctionsListRule`.

- [ ] **Step 3: Implement `SanctionsListRule`**

`src/domain/rules/SanctionsListRule.ts`:

```ts
import { RiskRule, RiskEvaluationContext, RuleVote } from './RiskRule';

export class SanctionsListRule implements RiskRule {
  evaluate(context: RiskEvaluationContext): RuleVote {
    if (context.verification.sanctionsListHit) {
      return { outcome: 'DENY', reason: 'customer matched a sanctions list entry' };
    }

    return { outcome: 'APPROVE', reason: 'no sanctions list match' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/domain/rules/SanctionsListRule.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/rules/SanctionsListRule.ts tests/unit/domain/rules/SanctionsListRule.test.ts
git commit -m "feat: add SanctionsListRule"
```

---

### Task 5: `RiskDecisionEngine` (TDD)

**Files:**
- Create: `src/domain/services/RiskDecisionEngine.ts`
- Test: `tests/unit/domain/services/RiskDecisionEngine.test.ts`

**Interfaces:**
- Consumes: `RiskRule`, `RiskEvaluationContext`, `RuleVote` from `src/domain/rules/RiskRule.ts`; `Decision`, `DecisionOutcome` from `src/domain/value-objects/Decision.ts`
- Produces: `RiskDecisionEngine` class with constructor `(rules: RiskRule[])` and method `decide(context: RiskEvaluationContext): Decision`

- [ ] **Step 1: Write the failing test**

`tests/unit/domain/services/RiskDecisionEngine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { RiskDecisionEngine } from '../../../../src/domain/services/RiskDecisionEngine';
import { RiskRule, RiskEvaluationContext, RuleVote } from '../../../../src/domain/rules/RiskRule';

class FixedVoteRule implements RiskRule {
  constructor(private readonly vote: RuleVote) {}

  evaluate(): RuleVote {
    return this.vote;
  }
}

const context: RiskEvaluationContext = {
  verification: { score: 50, sanctionsListHit: false },
  history: { wasEverDenied: false, priorCheckCount: 0 },
};

describe('RiskDecisionEngine', () => {
  it('returns APPROVE when every rule votes APPROVE', () => {
    const engine = new RiskDecisionEngine([
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'a' }),
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'b' }),
    ]);

    const decision = engine.decide(context);

    expect(decision.outcome).toBe('APPROVE');
    expect(decision.reasons).toEqual(['a', 'b']);
  });

  it('lets DENY win over APPROVE and MANUAL_REVIEW', () => {
    const engine = new RiskDecisionEngine([
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'a' }),
      new FixedVoteRule({ outcome: 'MANUAL_REVIEW', reason: 'b' }),
      new FixedVoteRule({ outcome: 'DENY', reason: 'c' }),
    ]);

    const decision = engine.decide(context);

    expect(decision.outcome).toBe('DENY');
    expect(decision.reasons).toEqual(['c']);
  });

  it('lets MANUAL_REVIEW win over APPROVE when no DENY vote exists', () => {
    const engine = new RiskDecisionEngine([
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'a' }),
      new FixedVoteRule({ outcome: 'MANUAL_REVIEW', reason: 'b' }),
    ]);

    const decision = engine.decide(context);

    expect(decision.outcome).toBe('MANUAL_REVIEW');
    expect(decision.reasons).toEqual(['b']);
  });

  it('only surfaces reasons from votes matching the winning severity', () => {
    const engine = new RiskDecisionEngine([
      new FixedVoteRule({ outcome: 'APPROVE', reason: 'neutral' }),
      new FixedVoteRule({ outcome: 'DENY', reason: 'flagged' }),
      new FixedVoteRule({ outcome: 'DENY', reason: 'also flagged' }),
    ]);

    const decision = engine.decide(context);

    expect(decision.reasons).toEqual(['flagged', 'also flagged']);
  });

  it('returns APPROVE with no reasons when there are no rules', () => {
    const engine = new RiskDecisionEngine([]);

    expect(engine.decide(context)).toEqual({ outcome: 'APPROVE', reasons: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/domain/services/RiskDecisionEngine.test.ts`
Expected: FAIL — cannot find module `../../../../src/domain/services/RiskDecisionEngine`.

- [ ] **Step 3: Implement `RiskDecisionEngine`**

`src/domain/services/RiskDecisionEngine.ts`:

```ts
import { RiskRule, RiskEvaluationContext, RuleVote } from '../rules/RiskRule';
import { Decision, DecisionOutcome } from '../value-objects/Decision';

const SEVERITY: Record<DecisionOutcome, number> = {
  APPROVE: 0,
  MANUAL_REVIEW: 1,
  DENY: 2,
};

export class RiskDecisionEngine {
  constructor(private readonly rules: RiskRule[]) {}

  decide(context: RiskEvaluationContext): Decision {
    const votes: RuleVote[] = this.rules.map((rule) => rule.evaluate(context));

    const winningOutcome = votes.reduce<DecisionOutcome>(
      (mostSevere, vote) => (SEVERITY[vote.outcome] > SEVERITY[mostSevere] ? vote.outcome : mostSevere),
      'APPROVE',
    );

    const reasons = votes.filter((vote) => vote.outcome === winningOutcome).map((vote) => vote.reason);

    return { outcome: winningOutcome, reasons };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/domain/services/RiskDecisionEngine.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/RiskDecisionEngine.ts tests/unit/domain/services/RiskDecisionEngine.test.ts
git commit -m "feat: add RiskDecisionEngine"
```

---

### Task 6: Application ports and DTOs

**Files:**
- Create: `src/application/ports/RiskVerificationPort.ts`
- Create: `src/application/ports/CustomerHistoryPort.ts`
- Create: `src/application/dtos/EvaluateRiskCheckInput.ts`
- Create: `src/application/dtos/EvaluateRiskCheckOutput.ts`

**Interfaces:**
- Consumes: `RiskVerificationResult` from `src/domain/value-objects/RiskVerificationResult.ts`; `CustomerHistory` from `src/domain/value-objects/CustomerHistory.ts`; `Decision`, `DecisionOutcome` from `src/domain/value-objects/Decision.ts`
- Produces:
  - `RiskVerificationSubject { customerId: string; customerName: string; country: string }`
  - `RiskVerificationPort { verify(customer: RiskVerificationSubject): Promise<RiskVerificationResult> }`
  - `CustomerHistoryPort { getHistory(customerId: string): Promise<CustomerHistory>; recordDecision(customerId: string, decision: Decision): Promise<void> }`
  - `EvaluateRiskCheckInput { customerId: string; customerName: string; country: string }`
  - `EvaluateRiskCheckOutput { customerId: string; decision: DecisionOutcome; reasons: string[]; riskScore: number | null }`

No behavior to test in this task (pure types); verified via type-check and lint.

- [ ] **Step 1: Create `RiskVerificationPort`**

`src/application/ports/RiskVerificationPort.ts`:

```ts
import { RiskVerificationResult } from '../../domain/value-objects/RiskVerificationResult';

export interface RiskVerificationSubject {
  customerId: string;
  customerName: string;
  country: string;
}

export interface RiskVerificationPort {
  verify(customer: RiskVerificationSubject): Promise<RiskVerificationResult>;
}
```

- [ ] **Step 2: Create `CustomerHistoryPort`**

`src/application/ports/CustomerHistoryPort.ts`:

```ts
import { CustomerHistory } from '../../domain/value-objects/CustomerHistory';
import { Decision } from '../../domain/value-objects/Decision';

export interface CustomerHistoryPort {
  getHistory(customerId: string): Promise<CustomerHistory>;
  recordDecision(customerId: string, decision: Decision): Promise<void>;
}
```

- [ ] **Step 3: Create the input DTO**

`src/application/dtos/EvaluateRiskCheckInput.ts`:

```ts
export interface EvaluateRiskCheckInput {
  customerId: string;
  customerName: string;
  country: string;
}
```

- [ ] **Step 4: Create the output DTO**

`src/application/dtos/EvaluateRiskCheckOutput.ts`:

```ts
import { DecisionOutcome } from '../../domain/value-objects/Decision';

export interface EvaluateRiskCheckOutput {
  customerId: string;
  decision: DecisionOutcome;
  reasons: string[];
  riskScore: number | null;
}
```

- [ ] **Step 5: Verify tooling**

Run: `npm run typecheck && npm run lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/application/
git commit -m "feat: add application ports and DTOs"
```

---

### Task 7: `EvaluateRiskCheck` use case (TDD, with shared port fakes)

**Files:**
- Create: `tests/fakes/FakeRiskVerificationPort.ts`
- Create: `tests/fakes/FakeCustomerHistoryPort.ts`
- Create: `src/application/use-cases/EvaluateRiskCheck.ts`
- Test: `tests/unit/application/EvaluateRiskCheck.test.ts`

**Interfaces:**
- Consumes: `RiskVerificationPort`, `RiskVerificationSubject` (Task 6); `CustomerHistoryPort` (Task 6); `EvaluateRiskCheckInput`, `EvaluateRiskCheckOutput` (Task 6); `RiskDecisionEngine` (Task 5); `Decision` (Task 1)
- Produces:
  - `FakeRiskVerificationPort` (test double), constructor `(result: RiskVerificationResult | Error)`
  - `FakeCustomerHistoryPort` (test double), constructor `(history: CustomerHistory)`, public `recorded: { customerId: string; decision: Decision }[]`
  - `EvaluateRiskCheck` class, constructor `(riskVerification: RiskVerificationPort, customerHistory: CustomerHistoryPort, decisionEngine: RiskDecisionEngine)`, method `execute(input: EvaluateRiskCheckInput): Promise<EvaluateRiskCheckOutput>`

These fakes are reused by Task 10 (inbound HTTP adapter tests) and Task 13 does not use them (it uses real adapters).

- [ ] **Step 1: Create the shared port fakes**

`tests/fakes/FakeRiskVerificationPort.ts`:

```ts
import { RiskVerificationPort, RiskVerificationSubject } from '../../src/application/ports/RiskVerificationPort';
import { RiskVerificationResult } from '../../src/domain/value-objects/RiskVerificationResult';

export class FakeRiskVerificationPort implements RiskVerificationPort {
  constructor(private readonly result: RiskVerificationResult | Error) {}

  async verify(_customer: RiskVerificationSubject): Promise<RiskVerificationResult> {
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}
```

`tests/fakes/FakeCustomerHistoryPort.ts`:

```ts
import { CustomerHistoryPort } from '../../src/application/ports/CustomerHistoryPort';
import { CustomerHistory } from '../../src/domain/value-objects/CustomerHistory';
import { Decision } from '../../src/domain/value-objects/Decision';

export class FakeCustomerHistoryPort implements CustomerHistoryPort {
  public recorded: { customerId: string; decision: Decision }[] = [];

  constructor(private readonly history: CustomerHistory) {}

  async getHistory(_customerId: string): Promise<CustomerHistory> {
    return this.history;
  }

  async recordDecision(customerId: string, decision: Decision): Promise<void> {
    this.recorded.push({ customerId, decision });
  }
}
```

- [ ] **Step 2: Write the failing test**

`tests/unit/application/EvaluateRiskCheck.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EvaluateRiskCheck } from '../../../src/application/use-cases/EvaluateRiskCheck';
import { RiskDecisionEngine } from '../../../src/domain/services/RiskDecisionEngine';
import { ScoreThresholdRule } from '../../../src/domain/rules/ScoreThresholdRule';
import { PriorDenialRule } from '../../../src/domain/rules/PriorDenialRule';
import { CustomerHistory } from '../../../src/domain/value-objects/CustomerHistory';
import { FakeRiskVerificationPort } from '../../fakes/FakeRiskVerificationPort';
import { FakeCustomerHistoryPort } from '../../fakes/FakeCustomerHistoryPort';

const input = { customerId: 'cus_1', customerName: 'Jane Doe', country: 'BR' };
const noHistory: CustomerHistory = { wasEverDenied: false, priorCheckCount: 0 };

function buildEngine(): RiskDecisionEngine {
  return new RiskDecisionEngine([new ScoreThresholdRule(), new PriorDenialRule()]);
}

describe('EvaluateRiskCheck', () => {
  it('approves a customer with a high score and no history', async () => {
    const verification = new FakeRiskVerificationPort({ score: 90, sanctionsListHit: false });
    const history = new FakeCustomerHistoryPort(noHistory);
    const useCase = new EvaluateRiskCheck(verification, history, buildEngine());

    const result = await useCase.execute(input);

    expect(result.customerId).toBe('cus_1');
    expect(result.decision).toBe('APPROVE');
    expect(result.riskScore).toBe(90);
  });

  it('records the decision in customer history', async () => {
    const verification = new FakeRiskVerificationPort({ score: 90, sanctionsListHit: false });
    const history = new FakeCustomerHistoryPort(noHistory);
    const useCase = new EvaluateRiskCheck(verification, history, buildEngine());

    await useCase.execute(input);

    expect(history.recorded).toHaveLength(1);
    expect(history.recorded[0].customerId).toBe('cus_1');
    expect(history.recorded[0].decision.outcome).toBe('APPROVE');
  });

  it('falls back to MANUAL_REVIEW with a null score when verification fails', async () => {
    const verification = new FakeRiskVerificationPort(new Error('network timeout'));
    const history = new FakeCustomerHistoryPort(noHistory);
    const useCase = new EvaluateRiskCheck(verification, history, buildEngine());

    const result = await useCase.execute(input);

    expect(result.decision).toBe('MANUAL_REVIEW');
    expect(result.reasons).toEqual(['risk verification unavailable']);
    expect(result.riskScore).toBeNull();
  });

  it('still records the fallback decision in customer history', async () => {
    const verification = new FakeRiskVerificationPort(new Error('network timeout'));
    const history = new FakeCustomerHistoryPort(noHistory);
    const useCase = new EvaluateRiskCheck(verification, history, buildEngine());

    await useCase.execute(input);

    expect(history.recorded).toHaveLength(1);
    expect(history.recorded[0].decision.outcome).toBe('MANUAL_REVIEW');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/application/EvaluateRiskCheck.test.ts`
Expected: FAIL — cannot find module `../../../src/application/use-cases/EvaluateRiskCheck`.

- [ ] **Step 4: Implement `EvaluateRiskCheck`**

`src/application/use-cases/EvaluateRiskCheck.ts`:

```ts
import { RiskDecisionEngine } from '../../domain/services/RiskDecisionEngine';
import { Decision } from '../../domain/value-objects/Decision';
import { RiskVerificationPort } from '../ports/RiskVerificationPort';
import { CustomerHistoryPort } from '../ports/CustomerHistoryPort';
import { EvaluateRiskCheckInput } from '../dtos/EvaluateRiskCheckInput';
import { EvaluateRiskCheckOutput } from '../dtos/EvaluateRiskCheckOutput';

export class EvaluateRiskCheck {
  constructor(
    private readonly riskVerification: RiskVerificationPort,
    private readonly customerHistory: CustomerHistoryPort,
    private readonly decisionEngine: RiskDecisionEngine,
  ) {}

  async execute(input: EvaluateRiskCheckInput): Promise<EvaluateRiskCheckOutput> {
    const history = await this.customerHistory.getHistory(input.customerId);

    let decision: Decision;
    let riskScore: number | null;

    try {
      const verification = await this.riskVerification.verify(input);
      decision = this.decisionEngine.decide({ verification, history });
      riskScore = verification.score;
    } catch {
      decision = { outcome: 'MANUAL_REVIEW', reasons: ['risk verification unavailable'] };
      riskScore = null;
    }

    await this.customerHistory.recordDecision(input.customerId, decision);

    return {
      customerId: input.customerId,
      decision: decision.outcome,
      reasons: decision.reasons,
      riskScore,
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/application/EvaluateRiskCheck.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add tests/fakes/ src/application/use-cases/ tests/unit/application/
git commit -m "feat: add EvaluateRiskCheck use case with infra-failure fallback"
```

---

### Task 8: `HttpRiskVerificationAdapter` (TDD, real local HTTP server)

**Files:**
- Create: `src/adapters/outbound/risk-verification/HttpRiskVerificationAdapter.ts`
- Test: `tests/unit/adapters/HttpRiskVerificationAdapter.test.ts`

**Interfaces:**
- Consumes: `RiskVerificationPort`, `RiskVerificationSubject` (Task 6); `RiskVerificationResult` (Task 1)
- Produces: `HttpRiskVerificationAdapter` class, constructor `(baseUrl: string, timeoutMs?: number)`, implements `RiskVerificationPort`

This test starts a real Node `http` server on an OS-assigned port and points the adapter at it — no mocking of `fetch` itself, so the real network boundary is exercised.

- [ ] **Step 1: Write the failing test**

`tests/unit/adapters/HttpRiskVerificationAdapter.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'node:http';
import { HttpRiskVerificationAdapter } from '../../../src/adapters/outbound/risk-verification/HttpRiskVerificationAdapter';

let server: Server;
let baseUrl: string;
let responseBehavior: 'ok' | 'error' | 'hang' = 'ok';

beforeAll(async () => {
  server = createServer((req, res) => {
    if (responseBehavior === 'error') {
      res.writeHead(500).end();
      return;
    }
    if (responseBehavior === 'hang') {
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ score: 73, sanctionsListHit: false }));
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('failed to determine test server address');
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
});

const customer = { customerId: 'cus_1', customerName: 'Jane Doe', country: 'BR' };

describe('HttpRiskVerificationAdapter', () => {
  it('returns the parsed verification result on a 200 response', async () => {
    responseBehavior = 'ok';
    const adapter = new HttpRiskVerificationAdapter(baseUrl);

    const result = await adapter.verify(customer);

    expect(result).toEqual({ score: 73, sanctionsListHit: false });
  });

  it('throws when the server responds with a non-2xx status', async () => {
    responseBehavior = 'error';
    const adapter = new HttpRiskVerificationAdapter(baseUrl);

    await expect(adapter.verify(customer)).rejects.toThrow('status 500');
  });

  it('throws when the server does not respond before the timeout', async () => {
    responseBehavior = 'hang';
    const adapter = new HttpRiskVerificationAdapter(baseUrl, 50);

    await expect(adapter.verify(customer)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/adapters/HttpRiskVerificationAdapter.test.ts`
Expected: FAIL — cannot find module `../../../src/adapters/outbound/risk-verification/HttpRiskVerificationAdapter`.

- [ ] **Step 3: Implement `HttpRiskVerificationAdapter`**

`src/adapters/outbound/risk-verification/HttpRiskVerificationAdapter.ts`:

```ts
import { RiskVerificationPort, RiskVerificationSubject } from '../../../application/ports/RiskVerificationPort';
import { RiskVerificationResult } from '../../../domain/value-objects/RiskVerificationResult';

export class HttpRiskVerificationAdapter implements RiskVerificationPort {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number = 2000,
  ) {}

  async verify(customer: RiskVerificationSubject): Promise<RiskVerificationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/verifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`risk verification service responded with status ${response.status}`);
      }

      const body = (await response.json()) as { score: number; sanctionsListHit: boolean };
      return { score: body.score, sanctionsListHit: body.sanctionsListHit };
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/adapters/HttpRiskVerificationAdapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/outbound/risk-verification/ tests/unit/adapters/HttpRiskVerificationAdapter.test.ts
git commit -m "feat: add HttpRiskVerificationAdapter"
```

---

### Task 9: `InMemoryCustomerHistoryRepository` (TDD)

**Files:**
- Create: `src/adapters/outbound/history/InMemoryCustomerHistoryRepository.ts`
- Test: `tests/unit/adapters/InMemoryCustomerHistoryRepository.test.ts`

**Interfaces:**
- Consumes: `CustomerHistoryPort` (Task 6); `CustomerHistory` (Task 1); `Decision` (Task 1)
- Produces: `InMemoryCustomerHistoryRepository` class implementing `CustomerHistoryPort`

- [ ] **Step 1: Write the failing test**

`tests/unit/adapters/InMemoryCustomerHistoryRepository.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { InMemoryCustomerHistoryRepository } from '../../../src/adapters/outbound/history/InMemoryCustomerHistoryRepository';

describe('InMemoryCustomerHistoryRepository', () => {
  it('returns a blank history for a customer with no records', async () => {
    const repo = new InMemoryCustomerHistoryRepository();

    const history = await repo.getHistory('cus_new');

    expect(history).toEqual({ wasEverDenied: false, priorCheckCount: 0 });
  });

  it('marks wasEverDenied after a DENY decision is recorded', async () => {
    const repo = new InMemoryCustomerHistoryRepository();

    await repo.recordDecision('cus_1', { outcome: 'DENY', reasons: ['x'] });
    const history = await repo.getHistory('cus_1');

    expect(history).toEqual({ wasEverDenied: true, priorCheckCount: 1 });
  });

  it('keeps wasEverDenied true even after a later APPROVE', async () => {
    const repo = new InMemoryCustomerHistoryRepository();

    await repo.recordDecision('cus_1', { outcome: 'DENY', reasons: ['x'] });
    await repo.recordDecision('cus_1', { outcome: 'APPROVE', reasons: [] });
    const history = await repo.getHistory('cus_1');

    expect(history).toEqual({ wasEverDenied: true, priorCheckCount: 2 });
  });

  it('keeps separate history per customer', async () => {
    const repo = new InMemoryCustomerHistoryRepository();

    await repo.recordDecision('cus_1', { outcome: 'DENY', reasons: ['x'] });
    const history = await repo.getHistory('cus_2');

    expect(history).toEqual({ wasEverDenied: false, priorCheckCount: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/adapters/InMemoryCustomerHistoryRepository.test.ts`
Expected: FAIL — cannot find module `../../../src/adapters/outbound/history/InMemoryCustomerHistoryRepository`.

- [ ] **Step 3: Implement `InMemoryCustomerHistoryRepository`**

`src/adapters/outbound/history/InMemoryCustomerHistoryRepository.ts`:

```ts
import { CustomerHistoryPort } from '../../../application/ports/CustomerHistoryPort';
import { CustomerHistory } from '../../../domain/value-objects/CustomerHistory';
import { Decision } from '../../../domain/value-objects/Decision';

interface StoredRecord {
  wasEverDenied: boolean;
  priorCheckCount: number;
}

export class InMemoryCustomerHistoryRepository implements CustomerHistoryPort {
  private readonly records = new Map<string, StoredRecord>();

  async getHistory(customerId: string): Promise<CustomerHistory> {
    const record = this.records.get(customerId);
    if (!record) {
      return { wasEverDenied: false, priorCheckCount: 0 };
    }
    return { ...record };
  }

  async recordDecision(customerId: string, decision: Decision): Promise<void> {
    const existing = this.records.get(customerId) ?? { wasEverDenied: false, priorCheckCount: 0 };
    this.records.set(customerId, {
      priorCheckCount: existing.priorCheckCount + 1,
      wasEverDenied: existing.wasEverDenied || decision.outcome === 'DENY',
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/adapters/InMemoryCustomerHistoryRepository.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/adapters/outbound/history/ tests/unit/adapters/InMemoryCustomerHistoryRepository.test.ts
git commit -m "feat: add InMemoryCustomerHistoryRepository"
```

---

### Task 10: Inbound HTTP adapter — `POST /risk-checks` (TDD)

**Files:**
- Create: `src/adapters/inbound/http/riskCheckRouter.ts`
- Create: `src/adapters/inbound/http/app.ts`
- Test: `tests/unit/adapters/app.test.ts`

**Interfaces:**
- Consumes: `EvaluateRiskCheck` (Task 7); `FakeRiskVerificationPort`, `FakeCustomerHistoryPort` (Task 7); `RiskDecisionEngine` (Task 5); `ScoreThresholdRule` (Task 2)
- Produces:
  - `createRiskCheckRouter(evaluateRiskCheck: EvaluateRiskCheck): Router`
  - `createApp(evaluateRiskCheck: EvaluateRiskCheck): Express`

- [ ] **Step 1: Write the failing test**

`tests/unit/adapters/app.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/adapters/inbound/http/app';
import { EvaluateRiskCheck } from '../../../src/application/use-cases/EvaluateRiskCheck';
import { RiskDecisionEngine } from '../../../src/domain/services/RiskDecisionEngine';
import { ScoreThresholdRule } from '../../../src/domain/rules/ScoreThresholdRule';
import { FakeRiskVerificationPort } from '../../fakes/FakeRiskVerificationPort';
import { FakeCustomerHistoryPort } from '../../fakes/FakeCustomerHistoryPort';

function buildApp(score: number) {
  const evaluateRiskCheck = new EvaluateRiskCheck(
    new FakeRiskVerificationPort({ score, sanctionsListHit: false }),
    new FakeCustomerHistoryPort({ wasEverDenied: false, priorCheckCount: 0 }),
    new RiskDecisionEngine([new ScoreThresholdRule()]),
  );
  return createApp(evaluateRiskCheck);
}

describe('POST /risk-checks', () => {
  it('returns 200 with the decision for a valid request', async () => {
    const app = buildApp(90);

    const response = await request(app)
      .post('/risk-checks')
      .send({ customerId: 'cus_1', customerName: 'Jane Doe', country: 'BR' });

    expect(response.status).toBe(200);
    expect(response.body.customerId).toBe('cus_1');
    expect(response.body.decision).toBe('APPROVE');
    expect(response.body.riskScore).toBe(90);
  });

  it('returns 400 when the request body is invalid', async () => {
    const app = buildApp(90);

    const response = await request(app).post('/risk-checks').send({ customerId: 'cus_1' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid request body');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/adapters/app.test.ts`
Expected: FAIL — cannot find module `../../../src/adapters/inbound/http/app`.

- [ ] **Step 3: Implement `riskCheckRouter`**

`src/adapters/inbound/http/riskCheckRouter.ts`:

```ts
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { EvaluateRiskCheck } from '../../../application/use-cases/EvaluateRiskCheck';

const riskCheckRequestSchema = z.object({
  customerId: z.string().min(1),
  customerName: z.string().min(1),
  country: z.string().length(2),
});

export function createRiskCheckRouter(evaluateRiskCheck: EvaluateRiskCheck): Router {
  const router = Router();

  router.post('/risk-checks', async (req: Request, res: Response) => {
    const parseResult = riskCheckRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ error: 'invalid request body', details: parseResult.error.flatten() });
      return;
    }

    const result = await evaluateRiskCheck.execute(parseResult.data);
    res.status(200).json(result);
  });

  return router;
}
```

- [ ] **Step 4: Implement `createApp`**

`src/adapters/inbound/http/app.ts`:

```ts
import express, { Express } from 'express';
import { EvaluateRiskCheck } from '../../../application/use-cases/EvaluateRiskCheck';
import { createRiskCheckRouter } from './riskCheckRouter';

export function createApp(evaluateRiskCheck: EvaluateRiskCheck): Express {
  const app = express();
  app.use(express.json());
  app.use(createRiskCheckRouter(evaluateRiskCheck));
  return app;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/adapters/app.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/adapters/inbound/ tests/unit/adapters/app.test.ts
git commit -m "feat: add inbound HTTP adapter for POST /risk-checks"
```

---

### Task 11: `loadEnv` config (TDD)

**Files:**
- Create: `src/config/env.ts`
- Test: `tests/unit/config/env.test.ts`

**Interfaces:**
- Produces: `AppEnv { port: number; riskVerificationBaseUrl: string }`, `loadEnv(): AppEnv`

- [ ] **Step 1: Write the failing test**

`tests/unit/config/env.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import { loadEnv } from '../../../src/config/env';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('loadEnv', () => {
  it('defaults port to 3000 and base url to localhost:4001 when unset', () => {
    delete process.env.PORT;
    delete process.env.RISK_VERIFICATION_BASE_URL;

    const env = loadEnv();

    expect(env.port).toBe(3000);
    expect(env.riskVerificationBaseUrl).toBe('http://localhost:4001');
  });

  it('reads PORT and RISK_VERIFICATION_BASE_URL from the environment when set', () => {
    process.env.PORT = '5050';
    process.env.RISK_VERIFICATION_BASE_URL = 'http://risk-mock:9000';

    const env = loadEnv();

    expect(env.port).toBe(5050);
    expect(env.riskVerificationBaseUrl).toBe('http://risk-mock:9000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/config/env.test.ts`
Expected: FAIL — cannot find module `../../../src/config/env`.

- [ ] **Step 3: Implement `loadEnv`**

`src/config/env.ts`:

```ts
export interface AppEnv {
  port: number;
  riskVerificationBaseUrl: string;
}

export function loadEnv(): AppEnv {
  return {
    port: Number(process.env.PORT ?? 3000),
    riskVerificationBaseUrl: process.env.RISK_VERIFICATION_BASE_URL ?? 'http://localhost:4001',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/config/env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/ tests/unit/config/
git commit -m "feat: add environment configuration loader"
```

---

### Task 12: Composition root and mock risk-verification server

**Files:**
- Create: `src/main.ts`
- Create: `mock-risk-verification-server/server.ts`

**Interfaces:**
- Consumes: `createApp` (Task 10); `EvaluateRiskCheck` (Task 7); `RiskDecisionEngine` (Task 5); `ScoreThresholdRule`, `PriorDenialRule`, `SanctionsListRule` (Tasks 2-4); `HttpRiskVerificationAdapter` (Task 8); `InMemoryCustomerHistoryRepository` (Task 9); `loadEnv` (Task 11)
- Produces: a running HTTP server on `env.port`; no exported symbols consumed by later tasks (Task 13 builds its own composition for the test)

This task wires already-tested units together and starts a real process — there is no new business logic to unit-test. It is verified by running both processes and issuing real HTTP requests.

- [ ] **Step 1: Implement the mock risk-verification server**

`mock-risk-verification-server/server.ts`:

```ts
import express from 'express';

const app = express();
app.use(express.json());

function scoreForCustomer(customerId: string): number {
  let hash = 0;
  for (let i = 0; i < customerId.length; i += 1) {
    hash = (hash * 31 + customerId.charCodeAt(i)) % 100;
  }
  return hash;
}

app.post('/verifications', (req, res) => {
  const { customerId } = req.body as { customerId?: string };

  if (!customerId) {
    res.status(400).json({ error: 'customerId is required' });
    return;
  }

  res.status(200).json({
    score: scoreForCustomer(customerId),
    sanctionsListHit: customerId === 'cus_sanctioned',
  });
});

const port = Number(process.env.PORT ?? 4001);
app.listen(port, () => {
  console.log(`mock-risk-verification-server listening on port ${port}`);
});
```

- [ ] **Step 2: Implement the composition root**

`src/main.ts`:

```ts
import { createApp } from './adapters/inbound/http/app';
import { EvaluateRiskCheck } from './application/use-cases/EvaluateRiskCheck';
import { RiskDecisionEngine } from './domain/services/RiskDecisionEngine';
import { ScoreThresholdRule } from './domain/rules/ScoreThresholdRule';
import { PriorDenialRule } from './domain/rules/PriorDenialRule';
import { SanctionsListRule } from './domain/rules/SanctionsListRule';
import { HttpRiskVerificationAdapter } from './adapters/outbound/risk-verification/HttpRiskVerificationAdapter';
import { InMemoryCustomerHistoryRepository } from './adapters/outbound/history/InMemoryCustomerHistoryRepository';
import { loadEnv } from './config/env';

const env = loadEnv();

const decisionEngine = new RiskDecisionEngine([
  new ScoreThresholdRule(),
  new PriorDenialRule(),
  new SanctionsListRule(),
]);

const evaluateRiskCheck = new EvaluateRiskCheck(
  new HttpRiskVerificationAdapter(env.riskVerificationBaseUrl),
  new InMemoryCustomerHistoryRepository(),
  decisionEngine,
);

const app = createApp(evaluateRiskCheck);

app.listen(env.port, () => {
  console.log(`kyc-risk-decision-engine listening on port ${env.port}`);
});
```

- [ ] **Step 3: Manually verify the wiring**

In one terminal:

Run: `PORT=4001 npm run mock-server`
Expected: logs `mock-risk-verification-server listening on port 4001`.

In a second terminal:

Run: `RISK_VERIFICATION_BASE_URL=http://localhost:4001 npm run dev`
Expected: logs `kyc-risk-decision-engine listening on port 3000`.

In a third terminal:

Run: `curl -s -X POST http://localhost:3000/risk-checks -H 'Content-Type: application/json' -d '{"customerId":"cus_demo","customerName":"Jane Doe","country":"BR"}'`
Expected: a JSON body with `customerId`, `decision`, `reasons`, `riskScore`.

Run: `curl -s -X POST http://localhost:3000/risk-checks -H 'Content-Type: application/json' -d '{"customerId":"cus_sanctioned","customerName":"John Roe","country":"BR"}'`
Expected: `"decision":"DENY"` (sanctions match overrides the score).

Stop both servers (Ctrl+C in each terminal) once verified.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts mock-risk-verification-server/
git commit -m "feat: add composition root and mock risk-verification server"
```

---

### Task 13: End-to-end integration test

**Files:**
- Test: `tests/integration/riskCheckApi.test.ts`

**Interfaces:**
- Consumes: `createApp` (Task 10); `EvaluateRiskCheck` (Task 7); `RiskDecisionEngine` (Task 5); `ScoreThresholdRule`, `PriorDenialRule`, `SanctionsListRule` (Tasks 2-4); `HttpRiskVerificationAdapter` (Task 8); `InMemoryCustomerHistoryRepository` (Task 9)

This test wires the real HTTP adapter to a real local `http` server standing in for the external risk-verification service, and drives the whole stack through the real Express app. It exercises composition equivalent to `main.ts`, without needing to import `main.ts` itself (which starts listening on import).

- [ ] **Step 1: Write the test**

`tests/integration/riskCheckApi.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { createServer, Server } from 'node:http';
import { createApp } from '../../src/adapters/inbound/http/app';
import { EvaluateRiskCheck } from '../../src/application/use-cases/EvaluateRiskCheck';
import { RiskDecisionEngine } from '../../src/domain/services/RiskDecisionEngine';
import { ScoreThresholdRule } from '../../src/domain/rules/ScoreThresholdRule';
import { PriorDenialRule } from '../../src/domain/rules/PriorDenialRule';
import { SanctionsListRule } from '../../src/domain/rules/SanctionsListRule';
import { HttpRiskVerificationAdapter } from '../../src/adapters/outbound/risk-verification/HttpRiskVerificationAdapter';
import { InMemoryCustomerHistoryRepository } from '../../src/adapters/outbound/history/InMemoryCustomerHistoryRepository';

let mockServer: Server;
let app: Express;

beforeAll(async () => {
  const mockApp = express();
  mockApp.use(express.json());
  mockApp.post('/verifications', (req, res) => {
    const { customerId } = req.body as { customerId: string };
    res.status(200).json({ score: 90, sanctionsListHit: customerId === 'cus_sanctioned' });
  });

  mockServer = createServer(mockApp);
  await new Promise<void>((resolve) => mockServer.listen(0, resolve));
  const address = mockServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('failed to determine mock server address');
  }
  const mockServerUrl = `http://127.0.0.1:${address.port}`;

  const decisionEngine = new RiskDecisionEngine([
    new ScoreThresholdRule(),
    new PriorDenialRule(),
    new SanctionsListRule(),
  ]);

  const evaluateRiskCheck = new EvaluateRiskCheck(
    new HttpRiskVerificationAdapter(mockServerUrl),
    new InMemoryCustomerHistoryRepository(),
    decisionEngine,
  );

  app = createApp(evaluateRiskCheck);
});

afterAll(() => {
  mockServer.close();
});

describe('POST /risk-checks (integration)', () => {
  it('approves a customer that clears verification with a high score', async () => {
    const response = await request(app)
      .post('/risk-checks')
      .send({ customerId: 'cus_ok', customerName: 'Jane Doe', country: 'BR' });

    expect(response.status).toBe(200);
    expect(response.body.decision).toBe('APPROVE');
    expect(response.body.riskScore).toBe(90);
  });

  it('denies a customer that matches the sanctions list, even with a high score', async () => {
    const response = await request(app)
      .post('/risk-checks')
      .send({ customerId: 'cus_sanctioned', customerName: 'John Roe', country: 'BR' });

    expect(response.status).toBe(200);
    expect(response.body.decision).toBe('DENY');
  });
});
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the 2 new integration tests (total test count so far: 3+2+2+5+4+3+4+2+2+2 = 29 tests across all tasks).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/
git commit -m "test: add end-to-end integration test for POST /risk-checks"
```

---

### Task 14: Docker, Docker Compose, and README usage instructions

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Modify: `README.md`

**Interfaces:**
- None (deployment/documentation only)

- [ ] **Step 1: Create the `Dockerfile`**

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev=false

COPY . .

EXPOSE 3000
EXPOSE 4001

CMD ["npx", "tsx", "src/main.ts"]
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  mock-risk-verification-server:
    build: .
    command: ["npx", "tsx", "mock-risk-verification-server/server.ts"]
    environment:
      PORT: "4001"
    ports:
      - "4001:4001"

  app:
    build: .
    command: ["npx", "tsx", "src/main.ts"]
    environment:
      PORT: "3000"
      RISK_VERIFICATION_BASE_URL: "http://mock-risk-verification-server:4001"
    ports:
      - "3000:3000"
    depends_on:
      - mock-risk-verification-server
```

- [ ] **Step 3: Verify with Docker Compose**

Run: `docker compose up --build -d`
Expected: both containers start; `docker compose ps` shows `app` and `mock-risk-verification-server` as running.

Run: `curl -s -X POST http://localhost:3000/risk-checks -H 'Content-Type: application/json' -d '{"customerId":"cus_demo","customerName":"Jane Doe","country":"BR"}'`
Expected: `200` response with a `decision` field.

Run: `docker compose down`
Expected: containers stop and are removed.

- [ ] **Step 4: Add usage instructions to `README.md`**

Read the current `README.md` first, then add this section right after the existing "## O que demonstra" section (keep all existing content):

```markdown
## Como rodar

Local, sem Docker:

\`\`\`bash
npm install
npm run mock-server   # terminal 1 — mock de verificação de risco na porta 4001
npm run dev            # terminal 2 — serviço principal na porta 3000
\`\`\`

Com Docker Compose:

\`\`\`bash
docker compose up --build
\`\`\`

Testando:

\`\`\`bash
curl -X POST http://localhost:3000/risk-checks \
  -H 'Content-Type: application/json' \
  -d '{"customerId":"cus_demo","customerName":"Jane Doe","country":"BR"}'
\`\`\`

Rodando os testes:

\`\`\`bash
npm test
npm run typecheck
npm run lint
\`\`\`
```

- [ ] **Step 5: Final full verification**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all three exit 0.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml README.md
git commit -m "chore: add Docker Compose setup and usage instructions"
```
