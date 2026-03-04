import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import { Upload, FileText, ChevronRight, Loader2, CheckSquare, Square, AlertCircle, ArrowLeft } from 'lucide-react';

const API = '/api';

const STEPS = ['Upload Questionnaire', 'Select Documents', 'Process'];

const NewQuestionnaire = () => {
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();

  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [docs, setDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [loadingDocs, setLoadingDocs] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post(`${API}/questionnaires`, fd, {
        headers: { ...getAuthHeaders() },
      });
      setQuestionnaire(res.data);

      // Load available docs
      setLoadingDocs(true);
      const docsRes = await axios.get(`${API}/documents`, { headers: getAuthHeaders() });
      setDocs(docsRes.data);
      setSelectedDocs(new Set(docsRes.data.map((d) => d.id)));
      setLoadingDocs(false);
      setStep(1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const toggleDoc = (id) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleProcess = async () => {
    if (selectedDocs.size === 0 && docs.length > 0) {
      toast.error('Select at least one reference document');
      return;
    }
    setProcessing(true);
    try {
      await axios.post(
        `/api/questionnaires/process?id=${encodeURIComponent(questionnaire.id)}`,
        { document_ids: docs.length > 0 ? Array.from(selectedDocs) : [] },
        { headers: getAuthHeaders() }
      );
      toast.success('Processing started!');
      navigate(`/questionnaire/${encodeURIComponent(questionnaire.id)}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start processing');
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </button>
      <h1 className="text-3xl font-bold text-white font-jakarta mb-2">New Questionnaire</h1>
      <p className="text-slate-400 mb-8">Upload a questionnaire and let AI answer it using your reference documents</p>

      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              i === step ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
              i < step ? 'text-green-400' : 'text-slate-500'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
                i < step ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                i === step ? 'bg-sky-500/20 border-sky-500/30 text-sky-400' :
                'bg-slate-800 border-slate-700 text-slate-500'
              }`}>
                {i < step ? '✓' : i + 1}
              </span>
              {s}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-700 mx-1" />}
          </div>
        ))}
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <div
          data-testid="questionnaire-upload-area"
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-sky-500/50 rounded-2xl p-16 text-center cursor-pointer transition-all group"
        >
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md"
            onChange={handleFileUpload}
            className="hidden"
            data-testid="questionnaire-file-input"
          />
          {uploading ? (
            <>
              <Loader2 className="h-12 w-12 text-sky-400 animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold font-jakarta">Parsing questions...</p>
              <p className="text-slate-400 text-sm mt-1">Extracting questions from your file</p>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-slate-500 group-hover:text-sky-400 mx-auto mb-4 transition-colors" />
              <p className="text-white font-semibold font-jakarta text-lg mb-1">Upload your questionnaire</p>
              <p className="text-slate-400 text-sm">PDF or TXT file — security questionnaire, RFP, compliance form</p>
              <span className="inline-block mt-4 px-4 py-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-lg text-sm">
                Click to browse files
              </span>
            </>
          )}
        </div>
      )}

      {/* Step 1: Select docs */}
      {step === 1 && questionnaire && (
        <div>
          <div className="bg-[#0B1221] border border-slate-800 rounded-xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-green-500/10 rounded-lg p-2">
                <FileText className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <p className="text-white font-medium">{questionnaire.name}</p>
                <p className="text-slate-400 text-sm">{questionnaire.question_count} questions detected</p>
              </div>
            </div>
            <div className="border-t border-slate-800 pt-3 max-h-48 overflow-y-auto space-y-1">
              {questionnaire.questions.slice(0, 5).map((q, i) => (
                <p key={i} className="text-slate-400 text-sm truncate">
                  <span className="text-slate-600 mr-2">{i + 1}.</span>{q}
                </p>
              ))}
              {questionnaire.questions.length > 5 && (
                <p className="text-slate-500 text-xs pt-1">+{questionnaire.questions.length - 5} more questions</p>
              )}
            </div>
          </div>

          <h2 className="text-white font-semibold font-jakarta mb-3">Select reference documents</h2>
          {loadingDocs ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 text-sky-400 animate-spin" /></div>
          ) : docs.length === 0 ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-5 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-300 font-medium text-sm">No reference documents found</p>
                <p className="text-yellow-400/70 text-sm mt-1">Upload reference documents in the Dashboard before processing. The AI will have no context to work with.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              {docs.map((doc) => {
                const checked = selectedDocs.has(doc.id);
                return (
                  <div
                    key={doc.id}
                    data-testid={`select-doc-${doc.id}`}
                    onClick={() => toggleDoc(doc.id)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
                      checked ? 'border-sky-500/30 bg-sky-500/5' : 'border-slate-800 bg-[#0B1221] hover:border-slate-700'
                    }`}
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4 text-sky-400 shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-600 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-slate-500 text-xs">{(doc.size_chars / 1000).toFixed(1)}k chars</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            data-testid="process-btn"
            onClick={handleProcess}
            disabled={processing}
            className="w-full h-12 bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-semibold rounded-xl transition-all hover:scale-[1.01] shadow-[0_0_20px_-5px_rgba(56,189,248,0.4)] flex items-center justify-center gap-2"
          >
            {processing ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Starting AI processing...</>
            ) : (
              <><ChevronRight className="h-4 w-4" /> Process with AI ({selectedDocs.size} doc{selectedDocs.size !== 1 ? 's' : ''})</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default NewQuestionnaire;
