import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) {
      return res.status(401).json({ detail: 'Missing token' });
    }
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ detail: error?.message || 'Invalid token' });
    }
    const u = data.user;
    return res.status(200).json({ id: u.id, email: u.email, name: u.user_metadata?.name || '' });
  } catch (e) {
    return res.status(500).json({ detail: e.message || 'Unexpected error' });
  }
}
