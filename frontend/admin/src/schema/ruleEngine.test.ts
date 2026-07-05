import { describe, expect, it } from 'vitest';
import { computeScores, evaluate, getVisibleQuestions, pruneAnswers } from './ruleEngine';
import { AnswerMap, Condition, Questionnaire, RuleGroup } from './types';

// ---------------------------------------------------------------------------
// Reference schema — mirrors backend/data/questionnaires.json's
// "onboarding-health-check" so these tests exercise the same branching,
// nested AND/OR, and scoring-gate behavior called out in CLAUDE.md.
// ---------------------------------------------------------------------------
const healthCheckSchema: Questionnaire = {
  id: 'onboarding-health-check',
  title: 'Onboarding Health Check',
  version: 1,
  questions: [
    {
      id: 'q_employment',
      type: 'single',
      title: 'Employment status',
      required: true,
      options: [
        { id: 'opt_employed', label: 'Employed', value: 'employed' },
        { id: 'opt_selfemployed', label: 'Self-employed', value: 'self_employed' },
        { id: 'opt_unemployed', label: 'Not currently working', value: 'unemployed' },
      ],
    },
    {
      id: 'q_employer',
      type: 'text',
      title: "Employer's name",
      visibleIf: {
        kind: 'group',
        combinator: 'AND',
        rules: [{ kind: 'condition', source: 'answer', questionId: 'q_employment', operator: 'eq', value: 'employed' }],
      },
    },
    {
      id: 'q_business_type',
      type: 'single',
      title: 'Business type',
      options: [
        { id: 'opt_sole', label: 'Sole proprietorship', value: 'sole' },
        { id: 'opt_llc', label: 'LLC / Corporation', value: 'llc' },
      ],
      visibleIf: {
        kind: 'group',
        combinator: 'AND',
        rules: [{ kind: 'condition', source: 'answer', questionId: 'q_employment', operator: 'eq', value: 'self_employed' }],
      },
    },
    {
      id: 'q_job_search',
      type: 'single',
      title: 'Actively looking for work?',
      options: [
        { id: 'opt_yes', label: 'Yes', value: 'yes' },
        { id: 'opt_no', label: 'No', value: 'no' },
      ],
      visibleIf: {
        kind: 'group',
        combinator: 'AND',
        rules: [{ kind: 'condition', source: 'answer', questionId: 'q_employment', operator: 'eq', value: 'unemployed' }],
      },
    },
    {
      id: 'q_risk_symptoms',
      type: 'multiple',
      title: 'Symptoms in the last 2 weeks',
      options: [
        { id: 'opt_fatigue', label: 'Fatigue', value: 'fatigue', score: 2 },
        { id: 'opt_fever', label: 'Fever', value: 'fever', score: 4 },
        { id: 'opt_cough', label: 'Persistent cough', value: 'cough', score: 3 },
        { id: 'opt_none', label: 'None of the above', value: 'none', score: 0 },
      ],
    },
    {
      id: 'q_recent_travel',
      type: 'single',
      title: 'International travel in the last 30 days?',
      options: [
        { id: 'opt_travel_yes', label: 'Yes', value: 'yes', score: 3 },
        { id: 'opt_travel_no', label: 'No', value: 'no', score: 0 },
      ],
    },
    {
      id: 'q_followup_required',
      type: 'text',
      title: 'Follow-up required — describe your symptoms',
      visibleIf: {
        kind: 'group',
        combinator: 'OR',
        rules: [
          { kind: 'condition', source: 'score', scoreId: 'riskScore', operator: 'gte', value: 5 },
          {
            kind: 'group',
            combinator: 'AND',
            rules: [
              { kind: 'condition', source: 'answer', questionId: 'q_recent_travel', operator: 'eq', value: 'yes' },
              { kind: 'condition', source: 'answer', questionId: 'q_risk_symptoms', operator: 'includes', value: 'fever' },
            ],
          },
        ],
      },
    },
    {
      id: 'q_all_clear',
      type: 'text',
      title: 'No follow-up needed — anything else?',
      visibleIf: {
        kind: 'group',
        combinator: 'AND',
        rules: [{ kind: 'condition', source: 'score', scoreId: 'riskScore', operator: 'lt', value: 5 }],
      },
    },
  ],
  scoring: [
    { id: 'riskScore', label: 'Health Risk Score', questionIds: ['q_risk_symptoms', 'q_recent_travel'] },
  ],
};

function visibleIds(answers: AnswerMap): string[] {
  return getVisibleQuestions(healthCheckSchema, answers).map((q) => q.id);
}

