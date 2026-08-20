import { test, expect } from '@playwright/test';
import { waitForDashboard, sampleTasks } from './_utils';

test('dashboard renders full UI after successful data load', async ({ page }) => {
  await page.route('**/api/data', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: sampleTasks, projects: ['API','GOV'] }) }));
  await page.goto('/');
  await waitForDashboard(page);
  await expect(page.locator('h1')).toHaveText(/Dashboard QA/i);
  await expect(page.locator('#kpis .kpi')).toHaveCount(4);
  const optCount = await page.locator('#fProject option').count();
  expect(optCount).toBeGreaterThan(1);
  await expect(page.locator('#chartBugsPerProject')).toBeVisible();
});
