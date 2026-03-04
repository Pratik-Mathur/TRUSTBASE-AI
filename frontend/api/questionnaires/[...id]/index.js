export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' });
  const id = Array.isArray(req.query.id) ? req.query.id.join('/') : req.query.id;
  return res.status(200).json({
    id,
    name: id.split('/').pop(),
    status: 'pending',
    questions: [],
    answers: [],
    versions: []
  });
}
