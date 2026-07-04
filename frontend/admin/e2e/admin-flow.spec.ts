import { test, expect } from '@playwright/test';

test.describe('Admin questionnaire authoring flow', () => {
  test('creates, edits, lists, and deletes a custom questionnaire', async ({ page }) => {
    // 1. Go to the admin interface
    await page.goto('http://localhost:5173/');
    await expect(page.getByRole('heading', { name: 'Questionnaires' })).toBeVisible();

    // 2. Start creating a new questionnaire
    await page.getByRole('button', { name: 'New questionnaire' }).click();

    const uniqueId = `e2e-custom-${Date.now()}`;
    const title = 'E2E Custom Admin Questionnaire';
    const description = 'Created dynamically during end-to-end suite';

    // Fill out meta fields
    await page.locator('label:has-text("Questionnaire ID") input').fill(uniqueId);
    await page.locator('label:has-text("Title") input').fill(title);
    await page.locator('label:has-text("Description") input').fill(description);

    // 3. Add first question (Single choice)
    await page.getByRole('button', { name: 'Add question' }).click();
    const firstCard = page.locator('.question-card').nth(0);
    await firstCard.locator('label:has-text("Title") input').fill('Do you like E2E testing?');

    // Customize the first option
    await firstCard.locator('input[placeholder="Label"]').nth(0).fill('Yes, very much');
    await firstCard.locator('input[placeholder="Value"]').nth(0).fill('yes');
    await firstCard.locator('input[placeholder="Score"]').nth(0).fill('10');

    // Add another option to Q1
    await firstCard.getByRole('button', { name: 'Option' }).click();
    await firstCard.locator('input[placeholder="Label"]').nth(1).fill('No, it is too slow');
    await firstCard.locator('input[placeholder="Value"]').nth(1).fill('no');
    await firstCard.locator('input[placeholder="Score"]').nth(1).fill('0');

    // 4. Add second question (Free text)
    await page.getByRole('button', { name: 'Add question' }).click();
    const secondCard = page.locator('.question-card').nth(1);
    await secondCard.locator('label:has-text("Title") input').fill('Please elaborate');
    await secondCard.locator('select').selectOption('text');
    await secondCard.locator('label:has-text("Placeholder") input').fill('Write here...');

    // 5. Save the questionnaire
    await page.getByRole('button', { name: 'Save' }).click();

    // 6. Verify we are redirected back to list and the questionnaire is present
    await expect(page.getByRole('heading', { name: 'Questionnaires' })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(`2 question(s) · id: ${uniqueId}`)).toBeVisible();

    // 7. Click Edit to verify fields persist
    const itemRow = page.locator(`li:has-text("${uniqueId}")`);
    await itemRow.getByRole('button', { name: 'Edit' }).click();

    await expect(page.locator('label:has-text("Title") input').nth(0)).toHaveValue(title);
    await expect(page.locator('.question-card')).toHaveCount(2);

    // Go back
    await page.getByRole('button', { name: 'Back' }).click();

    // 8. Delete the questionnaire
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(`Delete questionnaire "${uniqueId}"?`);
      await dialog.accept();
    });

    await itemRow.getByRole('button', { name: 'Delete' }).click();

    // 9. Confirm it is gone from the list
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test('creates a complex questionnaire with nested rules, reordering, and scoring', async ({ page }) => {
    // 1. Go to the admin interface
    await page.goto('http://localhost:5173/');
    await expect(page.getByRole('heading', { name: 'Questionnaires' })).toBeVisible();

    // 2. Start creating a new questionnaire
    await page.getByRole('button', { name: 'New questionnaire' }).click();

    const uniqueId = `e2e-complex-${Date.now()}`;
    const title = 'E2E Complex Admin Questionnaire';
    const description = 'Created dynamically to verify branching and scoring UI';

    // Fill out meta fields
    await page.locator('label:has-text("Questionnaire ID") input').fill(uniqueId);
    await page.locator('label:has-text("Title") input').fill(title);
    await page.locator('label:has-text("Description") input').fill(description);

    // 3. Add Q1 (Single choice)
    await page.getByRole('button', { name: 'Add question' }).click();
    const q1Card = page.locator('.question-card').nth(0);
    await q1Card.locator('label:has-text("Title") input').fill('Q1 Single Choice');
    await q1Card.locator('input[placeholder="Label"]').nth(0).fill('Opt A');
    await q1Card.locator('input[placeholder="Value"]').nth(0).fill('a');
    await q1Card.locator('input[placeholder="Score"]').nth(0).fill('5');

    await q1Card.getByRole('button', { name: 'Option' }).click();
    await q1Card.locator('input[placeholder="Label"]').nth(1).fill('Opt B');
    await q1Card.locator('input[placeholder="Value"]').nth(1).fill('b');
    await q1Card.locator('input[placeholder="Score"]').nth(1).fill('10');

    // 4. Add Q2 (Multiple choice)
    await page.getByRole('button', { name: 'Add question' }).click();
    const q2Card = page.locator('.question-card').nth(1);
    await q2Card.locator('label:has-text("Title") input').fill('Q2 Multiple Choice');
    await q2Card.locator('select').selectOption('multiple');
    await q2Card.locator('input[placeholder="Label"]').nth(0).fill('Opt X');
    await q2Card.locator('input[placeholder="Value"]').nth(0).fill('x');
    await q2Card.locator('input[placeholder="Score"]').nth(0).fill('15');

    // 5. Add Q3 (Conditionally visible based on Q1 Answer)
    await page.getByRole('button', { name: 'Add question' }).click();
    const q3Card = page.locator('.question-card').nth(2);
    await q3Card.locator('label:has-text("Title") input').fill('Q3 Conditional on Q1');
    await q3Card.locator('select').selectOption('text');
    await q3Card.locator('label:has-text("Placeholder") input').fill('Enter response...');

    // Enable conditional visibility
    await q3Card.locator('label:has-text("Conditionally visible") input').check();
    await q3Card.getByRole('button', { name: 'Condition' }).click();

    const q3Rule = q3Card.locator('.rule-row').first();
    // Select answer source
    await q3Rule.locator('select').nth(0).selectOption('answer');
    // Select target question Q1.
    // In RuleGroupEditor, the dropdown list is "select question", Q1, Q2.
    // Index 1 is Q1.
    await q3Rule.locator('select').nth(1).selectOption({ index: 1 });
    // Operator 'eq' (equals) is nth(2)
    await q3Rule.locator('select').nth(2).selectOption('eq');
    // Value dropdown nth(3)
    await q3Rule.locator('select').nth(3).selectOption('a');

    // 6. Add a Scoring Rule
    await page.getByRole('button', { name: 'Scoring rule' }).click();
    const scoreCard = page.locator('.scoring-rule-card').first();
    await scoreCard.locator('label:has-text("Score id") input').fill('e2e_total');
    await scoreCard.locator('label:has-text("Label") input').fill('E2E Total Score');
    // Check Q1 and Q2 checkboxes in the scoring rule checklist
    await scoreCard.locator('label:has-text("Q1 Single Choice") input').check();
    await scoreCard.locator('label:has-text("Q2 Multiple Choice") input').check();

    // 7. Add Q4 (Conditionally visible based on Score)
    await page.getByRole('button', { name: 'Add question' }).click();
    const q4Card = page.locator('.question-card').nth(3);
    await q4Card.locator('label:has-text("Title") input').fill('Q4 Conditional on Score');
    await q4Card.locator('select').selectOption('text');

    // Enable conditional visibility
    await q4Card.locator('label:has-text("Conditionally visible") input').check();
    await q4Card.getByRole('button', { name: 'Condition' }).click();

    const q4Rule = q4Card.locator('.rule-row').first();
    // Select score source
    await q4Rule.locator('select').nth(0).selectOption('score');
    // Select target score 'e2e_total'
    await q4Rule.locator('select').nth(1).selectOption('e2e_total');
    // Select operator 'gt'
    await q4Rule.locator('select').nth(2).selectOption('gt');
    // Fill value '10'
    await q4Rule.locator('input[placeholder="value"]').fill('10');

    // 8. Reorder Questions (Move Q1 down)
    // Q1 card is currently index 0. Let's move it down.
    await q1Card.locator('button[title="Move down"]').click();

    // Now Q2 should be first (index 0), and Q1 should be second (index 1).
    await expect(page.locator('.question-card').nth(0).locator('label:has-text("Title") input')).toHaveValue('Q2 Multiple Choice');
    await expect(page.locator('.question-card').nth(1).locator('label:has-text("Title") input')).toHaveValue('Q1 Single Choice');

    // 9. Save the questionnaire
    await page.getByRole('button', { name: 'Save' }).click();

    // 10. Verify we are redirected back to list and it is present
    await expect(page.getByRole('heading', { name: 'Questionnaires' })).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();

    // 11. Click Edit to verify fields persist exactly as saved
    const itemRow = page.locator(`li:has-text("${uniqueId}")`);
    await itemRow.getByRole('button', { name: 'Edit' }).click();

    await expect(page.locator('label:has-text("Title") input').nth(0)).toHaveValue(title);
    await expect(page.locator('.question-card')).toHaveCount(4);

    // Verify Q2 is first, Q1 is second
    await expect(page.locator('.question-card').nth(0).locator('label:has-text("Title") input')).toHaveValue('Q2 Multiple Choice');
    await expect(page.locator('.question-card').nth(1).locator('label:has-text("Title") input')).toHaveValue('Q1 Single Choice');

    // Verify Q3 has the rule group and is conditionally visible
    const loadedQ3Card = page.locator('.question-card').nth(2);
    await expect(loadedQ3Card.locator('label:has-text("Conditionally visible") input')).toBeChecked();
    const loadedQ3Rule = loadedQ3Card.locator('.rule-row').first();
    await expect(loadedQ3Rule.locator('select').nth(0)).toHaveValue('answer');
    await expect(loadedQ3Rule.locator('select').nth(2)).toHaveValue('eq');
    await expect(loadedQ3Rule.locator('select').nth(3)).toHaveValue('a');

    // Verify Q4 is conditionally visible and references scoring rule
    const loadedQ4Card = page.locator('.question-card').nth(3);
    await expect(loadedQ4Card.locator('label:has-text("Conditionally visible") input')).toBeChecked();
    const loadedQ4Rule = loadedQ4Card.locator('.rule-row').first();
    await expect(loadedQ4Rule.locator('select').nth(0)).toHaveValue('score');
    await expect(loadedQ4Rule.locator('select').nth(1)).toHaveValue('e2e_total');
    await expect(loadedQ4Rule.locator('select').nth(2)).toHaveValue('gt');
    await expect(loadedQ4Rule.locator('input[placeholder="value"]')).toHaveValue('10');

    // Go back
    await page.getByRole('button', { name: 'Back' }).click();

    // 12. Delete the questionnaire
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain(`Delete questionnaire "${uniqueId}"?`);
      await dialog.accept();
    });

    await itemRow.getByRole('button', { name: 'Delete' }).click();

    // 13. Confirm it is gone
    await expect(page.getByText(title)).toHaveCount(0);
  });
});
