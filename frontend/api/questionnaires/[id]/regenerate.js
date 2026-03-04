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
  const id = req.query.id;
  if (!id || typeof id !== 'string') return res.status(400).json({ detail: 'Invalid id' });
  const safeId = id.replace(/[\/\\]/g, '_');
  const admin = getSupabase({ useServiceRole: true });
  // Mark as completed again (placeholder regen)
  const statusPath = `jobs/${safeId}.status.json`;
  const { data } = await admin.storage.from('tb-questionnaires').download(statusPath);
  let statusObj = { status: 'completed' };
  if (data) {
    const text = await data.text();
    statusObj = { ...(JSON.parse(text || '{}')), status: 'completed' };
  }
  await admin.storage.from('tb-questionnaires').upload(statusPath, Buffer.from(JSON.stringify(statusObj), 'utf-8'), { upsert: true, contentType: 'application/json' });
  return res.status(200).json({ success: true });
}
