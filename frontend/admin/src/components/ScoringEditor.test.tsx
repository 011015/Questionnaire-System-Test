// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScoringEditor } from './ScoringEditor';
import { QuestionDef, ScoringRule } from '../schema/types';

const questions: QuestionDef[] = [
  { id: 'q1', type: 'multiple', title: 'Symptoms', options: [{ id: 'o1', label: 'Fever', value: 'fever', score: 4 }] },
  { id: 'q2', type: 'single', title: 'Travel', options: [{ id: 'o2', label: 'Yes', value: 'yes', score: 3 }] },
  { id: 'q3', type: 'text', title: 'Free text — should never be scoreable' },
];

function Harness({ initial }: { initial: ScoringRule[] }) {
  const [scoring, setScoring] = useState(initial);
  return <ScoringEditor scoring={scoring} questions={questions} onChange={setScoring} />;
}

describe('ScoringEditor', () => {
  it('only lists option-bearing questions as scoreable, excluding free-text questions', () => {
    render(<Harness initial={[{ id: 'riskScore', label: 'Risk', questionIds: [] }]} />);
    expect(screen.getByText('Symptoms')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.queryByText('Free text — should never be scoreable')).not.toBeInTheDocument();
  });

  it('adds a new blank scoring rule when "+ Scoring rule" is clicked', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[]} />);
    expect(screen.queryByText('Score id')).not.toBeInTheDocument();

    await user.click(screen.getByText('+ Scoring rule'));
    expect(screen.getByDisplayValue('score_1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('New score')).toBeInTheDocument();
  });

  it('checking a question checkbox adds it to questionIds; unchecking removes it', async () => {
    const user = userEvent.setup();
    render(<Harness initial={[{ id: 'riskScore', label: 'Risk', questionIds: [] }]} />);

    const symptomsCheckbox = screen.getByRole('checkbox', { name: 'Symptoms' });
    expect(symptomsCheckbox).not.toBeChecked();

    await user.click(symptomsCheckbox);
    expect(symptomsCheckbox).toBeChecked();

    await user.click(symptomsCheckbox);
    expect(symptomsCheckbox).not.toBeChecked();
  });

  it('editing the label input updates that rule only, leaving others untouched', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { id: 'riskScore', label: 'Risk', questionIds: [] },
          { id: 'otherScore', label: 'Other', questionIds: ['q2'] },
        ]}
      />
    );

    const riskLabelInput = screen.getByDisplayValue('Risk');
    await user.clear(riskLabelInput);
    await user.type(riskLabelInput, 'Health Risk');

    expect(screen.getByDisplayValue('Health Risk')).toBeInTheDocument();
    // The other rule's checkbox state must be unaffected — scope the lookup
    // to that card since both cards render a "Travel" checkbox.
    const otherCard = screen.getByDisplayValue('Other').closest('.scoring-rule-card') as HTMLElement;
    expect(screen.getByDisplayValue('Other')).toBeInTheDocument();
    expect(within(otherCard).getByRole('checkbox', { name: 'Travel' })).toBeChecked();
  });

  it('deleting a rule removes only that card', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          { id: 'riskScore', label: 'Risk', questionIds: [] },
          { id: 'otherScore', label: 'Other', questionIds: [] },
        ]}
      />
    );
    expect(screen.getAllByText('Delete')).toHaveLength(2);
    await user.click(screen.getAllByText('Delete')[0]);
    expect(screen.getAllByText('Delete')).toHaveLength(1);
    expect(screen.queryByDisplayValue('Risk')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Other')).toBeInTheDocument();
  });
});
