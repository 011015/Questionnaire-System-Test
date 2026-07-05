// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionRenderer } from './QuestionRenderer';
import { QuestionDef } from '../schema/types';

const singleChoice: QuestionDef = {
  id: 'q1',
  type: 'single',
  title: 'Pick one',
  options: [
    { id: 'o1', label: 'First', value: 'first' },
    { id: 'o2', label: 'Second', value: 'second' },
  ],
};

const multipleChoice: QuestionDef = {
  id: 'q2',
  type: 'multiple',
  title: 'Pick any',
  options: [
    { id: 'o1', label: 'Alpha', value: 'alpha' },
    { id: 'o2', label: 'Beta', value: 'beta' },
    { id: 'o3', label: 'Gamma', value: 'gamma' },
  ],
};

const textQuestion: QuestionDef = {
  id: 'q3',
  type: 'text',
  title: 'Tell us more',
  placeholder: 'Type here',
};

describe('QuestionRenderer — single choice', () => {
  it('renders the title and every option', () => {
    render(<QuestionRenderer question={singleChoice} value={undefined} onChange={() => {}} />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
    expect(screen.getByLabelText('First')).toBeInTheDocument();
    expect(screen.getByLabelText('Second')).toBeInTheDocument();
  });

  it('marks the currently selected option as checked', () => {
    render(<QuestionRenderer question={singleChoice} value="second" onChange={() => {}} />);
    expect(screen.getByLabelText('First')).not.toBeChecked();
    expect(screen.getByLabelText('Second')).toBeChecked();
  });

  it('calls onChange with the option value when a radio is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<QuestionRenderer question={singleChoice} value={undefined} onChange={onChange} />);
    await user.click(screen.getByLabelText('First'));
    expect(onChange).toHaveBeenCalledWith('first');
  });
});

describe('QuestionRenderer — multiple choice', () => {
  it('checks exactly the options present in the current value array', () => {
    render(<QuestionRenderer question={multipleChoice} value={['alpha', 'gamma']} onChange={() => {}} />);
    expect(screen.getByLabelText('Alpha')).toBeChecked();
    expect(screen.getByLabelText('Beta')).not.toBeChecked();
    expect(screen.getByLabelText('Gamma')).toBeChecked();
  });

  it('adds a value when checking a box that starts unchecked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<QuestionRenderer question={multipleChoice} value={['alpha']} onChange={onChange} />);
    await user.click(screen.getByLabelText('Beta'));
    expect(onChange).toHaveBeenCalledWith(['alpha', 'beta']);
  });

  it('removes a value when unchecking a box that was checked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<QuestionRenderer question={multipleChoice} value={['alpha', 'beta']} onChange={onChange} />);
    await user.click(screen.getByLabelText('Alpha'));
    expect(onChange).toHaveBeenCalledWith(['beta']);
  });

  it('treats an undefined value as no selections rather than throwing', () => {
    render(<QuestionRenderer question={multipleChoice} value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText('Alpha')).not.toBeChecked();
  });
});

describe('QuestionRenderer — free text', () => {
  it('renders the placeholder and an empty value by default', () => {
    render(<QuestionRenderer question={textQuestion} value={undefined} onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Type here')).toHaveValue('');
  });

  it('calls onChange with the typed text', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<QuestionRenderer question={textQuestion} value="" onChange={onChange} />);
    await user.type(screen.getByPlaceholderText('Type here'), 'hi');
    // userEvent.type fires one onChange per keystroke; the renderer is
    // controlled by the parent, so each call reflects a single-character delta.
    expect(onChange).toHaveBeenCalledWith('h');
    expect(onChange).toHaveBeenCalledWith('i');
  });
});
