# Architecture & Data Model

## 1. Questionnaire Schema

```ts
type QuestionType = 'single' | 'multiple' | 'text';

interface OptionDef {
  id: string;          // stable id, referenced by rules
  label: string;        // shown to user
  value: string;         // stored answer value
  score?: number;         // optional weight, used for scoring rules
}

interface QuestionDef {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required?: boolean;
  options?: OptionDef[];              // single / multiple only
  placeholder?: string;               // text only
  visibleIf?: RuleGroup;              // omitted = always visible
}

type Operator =
  | 'eq' | 'neq'                      // single-choice / text equality
  | 'includes' | 'excludes'           // multiple-choice membership
  | 'gt' | 'gte' | 'lt' | 'lte'       // numeric / score comparisons
  | 'isAnswered' | 'isEmpty';         // presence checks

interface Condition {
  kind: 'condition';
  source: 'answer' | 'score';         // read from raw answers or computed score
  questionId?: string;                // required when source === 'answer'
  scoreId?: string;                   // required when source === 'score'
  operator: Operator;
  value?: string | number | string[];
}

interface RuleGroup {
  kind: 'group';
  combinator: 'AND' | 'OR';
  rules: (Condition | RuleGroup)[];   // recursive -> supports nested multi-condition logic
}

interface ScoringRule {
  id: string;                         // e.g. "riskScore"
  label: string;
  questionIds: string[];              // sum of `score` on selected options across these questions
}

interface Questionnaire {
  id: string;
  title: string;
  description?: string;
  version: number;
  questions: QuestionDef[];           // authoring order = default linear order
  scoring?: ScoringRule[];
}
```

### Design rationale
- **Declarative, tree-shaped rules** (`RuleGroup` recursive over `Condition | RuleGroup`) instead of an imperative script. This keeps the schema pure JSON — safe to store, diff, and render as a form in the Admin UI (no `eval`, no code execution).
- **`visibleIf` lives on the question**, not as a separate "flow graph". A flat, ordered list of questions plus a per-question predicate is simpler to author and reason about than a graph of nodes/edges, while still supporting branching, skipping, and multi-condition logic (via nested `AND`/`OR` groups referencing multiple prior answers).
- **Scoring is a first-class concept** (`ScoringRule` + `option.score`), separate from raw answers, so a question can gate on "is cumulative risk score > 7" without the rule engine needing bespoke aggregation logic per rule — scores are computed once per evaluation pass and exposed as another queryable source.

## 2. Rule Engine

Pure function, no side effects, framework-agnostic (usable by both apps):

```ts
function evaluate(rule: RuleGroup | Condition, ctx: EvalContext): boolean
function computeScores(schema: Questionnaire, answers: AnswerMap): Record<string, number>
function getVisibleQuestions(schema: Questionnaire, answers: AnswerMap): QuestionDef[]
```

`EvalContext = { answers: AnswerMap; scores: Record<string, number> }`

`getVisibleQuestions` runs once per answer-change: compute scores → walk `questions` in authored order → keep any question whose `visibleIf` evaluates true (or has none). This naturally implements **branching** (different next question appears), **skipping** (question's condition becomes false → removed from the flow), and **scoring-gated** questions (condition references a `score` source).

## 3. Runtime Flow Control

The web app treats the *visible* question list as the live flow. Current index is tracked separately; when an answer changes, the visible list is recomputed. If the currently displayed question is no longer visible (e.g., user changed an earlier answer), the runtime clamps forward/back to the nearest still-visible question, and any answers belonging to now-hidden questions are cleared so stale data can't leak into scoring.

## 4. Data Contract (Backend)

`backend/` is a thin CRUD JSON store — no validation, no branching, no scoring. Endpoints:

```
GET    /questionnaires        -> list
GET    /questionnaires/:id    -> Questionnaire
POST   /questionnaires        -> create (body: Questionnaire)
PUT    /questionnaires/:id    -> replace
DELETE /questionnaires/:id    -> remove
```

Admin writes schema JSON here; Web reads by id. All interpretation of the schema (visibility, scoring, validation) happens exclusively in frontend code shared between both apps (`src/schema/*`).
