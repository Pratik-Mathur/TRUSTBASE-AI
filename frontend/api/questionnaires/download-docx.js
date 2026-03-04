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
  if (req.method !== 'GET') return res.status(405).end();
  const id = (req.query?.id || '').toString();
  if (!id) return res.status(400).end();
  const safeId = decodeURIComponent(id).replace(/[\/\\]/g, '_');
  const admin = getSupabase({ useServiceRole: true });
  const answersPath = `jobs/${safeId}.answers.json`;
  const { data } = await admin.storage.from('tb-questionnaires').download(answersPath);
  const text = data ? await data.text() : '{}';
  const obj = JSON.parse(text || '{}');
  const answers = obj.answers || [];
  let content = `Questionnaire Report\n\nID: ${id}\n\n`;
  answers.forEach((a, i) => {
    content += `Q${i + 1}: ${a.question}\nAnswer: ${a.answer}\nSource: ${a.source_document}\n\n`;
  });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="report.docx"`);
  return res.status(200).send(Buffer.from(content, 'utf-8'));
}
