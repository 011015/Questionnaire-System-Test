# CLAUDE.md

Context for AI assistants (Claude or otherwise) working in this repository.

## What this repo is

A schema-driven questionnaire system built for an engineering assessment. Two frontend apps + one dumb storage backend:

- `frontend/admin` — author questionnaires (questions, options, visibility rules, scoring rules)
- `frontend/web` — runtime that loads a schema by id and renders an interactive, branching form
- `backend` — Express + JSON file, CRUD only, **no business logic**

Full design rationale: `docs/ARCHITECTURE.md`. Key decisions and trade-offs: `docs/ADR.md`.

## Hard constraints (do not violate)

1. **No business logic in `backend/`.** Validation, branching, scoring, visibility — all of it stays in frontend code under `src/schema/`. The backend must remain swappable with any other dumb JSON store.
2. **`src/schema/types.ts` and `src/schema/ruleEngine.ts` must stay byte-identical between `frontend/admin` and `frontend/web`.** If you change one, copy the change to the other in the same commit. (See ADR §3 for why these aren't a shared package.) **`src/schema/ruleEngine.test.ts` is duplicated the same way** — if you add or change a test case, copy it to both apps so a regression in one copy of the engine can't slip past because only the other app's suite covers it.
3. **The rule engine is pure.** No DOM access, no React imports, no side effects, in `src/schema/*.ts`. It must be testable/runnable in plain Node.
4. **A question's `visibleIf` may only reference questions that appear earlier in the `questions` array.** The Admin UI enforces this by only offering earlier questions in the rule editor's question dropdown — don't remove that constraint without updating the runtime to handle forward references (it currently doesn't).

## Schema/rule engine mental model

- A questionnaire is a flat, ordered list of questions (not a graph).
- Each question optionally has `visibleIf: RuleGroup`. No `visibleIf` = always visible.
- `RuleGroup` is `{ combinator: 'AND'|'OR', rules: (Condition|RuleGroup)[] }` — recursive, so nested multi-condition logic is supported.
- `Condition.source` is either `'answer'` (reads a raw answer) or `'score'` (reads a computed scoring total).
- Scoring rules (`Questionnaire.scoring`) sum `option.score` across selected values for a configured set of questions; computed fresh on every answer change, never stored.
- At runtime: `getVisibleQuestions(schema, answers)` is the single source of truth for "what's in the flow right now." Re-run it after every answer change. `pruneAnswers()` must be called alongside it so answers to now-hidden questions don't leak into future scoring.

## Verifying changes to the rule engine

`vitest` is wired up in both `frontend/admin` and `frontend/web`. Run the suite from either app directory:

```bash
cd frontend/web   # or frontend/admin
npm install
npm test
```

`src/schema/ruleEngine.test.ts` covers, against the seeded `onboarding-health-check` schema:
- single-choice branching across all three employment paths
- the nested `AND`/`OR` scoring-gated question (`q_followup_required` vs `q_all_clear`), including a
  mutual-exclusivity check across several answer combinations
- `pruneAnswers` dropping stale answers when an earlier answer changes
- edge cases: empty `AND`/`OR` groups, `excludes` on a multi-select answer, 3+ levels of nested
  groups, `isAnswered`/`isEmpty` on missing vs. empty-array answers, and numeric comparisons with
  missing/non-numeric values

When you change `ruleEngine.ts`, add or update the corresponding test case rather than only
spot-checking manually — the suite is the source of truth now, not ad hoc scripts.

## Other test layers

Beyond the rule engine, each part of the stack has its own real test coverage:

- **`backend`**: `npm test` runs `src/server.test.js` (supertest against the real Express app,
  isolated to a throwaway data file via `QUESTIONNAIRES_DATA_FILE`) — full CRUD, 400/404 cases,
  PUT upsert semantics, DELETE idempotency, and a check that the backend truly performs no
  validation (constraint #1).
- **`frontend/web`**: component tests (`QuestionRenderer.test.tsx`), a hook test
  (`useQuestionnaireRuntime.test.ts`), and a full user-journey test
  (`QuestionnaireRuntime.test.tsx`) that drives the rendered UI through real branching + scoring
  paths — all in jsdom, no real network.
- **`frontend/web/src/App.test.tsx`** is different from the others: it spawns the **real**
  `backend/src/server.js` as a child process and renders the **real** `<App/>`, so it exercises
  the actual `fetch()` → real HTTP → real Express path, not a mocked one. **Prerequisite:** the
  backend's own dependencies must be installed first (`cd backend && npm install`) before running
  `frontend/web`'s test suite, since this test spawns that code as a subprocess. If you see
  "Backend did not become ready in time", the error message now includes the backend's captured
  stderr — check for `MODULE_NOT_FOUND` there first.
- **`frontend/admin`**: component tests for `ScoringEditor`, `RuleGroupEditor` (including nested
  groups and the answer↔score source switch), and `QuestionEditor` (type switching, options CRUD,
  the forward-reference constraint on `visibleIf` targets).
- **`frontend/web/e2e/questionnaire-flow.spec.ts`** (Playwright): a real-browser, real-backend E2E
  spec that boots both dev servers via `playwright.config.ts`. Run with
  `npx playwright install && npm run test:e2e`. This one has **not** been executed by AI tooling in
  this repo's history — browser binary installation was blocked by that environment's network
  policy — so treat it as unverified until it's actually been run once.

## Things intentionally out of scope (per assessment brief)

- Answer submission / persistence of user responses
- Authentication/authorization
- Backend validation of any kind

Don't add these unless the brief changes — adding them would blur the "backend is dumb storage" boundary the assessment explicitly tests for.

## Sample data

`backend/data/questionnaires.json` contains one seeded questionnaire (`onboarding-health-check`) exercising: simple single-choice branching, a nested `AND`/`OR` rule group, and a scoring-gated question. Use it as the reference example when adding new rule types or UI for the rule editor.
