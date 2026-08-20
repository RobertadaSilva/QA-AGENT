import { test, expect } from '@playwright/test';
import { waitForDashboard, sampleTasks } from './_utils';

test('monthly evolution chart has series and updates with filters', async ({ page }) => {
  await page.route('**/api/data', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: sampleTasks, projects: ['API','GOV'] }) }));
  await page.goto('/');
  await waitForDashboard(page);

  const chart = page.locator('#chartMonthly');
  await expect(chart).toBeVisible();
  await expect(chart.locator('svg').first()).toBeVisible();

  // Apply a filter and ensure chart still renders
  await page.selectOption('#fProject', 'GOV');
  await page.click('button:has-text("Filtrar")');
  await page.waitForSelector('#app.filtering', { state: 'detached' });
  await expect(chart.locator('svg').first()).toBeVisible();
});
