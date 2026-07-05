import { test, expect, APIRequestContext } from '@playwright/test';

const API_URL = process.env.VITE_API_URL || 'http://localhost:4000';

// Same shape as backend/data/questionnaires.json's "onboarding-health-check",
// posted fresh under a unique id per test run so parallel/repeated runs never
// collide and never touch the checked-in seed data.
function schema(id: string) {
  return {
    id,
    title: 'Onboarding Health Check (E2E)',
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
}

async function seedQuestionnaire(request: APIRequestContext, id: string) {
  const res = await request.post(`${API_URL}/questionnaires`, { data: schema(id) });
  expect(res.status()).toBe(201);
}

test.describe('Full-stack questionnaire flow (real browser, real backend)', () => {
  test('employed + high-risk path: branch question, correct scoring gate, correct summary', async ({ page, request }) => {
    const id = `e2e-high-risk-${Date.now()}`;
    await seedQuestionnaire(request, id);
    await page.goto(`/?id=${id}`);

    await expect(page.getByText('What is your current employment status?')).toBeVisible();
    await page.getByLabel('Employed', { exact: true }).check();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText("What is your employer's name?")).toBeVisible();
    await page.getByRole('textbox').fill('Acme Inc.');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText('Have you experienced any of the following in the last 2 weeks?')).toBeVisible();
    await page.getByLabel('Fever').check();
    await page.getByLabel('Persistent cough').check();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('No').check();
    await page.getByRole('button', { name: 'Next' }).click();

    // riskScore = fever(4) + cough(3) = 7 >= 5 -> follow-up question, not all-clear.
    await expect(page.getByText(/follow-up is recommended/)).toBeVisible();
    await expect(page.getByText(/No follow-up needed/)).toHaveCount(0);
    await page.getByRole('textbox').fill('Fever and cough since Tuesday.');
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByRole('heading', { name: 'All done' })).toBeVisible();
    await expect(page.getByText(/Acme Inc\./)).toBeVisible();
    await expect(page.getByText(/riskScore: 7/)).toBeVisible();
  });

  test('unemployed + low-risk path: employer branch never renders, all-clear question appears instead', async ({ page, request }) => {
    const id = `e2e-low-risk-${Date.now()}`;
    await seedQuestionnaire(request, id);
    await page.goto(`/?id=${id}`);

    await page.getByLabel('Not currently working').check();
    await page.getByRole('button', { name: 'Next' }).click();

    // The employer branch must never appear in the DOM for this path.
    await expect(page.getByText("What is your employer's name?")).toHaveCount(0);
    await expect(page.getByText('Have you experienced any of the following in the last 2 weeks?')).toBeVisible();
    await page.getByLabel('None of the above').check();
    await page.getByRole('button', { name: 'Next' }).click();

    await page.getByLabel('No').check();
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByText(/No follow-up needed/)).toBeVisible();
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByRole('heading', { name: 'All done' })).toBeVisible();
    await expect(page.getByText(/riskScore: 0/)).toBeVisible();
  });

  test('changing an earlier answer live-updates branching without a page reload', async ({ page, request }) => {
    const id = `e2e-branch-switch-${Date.now()}`;
    await seedQuestionnaire(request, id);
    await page.goto(`/?id=${id}`);

    await page.getByLabel('Employed', { exact: true }).check();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText("What is your employer's name?")).toBeVisible();

    // Go back and switch to a track with no employer branch.
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByLabel('Not currently working').check();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText('Have you experienced any of the following in the last 2 weeks?')).toBeVisible();
  });
});
