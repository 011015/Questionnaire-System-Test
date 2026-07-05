// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuestionnaireRuntime } from './QuestionnaireRuntime';
import { Questionnaire } from '../schema/types';

// Mirrors backend/data/questionnaires.json's "onboarding-health-check" —
// the same schema used to validate the rule engine, now driven through the
// actual rendered UI rather than called as a pure function.
const healthCheckSchema: Questionnaire = {
  id: 'onboarding-health-check',
  title: 'Onboarding Health Check',
  version: 1,
  questions: [
    {
      id: 'q_employment',
      type: 'single',
      title: 'What is your current employment status?',
      required: true,
      options: [
        { id: 'opt_employed', label: 'Employed', value: 'employed' },
        { id: 'opt_selfemployed', label: 'Self-employed', value: 'self_employed' },
        { id: 'opt_unemployed', label: 'Not currently working', value: 'unemployed' },
      ],
    },
    {
      id: 'q_employer',
      type: 'text',
      title: "What is your employer's name?",
      visibleIf: { kind: 'group', combinator: 'AND', rules: [{ kind: 'condition', source: 'answer', questionId: 'q_employment', operator: 'eq', value: 'employed' }] },
    },
    {
      id: 'q_risk_symptoms',
      type: 'multiple',
      title: 'Have you experienced any of the following in the last 2 weeks?',
      options: [
        { id: 'opt_fatigue', label: 'Fatigue', value: 'fatigue', score: 2 },
        { id: 'opt_fever', label: 'Fever', value: 'fever', score: 4 },
        { id: 'opt_cough', label: 'Persistent cough', value: 'cough', score: 3 },
        { id: 'opt_none', label: 'None of the above', value: 'none', score: 0 },
      ],
    },
    {
      id: 'q_recent_travel',
      type: 'single',
      title: 'Have you traveled internationally in the last 30 days?',
      options: [
        { id: 'opt_travel_yes', label: 'Yes', value: 'yes', score: 3 },
        { id: 'opt_travel_no', label: 'No', value: 'no', score: 0 },
      ],
    },
    {
      id: 'q_followup_required',
      type: 'text',
      title: 'Your combined responses suggest a follow-up is recommended. Please describe your symptoms in more detail.',
      visibleIf: { kind: 'group', combinator: 'AND', rules: [{ kind: 'condition', source: 'score', scoreId: 'riskScore', operator: 'gte', value: 5 }] },
    },
    {
      id: 'q_all_clear',
      type: 'text',
      title: 'No follow-up needed. Any other comments before you finish?',
      visibleIf: { kind: 'group', combinator: 'AND', rules: [{ kind: 'condition', source: 'score', scoreId: 'riskScore', operator: 'lt', value: 5 }] },
    },
  ],
  scoring: [{ id: 'riskScore', label: 'Health Risk Score', questionIds: ['q_risk_symptoms', 'q_recent_travel'] }],
};

describe('QuestionnaireRuntime — end-to-end user journeys', () => {
  it('walks the "employed + high risk" path: branch appears, score gates the right follow-up, summary is correct', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRuntime schema={healthCheckSchema} />);

    // Q1: employment — choosing "Employed" should reveal the employer branch.
    expect(screen.getByText('What is your current employment status?')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Employed'));
    await user.click(screen.getByText('Next'));

    // Q2 (branch): employer name, only visible because employment = employed.
    expect(screen.getByText("What is your employer's name?")).toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), 'Acme Inc.');
    await user.click(screen.getByText('Next'));

    // Q3: symptoms — pick fever + cough (score 4 + 3 = 7).
    expect(screen.getByText('Have you experienced any of the following in the last 2 weeks?')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Fever'));
    await user.click(screen.getByLabelText('Persistent cough'));
    await user.click(screen.getByText('Next'));

    // Q4: recent travel — say no (score stays at 7, still >= 5).
    expect(screen.getByText('Have you traveled internationally in the last 30 days?')).toBeInTheDocument();
    await user.click(screen.getByLabelText('No'));
    await user.click(screen.getByText('Next'));

    // riskScore = 7 >= 5, so the follow-up question should be the one shown —
    // not the all-clear question.
    expect(screen.getByText(/follow-up is recommended/)).toBeInTheDocument();
    expect(screen.queryByText(/No follow-up needed/)).not.toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), 'Fever and cough since Tuesday.');
    await user.click(screen.getByText('Finish'));

    // Summary reflects exactly the questions that were actually visible —
    // the employer branch answer included, all-clear question absent.
    expect(screen.getByText('All done')).toBeInTheDocument();
    expect(screen.getByText(/Acme Inc\./)).toBeInTheDocument();
    expect(screen.getByText(/riskScore: 7/)).toBeInTheDocument();
    expect(screen.queryByText(/No follow-up needed/)).not.toBeInTheDocument();
  });

  it('walks the "unemployed + low risk" path: employer branch never appears, all-clear question is gated in instead', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRuntime schema={healthCheckSchema} />);

    await user.click(screen.getByLabelText('Not currently working'));
    await user.click(screen.getByText('Next'));

    // Employer branch must be skipped entirely — next question is symptoms.
    expect(screen.getByText('Have you experienced any of the following in the last 2 weeks?')).toBeInTheDocument();
    await user.click(screen.getByLabelText('None of the above'));
    await user.click(screen.getByText('Next'));

    await user.click(screen.getByLabelText('No'));
    await user.click(screen.getByText('Next'));

    // riskScore = 0 < 5 -> all-clear question, not the follow-up question.
    expect(screen.getByText(/No follow-up needed/)).toBeInTheDocument();
    expect(screen.queryByText(/follow-up is recommended/)).not.toBeInTheDocument();
    await user.click(screen.getByText('Finish'));

    expect(screen.getByText('All done')).toBeInTheDocument();
    expect(screen.getByText(/riskScore: 0/)).toBeInTheDocument();
    // The employer question was never part of the flow, so it must not
    // appear in the final summary at all.
    expect(screen.queryByText(/employer's name/)).not.toBeInTheDocument();
  });

  it('disables Next on a required question until it is answered', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRuntime schema={healthCheckSchema} />);
    expect(screen.getByText('Next')).toBeDisabled();
    await user.click(screen.getByLabelText('Employed'));
    expect(screen.getByText('Next')).toBeEnabled();
  });

  it('restart() after finishing returns to a clean first question', async () => {
    const user = userEvent.setup();
    render(<QuestionnaireRuntime schema={healthCheckSchema} />);

    await user.click(screen.getByLabelText('Not currently working'));
    await user.click(screen.getByText('Next'));
    await user.click(screen.getByLabelText('None of the above'));
    await user.click(screen.getByText('Next'));
    await user.click(screen.getByLabelText('No'));
    await user.click(screen.getByText('Next'));
    await user.click(screen.getByText('Finish'));

    await user.click(screen.getByText('Restart'));
    expect(screen.getByText('What is your current employment status?')).toBeInTheDocument();
    expect(screen.getByLabelText('Employed')).not.toBeChecked();
  });
});
