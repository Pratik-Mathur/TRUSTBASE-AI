import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';
import { createClient } from '@supabase/supabase-js';

function getSupabase({ useServiceRole = false } = {}) {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL;
  const key =
    (useServiceRole && process.env.SUPABASE_SERVICE_ROLE_KEY) ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY;
  return createClient(url, key);
}

async function getUser(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const supabase = getSupabase();
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

async function ensureBucket() {
  const admin = getSupabase({ useServiceRole: true });
  const { data: bq } = await admin.storage.getBucket('tb-questionnaires');
  if (!bq) {
    await admin.storage.createBucket('tb-questionnaires', { public: false, fileSizeLimit: '10MB' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ detail: 'Method not allowed' });

  const user = await getUser(req);
  if (!user) return res.status(401).json({ detail: 'Unauthorized' });

  const id = (req.query?.id || '').toString();
  if (!id) return res.status(400).json({ detail: 'Invalid questionnaire id' });
  const safeId = decodeURIComponent(id).replace(/[\/\\]/g, '_');

  await ensureBucket();
  const admin = getSupabase({ useServiceRole: true });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const docIds = Array.isArray(body?.document_ids) ? body.document_ids : [];

  // Load questionnaire metadata (questions)
  const metaPath = `meta/${safeId}.json`;
  let questions = [];
  try {
    const { data: meta } = await admin.storage.from('tb-questionnaires').download(metaPath);
    if (meta) {
      const text = await meta.text();
      const obj = JSON.parse(text || '{}');
      questions = obj.questions || [];
    }
  } catch {}

  // Load first reference doc text as evidence (if any)
  let evidenceText = '';
  let sourceDocName = '';
  if (docIds.length > 0) {
    const firstId = docIds[0];
    const name = firstId.split('/').pop();
    sourceDocName = name;
    try {
      const { data: doc } = await admin.storage.from('tb-docs').download(firstId);
      if (doc) {
        evidenceText = await doc.text();
        evidenceText = (evidenceText || '').slice(0, 300);
      }
    } catch {}
  }

  const answers = questions.map((q) => ({
    question: q,
    answer: sourceDocName ? `See ${sourceDocName} for details.` : 'No reference documents selected.',
    found: !!sourceDocName,
    confidence: sourceDocName ? 'MEDIUM' : 'LOW',
    citation: evidenceText ? evidenceText.slice(0, 120) : '',
    evidence_text: evidenceText || '',
    source_document: sourceDocName || '',
    is_edited: false,
  }));

  // Persist answers and status
  const statusObj = {
    status: 'completed',
    document_ids: docIds,
    started_at: new Date().toISOString(),
    user_id: user.id,
  };

  const path = `jobs/${safeId}.status.json`;
  const dataBuf = Buffer.from(JSON.stringify(statusObj), 'utf-8');
  const { error } = await admin.storage.from('tb-questionnaires').upload(path, dataBuf, { upsert: true, contentType: 'application/json' });
  if (error) return res.status(500).json({ detail: 'Failed to start processing' });

  const answersPath = `jobs/${safeId}.answers.json`;
  await admin.storage.from('tb-questionnaires').upload(answersPath, Buffer.from(JSON.stringify({ answers }), 'utf-8'), { upsert: true, contentType: 'application/json' });

  return res.status(200).json({ status: 'processing' });
}
