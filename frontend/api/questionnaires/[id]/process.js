import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

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

async function ensureBucket() {
  const admin = getSupabase({ useServiceRole: true });
  const { data: bq } = await admin.storage.getBucket('tb-questionnaires');
  if (!bq) {
    await admin.storage.createBucket('tb-questionnaires', { public: false, fileSizeLimit: '10MB' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ detail: 'Unauthorized' });

  const id = req.query.id;
  if (!id || typeof id !== 'string') return res.status(400).json({ detail: 'Invalid questionnaire id' });

  await ensureBucket();
  const admin = getSupabase({ useServiceRole: true });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const statusObj = {
    status: 'processing',
    document_ids: Array.isArray(body?.document_ids) ? body.document_ids : [],
    started_at: new Date().toISOString(),
    user_id: user.id,
  };

  const path = `jobs/${id}.status.json`;
  const dataBuf = Buffer.from(JSON.stringify(statusObj), 'utf-8');
  const { error } = await admin.storage.from('tb-questionnaires').upload(path, dataBuf, { upsert: true, contentType: 'application/json' });
  if (error) return res.status(500).json({ detail: 'Failed to start processing' });

  return res.status(200).json({ status: 'processing' });
}
