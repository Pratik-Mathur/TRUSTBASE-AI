import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import { readFile as fsReadFile } from 'fs/promises';

export const config = { api: { bodyParser: false } };

function getSupabase() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY;
  return createClient(url, key);
}

async function getUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

function extractQuestionsText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const qs = [];
  for (const l of lines) {
    if (/\?$/.test(l)) qs.push(l);
    else if (/^\d+[\).]\s+/.test(l)) qs.push(l.replace(/^\d+[\).]\s+/, '').trim());
  }
  return qs.length ? qs : lines.slice(0, Math.min(20, lines.length));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const user = await getUser(req);
    if (!user) return res.status(401).json([]);
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from('tb-questionnaires').list(user.id, { limit: 200 });
    if (error) return res.status(500).json([]);
    const items = (data || []).map((f) => ({
      id: `${user.id}/${f.name}`,
      name: f.name,
      question_count: 0,
      created_at: new Date().toISOString(),
      status: 'pending'
    }));
    return res.status(200).json(items);
  }
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ detail: 'Unauthorized' });

  const form = formidable();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ detail: 'Invalid form data' });
    const file = files.file;
    if (!file || Array.isArray(file)) return res.status(400).json({ detail: 'File missing' });

    const supabase = getSupabase();
    const path = `${user.id}/${file.originalFilename}`;
    const data = await fsReadFile(file.filepath);
    const { error } = await supabase.storage.from('tb-questionnaires').upload(path, data, { upsert: true });
    if (error) return res.status(500).json({ detail: 'Upload failed' });

    let questions = [];
    if ((file.originalFilename || '').toLowerCase().endsWith('.txt')) {
      const text = data.toString('utf-8');
      questions = extractQuestionsText(text);
    }

    return res.status(200).json({
      id: path,
      name: file.originalFilename,
      question_count: questions.length,
      questions,
      created_at: new Date().toISOString(),
    });
  });
}
