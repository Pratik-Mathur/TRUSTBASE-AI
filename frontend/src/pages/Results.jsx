import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Download, ArrowLeft, CheckCircle, XCircle, Loader2, BookOpen,
  FileText, AlertCircle, Clock, RefreshCw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatusConfig = {
  pending:    { icon: Clock,      color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-500/20', label: 'Pending' },
  processing: { icon: Loader2,    color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-500/20',     label: 'Processing with AI...', spin: true },
  completed:  { icon: CheckCircle,color: 'text-green-400',   bg: 'bg-green-400/10 border-green-500/20',   label: 'Completed' },
  failed:     { icon: AlertCircle,color: 'text-red-400',     bg: 'bg-red-400/10 border-red-500/20',       label: 'Failed' },
};

const Results = () => {
  const { id } = useParams();
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const [questionnaire, setQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchQuestionnaire = async () => {
    try {
      const res = await axios.get(`${API}/questionnaires/${id}`, { headers: getAuthHeaders() });
      setQuestionnaire(res.data);
    } catch (err) {
      toast.error('Failed to load questionnaire');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionnaire();
  }, [id]);

  // Poll while processing
  useEffect(() => {
    if (!questionnaire) return;
    if (questionnaire.status === 'processing' || questionnaire.status === 'pending') {
      const interval = setInterval(fetchQuestionnaire, 3000);
      return () => clearInterval(interval);
    }
  }, [questionnaire?.status]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await axios.post(`${API}/questionnaires/${id}/regenerate`, {}, { headers: getAuthHeaders() });
      toast.success('Regenerating answers with all reference documents…');
      // Immediately fetch to get the "processing" status — polling takes over from there
      await fetchQuestionnaire();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start regeneration');
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API}/questionnaires/${id}/download`, {
        headers: getAuthHeaders(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${questionnaire.name}_answers.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Downloaded successfully');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (!questionnaire) return null;

  const sc = StatusConfig[questionnaire.status] || StatusConfig.pending;
  const StatusIcon = sc.icon;
  const isProcessing = questionnaire.status === 'processing' || questionnaire.status === 'pending';
  const foundCount = questionnaire.answers.filter((a) => a.found).length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </button>

      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white font-jakarta">{questionnaire.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${sc.bg} ${sc.color}`}>
              <StatusIcon className={`h-3.5 w-3.5 ${sc.spin ? 'animate-spin' : ''}`} />
              {sc.label}
            </span>
            {questionnaire.status === 'completed' && (
              <span className="text-slate-400 text-sm">
                {foundCount}/{questionnaire.answers.length} answers found
              </span>
            )}
          </div>
        </div>
        {questionnaire.status === 'completed' && (
          <div className="flex items-center gap-3">
            <button
              data-testid="regenerate-btn"
              onClick={handleRegenerate}
              disabled={regenerating || isProcessing}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-50 text-white border border-slate-700 hover:border-slate-600 font-medium px-5 py-2.5 rounded-lg transition-all"
            >
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Regenerate Answers
            </button>
            <button
              data-testid="download-btn"
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-semibold px-5 py-2.5 rounded-lg transition-all hover:scale-[1.02] shadow-[0_0_20px_-5px_rgba(56,189,248,0.4)]"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download CSV
            </button>
          </div>
        )}
        {questionnaire.status === 'failed' && (
          <button
            data-testid="regenerate-btn"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-50 text-white border border-slate-700 hover:border-slate-600 font-medium px-5 py-2.5 rounded-lg transition-all"
          >
            {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Regenerate Answers
          </button>
        )}
      </div>

      {/* Processing state */}
      {isProcessing && (
        <div data-testid="processing-indicator" className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-12 text-center">
          <Loader2 className="h-12 w-12 text-blue-400 animate-spin mx-auto mb-4" />
          <h2 className="text-white font-semibold font-jakarta text-xl mb-2">AI is working on your questionnaire</h2>
          <p className="text-slate-400">
            Analyzing {questionnaire.question_count} questions against your reference documents.
          </p>
          <p className="text-slate-500 text-sm mt-2">This usually takes 15–60 seconds. Page will update automatically.</p>
        </div>
      )}

      {/* Failed state */}
      {questionnaire.status === 'failed' && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-red-300 font-semibold font-jakarta mb-1">Processing failed</h2>
            <p className="text-red-400/70 text-sm">{questionnaire.error_message || 'An unexpected error occurred.'}</p>
          </div>
        </div>
      )}

      {/* Results table */}
      {questionnaire.status === 'completed' && questionnaire.answers.length > 0 && (
        <div data-testid="results-table">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Questions', value: questionnaire.answers.length, color: 'text-white' },
              { label: 'Answered', value: foundCount, color: 'text-green-400' },
              { label: 'Not Found', value: questionnaire.answers.length - foundCount, color: 'text-amber-400' },
            ].map((s) => (
              <div key={s.label} className="bg-[#0B1221] border border-slate-800 rounded-xl p-4 text-center">
                <div className={`text-3xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
                <div className="text-slate-400 text-sm mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {questionnaire.answers.map((ans, i) => (
              <div
                key={i}
                data-testid={`answer-item-${i}`}
                className="bg-[#0B1221] border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <span className="text-slate-600 text-sm font-mono mt-0.5 shrink-0 w-6">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-medium mb-3 leading-relaxed">{ans.question}</p>

                    <div className={`rounded-lg p-4 mb-3 border ${
                      ans.found
                        ? 'bg-slate-900/60 border-slate-700/50'
                        : 'bg-amber-500/5 border-amber-500/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {ans.found ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className={`text-xs font-semibold uppercase tracking-wider ${ans.found ? 'text-green-400' : 'text-amber-400'}`}>
                          {ans.found ? 'Answer' : 'Not Found'}
                        </span>
                      </div>
                      <p className={`text-sm leading-relaxed ${ans.found ? 'text-slate-200' : 'text-amber-300/80'}`}>
                        {ans.answer}
                      </p>
                    </div>

                    {ans.found && (ans.source_document || ans.citation) && (
                      <div className="flex items-start gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-slate-500 leading-relaxed">
                          {ans.source_document && (
                            <span className="text-sky-400 font-medium">{ans.source_document}</span>
                          )}
                          {ans.citation && (
                            <span className="text-slate-500"> — "{ans.citation}"</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Results;
