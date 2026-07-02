import {
  Condition,
  Operator,
  QuestionDef,
  RuleGroup,
  ScoringRule,
  isCondition,
} from '../schema/types';

interface Props {
  group: RuleGroup;
  onChange: (g: RuleGroup) => void;
  questions: QuestionDef[];
  scoring: ScoringRule[];
}

const OPERATORS: { value: Operator; label: string }[] = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'includes', label: 'includes' },
  { value: 'excludes', label: 'excludes' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'isAnswered', label: 'is answered' },
  { value: 'isEmpty', label: 'is empty' },
];

function emptyCondition(): Condition {
  return { kind: 'condition', source: 'answer', operator: 'eq' };
}

function emptyGroup(): RuleGroup {
  return { kind: 'group', combinator: 'AND', rules: [] };
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
  questions,
  scoring,
}: {
  condition: Condition;
  onChange: (c: Condition) => void;
  onRemove: () => void;
  questions: QuestionDef[];
  scoring: ScoringRule[];
}) {
  const targetQuestion = questions.find((q) => q.id === condition.questionId);
  const needsValueInput = !['isAnswered', 'isEmpty'].includes(condition.operator);
  const isChoiceValue =
    condition.source === 'answer' && targetQuestion?.options && needsValueInput;

  return (
    <div className="rule-row">
      <select
        value={condition.source}
        onChange={(e) =>
          onChange({ ...condition, source: e.target.value as 'answer' | 'score', questionId: undefined, scoreId: undefined })
        }
      >
        <option value="answer">Answer</option>
        <option value="score">Score</option>
      </select>

      {condition.source === 'answer' ? (
        <select
          value={condition.questionId ?? ''}
          onChange={(e) => onChange({ ...condition, questionId: e.target.value })}
        >
          <option value="" disabled>
            select question
          </option>
          {questions.map((q) => (
            <option key={q.id} value={q.id}>
              {q.title || q.id}
            </option>
          ))}
        </select>
      ) : (
        <select
          value={condition.scoreId ?? ''}
          onChange={(e) => onChange({ ...condition, scoreId: e.target.value })}
        >
          <option value="" disabled>
            select score
          </option>
          {scoring.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label || s.id}
            </option>
          ))}
        </select>
      )}

      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as Operator })}
      >
        {OPERATORS.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {needsValueInput &&
        (isChoiceValue ? (
          <select
            value={(condition.value as string) ?? ''}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
          >
            <option value="" disabled>
              select value
            </option>
            {targetQuestion!.options!.map((o) => (
              <option key={o.id} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            placeholder="value"
            value={(condition.value as string) ?? ''}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
          />
        ))}

      <button type="button" className="btn-remove" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}

export function RuleGroupEditor({ group, onChange, questions, scoring }: Props) {
  const updateRule = (idx: number, next: Condition | RuleGroup) => {
    const rules = [...group.rules];
    rules[idx] = next;
    onChange({ ...group, rules });
  };

  const removeRule = (idx: number) => {
    onChange({ ...group, rules: group.rules.filter((_, i) => i !== idx) });
  };

  return (
    <div className="rule-group">
      <div className="rule-group-header">
        <span>Match</span>
        <select
          value={group.combinator}
          onChange={(e) => onChange({ ...group, combinator: e.target.value as 'AND' | 'OR' })}
        >
          <option value="AND">ALL</option>
          <option value="OR">ANY</option>
        </select>
        <span>of the following:</span>
      </div>

      {group.rules.map((r, idx) =>
        isCondition(r) ? (
          <ConditionRow
            key={idx}
            condition={r}
            onChange={(c) => updateRule(idx, c)}
            onRemove={() => removeRule(idx)}
            questions={questions}
            scoring={scoring}
          />
        ) : (
          <div key={idx} className="rule-nested">
            <RuleGroupEditor group={r} onChange={(g) => updateRule(idx, g)} questions={questions} scoring={scoring} />
            <button type="button" className="btn-remove" onClick={() => removeRule(idx)}>
              Remove nested group
            </button>
          </div>
        )
      )}

      <div className="rule-group-actions">
        <button type="button" onClick={() => onChange({ ...group, rules: [...group.rules, emptyCondition()] })}>
          + Condition
        </button>
        <button type="button" onClick={() => onChange({ ...group, rules: [...group.rules, emptyGroup()] })}>
          + Nested group
        </button>
      </div>
    </div>
  );
}
