export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' });
  const id = req.query.id;
  if (!id || typeof id !== 'string') return res.status(400).json({ detail: 'Invalid questionnaire id' });
  return res.status(200).json({
    id,
    name: id.split('/').pop(),
    status: 'processing',
    questions: [],
    answers: [],
    versions: [],
  });
}
