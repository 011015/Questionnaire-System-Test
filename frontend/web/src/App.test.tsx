// @vitest-environment jsdom
//
// Unlike the other component/integration tests, this one does NOT pass a
// schema as a prop. It renders the real <App/> exactly as main.tsx does,
// which means it exercises the real network seam: App.tsx -> api.ts ->
// window.fetch() -> a REAL running instance of backend/src/server.js
// (spawned as a child process against a throwaway data file) -> real
// Express routing -> real fs.readFileSync. Nothing here is mocked.
//
// This is the closest thing to true end-to-end coverage achievable without
// a real browser: it can't verify pixel-level rendering or a real browser's
// event loop, but it does prove the frontend's actual fetch call, the
// backend's actual HTTP handling, and the schema-loading lifecycle in
// App.tsx all work together for real.
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import os from 'os';
import { setTimeout as sleep } from 'node:timers/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

const PORT = 4000; // matches api.ts's default when VITE_API_URL is unset
const BACKEND_DIR = path.resolve(__dirname, '../../../backend');
const DATA_FILE = path.join(os.tmpdir(), `app-integration-test-${process.pid}.json`);

let backend: ChildProcess;
let backendStderr = '';

async function waitForBackend(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${PORT}/questionnaires`);
      if (res.ok) return;
    } catch {
      // not up yet, keep polling
    }
    await sleep(150);
  }
  throw new Error(
    `Backend did not become ready in time.${
      backendStderr ? ` Backend stderr:\n${backendStderr}` : ' (No stderr captured — did you run "npm install" in backend/?)'
    }`
  );
}

beforeAll(async () => {
  backend = spawn('node', ['src/server.js'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, QUESTIONNAIRES_DATA_FILE: DATA_FILE, PORT: String(PORT) },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  backend.stderr?.on('data', (chunk) => {
    backendStderr += chunk.toString();
  });
  await waitForBackend();

  // Seed the exact id App.tsx defaults to when no ?id= query param is present.
  await fetch(`http://localhost:${PORT}/questionnaires`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 'onboarding-health-check',
      title: 'Onboarding Health Check',
      version: 1,
      questions: [
        {
          id: 'q_employment',
          type: 'single',
          title: 'What is your current employment status?',
          required: true,
          options: [{ id: 'opt_employed', label: 'Employed', value: 'employed' }],
        },
      ],
    }),
  });
}, 15000);

afterAll(() => {
  backend?.kill('SIGTERM');
});

describe('App — real network integration (real fetch, real backend process)', () => {
  it('shows a loading state, then renders the questionnaire fetched over real HTTP from the real backend', async () => {
    render(<App />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    // Poll instead of a fixed sleep, since this is a real network round trip.
    await screen.findByText('What is your current employment status?', {}, { timeout: 5000 });
    expect(screen.getByLabelText('Employed')).toBeInTheDocument();
  });

  it('shows the error banner when the backend returns 404 for an unknown id', async () => {
    const originalSearch = window.location.search;
    window.history.pushState({}, '', '/?id=this-id-does-not-exist');

    render(<App />);
    await screen.findByText(/Failed to load questionnaire/, {}, { timeout: 5000 });
    expect(screen.getByText(/Is the backend running/)).toBeInTheDocument();

    window.history.pushState({}, '', `/?${originalSearch}`);
  });
});
