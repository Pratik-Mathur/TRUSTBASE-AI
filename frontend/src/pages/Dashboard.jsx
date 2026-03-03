import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import axios from 'axios';
import {
  Upload, FileText, Trash2, PlusCircle, CheckCircle,
  Clock, Loader2, AlertCircle, FileUp, ChevronRight, Database
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatusBadge = ({ status }) => {
  const map = {
    pending:    { icon: Clock,      color: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/20', label: 'Pending' },
    processing: { icon: Loader2,    color: 'text-blue-400 bg-blue-400/10 border-blue-500/20',       label: 'Processing', spin: true },
    completed:  { icon: CheckCircle,color: 'text-green-400 bg-green-400/10 border-green-500/20',    label: 'Completed' },
    failed:     { icon: AlertCircle,color: 'text-red-400 bg-red-400/10 border-red-500/20',          label: 'Failed' },
  };
  const c = map[status] || map.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.color}`}>
      <Icon className={`h-3 w-3 ${c.spin ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
};

const Dashboard = () => {
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef();

  const [docs, setDocs] = useState([]);
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingQs, setLoadingQs] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('documents');

  const fetchDocs = async () => {
    try {
      const res = await axios.get(`${API}/documents`, { headers: getAuthHeaders() });
      setDocs(res.data);
    } catch { toast.error('Failed to load documents'); }
    finally { setLoadingDocs(false); }
  };

  const fetchQuestionnaires = async () => {
    try {
      const res = await axios.get(`${API}/questionnaires`, { headers: getAuthHeaders() });
      setQuestionnaires(res.data);
    } catch { toast.error('Failed to load questionnaires'); }
    finally { setLoadingQs(false); }
  };

  useEffect(() => { fetchDocs(); fetchQuestionnaires(); }, []);

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      await axios.post(`${API}/documents`, fd, { headers: { ...getAuthHeaders(), 'Content-Type': 'multipart/form-data' } });
      toast.success('Document uploaded successfully');
      fetchDocs();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDoc = async (id) => {
    try {
      await axios.delete(`${API}/documents/${id}`, { headers: getAuthHeaders() });
      setDocs((prev) => prev.filter((d) => d.id !== id));
      toast.success('Document deleted');
    } catch { toast.error('Delete failed'); }
  };

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatSize = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}k chars` : `${n} chars`;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-jakarta">Dashboard</h1>
          <p className="text-slate-400 mt-1">Manage your reference documents and questionnaires</p>
        </div>
        <button
          data-testid="new-questionnaire-btn"
          onClick={() => navigate('/questionnaire/new')}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg transition-all hover:scale-[1.02] shadow-[0_0_20px_-5px_rgba(56,189,248,0.4)]"
        >
          <PlusCircle className="h-4 w-4" />
          New Questionnaire
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {[
          { label: 'Reference Documents', value: docs.length, icon: Database, color: 'text-sky-400' },
          { label: 'Questionnaires', value: questionnaires.length, icon: FileText, color: 'text-violet-400' },
        ].map((s) => (
          <div key={s.label} className="bg-[#0B1221] border border-slate-800 rounded-xl p-5 flex items-center gap-4">
            <div className={`${s.color} bg-current/10 rounded-lg p-2.5 bg-slate-800`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold text-white font-jakarta">{s.value}</div>
              <div className="text-slate-400 text-sm">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-900/40 p-1 rounded-lg w-fit border border-slate-800">
        {[{ id: 'documents', label: 'Reference Documents' }, { id: 'questionnaires', label: 'Questionnaires' }].map((t) => (
          <button
            key={t.id}
            data-testid={`tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === t.id ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Documents tab */}
      {tab === 'documents' && (
        <div data-testid="documents-section">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-sky-500/50 rounded-xl p-8 text-center cursor-pointer transition-all mb-6 group"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              onChange={handleDocUpload}
              className="hidden"
              data-testid="doc-upload-input"
            />
            {uploading ? (
              <Loader2 className="h-8 w-8 text-sky-400 animate-spin mx-auto mb-3" />
            ) : (
              <Upload className="h-8 w-8 text-slate-500 group-hover:text-sky-400 mx-auto mb-3 transition-colors" />
            )}
            <p className="text-slate-300 font-medium mb-1">{uploading ? 'Uploading...' : 'Upload reference document'}</p>
            <p className="text-slate-500 text-sm">PDF or TXT — security policies, SOC 2 reports, etc.</p>
          </div>

          {loadingDocs ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 text-sky-400 animate-spin" /></div>
          ) : docs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileUp className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No reference documents yet. Upload your first document above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  data-testid={`doc-item-${doc.id}`}
                  className="flex items-center justify-between bg-[#0B1221] border border-slate-800 rounded-xl px-5 py-4 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-sky-500/10 rounded-lg p-2">
                      <FileText className="h-4 w-4 text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{doc.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{formatSize(doc.size_chars)} · {formatDate(doc.created_at)}</p>
                    </div>
                  </div>
                  <button
                    data-testid={`delete-doc-${doc.id}`}
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors ml-4 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Questionnaires tab */}
      {tab === 'questionnaires' && (
        <div data-testid="questionnaires-section">
          {loadingQs ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 text-sky-400 animate-spin" /></div>
          ) : questionnaires.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="mb-4">No questionnaires yet.</p>
              <button
                onClick={() => navigate('/questionnaire/new')}
                className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold px-5 py-2.5 rounded-lg transition-all text-sm"
              >
                Create your first questionnaire
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {questionnaires.map((q) => (
                <div
                  key={q.id}
                  data-testid={`questionnaire-item-${q.id}`}
                  className="flex items-center justify-between bg-[#0B1221] border border-slate-800 rounded-xl px-5 py-4 hover:border-slate-700 transition-colors cursor-pointer"
                  onClick={() => navigate(`/questionnaire/${q.id}`)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="bg-violet-500/10 rounded-lg p-2">
                      <FileText className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm">{q.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{q.question_count} questions · {formatDate(q.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={q.status} />
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
