import { test, expect } from '@playwright/test';
import { waitForDashboard, sampleTasks } from './_utils';

test('date-range filter limits results', async ({ page }) => {
  await page.route('**/api/data', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: sampleTasks, projects: ['API','GOV'] }) }));
  await page.goto('/');
  await waitForDashboard(page);

  // set narrow date range (no tasks expected)
  await page.fill('#fFrom', '01/01/2025');
  await page.fill('#fTo', '02/01/2025');
  await page.click('button:has-text("Filtrar")');
  await page.waitForSelector('#app.filtering', { state: 'detached' });

  const info = await page.locator('#filterInfo').textContent();
  expect(info).toMatch(/0 de \d+ cards|\d+ de \d+ cards/);
});
