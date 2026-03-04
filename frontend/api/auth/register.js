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
    const anonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.REACT_APP_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (serviceRoleKey) {
      const admin = createClient(url, serviceRoleKey);
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (createErr) {
        // If already registered, surface a clear message
        return res.status(400).json({ detail: createErr.message || 'Email already registered' });
      }
      // Sign in to get a session token
      const supabase = createClient(url, anonKey);
      const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) {
        // Return user without token; client can prompt to sign in
        return res.status(200).json({
          token: null,
          user: { id: created.user.id, email: created.user.email, name },
          message: 'Account created. Please sign in.',
        });
      }
      const token = loginData.session?.access_token || null;
      return res.status(200).json({
        token,
        user: { id: loginData.user.id, email: loginData.user.email, name },
      });
    } else {
      // Fallback to anon signUp (may trigger email rate limits if confirmation emails are enabled)
      const supabase = createClient(url, anonKey);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('rate limit')) {
          return res.status(429).json({ detail: 'Email rate limit exceeded. Please wait a few minutes and try again.' });
        }
        return res.status(400).json({ detail: error.message });
      }
      const token = data.session?.access_token || null;
      if (!token) {
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
    }
  } catch (e) {
    return res.status(500).json({ detail: e.message || 'Unexpected error' });
  }
}
