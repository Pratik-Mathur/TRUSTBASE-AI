import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Method not allowed' });
  }
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ detail: 'Name, email and password required' });
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) {
      return res.status(400).json({ detail: error.message });
    }
    const token = data.session?.access_token;
    if (!token) {
      // If email confirmation is enabled, session will be null
      return res.status(200).json({
        token: null,
        user: { id: data.user.id, email: data.user.email, name },
        message: 'Check your email to confirm your account, then sign in.',
      });
    }
    return res.status(200).json({
      token,
      user: { id: data.user.id, email: data.user.email, name },
    });
  } catch (e) {
    return res.status(500).json({ detail: e.message || 'Unexpected error' });
  }
}
