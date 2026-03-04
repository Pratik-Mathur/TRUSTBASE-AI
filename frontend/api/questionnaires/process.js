import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

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
  let docIds = Array.isArray(body?.document_ids) ? body.document_ids : [];
  if (docIds.length === 0) {
    // Fallback to last used document ids from status
    try {
      const { data: sData } = await admin.storage.from('tb-questionnaires').download(`jobs/${safeId}.status.json`);
      if (sData) {
        const sText = await sData.text();
        const sObj = JSON.parse(sText || '{}');
        if (Array.isArray(sObj.document_ids)) docIds = sObj.document_ids;
      }
    } catch {}
  }

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

  const docs = [];
  for (const did of docIds) {
    const name = did.split('/').pop();
    try {
      const { data: doc } = await admin.storage.from('tb-docs').download(did);
      const txt = doc ? await doc.text() : '';
      const sentences = txt.split(/[\r\n]+|(?<=\.|\?|!)\s+/).map((s) => s.trim()).filter(Boolean);
      docs.push({ id: did, name, sentences });
    } catch {}
  }
  function scoreSentence(q, s) {
    const ql = q.toLowerCase();
    const sl = s.toLowerCase();
    const tokens = ql.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
    let sc = 0;
    for (const t of tokens) { if (sl.includes(t)) sc++; }
    if (ql.includes('mfa') || ql.includes('multi') && ql.includes('factor')) {
      if (sl.includes('mfa') || (sl.includes('multi') && sl.includes('factor'))) sc += 2;
    }
    if (ql.includes('hipaa')) { if (sl.includes('hipaa')) sc += 2; }
    if (ql.includes('encryption')) { if (sl.includes('encrypt')) sc += 2; }
    if (ql.includes('retention')) { if (sl.includes('retention')) sc += 1; }
    return sc;
  }
  const answers = questions.map((q) => {
    let best = { score: 0, sentence: '', doc: '' };
    for (const d of docs) {
      for (const s of d.sentences) {
        const sc = scoreSentence(q, s);
        if (sc > best.score) best = { score: sc, sentence: s, doc: d.name };
      }
    }
    const found = best.score >= 2;
    const confidence = best.score >= 5 ? 'HIGH' : best.score >= 2 ? 'MEDIUM' : 'LOW';
    const ansText = found ? best.sentence : 'No relevant information found in selected documents.';
    const citation = found ? best.sentence.slice(0, 120) : '';
    return {
      question: q,
      answer: ansText,
      found,
      confidence,
      citation,
      evidence_text: best.sentence,
      source_document: best.doc,
      is_edited: false,
    };
  });

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
