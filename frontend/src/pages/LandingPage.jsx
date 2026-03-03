import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Upload, Brain, Download, ArrowRight, CheckCircle, Shield, FileText, Cpu } from 'lucide-react';

const LandingPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleGetStarted = () => navigate(isAuthenticated ? '/dashboard' : '/auth');
  const handleLogin = () => navigate('/auth');

  return (
    <div className="min-h-screen bg-[#020817] text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#020817]/80 backdrop-blur-xl border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-sky-500/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-sky-400" />
            </div>
            <span className="text-white font-bold text-xl font-jakarta" data-testid="navbar-logo">TrustBase AI</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              data-testid="navbar-login-btn"
              onClick={handleLogin}
              className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/50 text-sm font-medium transition-all"
            >
              Log In
            </button>
            <button
              data-testid="navbar-get-started-btn"
              onClick={handleGetStarted}
              className="px-5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm transition-all hover:scale-[1.02] shadow-[0_0_20px_-5px_rgba(56,189,248,0.4)]"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero section */}
      <section className="relative pt-32 pb-24 px-6">
        {/* Background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#0c1f4a_0%,_#020817_60%)] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-10 pointer-events-none bg-cover bg-center"
          style={{ backgroundImage: `url(https://images.unsplash.com/photo-1762279388956-1c098163a2a8?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020817]/70 to-[#020817] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 text-sm font-medium mb-8 animate-fade-in">
            <Zap className="h-3.5 w-3.5" />
            AI-Powered Questionnaire Answering
          </div>

          <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tighter leading-[1.0] font-jakarta mb-8 animate-fade-in-up">
            Answer Any Questionnaire
            <span className="block bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-500 bg-clip-text text-transparent mt-1 pb-2"> in Minutes</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 leading-relaxed mb-10 max-w-2xl mx-auto animate-fade-in-up delay-100">
            Upload your documents. Let AI do the rest.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap animate-fade-in-up delay-200">
            <button
              data-testid="hero-get-started-btn"
              onClick={handleGetStarted}
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-all hover:scale-[1.03] shadow-[0_0_30px_-5px_rgba(56,189,248,0.5)] text-base"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </button>
            <button
              data-testid="hero-login-btn"
              onClick={handleLogin}
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 text-white border border-slate-700 hover:border-slate-600 font-medium transition-all text-base"
            >
              Log In
            </button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-4xl font-semibold font-jakarta text-white">Four simple steps</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { n: '01', icon: Upload,   title: 'Upload Docs',       desc: 'Add your security policies, SOC 2 reports, and compliance documents' },
              { n: '02', icon: FileText, title: 'Upload Questionnaire', desc: 'Upload any vendor security questionnaire in PDF or TXT format' },
              { n: '03', icon: Cpu,      title: 'AI Analyzes',       desc: 'Our AI reads your documents and crafts accurate, cited answers' },
              { n: '04', icon: Download, title: 'Download Results',  desc: 'Get a complete spreadsheet of answered questions with citations' },
            ].map((s, i) => (
              <div
                key={s.n}
                className="relative group p-6 rounded-2xl border border-slate-800 bg-slate-900/20 hover:border-slate-700 transition-colors"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="text-sky-400/30 font-bold text-4xl font-jakarta absolute top-4 right-5">{s.n}</div>
                <div className="bg-sky-500/10 rounded-xl p-3 w-fit mb-4">
                  <s.icon className="h-5 w-5 text-sky-400" />
                </div>
                <h3 className="text-white font-semibold font-jakarta mb-2">{s.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features bento grid */}
      <section className="py-24 px-6 border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sky-400 text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-4xl font-semibold font-jakarta text-white">Everything you need</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: 'AI-Powered Answers',
                desc: 'GPT-4 reads your documents and generates accurate, contextual answers to every question automatically.',
                accent: 'text-sky-400',
                bg: 'bg-sky-500/10',
              },
              {
                icon: Shield,
                title: 'Source Citations',
                desc: 'Every answer includes a citation showing exactly which document and section was used as the source.',
                accent: 'text-violet-400',
                bg: 'bg-violet-500/10',
              },
              {
                icon: CheckCircle,
                title: '"Not Found" Fallback',
                desc: 'When information is missing from your documents, answers are clearly marked as "Not found in references".',
                accent: 'text-green-400',
                bg: 'bg-green-500/10',
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/20 p-8 hover:border-slate-700 transition-colors"
              >
                <div className={`${f.bg} rounded-xl p-3 w-fit mb-5`}>
                  <f.icon className={`h-6 w-6 ${f.accent}`} />
                </div>
                <h3 className="text-white font-semibold font-jakarta text-lg mb-3">{f.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-[radial-gradient(ellipse_at_center,_#0c1f4a_0%,_#020817_70%)] rounded-3xl border border-slate-800 p-16">
            <h2 className="text-4xl font-bold font-jakarta mb-4">Start answering questionnaires today</h2>
            <p className="text-slate-400 text-lg mb-8">Join compliance teams saving hours on every vendor questionnaire</p>
            <button
              data-testid="cta-get-started-btn"
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-all hover:scale-[1.03] shadow-[0_0_30px_-5px_rgba(56,189,248,0.5)] text-base"
            >
              Get started for free <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-sky-400" />
            <span className="text-slate-400 text-sm font-medium font-jakarta">TrustBase AI</span>
          </div>
          <p className="text-slate-600 text-sm">&copy; {new Date().getFullYear()} TrustBase AI</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
