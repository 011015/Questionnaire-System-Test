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

## 4. Verification performed (initial pass)

- `npm run build` (tsc + vite build) passes clean for both frontend apps —
  no `any`-driven type errors.
- Backend smoke-tested with `curl` against `/questionnaires` and
  `/questionnaires/:id`.
- Rule engine exercised directly via `tsx` against the seed schema for:
  branching by single-choice answer (3 employment paths), a nested `AND`/`OR`
  visibility rule, and a scoring-threshold-gated question. All expected
  visible-question sets matched.
- Did **not** write an automated test suite (no framework was wired up) —
  flagged as a known gap. Superseded by §6 below.

## 5. What I'd do next with more time

- ~~Add `vitest` and port the manual `tsx` checks into a real test file~~ — done, see §6.
- Promote `schema/` to an npm workspace package instead of file duplication
  once there's a third consumer or the files start drifting.
- Admin-side live preview embedded in-app (currently opens the Web app in a
  new tab via `?id=`) so authors don't context-switch to check their logic.
- Drag-and-drop question reordering (currently up/down buttons).

## 6. Adding a real test framework (vitest)

Wired up `vitest` in both `frontend/web` and `frontend/admin` (pinned to
`^2.1.9` to stay compatible with the project's Vite 5.4 — vitest 4.x requires
Vite 6+). Added `vitest.config.ts` (plain `node` environment — the rule engine
has zero DOM dependency by design, see CLAUDE.md constraint #3) and `npm test`
in each app's `package.json`.

`src/schema/ruleEngine.test.ts` replaces the manual `tsx` snippet as the
source of truth, and is duplicated byte-for-byte between the two apps
following the same convention as `types.ts`/`ruleEngine.ts` (see ADR §3).
Coverage:

- single-choice branching across all three employment paths (the case the
  manual script covered)
- the nested `AND`/`OR` scoring-gated question, including a check that
  `q_followup_required` and `q_all_clear` are mutually exclusive across
  several answer combinations
- `pruneAnswers` dropping stale answers when an earlier answer changes
- edge cases explicitly called out in the original "what I'd do next" list:
  empty `AND`/`OR` rule groups, `excludes` on a multi-select answer, and 3+
  levels of nested groups
- additionally added: `isAnswered`/`isEmpty` on missing vs. empty-array
  answers, and numeric comparisons (`gt`/`gte`/`lt`/`lte`) with missing or
  non-numeric input

**Writing the numeric-comparison edge case caught a real bug**: for
`gt`/`gte`/`lt`/`lte` conditions with `source: 'answer'`, the engine read
`raw?.[0]` where `raw` is `string | string[] | undefined`. For a plain string
answer (e.g. a text-question answer of `"10"`), `[0]` indexed the *character*
(`"1"`) rather than the whole value, silently breaking any numeric comparison
against a free-text or single-select answer stored as a string. Fixed by
routing through the existing `toArray()` helper (`toArray(raw)[0]`) so string
and array-valued answers are normalized the same way before the numeric
comparison, in both copies of `ruleEngine.ts`. This is exactly the kind of
regression a real test suite is meant to catch before it reaches the runtime
app — the seed schema didn't happen to exercise a numeric comparison against
a string answer, so the earlier manual `tsx` check never surfaced it.
