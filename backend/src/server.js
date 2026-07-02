/**
 * Dumb storage service. No validation, no branching/scoring logic — that all
 * lives in the frontend (see /docs/ARCHITECTURE.md). This just persists and
 * returns whatever questionnaire JSON it's given.
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

const DATA_FILE = path.join(__dirname, '..', 'data', 'questionnaires.json');
const PORT = process.env.PORT || 4000;

function readAll() {
  if (!fs.existsSync(DATA_FILE)) return {};
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return raw.trim() ? JSON.parse(raw) : {};
}

function writeAll(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/questionnaires', (req, res) => {
  const all = readAll();
  res.json(Object.values(all));
});

app.get('/questionnaires/:id', (req, res) => {
  const all = readAll();
  const item = all[req.params.id];
  if (!item) return res.status(404).json({ error: 'not found' });
  res.json(item);
});

app.post('/questionnaires', (req, res) => {
  const all = readAll();
  const item = req.body;
  if (!item || !item.id) return res.status(400).json({ error: 'id required' });
  all[item.id] = item;
  writeAll(all);
  res.status(201).json(item);
});

app.put('/questionnaires/:id', (req, res) => {
  const all = readAll();
  all[req.params.id] = { ...req.body, id: req.params.id };
  writeAll(all);
  res.json(all[req.params.id]);
});

app.delete('/questionnaires/:id', (req, res) => {
  const all = readAll();
  delete all[req.params.id];
  writeAll(all);
  res.status(204).end();
});

app.listen(PORT, () => console.log(`Storage service running on http://localhost:${PORT}`));
