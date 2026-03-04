export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' });
  const id = (req.query?.id || '').toString();
  if (!id) return res.status(400).json({ detail: 'Invalid questionnaire id' });
  const name = decodeURIComponent(id).split('/').pop();
  return res.status(200).json({
    id,
    name,
    status: 'processing',
    questions: [],
    answers: [],
    versions: [],
  });
}
