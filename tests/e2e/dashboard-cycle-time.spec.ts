import { test, expect } from '@playwright/test';
import { waitForDashboard, sampleTasks } from './_utils';

test('cycle-time table shows sizes and handles empty buckets', async ({ page }) => {
  await page.route('**/api/data', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: sampleTasks, projects: ['API','GOV'] }) }));
  await page.goto('/');
  await waitForDashboard(page);

  const table = page.locator('#cycleTimeTable');
  await expect(table).toBeVisible();
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(5);
  // ensure at least one cell shows 'h' for hours
  const hoursText = await table.locator('tbody tr').nth(0).locator('td').nth(2).textContent();
  expect(hoursText || '').toMatch(/h|—/);
});
