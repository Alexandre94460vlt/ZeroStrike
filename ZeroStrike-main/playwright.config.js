// @ts-check
import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL
  },
  /** Smoke HTTP : pas de navigateur ; SQLite en mémoire pour ne pas toucher `data/leaderboard.db`. */
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'node server/index.js',
        url: `${baseURL}/health`,
        reuseExistingServer: true,
        timeout: 90_000,
        env: {
          ...process.env,
          PORT: process.env.PORT ?? '3000',
          HOST: '127.0.0.1',
          DB_PATH: ':memory:',
          NODE_ENV: 'test'
        }
      }
});
