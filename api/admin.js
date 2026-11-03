// POST /api/admin  { admin: <key>, action: 'clear-scores' | 'delete-score', id }
import { redis, SCORES_KEY } from '../lib/redis.js';
import { isAdmin, send } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (!isAdmin(b.admin)) return send(res, 403, { error: 'Not allowed.' });
  try {
    if (b.action === 'clear-scores') { await redis('DEL', SCORES_KEY); return send(res, 200, { ok: true }); }
    if (b.action === 'delete-score' && b.id) { await redis('HDEL', SCORES_KEY, String(b.id)); return send(res, 200, { ok: true }); }
    send(res, 400, { error: 'Unknown action.' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
