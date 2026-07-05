import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

// Point the server at a throwaway file *before* importing it, so tests never
// touch the real backend/data/questionnaires.json.
const tmpFile = path.join(os.tmpdir(), `questionnaires-test-${process.pid}-${Date.now()}.json`);
process.env.QUESTIONNAIRES_DATA_FILE = tmpFile;

const { default: app } = await import('./server.js');

function resetDataFile() {
  if (fs.existsSync(tmpFile)) fs.rmSync(tmpFile);
}

beforeEach(resetDataFile);
afterEach(resetDataFile);

const sample = {
  id: 'sample-q',
  title: 'Sample',
  version: 1,
  questions: [{ id: 'q1', type: 'text', title: 'Anything?' }],
};

describe('GET /questionnaires', () => {
  it('returns an empty list when no data file exists yet', async () => {
    const res = await request(app).get('/questionnaires');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns all stored questionnaires as a flat array', async () => {
    await request(app).post('/questionnaires').send(sample);
    await request(app).post('/questionnaires').send({ ...sample, id: 'sample-q-2' });

    const res = await request(app).get('/questionnaires');
    expect(res.status).toBe(200);
    expect(res.body.map((q) => q.id).sort()).toEqual(['sample-q', 'sample-q-2']);
  });
});

describe('GET /questionnaires/:id', () => {
  it('404s for an unknown id', async () => {
    const res = await request(app).get('/questionnaires/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('returns the stored questionnaire by id', async () => {
    await request(app).post('/questionnaires').send(sample);
    const res = await request(app).get(`/questionnaires/${sample.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(sample);
  });
});

describe('POST /questionnaires', () => {
  it('creates a questionnaire and persists it to disk', async () => {
    const res = await request(app).post('/questionnaires').send(sample);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(sample);

    const onDisk = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
    expect(onDisk[sample.id]).toEqual(sample);
  });

  it('rejects a body with no id, without mutating storage', async () => {
    const res = await request(app).post('/questionnaires').send({ title: 'No id here' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'id required' });
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  it('does not validate or interpret question content — dumb storage only', async () => {
    // Deliberately malformed from a schema standpoint (unknown question type,
    // a visibleIf referencing a question that doesn't exist). The backend
    // must accept and round-trip it unchanged — validation is a frontend
    // concern (CLAUDE.md constraint #1).
    const weird = {
      id: 'weird-q',
      questions: [{ id: 'q1', type: 'not-a-real-type', visibleIf: { kind: 'group', combinator: 'AND', rules: [] } }],
    };
    const res = await request(app).post('/questionnaires').send(weird);
    expect(res.status).toBe(201);
    expect(res.body).toEqual(weird);
  });
});

describe('PUT /questionnaires/:id', () => {
  it('replaces an existing questionnaire, forcing the id to match the URL param', async () => {
    await request(app).post('/questionnaires').send(sample);
    const res = await request(app)
      .put(`/questionnaires/${sample.id}`)
      .send({ ...sample, id: 'ignored-mismatched-id', title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sample.id); // URL param wins, not the body's id
    expect(res.body.title).toBe('Updated title');
  });

  it('creates the record if it did not already exist (upsert semantics)', async () => {
    const res = await request(app).put('/questionnaires/brand-new').send({ title: 'New via PUT' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ title: 'New via PUT', id: 'brand-new' });
  });
});

describe('DELETE /questionnaires/:id', () => {
  it('removes an existing questionnaire and returns 204', async () => {
    await request(app).post('/questionnaires').send(sample);
    const del = await request(app).delete(`/questionnaires/${sample.id}`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/questionnaires/${sample.id}`);
    expect(get.status).toBe(404);
  });

  it('is idempotent — deleting a non-existent id still returns 204', async () => {
    const res = await request(app).delete('/questionnaires/never-existed');
    expect(res.status).toBe(204);
  });
});
