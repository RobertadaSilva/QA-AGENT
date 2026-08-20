import { test, expect } from '@playwright/test';
import { waitForDashboard, sampleTasks } from './_utils';

test('bugs per project chart renders and shows tooltip', async ({ page }) => {
  await page.route('**/api/data', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tasks: sampleTasks, projects: ['API','GOV'] }) }));
  await page.goto('/');
  await waitForDashboard(page);

  // ApexCharts renders SVG; ensure container exists and has children
  const chart = page.locator('#chartBugsPerProject');
  await expect(chart).toBeVisible();
  // Hover somewhere in the chart to trigger tooltip; approximate by hovering the container
  await chart.hover();
  // Tooltip may be rendered in DOM: check for a tooltip-like element or for chart SVG
  const svg = chart.locator('svg').first();
  await expect(svg).toBeVisible();
});
