import { defineConfig } from '@playwright/test';

const WEB_PORT = 5174;
const API_PORT = 4000;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
  },
  // Spins up both the storage backend and this app's dev server for the
  // duration of the test run. The backend is pointed at a throwaway data
  // file (via QUESTIONNAIRES_DATA_FILE, see backend/src/server.js) so E2E
  // runs never touch backend/data/questionnaires.json.
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
      command: 'npm run dev -- --port 5174',
      cwd: '.',
      port: WEB_PORT,
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
});
