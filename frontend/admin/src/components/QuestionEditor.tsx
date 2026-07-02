import { OptionDef, QuestionDef, QuestionType, RuleGroup, ScoringRule } from '../schema/types';
import { RuleGroupEditor } from './RuleGroupEditor';

interface Props {
  question: QuestionDef;
  index: number;
  allQuestions: QuestionDef[];
  scoring: ScoringRule[];
  onChange: (q: QuestionDef) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}

function newOption(n: number): OptionDef {
  return { id: `opt_${Date.now()}_${n}`, label: '', value: `value_${n}` };
}

export function QuestionEditor({ question, index, allQuestions, scoring, onChange, onRemove, onMove }: Props) {
  const priorQuestions = allQuestions.slice(0, index); // can only depend on earlier questions

  const setType = (type: QuestionType) => {
    onChange({
      ...question,
      type,
      options: type === 'text' ? undefined : question.options ?? [newOption(1)],
    });
  };

  const updateOption = (i: number, opt: OptionDef) => {
    const options = [...(question.options ?? [])];
    options[i] = opt;
    onChange({ ...question, options });
  };

  const removeOption = (i: number) => {
    onChange({ ...question, options: (question.options ?? []).filter((_, idx) => idx !== i) });
  };

  const toggleConditional = (enabled: boolean) => {
    onChange({
      ...question,
      visibleIf: enabled ? ({ kind: 'group', combinator: 'AND', rules: [] } as RuleGroup) : undefined,
    });
  };

  return (
    <div className="question-card">
      <div className="question-card-header">
        <strong>Q{index + 1}</strong>
        <div className="question-card-actions">
          <button type="button" onClick={() => onMove(-1)} title="Move up">
            ↑
          </button>
          <button type="button" onClick={() => onMove(1)} title="Move down">
            ↓
          </button>
          <button type="button" className="btn-remove" onClick={onRemove}>
            Delete question
          </button>
        </div>
      </div>

      <label>
        Title
        <input value={question.title} onChange={(e) => onChange({ ...question, title: e.target.value })} />
      </label>

      <label>
        Description (optional)
        <input
          value={question.description ?? ''}
          onChange={(e) => onChange({ ...question, description: e.target.value })}
        />
      </label>

      <div className="question-row">
        <label>
          Type
          <select value={question.type} onChange={(e) => setType(e.target.value as QuestionType)}>
            <option value="single">Single choice</option>
            <option value="multiple">Multiple choice</option>
            <option value="text">Free text</option>
          </select>
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={!!question.required}
            onChange={(e) => onChange({ ...question, required: e.target.checked })}
          />
          Required
        </label>
      </div>

      {question.type !== 'text' && (
        <div className="options-editor">
          <div className="options-editor-title">Options</div>
          {(question.options ?? []).map((opt, i) => (
            <div key={opt.id} className="option-row">
              <input
                placeholder="Label"
                value={opt.label}
                onChange={(e) => updateOption(i, { ...opt, label: e.target.value })}
              />
              <input
                placeholder="Value"
                value={opt.value}
                onChange={(e) => updateOption(i, { ...opt, value: e.target.value })}
              />
              <input
                placeholder="Score"
                type="number"
                value={opt.score ?? ''}
                onChange={(e) =>
                  updateOption(i, { ...opt, score: e.target.value === '' ? undefined : Number(e.target.value) })
                }
              />
              <button type="button" className="btn-remove" onClick={() => removeOption(i)}>
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...question, options: [...(question.options ?? []), newOption((question.options?.length ?? 0) + 1)] })}
          >
            + Option
          </button>
        </div>
      )}

      {question.type === 'text' && (
        <label>
          Placeholder
          <input
            value={question.placeholder ?? ''}
            onChange={(e) => onChange({ ...question, placeholder: e.target.value })}
          />
        </label>
      )}

      <div className="visibility-editor">
        <label className="checkbox-label">
          <input type="checkbox" checked={!!question.visibleIf} onChange={(e) => toggleConditional(e.target.checked)} />
          Conditionally visible
        </label>
        {question.visibleIf && (
          <RuleGroupEditor
            group={question.visibleIf}
            onChange={(g) => onChange({ ...question, visibleIf: g })}
            questions={priorQuestions}
            scoring={scoring}
          />
        )}
        {question.visibleIf && priorQuestions.length === 0 && (
          <p className="hint">No earlier questions to reference yet — move this question down or add earlier ones.</p>
        )}
      </div>
    </div>
  );
}
