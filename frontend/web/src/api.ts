import { Questionnaire } from './schema/types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function getQuestionnaire(id: string): Promise<Questionnaire> {
  const res = await fetch(`${BASE_URL}/questionnaires/${id}`);
  if (!res.ok) throw new Error(`Failed to load questionnaire "${id}"`);
  return res.json();
}
