// GET /api/data — what the page needs, based on who is logged in (session cookie).
//   Everyone:   papers + score totals (for the ranking).
//   Evaluator:  + their own full score sheets ("mine") and their seat.
//   Admin:      + every score sheet with remarks, and the judges' names per seat.
import { PAPERS } from '../lib/papers.js';
import { EVALUATORS } from '../lib/criteria.js';
import { allScores } from '../lib/redis.js';
import { currentUser, allAccounts, GROUPS, send } from '../lib/accounts.js';
import { maskEmail } from '../lib/deliver.js';

const groupOf = p => String(p.group || (p.theme === '4' || p.theme === '5' ? '4-5' : p.theme));

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Use GET.' });
  try {
    const [user, all] = await Promise.all([currentUser(req), allScores()]);
    const papers = PAPERS.map((p, i) => ({ code: p.code, group: groupOf(p), theme: p.theme, title: p.title, authors: p.authors, order: i }));
    const scores = all.map(s => ({ code: s.code, ev: s.ev, s1: s.s1, s2: s.s2, s3: s.s3, total: s.total }));
    const out = { role: user ? user.role : 'viewer', evaluators: EVALUATORS, papers, scores, at: Date.now() };
    if (user && user.role === 'evaluator') {
      out.me = { username: user.username, name: user.name, group: user.group, slot: user.slot, label: `${GROUPS[user.group].label} · Evaluator ${user.slot}`, email: maskEmail(user.email) };
      const inMyGroup = new Set(papers.filter(p => p.group === user.group).map(p => p.code));
      out.mine = {};
      all.filter(s => s.ev === user.slot && inMyGroup.has(s.code))
        .forEach(s => { out.mine[s.code] = { scores: s.scores, total: s.total, remarks: s.remarks || '', updatedAt: s.updatedAt }; });
    }
    if (user && user.role === 'admin') {
      out.me = { username: 'admin', name: 'Admin' };
      out.full = all;
      out.panel = {};
      for (const a of Object.values(await allAccounts())) (out.panel[a.group] ||= {})[a.slot] = a.name || a.username;
    }
    send(res, 200, out);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
