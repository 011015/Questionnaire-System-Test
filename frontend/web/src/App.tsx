import { useEffect, useState } from 'react';
import { Questionnaire } from './schema/types';
import { getQuestionnaire } from './api';
import { QuestionnaireRuntime } from './pages/QuestionnaireRuntime';

const DEFAULT_ID = 'onboarding-health-check';

export default function App() {
  const [schema, setSchema] = useState<Questionnaire | null>(null);
  const [error, setError] = useState<string | null>(null);

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || DEFAULT_ID;

  useEffect(() => {
    getQuestionnaire(id)
      .then(setSchema)
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Questionnaire</h1>
      </header>
      <main>
        {error && (
          <div className="error-banner">
            {error}
            <br />
            Is the backend running on the configured API URL? Try ?id=onboarding-health-check.
          </div>
        )}
        {!error && !schema && <p>Loading…</p>}
        {schema && <QuestionnaireRuntime schema={schema} />}
      </main>
    </div>
  );
}
