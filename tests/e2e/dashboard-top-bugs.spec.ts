import { test, expect } from '@playwright/test';
import { waitForDashboard, sampleTasks } from './_utils';

test('top bugs table ranks cards and limits to 20', async ({ page }) => {
  // create a larger dataset to ensure truncation to 20 is exercised
  const many = [];
  for (let i = 0; i < 30; i++) many.push({ gid: String(100 + i), name: `Card ${i}`, section: 'Finalizado', projects: ['API'], size: null, bugs: i + 1, hasBug: true, noBug: false, isFinished: true, created: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', month: '2026-08' });
  const tasks = [...many, ...sampleTasks];

  await page.route('**/api/data', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks, projects: ['API','GOV'] }) }));
  await page.goto('/');
  await waitForDashboard(page);

  const rows = page.locator('#bugsTable tbody tr');
  await expect(rows).toHaveCount(20);
  // first row should have highest bug count (descending)
  const firstCount = await rows.nth(0).locator('td').nth(2).textContent();
  const secondCount = await rows.nth(1).locator('td').nth(2).textContent();
  expect(Number(firstCount)).toBeGreaterThanOrEqual(Number(secondCount));
});
