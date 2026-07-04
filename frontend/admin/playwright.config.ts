import { defineConfig } from '@playwright/test';

const ADMIN_PORT = 5173;
const API_PORT = 4000;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: `http://localhost:${ADMIN_PORT}/`,
  },
  // Spins up both the storage backend and the Admin app's dev server for the
  // duration of the test run.
  webServer: [
    {
      command: 'npm start',
      cwd: '../../backend',
      port: API_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        QUESTIONNAIRES_DATA_FILE: '.e2e-data/questionnaires.json',
        PORT: String(API_PORT),
      },
    },
    {
      command: 'npm run dev -- --port 5173',
      cwd: '.',
      port: ADMIN_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
