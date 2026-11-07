// POST /api/score { code, scores: {1a..3b}, remarks } — save or edit the logged-in evaluator's score for one paper.
// The evaluator number comes from the account, and the paper must be in the account's theme group.
import { getPapers } from '../lib/catalog.js';
import { CRITERIA } from '../lib/criteria.js';
import { redis, SCORES_KEY } from '../lib/redis.js';
import { body, siteUrl } from '../lib/http.js';
import { afterScore } from '../lib/deliver.js';
import { currentUser, send } from '../lib/accounts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  try {
    const user = await currentUser(req);
    if (!user || user.role !== 'evaluator') return send(res, 401, { error: 'Your login has expired. Log in again; your entries are still on the sheet.' });
    const b = body(req), code = String(b.code || ''), paper = (await getPapers()).find(p => p.code === code);
    if (!paper) return send(res, 400, { error: 'That paper is not on the list. Reload the page.' });
    if (paper.group !== user.group) return send(res, 403, { error: 'That paper is not in your panel\'s group.' });

    const clean = {}, sub = { s1: 0, s2: 0, s3: 0 };
    for (const c of CRITERIA) {
      const raw = b.scores ? b.scores[c.k] : undefined, v = Number(raw);
      if (raw === '' || raw == null || !Number.isFinite(v) || v < 0 || v > c.max) {
        return send(res, 400, { error: `Criterion ${c.k} must be a number from 0 to ${c.max}.` });
      }
      clean[c.k] = v; sub[c.sec] += v;
    }
    const r2 = n => Math.round(n * 100) / 100, ev = user.slot;
    // Saving again replaces this evaluator's earlier score for the paper (that's how editing works).
    const id = `${code}_e${ev}`, old = await redis('HGET', SCORES_KEY, id), prev = old ? JSON.parse(old) : null;
    const rec = {
      code, ev, by: user.username, byName: user.name || '', scores: clean,
      s1: r2(sub.s1), s2: r2(sub.s2), s3: r2(sub.s3), total: r2(sub.s1 + sub.s2 + sub.s3),
      remarks: String(b.remarks || '').slice(0, 400), updatedAt: Date.now(),
      createdAt: prev ? (prev.createdAt || prev.updatedAt) : Date.now(), edits: prev ? (prev.edits || 0) + 1 : 0,
    };
    await redis('HSET', SCORES_KEY, id, JSON.stringify(rec));
    // If this was the judge's last paper in their group, their Excel file is emailed to them (once).
    const mail = await afterScore(user, siteUrl(req));
    send(res, 200, { ok: true, saved: rec, edited: Boolean(prev), ...(mail || {}) });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
