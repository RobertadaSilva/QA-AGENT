import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',

  /* Execução paralela */
  fullyParallel: true,

  /* Falhar o build se test.only estiver no código */
  forbidOnly: !!process.env.CI,

  /* Retries: 2 no CI, 0 local */
  retries: process.env.CI ? 2 : 0,

  /* Workers: limitado no CI pra estabilidade */
  workers: process.env.CI ? 2 : undefined,

  /* Reporter */
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'on-failure' }]],

  /* Configurações compartilhadas */
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },

  /* Projetos/browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Descomentar pra testar em múltiplos browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Servidor local: sobe o dashboard antes de testar */
  webServer: {
    command: 'npm run dashboard',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
