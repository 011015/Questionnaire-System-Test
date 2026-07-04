// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleGroupEditor } from './RuleGroupEditor';
import { QuestionDef, RuleGroup, ScoringRule } from '../schema/types';

const questions: QuestionDef[] = [
  { id: 'q_employment', type: 'single', title: 'Employment', options: [{ id: 'o1', label: 'Employed', value: 'employed' }] },
];
const scoring: ScoringRule[] = [{ id: 'riskScore', label: 'Health Risk Score', questionIds: [] }];

function Harness({ initial }: { initial: RuleGroup }) {
  const [group, setGroup] = useState(initial);
  return <RuleGroupEditor group={group} onChange={setGroup} questions={questions} scoring={scoring} />;
}

function emptyGroup(): RuleGroup {
  return { kind: 'group', combinator: 'AND', rules: [] };
}

describe('RuleGroupEditor', () => {
  it('adds a condition row with "+ Condition", defaulting to source = answer', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyGroup()} />);
    expect(screen.queryByText('select question')).not.toBeInTheDocument();

    await user.click(screen.getByText('+ Condition'));
    // The new condition row defaults to "answer" source, so a question
    // dropdown (not a score dropdown) should appear.
    expect(screen.getByText('select question')).toBeInTheDocument();
  });

  it('switching combinator between AND/OR updates the select value', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyGroup()} />);
    const combinatorSelect = screen.getByDisplayValue('ALL');
    expect(combinatorSelect).toBeInTheDocument();

    await user.selectOptions(combinatorSelect, 'OR');
    expect(screen.getByDisplayValue('ANY')).toBeInTheDocument();
  });

  it('switching a condition source from Answer to Score swaps the dropdown and clears the prior selection', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyGroup()} />);
    await user.click(screen.getByText('+ Condition'));

    const questionSelect = screen.getByText('select question').closest('select')!;
    await user.selectOptions(questionSelect, 'q_employment');
    expect(within(questionSelect).getByText('Employment')).toBeInTheDocument();

    const sourceSelect = screen.getByDisplayValue('Answer');
    await user.selectOptions(sourceSelect, 'score');

    // Question dropdown is gone, replaced by a score dropdown; the previous
    // questionId selection must not leak through.
    expect(screen.queryByText('select question')).not.toBeInTheDocument();
    expect(screen.getByText('select score')).toBeInTheDocument();
  });

  it('operators that need no value (isAnswered/isEmpty) hide the value input', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyGroup()} />);
    await user.click(screen.getByText('+ Condition'));

    const questionSelect = screen.getByText('select question').closest('select')!;
    await user.selectOptions(questionSelect, 'q_employment');

    // eq (default) on a question with options renders a value <select>.
    expect(screen.getByText('select value')).toBeInTheDocument();

    const operatorSelect = screen.getByDisplayValue('equals');
    await user.selectOptions(operatorSelect, 'isAnswered');
    expect(screen.queryByText('select value')).not.toBeInTheDocument();
  });

  it('adds a nested group with "+ Nested group" and can remove it independently of sibling conditions', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyGroup()} />);

    await user.click(screen.getByText('+ Condition'));
    await user.click(screen.getByText('+ Nested group'));

    expect(screen.getByText('Remove nested group')).toBeInTheDocument();
    // Nested group has its own "Match ... of the following" header — two
    // "ALL" selects should now exist (outer + nested).
    expect(screen.getAllByDisplayValue('ALL')).toHaveLength(2);

    await user.click(screen.getByText('Remove nested group'));
    expect(screen.queryByText('Remove nested group')).not.toBeInTheDocument();
    expect(screen.getAllByDisplayValue('ALL')).toHaveLength(1);
  });

  it('removing a condition via ✕ leaves other rules intact', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyGroup()} />);
    await user.click(screen.getByText('+ Condition'));
    await user.click(screen.getByText('+ Nested group'));

    expect(screen.getAllByText('✕')).toHaveLength(1); // only the condition row has a ✕ remove button at top level
    await user.click(screen.getByText('✕'));
    expect(screen.queryByText('select question')).not.toBeInTheDocument();
    // Nested group survives.
    expect(screen.getByText('Remove nested group')).toBeInTheDocument();
  });
});
