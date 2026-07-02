# Architecture Decision Record

## 1. Declarative rule tree instead of a flow graph or scripting language

**Decision:** Question visibility is driven by a recursive `RuleGroup { combinator, rules: (Condition|RuleGroup)[] }` attached to each question (`visibleIf`), evaluated against `{ answers, scores }`. No node/edge flow graph, no embedded expression language.

**Why:** A flow graph (nodes = questions, edges = transitions) models branching well but struggles with multi-condition logic ("show if A AND (B OR C)") without becoming a general-purpose rule language anyway — you end up building the same thing with extra indirection. A scripting/expression language (e.g. storing `"answers.q1 === 'yes' && score.risk > 5"` as a string) is more expressive but requires `eval`-like execution or a parser, and isn't safely renderable as a form in the Admin UI. The recursive JSON rule tree is expressive enough for AND/OR nesting, stays pure data (safe to store/diff/version), and maps directly onto a recursive editor UI.

**Trade-off accepted:** No support for referencing a question's answer *before* it's been asked in re-orderable ways beyond linear precedence (see Editor constraint: a question can only reference earlier questions) — acceptable for a questionnaire (not a general workflow engine).

## 2. Flat, ordered question list instead of a question graph

**Decision:** `Questionnaire.questions` is a flat array in authoring order. At runtime, `getVisibleQuestions()` filters that array down to whichever questions currently evaluate visible, and the runtime walks that filtered list.

**Why:** This keeps authoring simple (drag order = flow order, same mental model as a paper form) while still producing branching/skipping behavior purely as a side effect of filtering. It avoids the complexity of a graph data structure (node IDs, edge conditions, cycle detection) for a domain that's fundamentally about "which subset of a form is relevant," not arbitrary control flow.

**Trade-off accepted:** Two different branches can't easily converge into different downstream re-orderings — the authored order is the ceiling on possible sequences. For a questionnaire (not a BPMN-style process), this is the right amount of power.

## 3. Rule engine + schema types are pure, framework-agnostic, and duplicated across apps rather than shared via a package

**Decision:** `schema/types.ts` and `schema/ruleEngine.ts` contain zero React/DOM dependencies and are copied byte-for-byte into both `frontend/admin` and `frontend/web`.

**Why:** Both apps must interpret the schema identically (the Admin preview and the Web runtime must agree on what "visible" means), so this logic needed to be single-sourced conceptually. A proper monorepo package (npm workspaces / pnpm workspace) is the "correct" long-term answer, but for a 2-app assessment scope it adds tooling overhead (workspace config, build ordering, publish/link step) disproportionate to the benefit. Duplication is explicit, tracked, and the files are small enough that a diff check is trivial. If this were a real production system with more than two consumers, I'd promote `schema/` to a workspace package immediately.

## 4. Backend is a dumb CRUD JSON store; all logic lives in the frontend

**Decision:** `backend/` only persists and returns whatever JSON it's given (`GET/POST/PUT/DELETE /questionnaires[/:id]`). No validation, no branching/scoring evaluation server-side.

**Why:** Required by the assessment brief, and also the right call independent of that: the rule engine needs to run identically wherever a question is rendered, and duplicating it server-side would risk drift between "what the admin previewed" and "what actually got evaluated." Keeping the backend dumb also means the storage layer is trivially swappable (the API surface is 5 REST endpoints) without touching any business logic.
