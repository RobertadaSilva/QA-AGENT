import { test, expect } from '@playwright/test';
import { waitForDashboard } from './_utils';

test('loading spinner visible and app hidden while fetching', async ({ page }) => {
  await page.route('**/api/data', async route => {
    // delay response to simulate loading
    await new Promise(r => setTimeout(r, 2000));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: [], projects: [] }) });
  });

  await page.goto('/');
  await expect(page.locator('#loading')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('#app')).toBeHidden();
  await waitForDashboard(page);
  await expect(page.locator('#loading')).toBeHidden();
  await expect(page.locator('#app')).toBeVisible();
});
