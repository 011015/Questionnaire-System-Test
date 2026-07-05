// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useQuestionnaireRuntime } from './useQuestionnaireRuntime';
import { Questionnaire } from './schema/types';

const schema: Questionnaire = {
  id: 'branching-demo',
  title: 'Branching demo',
  version: 1,
  questions: [
    {
      id: 'q_track',
      type: 'single',
      title: 'Which track?',
      options: [
        { id: 'o1', label: 'A', value: 'a' },
        { id: 'o2', label: 'B', value: 'b' },
      ],
    },
    {
      id: 'q_a_only',
      type: 'text',
      title: 'A-track question',
      visibleIf: { kind: 'group', combinator: 'AND', rules: [{ kind: 'condition', source: 'answer', questionId: 'q_track', operator: 'eq', value: 'a' }] },
    },
    {
      id: 'q_b_only',
      type: 'text',
      title: 'B-track question',
      visibleIf: { kind: 'group', combinator: 'AND', rules: [{ kind: 'condition', source: 'answer', questionId: 'q_track', operator: 'eq', value: 'b' }] },
    },
    { id: 'q_last', type: 'text', title: 'Final question' },
  ],
};

describe('useQuestionnaireRuntime', () => {
  it('starts on the first question with nothing answered', () => {
    const { result } = renderHook(() => useQuestionnaireRuntime(schema));
    expect(result.current.current.id).toBe('q_track');
    expect(result.current.index).toBe(0);
    expect(result.current.finished).toBe(false);
    // Both branch questions are hidden until q_track is answered.
    expect(result.current.visibleQuestions.map((q) => q.id)).toEqual(['q_track', 'q_last']);
  });

  it('reveals the matching branch question immediately after answering, and advances into it', () => {
    const { result } = renderHook(() => useQuestionnaireRuntime(schema));

    act(() => result.current.setAnswer('q_track', 'a'));
    expect(result.current.visibleQuestions.map((q) => q.id)).toEqual(['q_track', 'q_a_only', 'q_last']);

    act(() => result.current.next());
    expect(result.current.current.id).toBe('q_a_only');
  });

  it('re-clamps forward when switching branches so a stale question is never shown', () => {
    const { result } = renderHook(() => useQuestionnaireRuntime(schema));

    act(() => result.current.setAnswer('q_track', 'a'));
    act(() => result.current.next()); // now on q_a_only, index 1

    // Flip the branch — q_a_only should disappear and the hook should not be
    // left pointing at a hidden question.
    act(() => result.current.setAnswer('q_track', 'b'));
    expect(result.current.visibleQuestions.map((q) => q.id)).toEqual(['q_track', 'q_b_only', 'q_last']);
    expect(result.current.visibleQuestions[result.current.index].id).not.toBe('q_a_only');
  });

  it('prunes the stale branch answer when switching tracks', () => {
    const { result } = renderHook(() => useQuestionnaireRuntime(schema));

    act(() => result.current.setAnswer('q_track', 'a'));
    act(() => result.current.setAnswer('q_a_only', 'some answer'));
    expect(result.current.answers.q_a_only).toBe('some answer');

    act(() => result.current.setAnswer('q_track', 'b'));
    expect(result.current.answers.q_a_only).toBeUndefined();
  });

  it('walks to the end and sets finished on the final next()', () => {
    const { result } = renderHook(() => useQuestionnaireRuntime(schema));

    act(() => result.current.setAnswer('q_track', 'a'));
    act(() => result.current.next()); // -> q_a_only
    act(() => result.current.next()); // -> q_last
    expect(result.current.isLast).toBe(true);

    act(() => result.current.next()); // -> finished
    expect(result.current.finished).toBe(true);
  });

  it('back() from the finished state returns to the last question rather than decrementing index', () => {
    const { result } = renderHook(() => useQuestionnaireRuntime(schema));
    act(() => result.current.setAnswer('q_track', 'a'));
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next()); // finished
    expect(result.current.finished).toBe(true);

    act(() => result.current.back());
    expect(result.current.finished).toBe(false);
    expect(result.current.current.id).toBe('q_last');
  });

  it('restart() clears answers and returns to the first question', () => {
    const { result } = renderHook(() => useQuestionnaireRuntime(schema));
    act(() => result.current.setAnswer('q_track', 'a'));
    act(() => result.current.next());

    act(() => result.current.restart());
    expect(result.current.answers).toEqual({});
    expect(result.current.index).toBe(0);
    expect(result.current.finished).toBe(false);
    expect(result.current.current.id).toBe('q_track');
  });
});