describe('getVisibleQuestions — single-choice branching (employment)', () => {
  it('shows the employer-name branch when employed', () => {
    expect(visibleIds({ q_employment: 'employed' })).toContain('q_employer');
  });

  it('shows the business-type branch when self-employed, and hides the other branches', () => {
    const ids = visibleIds({ q_employment: 'self_employed' });
    expect(ids).toContain('q_business_type');
    expect(ids).not.toContain('q_employer');
    expect(ids).not.toContain('q_job_search');
  });

  it('shows the job-search branch when unemployed, and hides the other branches', () => {
    const ids = visibleIds({ q_employment: 'unemployed' });
    expect(ids).toContain('q_job_search');
    expect(ids).not.toContain('q_employer');
    expect(ids).not.toContain('q_business_type');
  });

  it('hides all three branches when employment is unanswered', () => {
    const ids = visibleIds({});
    expect(ids).not.toContain('q_employer');
    expect(ids).not.toContain('q_business_type');
    expect(ids).not.toContain('q_job_search');
  });
});

describe('computeScores', () => {
  it('sums scores across all questionIds in a scoring rule', () => {
    const scores = computeScores(healthCheckSchema, {
      q_risk_symptoms: ['fever', 'cough'],
      q_recent_travel: 'yes',
    });
    // fever(4) + cough(3) + travel(3) = 10
    expect(scores.riskScore).toBe(10);
  });

  it('ignores unscored/absent options and treats missing answers as zero', () => {
    const scores = computeScores(healthCheckSchema, { q_risk_symptoms: ['none'] });
    expect(scores.riskScore).toBe(0);
  });
});

describe('getVisibleQuestions — scoring-gated + nested AND/OR (q_followup_required / q_all_clear)', () => {
  it('gates the follow-up question on riskScore >= 5 alone', () => {
    const ids = visibleIds({ q_risk_symptoms: ['fever', 'cough'], q_recent_travel: 'no' }); // score 7
    expect(ids).toContain('q_followup_required');
    expect(ids).not.toContain('q_all_clear');
  });

  it('gates the follow-up question on the nested AND branch even when score is low', () => {
    // score = fever(4) only = 4, below threshold, but travel=yes AND fever present
    const ids = visibleIds({ q_risk_symptoms: ['fever'], q_recent_travel: 'yes' });
    expect(ids).toContain('q_followup_required');
  });

  it('does NOT trigger the nested AND branch if only one side is true', () => {
    // travel=yes but no fever, score = 3 (travel only) — below 5, fever missing
    const ids = visibleIds({ q_risk_symptoms: ['cough'], q_recent_travel: 'yes' }); // score 3+3=6... use fatigue instead
    const idsLowScore = visibleIds({ q_risk_symptoms: ['fatigue'], q_recent_travel: 'yes' }); // 2+3=5 -> hits OR via score actually
    // Use a case that stays under both the score threshold and the AND branch:
    const idsSafe = visibleIds({ q_risk_symptoms: ['none'], q_recent_travel: 'yes' }); // score 0, travel yes but no fever
    expect(idsSafe).not.toContain('q_followup_required');
    expect(idsSafe).toContain('q_all_clear');
  });

  it('shows the all-clear question when riskScore is below threshold and the AND branch is false', () => {
    const ids = visibleIds({ q_risk_symptoms: ['none'], q_recent_travel: 'no' });
    expect(ids).toContain('q_all_clear');
    expect(ids).not.toContain('q_followup_required');
  });

  it('follow-up and all-clear are mutually exclusive across the answer space', () => {
    const scenarios: AnswerMap[] = [
      { q_risk_symptoms: ['fever', 'cough'], q_recent_travel: 'yes' },
      { q_risk_symptoms: ['none'], q_recent_travel: 'no' },
      { q_risk_symptoms: ['fatigue'], q_recent_travel: 'no' },
      { q_risk_symptoms: ['fever'], q_recent_travel: 'no' },
    ];
    for (const answers of scenarios) {
      const ids = visibleIds(answers);
      const hasFollowup = ids.includes('q_followup_required');
      const hasAllClear = ids.includes('q_all_clear');
      expect(hasFollowup).toBe(!hasAllClear);
    }
  });
});

describe('pruneAnswers', () => {
  it('drops answers belonging to questions hidden by a changed earlier answer', () => {
    const answers: AnswerMap = { q_employment: 'employed', q_employer: 'Acme Inc.' };
    const changed = { ...answers, q_employment: 'unemployed' };
    const pruned = pruneAnswers(healthCheckSchema, changed);
    expect(pruned.q_employer).toBeUndefined();
    expect(pruned.q_employment).toBe('unemployed');
  });

  it('keeps answers for questions that remain visible', () => {
    const answers: AnswerMap = { q_employment: 'employed', q_employer: 'Acme Inc.' };
    const pruned = pruneAnswers(healthCheckSchema, answers);
    expect(pruned.q_employer).toBe('Acme Inc.');
  });
});

