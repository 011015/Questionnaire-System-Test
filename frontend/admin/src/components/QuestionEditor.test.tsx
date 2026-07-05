// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionEditor } from './QuestionEditor';
import { QuestionDef } from '../schema/types';

function Harness({ initial, allQuestions = [], index = 0 }: { initial: QuestionDef; allQuestions?: QuestionDef[]; index?: number }) {
  const [question, setQuestion] = useState(initial);
  return (
    <QuestionEditor
      question={question}
      index={index}
      allQuestions={allQuestions}
      scoring={[]}
      onChange={setQuestion}
      onRemove={() => {}}
      onMove={() => {}}
    />
  );
}

const singleWithOptions = (): QuestionDef => ({
  id: 'q1',
  type: 'single',
  title: 'Pick one',
  options: [{ id: 'o1', label: 'A', value: 'value_1' }],
});

describe('QuestionEditor — type switching', () => {
  it('switching to "text" clears the options list', async () => {
    const user = userEvent.setup();
    render(<Harness initial={singleWithOptions()} />);
    expect(screen.getByText('Options')).toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('Single choice'), 'text');
    expect(screen.queryByText('Options')).not.toBeInTheDocument();
    expect(screen.getByText('Placeholder')).toBeInTheDocument();
  });

  it('switching from "text" to "single" seeds a default option rather than leaving it empty', async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ id: 'q1', type: 'text', title: 'An open-ended question' }} />);
    expect(screen.queryByText('Options')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue('Free text'), 'single');
    expect(screen.getByText('Options')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Label')).toHaveLength(1);
  });

  it('switching between single and multiple preserves existing options', async () => {
    const user = userEvent.setup();
    render(<Harness initial={singleWithOptions()} />);
    await user.selectOptions(screen.getByDisplayValue('Single choice'), 'multiple');
    expect(screen.getAllByPlaceholderText('Label')).toHaveLength(1);
    expect(screen.getByDisplayValue('A')).toBeInTheDocument();
  });
});

describe('QuestionEditor — options CRUD', () => {
  it('"+ Option" adds a new blank option row', async () => {
    const user = userEvent.setup();
    render(<Harness initial={singleWithOptions()} />);
    expect(screen.getAllByPlaceholderText('Label')).toHaveLength(1);

    await user.click(screen.getByText('+ Option'));
    expect(screen.getAllByPlaceholderText('Label')).toHaveLength(2);
  });

  it('removing an option via ✕ leaves the others intact', async () => {
    const q: QuestionDef = {
      id: 'q1',
      type: 'single',
      title: 'Pick one',
      options: [
        { id: 'o1', label: 'A', value: 'value_1' },
        { id: 'o2', label: 'B', value: 'value_2' },
      ],
    };
    const user = userEvent.setup();
    render(<Harness initial={q} />);
    expect(screen.getAllByPlaceholderText('Label')).toHaveLength(2);

    await user.click(screen.getAllByText('✕')[0]);
    expect(screen.getAllByPlaceholderText('Label')).toHaveLength(1);
    expect(screen.getByDisplayValue('B')).toBeInTheDocument();
  });
});

describe('QuestionEditor — conditional visibility', () => {
  const priorQuestion: QuestionDef = { id: 'q0', type: 'single', title: 'Earlier question', options: [{ id: 'o1', label: 'X', value: 'x' }] };

  it('toggling "Conditionally visible" on adds an empty AND rule group editor', async () => {
    const user = userEvent.setup();
    render(<Harness initial={singleWithOptions()} allQuestions={[priorQuestion, singleWithOptions()]} index={1} />);
    expect(screen.queryByText('Match')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Conditionally visible'));
    expect(screen.getByText('Match')).toBeInTheDocument();
  });

  it('toggling it back off removes visibleIf entirely rather than leaving an empty group', async () => {
    const user = userEvent.setup();
    render(<Harness initial={singleWithOptions()} allQuestions={[priorQuestion, singleWithOptions()]} index={1} />);
    const toggle = screen.getByLabelText('Conditionally visible');
    await user.click(toggle);
    expect(screen.getByText('Match')).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByText('Match')).not.toBeInTheDocument();
  });

  it('warns when there are no earlier questions to reference (forward-reference constraint)', async () => {
    const user = userEvent.setup();
    // index 0 -> allQuestions.slice(0, 0) -> no prior questions available
    render(<Harness initial={singleWithOptions()} allQuestions={[singleWithOptions()]} index={0} />);
    await user.click(screen.getByLabelText('Conditionally visible'));
    expect(screen.getByText(/No earlier questions to reference yet/)).toBeInTheDocument();
  });

  it('only offers questions earlier in the array as rule targets, not the current or later ones', async () => {
    const user = userEvent.setup();
    const q2: QuestionDef = { id: 'q2', type: 'single', title: 'Current question', options: [{ id: 'o1', label: 'Y', value: 'y' }] };
    const q3: QuestionDef = { id: 'q3', type: 'single', title: 'Later question', options: [{ id: 'o1', label: 'Z', value: 'z' }] };
    render(<Harness initial={q2} allQuestions={[priorQuestion, q2, q3]} index={1} />);

    await user.click(screen.getByLabelText('Conditionally visible'));
    await user.click(screen.getByText('+ Condition'));

    const questionSelect = screen.getByText('select question').closest('select')!;
    expect(questionSelect.textContent).toContain('Earlier question');
    expect(questionSelect.textContent).not.toContain('Current question');
    expect(questionSelect.textContent).not.toContain('Later question');
  });
});
