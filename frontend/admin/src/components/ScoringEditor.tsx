import { QuestionDef, ScoringRule } from '../schema/types';

interface Props {
  scoring: ScoringRule[];
  questions: QuestionDef[];
  onChange: (s: ScoringRule[]) => void;
}

export function ScoringEditor({ scoring, questions, onChange }: Props) {
  const optionBearingQuestions = questions.filter((q) => q.type !== 'text');

  const update = (i: number, rule: ScoringRule) => {
    const next = [...scoring];
    next[i] = rule;
    onChange(next);
  };

  const remove = (i: number) => onChange(scoring.filter((_, idx) => idx !== i));

  const toggleQuestion = (rule: ScoringRule, qId: string, checked: boolean) => {
    const questionIds = checked ? [...rule.questionIds, qId] : rule.questionIds.filter((id) => id !== qId);
    return { ...rule, questionIds };
  };

  return (
    <div className="scoring-editor">
      <h3>Scoring rules</h3>
      <p className="hint">
        A scoring rule sums the <code>score</code> value of selected options across the chosen questions. Reference it
        from a question's visibility rule via source = "Score".
      </p>
      {scoring.map((rule, i) => (
        <div key={rule.id} className="scoring-rule-card">
          <div className="question-row">
            <label>
              Score id
              <input value={rule.id} onChange={(e) => update(i, { ...rule, id: e.target.value })} />
            </label>
            <label>
              Label
              <input value={rule.label} onChange={(e) => update(i, { ...rule, label: e.target.value })} />
            </label>
            <button type="button" className="btn-remove" onClick={() => remove(i)}>
              Delete
            </button>
          </div>
          <div className="scoring-question-list">
            {optionBearingQuestions.map((q) => (
              <label key={q.id} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rule.questionIds.includes(q.id)}
                  onChange={(e) => update(i, toggleQuestion(rule, q.id, e.target.checked))}
                />
                {q.title || q.id}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange([...scoring, { id: `score_${scoring.length + 1}`, label: 'New score', questionIds: [] }])
        }
      >
        + Scoring rule
      </button>
    </div>
  );
}
