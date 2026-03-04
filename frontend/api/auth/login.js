import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ detail: 'Email and password required' });
    }

    const url =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.REACT_APP_SUPABASE_URL;
    const key =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.REACT_APP_SUPABASE_ANON_KEY;
    const supabase = createClient(url, key);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ detail: error.message });
    }
    const token = data.session?.access_token;
    if (!token) {
      return res.status(500).json({ detail: 'No token returned from auth provider' });
    }
    return res.status(200).json({
      token,
      user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || '' },
    });
  } catch (e) {
    return res.status(500).json({ detail: e.message || 'Unexpected error' });
  }
}
