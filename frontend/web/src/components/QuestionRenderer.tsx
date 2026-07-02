import { AnswerValue, QuestionDef } from '../schema/types';

interface Props {
  question: QuestionDef;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
}

export function QuestionRenderer({ question, value, onChange }: Props) {
  return (
    <div className="question">
      <h2>{question.title}</h2>
      {question.description && <p className="question-description">{question.description}</p>}

      {question.type === 'single' && (
        <div className="options-list">
          {question.options?.map((opt) => (
            <label key={opt.id} className="option-tile">
              <input
                type="radio"
                name={question.id}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}

      {question.type === 'multiple' && (
        <div className="options-list">
          {question.options?.map((opt) => {
            const arr = Array.isArray(value) ? value : [];
            const checked = arr.includes(opt.value);
            return (
              <label key={opt.id} className="option-tile">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, opt.value] : arr.filter((v) => v !== opt.value);
                    onChange(next);
                  }}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      )}

      {question.type === 'text' && (
        <textarea
          placeholder={question.placeholder}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      )}
    </div>
  );
}
