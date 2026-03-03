import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Download, ArrowLeft, CheckCircle, XCircle, Loader2, BookOpen,
  AlertCircle, Clock, RefreshCw, Edit2, Save, X, ChevronDown,
  ChevronUp, RotateCcw, History, FileText, PenLine,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatusConfig = {
  pending:    { icon: Clock,       color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-500/20', label: 'Pending' },
  processing: { icon: Loader2,     color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-500/20',     label: 'Processing with AI...', spin: true },
  completed:  { icon: CheckCircle, color: 'text-green-400',  bg: 'bg-green-400/10 border-green-500/20',   label: 'Completed' },
  failed:     { icon: AlertCircle, color: 'text-red-400',    bg: 'bg-red-400/10 border-red-500/20',       label: 'Failed' },
};

const ConfidenceBadge = ({ confidence }) => {
  if (!confidence) return null;
  const map = {
    HIGH:   'text-green-400 bg-green-400/10 border-green-500/25',
    MEDIUM: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/25',
    LOW:    'text-red-400 bg-red-400/10 border-red-500/25',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${map[confidence] || map.LOW}`}>
      {confidence}
    </span>
  );
};

const CoverageSummaryCard = ({ answers }) => {
  const total = answers.length;
  const found = answers.filter((a) => a.found).length;
  const notFound = total - found;
  const pct = total > 0 ? Math.round((found / total) * 100) : 0;
  const cc = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  answers.forEach((a) => { const c = (a.confidence || 'LOW').toUpperCase(); if (c in cc) cc[c]++; });

  return (
    <div data-testid="coverage-summary" className="bg-gradient-to-br from-sky-950/50 via-[#0B1221] to-[#0B1221] border border-sky-900/25 rounded-2xl p-6 mb-6">
      <h2 className="text-white font-semibold font-jakarta text-base mb-5">Coverage Summary</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Total Questions', value: total,    color: 'text-white' },
          { label: 'Answered',        value: found,    color: 'text-green-400' },
          { label: 'Not Found',       value: notFound, color: 'text-amber-400' },
        ].map((s) => (
          <div key={s.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center">
            <div className={`text-3xl font-bold font-jakarta ${s.color}`}>{s.value}</div>
            <div className="text-slate-400 text-xs mt-1">{s.label}</div>
          </div>
        ))}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <div className="text-slate-400 text-xs mb-3">Confidence</div>
          <div className="space-y-1.5">
            {[['HIGH','text-green-400','bg-green-400'],['MEDIUM','text-yellow-400','bg-yellow-400'],['LOW','text-red-400','bg-red-400']].map(([lvl, tc, bc]) => (
              <div key={lvl} className="flex items-center justify-between">
                <span className={`text-xs font-medium ${tc}`}>{lvl}</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-20 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${bc} rounded-full transition-all`} style={{ width: total > 0 ? `${(cc[lvl]/total)*100}%` : '0%' }} />
                  </div>
                  <span className="text-slate-400 text-xs w-4 text-right">{cc[lvl]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>{found} of {total} answered</span>
          <span className="font-medium text-white">{pct}%</span>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-green-500 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const EvidencePanel = ({ evidenceText, sourceDocument, open, onToggle }) => {
  if (!evidenceText && !sourceDocument) return null;
  return (
    <div className="mt-3 border-t border-slate-800/60 pt-3">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-400 transition-colors"
        data-testid="evidence-toggle"
      >
        <BookOpen className="h-3 w-3" />
        {open ? 'Hide Evidence' : 'View Evidence'}
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="mt-2 bg-slate-950/60 border border-slate-700/50 rounded-lg p-3">
          {sourceDocument && (
            <p className="text-sky-400 text-xs font-medium mb-1.5">{sourceDocument}</p>
          )}
          {evidenceText && (
            <p className="text-slate-300 text-xs leading-relaxed italic">"{evidenceText}"</p>
          )}
        </div>
      )}
    </div>
  );
};

const AnswerCard = ({ answer: initialAnswer, idx, qId, headers, onUpdate, canEdit }) => {
  const [answer, setAnswer] = useState(initialAnswer);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(initialAnswer.answer);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  useEffect(() => {
    setAnswer(initialAnswer);
    setEditText(initialAnswer.answer);
  }, [initialAnswer]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.patch(
        `${API}/questionnaires/${qId}/answers/${idx}`,
        { answer: editText },
        { headers }
      );
      const updated = { ...answer, ...res.data };
      setAnswer(updated);
      onUpdate(idx, updated);
      setEditing(false);
      toast.success('Answer saved');
    } catch { toast.error('Failed to save answer'); }
    finally { setSaving(false); }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await axios.post(
        `${API}/questionnaires/${qId}/answers/${idx}/regenerate`,
        {},
        { headers }
      );
      const updated = res.data;
      setAnswer(updated);
      setEditText(updated.answer);
      onUpdate(idx, updated);
      toast.success('Answer regenerated');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to regenerate'); }
    finally { setRegenerating(false); }
  };

  return (
    <div
      data-testid={`answer-card-${idx}`}
      className="bg-[#0B1221] border border-slate-800 rounded-xl p-6 sm:p-7 hover:border-slate-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-slate-600 text-sm font-mono mt-0.5 shrink-0 w-7">#{idx + 1}</span>
          <p className="text-slate-200 font-medium leading-relaxed">{answer.question}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1.5 shrink-0">
            {regenerating ? (
              <Loader2 className="h-4 w-4 text-sky-400 animate-spin" />
            ) : (
              <button
                data-testid={`regen-single-${idx}`}
                onClick={handleRegenerate}
                title="Regenerate this answer"
                className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            {!editing && (
              <button
                data-testid={`edit-answer-${idx}`}
                onClick={() => setEditing(true)}
                title="Edit answer"
                className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-500/10 transition-all"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Answer area */}
      <div className={`rounded-lg p-4 border ${answer.found ? 'bg-slate-900/60 border-slate-700/50' : 'bg-amber-500/5 border-amber-500/20'}`}>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {answer.found ? (
            <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          )}
          <span className={`text-xs font-semibold uppercase tracking-wider ${answer.found ? 'text-green-400' : 'text-amber-400'}`}>
            {answer.found ? 'Answer' : 'Not Found'}
          </span>
          <ConfidenceBadge confidence={answer.confidence} />
          {answer.is_edited && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">
              <PenLine className="h-2.5 w-2.5" /> Edited
            </span>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <textarea
              data-testid={`edit-textarea-${idx}`}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="w-full bg-slate-950/60 border border-sky-500/30 focus:border-sky-500/60 rounded-lg px-3 py-2 text-white text-sm resize-none outline-none transition-colors leading-relaxed"
            />
            <div className="flex items-center gap-2">
              <button
                data-testid={`save-answer-${idx}`}
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-semibold rounded-lg text-xs transition-all"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
              <button
                data-testid={`cancel-edit-${idx}`}
                onClick={() => { setEditing(false); setEditText(answer.answer); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-all"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className={`text-sm leading-relaxed ${answer.found ? 'text-slate-200' : 'text-amber-300/80'}`}>
            {answer.answer}
          </p>
        )}
      </div>

      {/* Citation row */}
      {answer.found && answer.source_document && (
        <div className="flex items-start gap-1.5 mt-3">
          <BookOpen className="h-3.5 w-3.5 text-sky-400 shrink-0 mt-0.5" />
          <span className="text-xs text-slate-500 leading-relaxed">
            <span className="text-sky-400 font-medium">{answer.source_document}</span>
            {answer.citation && <span className="text-slate-500"> — "{answer.citation}"</span>}
          </span>
        </div>
      )}

      <EvidencePanel
        evidenceText={answer.evidence_text}
        sourceDocument={answer.source_document}
        open={evidenceOpen}
        onToggle={() => setEvidenceOpen((o) => !o)}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Results component
// ---------------------------------------------------------------------------

const Results = () => {
  const { id } = useParams();
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const [questionnaire, setQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [selectedVersionNum, setSelectedVersionNum] = useState(null);
  const [mounted, setMounted] = useState(false);

  const fetchQuestionnaire = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/questionnaires/${id}`, { headers: getAuthHeaders() });
      setQuestionnaire(res.data);
    } catch { toast.error('Failed to load questionnaire'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchQuestionnaire(); }, [fetchQuestionnaire]);

  // Trigger mount animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!questionnaire) return;
    if (questionnaire.status === 'processing' || questionnaire.status === 'pending') {
      const t = setInterval(fetchQuestionnaire, 3000);
      return () => clearInterval(t);
    }
  }, [questionnaire?.status, fetchQuestionnaire]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await axios.post(`${API}/questionnaires/${id}/regenerate`, {}, { headers: getAuthHeaders() });
      toast.success('Regenerating with all reference documents…');
      setSelectedVersionNum(null);
      await fetchQuestionnaire();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to regenerate'); }
    finally { setRegenerating(false); }
  };

  const handleDownloadDocx = async () => {
    setDownloading(true);
    try {
      const res = await axios.get(`${API}/questionnaires/${id}/download-docx`, {
        headers: getAuthHeaders(), responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${questionnaire.name}_report.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch { toast.error('Export failed. Please try again.'); }
    finally { setDownloading(false); }
  };

  const handleAnswerUpdate = useCallback((idx, updatedAnswer) => {
    setQuestionnaire((prev) => {
      if (!prev) return prev;
      const newAnswers = [...prev.answers];
      newAnswers[idx] = updatedAnswer;
      return { ...prev, answers: newAnswers };
    });
  }, []);

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 text-sky-400 animate-spin" /></div>;
  if (!questionnaire) return null;

  const sc = StatusConfig[questionnaire.status] || StatusConfig.pending;
  const StatusIcon = sc.icon;
  const isProcessing = questionnaire.status === 'processing' || questionnaire.status === 'pending';
  const isCurrentVersion = selectedVersionNum === null;
  const displayAnswers = isCurrentVersion
    ? (questionnaire.answers || [])
    : (questionnaire.versions?.find((v) => v.version_number === selectedVersionNum)?.answers || []);
  const foundCount = displayAnswers.filter((a) => a.found).length;
  const versions = questionnaire.versions || [];

  return (
    <div className={`p-4 sm:p-8 max-w-5xl mx-auto transition-all duration-500 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      {/* Back */}
      <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white font-jakarta">{questionnaire.name}</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${sc.bg} ${sc.color}`}>
              <StatusIcon className={`h-3.5 w-3.5 ${sc.spin ? 'animate-spin' : ''}`} />
              {sc.label}
            </span>
            {displayAnswers.length > 0 && (
              <span className="text-slate-400 text-sm">{foundCount}/{displayAnswers.length} answered</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {(questionnaire.status === 'completed' || questionnaire.status === 'failed') && isCurrentVersion && (
            <button
              data-testid="regenerate-btn"
              onClick={handleRegenerate}
              disabled={regenerating || isProcessing}
              className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 disabled:opacity-50 text-white border border-slate-700 px-4 py-2.5 rounded-lg transition-all text-sm font-medium"
            >
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Regenerate Answers
            </button>
          )}
          {questionnaire.status === 'completed' && isCurrentVersion && (
            <button
              data-testid="download-report-btn"
              onClick={handleDownloadDocx}
              disabled={downloading}
              className="flex items-center gap-2 bg-gradient-to-r from-sky-400 to-cyan-400 hover:from-sky-300 hover:to-cyan-300 disabled:opacity-60 text-slate-950 font-bold px-5 py-2.5 rounded-lg transition-all hover:scale-[1.04] shadow-[0_0_30px_-4px_rgba(56,189,248,0.7)] text-sm"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Report
            </button>
          )}
        </div>
      </div>

      {/* Version history */}
      {versions.length > 0 && (
        <div data-testid="version-history" className="flex items-center gap-3 mb-5 bg-slate-900/40 border border-slate-800 rounded-xl px-4 py-3">
          <History className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-slate-400 text-sm shrink-0">Version:</span>
          <select
            data-testid="version-select"
            value={selectedVersionNum ?? 'current'}
            onChange={(e) => {
              const v = e.target.value;
              setSelectedVersionNum(v === 'current' ? null : parseInt(v, 10));
            }}
            className="bg-slate-800 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-sky-500/50 cursor-pointer"
          >
            <option value="current">
              Current — {questionnaire.answers.filter((a) => a.found).length} answered
            </option>
            {[...versions].reverse().map((v) => (
              <option key={v.version_number} value={v.version_number}>
                Version {v.version_number} — {new Date(v.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — {v.answers_found_count} answered
              </option>
            ))}
          </select>
          {!isCurrentVersion && (
            <span className="text-xs text-amber-400 border border-amber-500/20 bg-amber-500/10 rounded-full px-2.5 py-0.5">
              Viewing history — editing disabled
            </span>
          )}
        </div>
      )}

      {/* Coverage summary */}
      {displayAnswers.length > 0 && <CoverageSummaryCard answers={displayAnswers} />}
      {/* Processing state */}
      {isProcessing && (
        <div data-testid="processing-indicator" className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-12 text-center">
          <Loader2 className="h-12 w-12 text-blue-400 animate-spin mx-auto mb-4" />
          <h2 className="text-white font-semibold font-jakarta text-xl mb-2">AI is working on your questionnaire</h2>
          <p className="text-slate-400">Analyzing {questionnaire.question_count} questions. Page updates automatically.</p>
        </div>
      )}

      {/* Failed state */}
      {questionnaire.status === 'failed' && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 flex items-start gap-4 mb-6">
          <AlertCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-red-300 font-semibold font-jakarta mb-1">Processing failed</h2>
            <p className="text-red-400/70 text-sm mb-4">{questionnaire.error_message || 'An unexpected error occurred.'}</p>
            <button
              data-testid="retry-btn"
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-2 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-60 text-red-300 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            >
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Retry with all documents
            </button>
          </div>
        </div>
      )}

      {/* Answers */}
      {displayAnswers.length > 0 && (
        <div data-testid="answers-list" className="space-y-5">
          {displayAnswers.map((ans, i) => (
            <AnswerCard
              key={`${isCurrentVersion ? 'cur' : selectedVersionNum}-${i}`}
              answer={ans}
              idx={i}
              qId={id}
              headers={getAuthHeaders()}
              onUpdate={handleAnswerUpdate}
              canEdit={isCurrentVersion && questionnaire.status === 'completed'}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Results;
