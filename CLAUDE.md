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
2. **`src/schema/types.ts` and `src/schema/ruleEngine.ts` must stay byte-identical between `frontend/admin` and `frontend/web`.** If you change one, copy the change to the other in the same commit. (See ADR §3 for why these aren't a shared package.)
3. **The rule engine is pure.** No DOM access, no React imports, no side effects, in `src/schema/*.ts`. It must be testable/runnable in plain Node (this is how it was validated during development — see "Verifying changes" below).
4. **A question's `visibleIf` may only reference questions that appear earlier in the `questions` array.** The Admin UI enforces this by only offering earlier questions in the rule editor's question dropdown — don't remove that constraint without updating the runtime to handle forward references (it currently doesn't).

## Schema/rule engine mental model

- A questionnaire is a flat, ordered list of questions (not a graph).
- Each question optionally has `visibleIf: RuleGroup`. No `visibleIf` = always visible.
- `RuleGroup` is `{ combinator: 'AND'|'OR', rules: (Condition|RuleGroup)[] }` — recursive, so nested multi-condition logic is supported.
- `Condition.source` is either `'answer'` (reads a raw answer) or `'score'` (reads a computed scoring total).
- Scoring rules (`Questionnaire.scoring`) sum `option.score` across selected values for a configured set of questions; computed fresh on every answer change, never stored.
- At runtime: `getVisibleQuestions(schema, answers)` is the single source of truth for "what's in the flow right now." Re-run it after every answer change. `pruneAnswers()` must be called alongside it so answers to now-hidden questions don't leak into future scoring.

## Verifying changes to the rule engine

There's no test framework wired up yet (kept the dependency footprint minimal for the assessment). To sanity-check `ruleEngine.ts` changes, run it directly against the sample schema with `tsx`, e.g.:

```bash
cd frontend/web
npx tsx -e "
import { getVisibleQuestions } from './src/schema/ruleEngine';
import fs from 'fs';
const schema = JSON.parse(fs.readFileSync('../../backend/data/questionnaires.json','utf-8'))['onboarding-health-check'];
console.log(getVisibleQuestions(schema, { q_employment: 'employed' }).map(q => q.id));
"
```

If you add a real test framework (vitest is the natural choice given Vite is already present), put engine tests in `frontend/web/src/schema/ruleEngine.test.ts` (or promote `schema/` to a shared workspace package first — see ADR §3 — and test it once).

## Things intentionally out of scope (per assessment brief)

- Answer submission / persistence of user responses
- Authentication/authorization
- Backend validation of any kind

Don't add these unless the brief changes — adding them would blur the "backend is dumb storage" boundary the assessment explicitly tests for.

## Sample data

`backend/data/questionnaires.json` contains one seeded questionnaire (`onboarding-health-check`) exercising: simple single-choice branching, a nested `AND`/`OR` rule group, and a scoring-gated question. Use it as the reference example when adding new rule types or UI for the rule editor.
