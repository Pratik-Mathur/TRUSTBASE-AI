import { createClient } from '@supabase/supabase-js';

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

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ detail: 'Method not allowed' });
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ detail: 'Unauthorized' });
  const supabase = getSupabase();
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData?.user) return res.status(401).json({ detail: 'Unauthorized' });
  const segs = Array.isArray(req.query.id) ? req.query.id : [req.query.id];
  const id = segs.map((s) => decodeURIComponent(s)).join('/');
  const admin = getSupabase({ useServiceRole: true });
  const { error } = await admin.storage.from('tb-docs').remove([id]);
  if (error) return res.status(200).json({ success: false });
  return res.status(200).json({ success: true });
}
