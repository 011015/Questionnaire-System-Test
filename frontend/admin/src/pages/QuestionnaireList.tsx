import { useEffect, useState } from 'react';
import { Questionnaire } from '../schema/types';
import { deleteQuestionnaire, listQuestionnaires } from '../api';

interface Props {
  onSelect: (q: Questionnaire) => void;
  onCreateNew: () => void;
}

export function QuestionnaireList({ onSelect, onCreateNew }: Props) {
  const [items, setItems] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listQuestionnaires()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const remove = async (id: string) => {
    if (!confirm(`Delete questionnaire "${id}"?`)) return;
    await deleteQuestionnaire(id);
    load();
  };

  if (loading) return <p>Loading…</p>;
  if (error)
    return (
      <div className="error-banner">
        Could not reach storage service at the configured API URL. Is the backend running?
        <br />
        {error}
      </div>
    );

  return (
    <div className="list-page">
      <div className="editor-toolbar">
        <h1>Questionnaires</h1>
        <div className="spacer" />
        <button type="button" onClick={onCreateNew}>
          + New questionnaire
        </button>
      </div>
      {items.length === 0 && <p>No questionnaires yet. Create one to get started.</p>}
      <ul className="questionnaire-list">
        {items.map((q) => (
          <li key={q.id}>
            <div>
              <strong>{q.title || q.id}</strong>
              <div className="hint">{q.questions.length} question(s) · id: {q.id}</div>
            </div>
            <div>
              <button type="button" onClick={() => onSelect(q)}>
                Edit
              </button>
              <button type="button" className="btn-remove" onClick={() => remove(q.id)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
