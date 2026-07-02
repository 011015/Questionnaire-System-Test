// Questionnaire schema types.
// See /docs/ARCHITECTURE.md for full rationale.
// NOTE: this file is intentionally duplicated (byte-for-byte) in
// frontend/web/src/schema/types.ts. See ADR.md for why we didn't set up a
// shared package for a project this size.

export type QuestionType = 'single' | 'multiple' | 'text';

export interface OptionDef {
  id: string;
  label: string;
  value: string;
  score?: number;
}

export interface QuestionDef {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required?: boolean;
  options?: OptionDef[];
  placeholder?: string;
  visibleIf?: RuleGroup;
}

export type Operator =
  | 'eq'
  | 'neq'
  | 'includes'
  | 'excludes'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'isAnswered'
  | 'isEmpty';

export interface Condition {
  kind: 'condition';
  source: 'answer' | 'score';
  questionId?: string;
  scoreId?: string;
  operator: Operator;
  value?: string | number | string[];
}

export interface RuleGroup {
  kind: 'group';
  combinator: 'AND' | 'OR';
  rules: (Condition | RuleGroup)[];
}

export interface ScoringRule {
  id: string;
  label: string;
  questionIds: string[];
}

export interface Questionnaire {
  id: string;
  title: string;
  description?: string;
  version: number;
  questions: QuestionDef[];
  scoring?: ScoringRule[];
}

export type AnswerValue = string | string[] | undefined;
export type AnswerMap = Record<string, AnswerValue>;

export function isCondition(r: Condition | RuleGroup): r is Condition {
  return r.kind === 'condition';
}
