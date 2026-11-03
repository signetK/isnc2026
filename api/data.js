// GET /api/data?e=<n>&k=<key>  or  /api/data?admin=<key>
// Everyone gets papers + score totals (for the ranking).
// A valid evaluator also gets their own full score sheets; the admin gets everything.
import { PAPERS } from '../lib/papers.js';
import { EVALUATORS } from '../lib/criteria.js';
import { allScores } from '../lib/redis.js';
import { isEvaluator, isAdmin, send } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Use GET.' });
  const q = req.query || {};
  let role = 'viewer', ev = 0;
  if (q.admin) role = isAdmin(q.admin) ? 'admin' : 'badlink';
  else if (q.e || q.k) { if (isEvaluator(q.e, q.k)) { role = 'evaluator'; ev = Number(q.e); } else role = 'badlink'; }

  try {
    const all = await allScores();
    const scores = all.map(s => ({ code: s.code, ev: s.ev, s1: s.s1, s2: s.s2, s3: s.s3, total: s.total }));
    let mine = null, full = null;
    if (role === 'evaluator') {
      mine = {};
      all.filter(s => s.ev === ev).forEach(s => mine[s.code] = { scores: s.scores, total: s.total, remarks: s.remarks || '' });
    }
    if (role === 'admin') full = all;
    send(res, 200, {
      role, ev, evaluators: EVALUATORS,
      papers: PAPERS.map((p, i) => ({ code: p.code, theme: p.theme, title: p.title, authors: p.authors, order: i })),
      scores, mine, full, at: Date.now(),
    });
  } catch (e) {
    send(res, 500, { error: e.message, role });
  }
}
