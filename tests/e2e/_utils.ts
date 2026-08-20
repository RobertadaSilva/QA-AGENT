import { Page } from '@playwright/test';

export async function waitForDashboard(page: Page, timeout = 10000) {
  await page.waitForSelector('#loading', { state: 'visible', timeout: 2000 }).catch(() => {});
  await page.waitForSelector('#loading', { state: 'hidden', timeout });
  await page.waitForSelector('#app', { state: 'visible', timeout });
  await page.waitForSelector('#kpis .kpi', { state: 'attached', timeout });
}

export const sampleTasks = [
  { gid: '1', name: 'Task A', section: 'Finalizado', projects: ['API'], size: 'm', bugs: 2, hasBug: true, noBug: false, isFinished: true, created: '2026-08-01', createdAt: '2026-08-01T10:00:00Z', month: '2026-08', cycleHours: 4 },
  { gid: '2', name: 'Task B', section: 'Em andamento', projects: ['API'], size: null, bugs: 0, hasBug: false, noBug: true, isFinished: false, created: '2026-08-05', createdAt: '2026-08-05T10:00:00Z', month: '2026-08' },
  { gid: '3', name: 'Task C', section: 'Finalizado', projects: ['GOV'], size: 'g', bugs: 3, hasBug: true, noBug: false, isFinished: true, created: '2026-07-10', createdAt: '2026-07-10T10:00:00Z', month: '2026-07', cycleHours: 5 },
  { gid: '4', name: 'Task D', section: 'Pausado', projects: [], size: null, bugs: 6, hasBug: true, noBug: false, isFinished: false, created: '2026-06-01', createdAt: '2026-06-01T10:00:00Z', month: '2026-06' }
];
