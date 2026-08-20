import { test, expect } from '@playwright/test';
import { waitForDashboard, sampleTasks } from './_utils';

test('reset filters restores defaults', async ({ page }) => {
  await page.route('**/api/data', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: sampleTasks, projects: ['API','GOV'] }) }));
  await page.goto('/');
  await waitForDashboard(page);

  await page.selectOption('#fProject', 'API');
  await page.selectOption('#fSection', 'Finalizado');
  await page.click('button:has-text("Limpar")');
  await page.waitForSelector('#app.filtering', { state: 'detached' });

  const projVal = await page.locator('#fProject').inputValue();
  expect(projVal).toBe('');
  const secVal = await page.locator('#fSection').inputValue();
  expect(secVal).toBe('');
});
