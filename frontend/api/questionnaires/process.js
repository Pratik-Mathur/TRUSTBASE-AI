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
  const synonyms = {
    mfa: ['mfa','multi-factor','multi factor','two-factor','2fa'],
    hipaa: ['hipaa','baa','health insurance portability'],
    encryption: ['encryption','encrypted','aes','tls','ssl','at rest','in transit'],
    retention: ['retention','retained','store','stored','storage duration','data retention'],
    logging: ['logs','logging','audit','auditing'],
    residency: ['residency','location','region','data center','geo','geography'],
    uptime: ['uptime','availability','service level','sla','99','%','nines'],
    breach: ['breach','incident','notify','notification','customers','alert','disclosure'],
    audit: ['audit','assessment','penetration','pentest','third-party','external'],
  };
  function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
  }
  function getCategoriesFromQuestion(qStr) {
    const cats = [];
    const lower = qStr.toLowerCase();
    for (const key of Object.keys(synonyms)) {
      if (synonyms[key].some(k => lower.includes(k))) cats.push(key);
    }
    return cats;
  }
  function sentenceMatchesCategory(sentence, cats) {
    const s = sentence.toLowerCase();
    if (cats.length === 0) return true;
    // Require at least one token from any matched category
    return cats.some(cat => synonyms[cat].some(k => s.includes(k)));
  }
  function scoreSentence(q, s) {
    const qTokens = tokenize(q).filter((w)=>w.length>2);
    const sTokens = tokenize(s);
    if (sTokens.length===0) return 0;
    // base overlap
    let overlap = 0;
    for (const t of qTokens) if (sTokens.includes(t)) overlap++;
    let score = overlap;
    // keyword boosts
    const qStr = q.toLowerCase();
    const sStr = s.toLowerCase();
    let domainHits = 0;
    for (const [key, list] of Object.entries(synonyms)) {
      const qHas = list.some(k=>qStr.includes(k));
      const sHas = list.some(k=>sStr.includes(k));
      if (qHas && sHas) { score += 2; domainHits++; }
    }
    // proximity: consecutive matches
    for (let i=0;i<qTokens.length-1;i++){
      if (sStr.includes(`${qTokens[i]} ${qTokens[i+1]}`)) score += 1;
    }
    // normalize by sentence length
    const norm = score / Math.sqrt(sTokens.length);
    return { norm, domainHits };
  }
  const answers = questions.map((q) => {
    let best = { score: 0, domainHits: 0, sentence: '', doc: '' };
    const cats = getCategoriesFromQuestion(q);
    for (const d of docs) {
      for (const s of d.sentences) {
        const { norm, domainHits } = scoreSentence(q, s);
        // Penalize sentences that don't match the question's category tokens
        const categoryMatch = sentenceMatchesCategory(s, cats);
        const adjusted = categoryMatch ? norm : norm * 0.3;
        if (adjusted > best.score) best = { score: adjusted, domainHits, sentence: s, doc: d.name };
      }
    }
    const found = best.score >= 0.45 && best.domainHits > 0;
    const confidence = best.score >= 0.85 ? 'HIGH' : best.score >= 0.45 ? 'MEDIUM' : 'LOW';
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
