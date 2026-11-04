// POST /api/score  { e, k, code, scores: {1a..3b}, remarks }
import { PAPERS } from '../lib/papers.js';
import { CRITERIA } from '../lib/criteria.js';
import { redis, SCORES_KEY } from '../lib/redis.js';
import { isEvaluator, send } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const ev = Number(b.e);
  if (!isEvaluator(ev, b.k)) return send(res, 403, { error: 'This evaluator link is not valid. Ask the organizer for your link.' });
  const code = String(b.code || '');
  if (!PAPERS.some(p => p.code === code)) return send(res, 400, { error: 'That paper is not on the list. Reload the page.' });

  const clean = {}, sub = { s1: 0, s2: 0, s3: 0 };
  for (const c of CRITERIA) {
    const raw = b.scores ? b.scores[c.k] : undefined;
    const v = Number(raw);
    if (raw === '' || raw == null || !Number.isFinite(v) || v < 0 || v > c.max) {
      return send(res, 400, { error: `Criterion ${c.k} must be a number from 0 to ${c.max}.` });
    }
    clean[c.k] = v; sub[c.sec] += v;
  }
  const r2 = n => Math.round(n * 100) / 100;
  try {
    // Saving again replaces the evaluator's earlier score for this paper (that's how editing works).
    // createdAt keeps the first submission time; edits counts how many times it was changed.
    const id = `${code}_e${ev}`, old = await redis('HGET', SCORES_KEY, id), prev = old ? JSON.parse(old) : null;
    const rec = {
      code, ev, scores: clean, s1: r2(sub.s1), s2: r2(sub.s2), s3: r2(sub.s3),
      total: r2(sub.s1 + sub.s2 + sub.s3), remarks: String(b.remarks || '').slice(0, 400), updatedAt: Date.now(),
      createdAt: prev ? (prev.createdAt || prev.updatedAt) : Date.now(), edits: prev ? (prev.edits || 0) + 1 : 0,
    };
    await redis('HSET', SCORES_KEY, id, JSON.stringify(rec));
    send(res, 200, { ok: true, saved: rec, edited: Boolean(prev) });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
