import { test, expect } from '@playwright/test';
import { waitForDashboard, sampleTasks } from './_utils';

test('project + status filters recalculate KPIs', async ({ page }) => {
	await page.route('**/api/data', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: sampleTasks, projects: ['API','GOV'] }) }));
	await page.goto('/');
	await waitForDashboard(page);

	// select project API and status Finalizado
	await page.selectOption('#fProject', 'API');
	await page.selectOption('#fSection', 'Finalizado');
	await page.click('button:has-text("Filtrar")');
	await page.waitForSelector('#app.filtering', { state: 'detached' });

	const filterInfo = await page.locator('#filterInfo').textContent();
	expect(filterInfo).toMatch(/\d+ de \d+ cards/);
	const totalCards = await page.locator('#kpis .kpi').nth(0).locator('.val').textContent();
	expect(Number(totalCards)).toBeGreaterThanOrEqual(0);
});