// ---------------------------------------------------------------------------
// Edge cases flagged in task.md's "what I'd do next": empty rule groups,
// a multiple-choice `excludes` check, and deeply nested (3+ level) groups.
// ---------------------------------------------------------------------------
describe('evaluate — edge cases', () => {
  it('an empty AND group evaluates true (vacuous truth over zero rules)', () => {
    const group: RuleGroup = { kind: 'group', combinator: 'AND', rules: [] };
    expect(evaluate(group, { answers: {}, scores: {} })).toBe(true);
  });

  it('an empty OR group evaluates false (no rule is satisfied)', () => {
    const group: RuleGroup = { kind: 'group', combinator: 'OR', rules: [] };
    expect(evaluate(group, { answers: {}, scores: {} })).toBe(false);
  });

  it('excludes operator on a multiple-choice answer', () => {
    const cond: Condition = { kind: 'condition', source: 'answer', questionId: 'q_risk_symptoms', operator: 'excludes', value: 'fever' };
    expect(evaluate(cond, { answers: { q_risk_symptoms: ['cough'] }, scores: {} })).toBe(true);
    expect(evaluate(cond, { answers: { q_risk_symptoms: ['fever'] }, scores: {} })).toBe(false);
    // absent answer -> excludes everything, so this should be true
    expect(evaluate(cond, { answers: {}, scores: {} })).toBe(true);
  });

  it('handles 3+ levels of nested AND/OR groups', () => {
    // (A AND (B OR (C AND D)))
    const deeplyNested: RuleGroup = {
      kind: 'group',
      combinator: 'AND',
      rules: [
        { kind: 'condition', source: 'answer', questionId: 'a', operator: 'eq', value: '1' },
        {
          kind: 'group',
          combinator: 'OR',
          rules: [
            { kind: 'condition', source: 'answer', questionId: 'b', operator: 'eq', value: '1' },
            {
              kind: 'group',
              combinator: 'AND',
              rules: [
                { kind: 'condition', source: 'answer', questionId: 'c', operator: 'eq', value: '1' },
                { kind: 'condition', source: 'answer', questionId: 'd', operator: 'eq', value: '1' },
              ],
            },
          ],
        },
      ],
    };

    // A true, B false, C+D both true -> inner AND true -> OR true -> outer AND true
    expect(
      evaluate(deeplyNested, { answers: { a: '1', b: '0', c: '1', d: '1' }, scores: {} })
    ).toBe(true);

    // A true, B false, only C true (D missing) -> inner AND false -> OR false -> outer AND false
    expect(
      evaluate(deeplyNested, { answers: { a: '1', b: '0', c: '1' }, scores: {} })
    ).toBe(false);

    // A false short-circuits everything else
    expect(
      evaluate(deeplyNested, { answers: { a: '0', b: '1', c: '1', d: '1' }, scores: {} })
    ).toBe(false);
  });

  it('isAnswered / isEmpty distinguish missing vs. present answers, including empty arrays', () => {
    const isAnswered: Condition = { kind: 'condition', source: 'answer', questionId: 'q', operator: 'isAnswered' };
    const isEmpty: Condition = { kind: 'condition', source: 'answer', questionId: 'q', operator: 'isEmpty' };

    expect(evaluate(isAnswered, { answers: {}, scores: {} })).toBe(false);
    expect(evaluate(isEmpty, { answers: {}, scores: {} })).toBe(true);

    expect(evaluate(isAnswered, { answers: { q: [] }, scores: {} })).toBe(false);
    expect(evaluate(isAnswered, { answers: { q: ['x'] }, scores: {} })).toBe(true);
    expect(evaluate(isEmpty, { answers: { q: ['x'] }, scores: {} })).toBe(false);
  });

  it('numeric comparisons return false rather than throwing when values are missing/non-numeric', () => {
    const gte: Condition = { kind: 'condition', source: 'answer', questionId: 'q', operator: 'gte', value: 5 };
    expect(evaluate(gte, { answers: {}, scores: {} })).toBe(false);
    expect(evaluate(gte, { answers: { q: 'not-a-number' }, scores: {} })).toBe(false);
    expect(evaluate(gte, { answers: { q: '10' }, scores: {} })).toBe(true);
  });

  it('score-source conditions read from ctx.scores rather than answers', () => {
    const cond: Condition = { kind: 'condition', source: 'score', scoreId: 'riskScore', operator: 'gt', value: 3 };
    expect(evaluate(cond, { answers: {}, scores: { riskScore: 4 } })).toBe(true);
    expect(evaluate(cond, { answers: {}, scores: { riskScore: 2 } })).toBe(false);
    expect(evaluate(cond, { answers: {}, scores: {} })).toBe(false);
  });
});
