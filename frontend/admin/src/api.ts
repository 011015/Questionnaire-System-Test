import { Questionnaire } from './schema/types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function listQuestionnaires(): Promise<Questionnaire[]> {
  const res = await fetch(`${BASE_URL}/questionnaires`);
  if (!res.ok) throw new Error('Failed to list questionnaires');
  return res.json();
}

export async function getQuestionnaire(id: string): Promise<Questionnaire> {
  const res = await fetch(`${BASE_URL}/questionnaires/${id}`);
  if (!res.ok) throw new Error('Failed to load questionnaire');
  return res.json();
}

export async function createQuestionnaire(q: Questionnaire): Promise<Questionnaire> {
  const res = await fetch(`${BASE_URL}/questionnaires`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(q),
  });
  if (!res.ok) throw new Error('Failed to create questionnaire');
  return res.json();
}

export async function updateQuestionnaire(q: Questionnaire): Promise<Questionnaire> {
  const res = await fetch(`${BASE_URL}/questionnaires/${q.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(q),
  });
  if (!res.ok) throw new Error('Failed to update questionnaire');
  return res.json();
}

export async function deleteQuestionnaire(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/questionnaires/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error('Failed to delete questionnaire');
}
