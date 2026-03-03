import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Eye, EyeOff, Zap, ArrowLeft, Loader2 } from 'lucide-react';

const AuthPage = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) { setError('Name is required'); setLoading(false); return; }
        await register(form.name, form.email, form.password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#0c1f4a_0%,_#020817_60%)] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Back to home */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>

        {/* Card */}
        <div className="bg-[#0B1221] border border-slate-800 rounded-2xl p-8 shadow-[0_20px_50px_rgb(0,0,0,0.5)]">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-md bg-sky-500/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-sky-400" />
            </div>
            <span className="text-white font-bold text-xl font-jakarta">TrustBase AI</span>
          </div>

          <h1 className="text-2xl font-bold text-white font-jakarta mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-slate-400 text-sm mb-6">
            {mode === 'login' ? "Sign in to your account" : "Start answering questionnaires in minutes"}
          </p>

          {error && (
            <div data-testid="auth-error" className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Full name</label>
                <input
                  data-testid="name-input"
                  type="text"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-slate-950/50 border border-slate-700 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 rounded-lg h-11 px-4 text-white placeholder-slate-500 outline-none transition-all text-sm"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
              <input
                data-testid="email-input"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-950/50 border border-slate-700 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 rounded-lg h-11 px-4 text-white placeholder-slate-500 outline-none transition-all text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  data-testid="password-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-slate-950/50 border border-slate-700 focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30 rounded-lg h-11 px-4 pr-11 text-white placeholder-slate-500 outline-none transition-all text-sm"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              data-testid="auth-submit-btn"
              disabled={loading}
              className="w-full h-11 bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-semibold rounded-lg transition-all hover:scale-[1.01] shadow-[0_0_20px_-5px_rgba(56,189,248,0.4)] flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              data-testid="toggle-auth-mode"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
              className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
