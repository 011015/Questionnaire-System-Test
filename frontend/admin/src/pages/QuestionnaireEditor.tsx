import { useState } from 'react';
import { Questionnaire, QuestionDef } from '../schema/types';
import { QuestionEditor } from '../components/QuestionEditor';
import { ScoringEditor } from '../components/ScoringEditor';
import { createQuestionnaire, updateQuestionnaire } from '../api';

interface Props {
  initial: Questionnaire;
  isNew: boolean;
  onSaved: (q: Questionnaire) => void;
  onCancel: () => void;
}

function newQuestion(n: number): QuestionDef {
  return {
    id: `q_${Date.now()}_${n}`,
    type: 'single',
    title: '',
    options: [{ id: `opt_${Date.now()}`, label: '', value: 'value_1' }],
  };
}

const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:5174';

export function QuestionnaireEditor({ initial, isNew, onSaved, onCancel }: Props) {
  const [q, setQ] = useState<Questionnaire>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateQuestion = (idx: number, next: QuestionDef) => {
    const questions = [...q.questions];
    questions[idx] = next;
    setQ({ ...q, questions });
  };

  const removeQuestion = (idx: number) => {
    const removedId = q.questions[idx].id;
    setQ({
      ...q,
      questions: q.questions.filter((_, i) => i !== idx),
      scoring: (q.scoring ?? []).map((s) => ({ ...s, questionIds: s.questionIds.filter((id) => id !== removedId) })),
    });
  };

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= q.questions.length) return;
    const questions = [...q.questions];
    [questions[idx], questions[target]] = [questions[target], questions[idx]];
    setQ({ ...q, questions });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = isNew ? await createQuestionnaire(q) : await updateQuestionnaire(q);
      onSaved(saved);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="editor-page">
      <div className="editor-toolbar">
        <button type="button" onClick={onCancel}>
          ← Back
        </button>
        <div className="spacer" />
        <a href={`${WEB_APP_URL}/?id=${q.id}`} target="_blank" rel="noreferrer">
          Preview in runtime app ↗
        </a>
        <button type="button" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <label>
        Questionnaire ID (used in URL / storage key)
        <input value={q.id} disabled={!isNew} onChange={(e) => setQ({ ...q, id: e.target.value })} />
      </label>
      <label>
        Title
        <input value={q.title} onChange={(e) => setQ({ ...q, title: e.target.value })} />
      </label>
      <label>
        Description
        <input value={q.description ?? ''} onChange={(e) => setQ({ ...q, description: e.target.value })} />
      </label>

      <h2>Questions</h2>
      {q.questions.map((question, idx) => (
        <QuestionEditor
          key={question.id}
          question={question}
          index={idx}
          allQuestions={q.questions}
          scoring={q.scoring ?? []}
          onChange={(next) => updateQuestion(idx, next)}
          onRemove={() => removeQuestion(idx)}
          onMove={(dir) => moveQuestion(idx, dir)}
        />
      ))}
      <button type="button" onClick={() => setQ({ ...q, questions: [...q.questions, newQuestion(q.questions.length + 1)] })}>
        + Add question
      </button>

      <ScoringEditor
        scoring={q.scoring ?? []}
        questions={q.questions}
        onChange={(scoring) => setQ({ ...q, scoring })}
      />
    </div>
  );
}
