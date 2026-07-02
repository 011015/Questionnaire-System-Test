import { useMemo, useState } from 'react';
import { AnswerMap, AnswerValue, Questionnaire } from './schema/types';
import { computeScores, getVisibleQuestions, pruneAnswers } from './schema/ruleEngine';

export function useQuestionnaireRuntime(schema: Questionnaire) {
  const [answers, setAnswersState] = useState<AnswerMap>({});
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  const visibleQuestions = useMemo(() => getVisibleQuestions(schema, answers), [schema, answers]);
  const scores = useMemo(() => computeScores(schema, answers), [schema, answers]);
  const current = visibleQuestions[index];

  function setAnswer(questionId: string, value: AnswerValue) {
    const nextAnswers = pruneAnswers(schema, { ...answers, [questionId]: value });
    setAnswersState(nextAnswers);

    // Re-clamp index against the new visible list so branching/skipping takes
    // effect immediately (e.g. an earlier answer changing hides the current question).
    const nextVisible = getVisibleQuestions(schema, nextAnswers);
    const currentId = visibleQuestions[index]?.id;
    const newIdx = nextVisible.findIndex((q) => q.id === currentId);
    setIndex(newIdx === -1 ? Math.min(index, Math.max(nextVisible.length - 1, 0)) : newIdx);
  }

  function next() {
    if (index < visibleQuestions.length - 1) {
      setIndex(index + 1);
    } else {
      setFinished(true);
    }
  }

  function back() {
    if (finished) {
      setFinished(false);
      return;
    }
    if (index > 0) setIndex(index - 1);
  }

  function restart() {
    setAnswersState({});
    setIndex(0);
    setFinished(false);
  }

  return {
    answers,
    scores,
    visibleQuestions,
    current,
    index,
    finished,
    setAnswer,
    next,
    back,
    restart,
    isLast: index === visibleQuestions.length - 1,
  };
}
