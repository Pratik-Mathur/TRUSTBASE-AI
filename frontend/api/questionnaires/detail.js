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
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' });
  const id = (req.query?.id || '').toString();
  if (!id) return res.status(400).json({ detail: 'Invalid questionnaire id' });
  const name = decodeURIComponent(id).split('/').pop();

  try {
    const admin = getSupabase({ useServiceRole: true });
    const safeId = id.replace(/[\/\\]/g, '_');
    const statusPath = `jobs/${safeId}.status.json`;
    const { data, error } = await admin.storage.from('tb-questionnaires').download(statusPath);
    let status = 'processing';
    if (!error && data) {
      const text = await data.text();
      const obj = JSON.parse(text || '{}');
      status = obj.status || status;
    }
    let answers = [];
    const answersPath = `jobs/${safeId}.answers.json`;
    const { data: aData } = await admin.storage.from('tb-questionnaires').download(answersPath);
    if (aData) {
      const aText = await aData.text();
      const aObj = JSON.parse(aText || '{}');
      answers = aObj.answers || [];
    }
    return res.status(200).json({
      id,
      name,
      status,
      questions: [],
      answers,
      versions: [],
    });
  } catch {
    return res.status(200).json({
      id,
      name,
      status: 'processing',
      questions: [],
      answers: [],
      versions: [],
    });
  }
}
