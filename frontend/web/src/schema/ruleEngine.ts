// Pure rule engine — no side effects, no DOM/React dependency.
// Duplicated in frontend/web/src/schema/ruleEngine.ts (see ADR.md).

import {
  AnswerMap,
  AnswerValue,
  Condition,
  Questionnaire,
  QuestionDef,
  RuleGroup,
  isCondition,
} from './types';

export interface EvalContext {
  answers: AnswerMap;
  scores: Record<string, number>;
}

function toArray(v: AnswerValue): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function toNumber(v: AnswerValue | number): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v))) return Number(v);
  return undefined;
}

function evaluateCondition(cond: Condition, ctx: EvalContext): boolean {
  const raw: AnswerValue =
    cond.source === 'answer' && cond.questionId ? ctx.answers[cond.questionId] : undefined;
  const scoreVal =
    cond.source === 'score' && cond.scoreId ? ctx.scores[cond.scoreId] : undefined;

  switch (cond.operator) {
    case 'isAnswered':
      return cond.source === 'answer' ? toArray(raw).length > 0 : scoreVal !== undefined;
    case 'isEmpty':
      return cond.source === 'answer' ? toArray(raw).length === 0 : scoreVal === undefined;
    case 'eq':
      if (cond.source === 'score') return toNumber(scoreVal) === toNumber(cond.value as number);
      return toArray(raw)[0] === cond.value;
    case 'neq':
      if (cond.source === 'score') return toNumber(scoreVal) !== toNumber(cond.value as number);
      return toArray(raw)[0] !== cond.value;
    case 'includes':
      return toArray(raw).includes(String(cond.value));
    case 'excludes':
      return !toArray(raw).includes(String(cond.value));
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const left = cond.source === 'score' ? toNumber(scoreVal) : toNumber(raw?.[0]);
      const right = toNumber(cond.value as number);
      if (left === undefined || right === undefined) return false;
      if (cond.operator === 'gt') return left > right;
      if (cond.operator === 'gte') return left >= right;
      if (cond.operator === 'lt') return left < right;
      return left <= right;
    }
    default:
      return false;
  }
}

export function evaluate(rule: Condition | RuleGroup, ctx: EvalContext): boolean {
  if (isCondition(rule)) return evaluateCondition(rule, ctx);
  const results = rule.rules.map((r) => evaluate(r, ctx));
  return rule.combinator === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

export function computeScores(
  schema: Questionnaire,
  answers: AnswerMap
): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const rule of schema.scoring ?? []) {
    let total = 0;
    for (const qId of rule.questionIds) {
      const q = schema.questions.find((x) => x.id === qId);
      if (!q?.options) continue;
      const selected = toArray(answers[qId]);
      for (const optValue of selected) {
        const opt = q.options.find((o) => o.value === optValue);
        if (opt?.score) total += opt.score;
      }
    }
    scores[rule.id] = total;
  }
  return scores;
}

/** Returns the questions that should currently be part of the flow, in authored order. */
export function getVisibleQuestions(
  schema: Questionnaire,
  answers: AnswerMap
): QuestionDef[] {
  const scores = computeScores(schema, answers);
  const ctx: EvalContext = { answers, scores };
  return schema.questions.filter((q) => !q.visibleIf || evaluate(q.visibleIf, ctx));
}

/**
 * Strips answers that belong to questions no longer visible, so stale answers
 * can't silently influence scoring/branching after the user edits an earlier answer.
 */
export function pruneAnswers(schema: Questionnaire, answers: AnswerMap): AnswerMap {
  const visibleIds = new Set(getVisibleQuestions(schema, answers).map((q) => q.id));
  const next: AnswerMap = {};
  for (const [id, val] of Object.entries(answers)) {
    if (visibleIds.has(id)) next[id] = val;
  }
  return next;
}
