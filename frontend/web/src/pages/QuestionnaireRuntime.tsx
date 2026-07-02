import { Questionnaire } from '../schema/types';
import { useQuestionnaireRuntime } from '../useQuestionnaireRuntime';
import { QuestionRenderer } from '../components/QuestionRenderer';
import { ProgressBar } from '../components/ProgressBar';

export function QuestionnaireRuntime({ schema }: { schema: Questionnaire }) {
  const rt = useQuestionnaireRuntime(schema);

  if (rt.visibleQuestions.length === 0) {
    return <p>This questionnaire has no questions yet.</p>;
  }

  if (rt.finished) {
    return (
      <div className="summary">
        <h1>All done</h1>
        <p className="hint">This is a demo summary — the assessment scope excludes answer submission/persistence.</p>
        <h3>Your answers</h3>
        <ul>
          {rt.visibleQuestions.map((q) => (
            <li key={q.id}>
              <strong>{q.title}</strong>: {formatAnswer(rt.answers[q.id])}
            </li>
          ))}
        </ul>
        {Object.keys(rt.scores).length > 0 && (
          <>
            <h3>Computed scores</h3>
            <ul>
              {Object.entries(rt.scores).map(([id, val]) => (
                <li key={id}>
                  {id}: {val}
                </li>
              ))}
            </ul>
          </>
        )}
        <button type="button" onClick={rt.restart}>
          Restart
        </button>
      </div>
    );
  }

  const q = rt.current;
  const canProceed = !q.required || hasAnswer(rt.answers[q.id]);

  return (
    <div className="runtime-page">
      <ProgressBar index={rt.index} total={rt.visibleQuestions.length} />
      <QuestionRenderer question={q} value={rt.answers[q.id]} onChange={(v) => rt.setAnswer(q.id, v)} />
      <div className="runtime-actions">
        <button type="button" onClick={rt.back} disabled={rt.index === 0}>
          Back
        </button>
        <button type="button" onClick={rt.next} disabled={!canProceed}>
          {rt.isLast ? 'Finish' : 'Next'}
        </button>
      </div>
    </div>
  );
}

function hasAnswer(v: unknown): boolean {
  if (v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim().length > 0;
}

function formatAnswer(v: unknown): string {
  if (v === undefined) return '(no answer)';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}
