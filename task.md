# Task Log

Working notes from building this assessment solution with Claude, kept as a
process artifact per the assessment's "intermediate artifacts" deliverable.

## 1. Framing

Read `README.md`. Three things were explicitly left to design: the schema, the
rule engine, and the UI/state approach. Decided to lock in the schema and rule
engine on paper first (`docs/ARCHITECTURE.md`) before writing any UI code,
since both apps depend on interpreting it identically — getting it wrong after
UI exists is expensive to unwind.

## 2. Design pass

- Chose a flat ordered question list + per-question declarative `visibleIf`
  rule tree over a flow graph. Reasoning captured in `docs/ADR.md` (#1, #2).
- Added a first-class `scoring` concept (separate from raw answers) after
  re-reading the requirement: "combining multiple answers to determine which
  questions appear next (e.g., scoring, multi-condition branching)" —
  needed a way to gate a question on an aggregate, not just a single answer.
- Decided the backend is a 5-endpoint dumb CRUD store, no validation — required
  by the brief, also avoids drift between admin-side preview and runtime
  evaluation (ADR #4).

## 3. Build order

1. `schema/types.ts` + `schema/ruleEngine.ts` — pure, no framework deps, so it
   could be sanity-tested standalone before any UI existed.
2. `backend/` — minimal enough to unblock both frontends immediately.
3. Seed data (`backend/data/questionnaires.json`) — wrote this *before* the
   Admin UI so there was a known-good example to render/validate against
   (single-choice branching, nested AND/OR, scoring gate all present).
4. `frontend/web` (runtime) — built against the seed data directly, since
   rendering/branching correctness was the highest-priority evaluation
   criterion in the brief.
5. `frontend/admin` — authoring UI, including a recursive rule-group editor
   mirroring the recursive `RuleGroup` type.

## 4. Verification performed

- `npm run build` (tsc + vite build) passes clean for both frontend apps —
  no `any`-driven type errors.
- Backend smoke-tested with `curl` against `/questionnaires` and
  `/questionnaires/:id`.
- Rule engine exercised directly via `tsx` against the seed schema for:
  branching by single-choice answer (3 employment paths), a nested `AND`/`OR`
  visibility rule, and a scoring-threshold-gated question. All expected
  visible-question sets matched. Command used is recorded in `CLAUDE.md` under
  "Verifying changes" so it's repeatable.
- Did **not** write an automated test suite (no framework was wired up) —
  flagged as a known gap, see "What I'd do next."

## 5. What I'd do next with more time

- Add `vitest` and port the manual `tsx` checks into a real test file
  (`ruleEngine.test.ts`), including edge cases: empty rule groups, a
  multiple-choice `excludes` check, deeply nested groups (3+ levels).
- Promote `schema/` to an npm workspace package instead of file duplication
  once there's a third consumer or the files start drifting.
- Admin-side live preview embedded in-app (currently opens the Web app in a
  new tab via `?id=`) so authors don't context-switch to check their logic.
- Drag-and-drop question reordering (currently up/down buttons).
