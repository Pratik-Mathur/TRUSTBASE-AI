import { createClient } from '@supabase/supabase-js';

function getSupabase({ useServiceRole = false } = {}) {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL;
  const key =
    (useServiceRole && process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY;
  return createClient(url, key);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });
  const idSegs = Array.isArray(req.query.id) ? req.query.id : [req.query.id];
  const idx = parseInt(req.query.idx, 10);
  if (!idSegs.length || Number.isNaN(idx)) return res.status(400).json({ detail: 'Invalid parameters' });
  const safeId = idSegs.join('_');
  const admin = getSupabase({ useServiceRole: true });
  const path = `jobs/${safeId}.answers.json`;
  const { data } = await admin.storage.from('tb-questionnaires').download(path);
  if (!data) return res.status(404).json({ detail: 'Answers not found' });
  const text = await data.text();
  const obj = JSON.parse(text || '{}');
  const answers = obj.answers || [];
  if (idx < 0 || idx >= answers.length) return res.status(400).json({ detail: 'Index out of range' });
  const a = answers[idx];
  const updated = { ...a, answer: `${a.answer} (Regenerated)`, is_edited: false };
  answers[idx] = updated;
  await admin.storage.from('tb-questionnaires').upload(path, Buffer.from(JSON.stringify({ answers }), 'utf-8'), { upsert: true, contentType: 'application/json' });
  return res.status(200).json(updated);
}
