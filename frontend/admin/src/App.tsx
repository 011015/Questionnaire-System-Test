import { useState } from 'react';
import { Questionnaire } from './schema/types';
import { QuestionnaireList } from './pages/QuestionnaireList';
import { QuestionnaireEditor } from './pages/QuestionnaireEditor';

type View = { name: 'list' } | { name: 'edit'; questionnaire: Questionnaire; isNew: boolean };

function blankQuestionnaire(): Questionnaire {
  return {
    id: `questionnaire_${Date.now()}`,
    title: '',
    description: '',
    version: 1,
    questions: [],
    scoring: [],
  };
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'list' });
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Questionnaire Admin</h1>
      </header>
      <main>
        {view.name === 'list' && (
          <QuestionnaireList
            key={refreshKey}
            onSelect={(q) => setView({ name: 'edit', questionnaire: q, isNew: false })}
            onCreateNew={() => setView({ name: 'edit', questionnaire: blankQuestionnaire(), isNew: true })}
          />
        )}
        {view.name === 'edit' && (
          <QuestionnaireEditor
            initial={view.questionnaire}
            isNew={view.isNew}
            onCancel={() => setView({ name: 'list' })}
            onSaved={() => {
              setRefreshKey((k) => k + 1);
              setView({ name: 'list' });
            }}
          />
        )}
      </main>
    </div>
  );
}
