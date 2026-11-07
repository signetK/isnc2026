// POST /api/export {action:"xlsx"}   → the Excel file for the logged-in person, as base64
//        evaluator: their theme group's ranking + their own scores and remarks · admin: everything
// POST /api/export {action:"email"}  → email the evaluator their own Excel file
import { body, siteUrl } from '../lib/http.js';
import { allScores } from '../lib/redis.js';
import { currentUser, send } from '../lib/accounts.js';
import { buildReport } from '../lib/report.js';
import { getPapers } from '../lib/catalog.js';
import { emailReport, panelNames } from '../lib/deliver.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  try {
    const me = await currentUser(req);
    if (!me) return send(res, 401, { error: 'Your login has expired. Log in again.' });
    const b = body(req);
    if (b.action === 'xlsx') {
      const scores = await allScores();
      const { buffer, filename } = buildReport({ viewer: me, scores, papers: await getPapers(), names: me.role === 'admin' ? await panelNames() : {} });
      return send(res, 200, { filename, base64: buffer.toString('base64') });
    }
    if (b.action === 'email') {
      if (me.role !== 'evaluator') return send(res, 400, { error: 'Only evaluators can email their file. Use Download.' });
      return send(res, 200, { emailedTo: await emailReport(me, siteUrl(req), 'asked') });
    }
    send(res, 400, { error: 'Unknown action.' });
  } catch (e) {
    send(res, 400, { error: e.message });
  }
}
