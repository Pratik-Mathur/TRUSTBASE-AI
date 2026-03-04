import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import { readFile as fsReadFile } from 'fs/promises';

export const config = { api: { bodyParser: false } };

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

async function getUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

async function ensureBuckets() {
  const admin = getSupabase({ useServiceRole: true });
  // Create bucket if missing (idempotent safe check)
  const { data: b1 } = await admin.storage.getBucket('tb-docs');
  if (!b1) {
    await admin.storage.createBucket('tb-docs', { public: false, fileSizeLimit: '50MB' });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const user = await getUser(req);
    if (!user) return res.status(401).json([]);
    await ensureBuckets();
    const supabase = getSupabase({ useServiceRole: true });
    const { data, error } = await supabase.storage.from('tb-docs').list(user.id, { limit: 200 });
    if (error) return res.status(500).json([]);
    const items = (data || []).map((f) => ({
      id: `${user.id}/${f.name}`,
      name: f.name,
      size_chars: f.size || 0,
      created_at: new Date().toISOString(),
    }));
    return res.status(200).json(items);
  }

  if (req.method === 'POST') {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ detail: 'Unauthorized' });

    await ensureBuckets();
    const form = formidable();
    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(400).json({ detail: 'Invalid form data' });
      const fileField = files.file || (Array.isArray(files.files) ? files.files[0] : files.files);
      const file = Array.isArray(fileField) ? fileField[0] : fileField;
      if (!file) return res.status(400).json({ detail: 'File missing' });

      const supabase = getSupabase({ useServiceRole: true });
      const path = `${user.id}/${file.originalFilename}`;
      const data = await fsReadFile(file.filepath);
      const { error } = await supabase.storage.from('tb-docs').upload(path, data, { upsert: true });
      if (error) return res.status(500).json({ detail: 'Upload failed' });

      return res.status(200).json({
        id: path,
        name: file.originalFilename,
        size_chars: data.length,
        created_at: new Date().toISOString(),
      });
    });
    return;
  }

  return res.status(405).json({ detail: 'Method not allowed' });
}
