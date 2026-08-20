import { test, expect } from '@playwright/test';
import { waitForDashboard } from './_utils';

test('shows error state when /api/data fails', async ({ page }) => {
  await page.route('**/api/data', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Asana API 401: Unauthorized' }) }));
  await page.goto('/');
  // loader should hide and error shown
  await page.waitForSelector('#loading', { state: 'hidden' });
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error h2')).toHaveText(/Erro ao carregar/);
  await expect(page.locator('#app')).toBeHidden();
});
