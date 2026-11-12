// GET /api/data — what the page needs, based on who is logged in (session cookie).
//   Everyone:   papers + score totals (for the ranking).
//   Evaluator:  + their own full score sheets ("mine") and their seat.
//   Admin:      + every score sheet with remarks, and the judges' names per seat.
import { getPapers } from '../lib/catalog.js';
import { EVALUATORS } from '../lib/criteria.js';
import { allScores, allScoresCached } from '../lib/redis.js';
import { allEncoded } from '../lib/encoded.js';
import { currentUser, allAccounts, GROUPS, maskEmail, send } from '../lib/accounts.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Use GET.' });
  try {
    // Viewers (not logged in) get a copy of the scores at most 5 seconds old and of the paper list at most 20 seconds old,
    // so many ranking screens don't use up the database's request allowance. Evaluators and the admin get fresh scores.
    const user = await currentUser(req);
    const [all, list] = await Promise.all([user ? allScores() : allScoresCached(5000), getPapers(user && user.role === 'admin' ? 0 : 20000)]);
    const papers = list.map(p => ({ code: p.code, label: p.label, group: p.group, theme: p.theme, no: p.no, session: p.session, title: p.title, authors: p.authors, principal: p.principal || [], affiliation: p.affiliation || '', order: p.order }));
    const scores = all.map(s => ({ code: s.code, ev: s.ev, s1: s.s1, s2: s.s2, s3: s.s3, total: s.total }));
    const out = { role: user ? user.role : 'viewer', evaluators: EVALUATORS, papers, scores, at: Date.now() };
    if (user && user.role === 'evaluator') {
      out.me = { username: user.username, name: user.name, group: user.group, slot: user.slot, label: `${GROUPS[user.group].label} · Evaluator ${user.slot}`, email: maskEmail(user.email) };
      const inMyGroup = new Set(papers.filter(p => p.group === user.group).map(p => p.code));
      out.mine = {};
      all.filter(s => s.ev === user.slot && inMyGroup.has(s.code))
        .forEach(s => { out.mine[s.code] = { scores: s.scores, total: s.total, remarks: s.remarks || '', updatedAt: s.updatedAt }; });
      // remarks a facilitator encoded for this evaluator (read-only for them)
      out.encodedMine = {};
      for (const x of Object.values(await allEncoded())) if (x.ev === user.slot && inMyGroup.has(x.code)) out.encodedMine[x.code] = { text: x.text, at: x.at };
    }
    if (user && user.role === 'admin') {
      out.me = { username: 'admin', name: 'Admin' };
      out.full = all;
      out.encoded = await allEncoded();
      out.panel = {};
      for (const a of Object.values(await allAccounts())) (out.panel[a.group] ||= {})[a.slot] = a.name || a.username;
    }
    send(res, 200, out);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
