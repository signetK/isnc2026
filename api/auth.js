// POST /api/auth {action:"login", username, password}
// POST /api/auth {action:"logout"}
// POST /api/auth {action:"change-password", current, password}   (evaluators)
import { body } from '../lib/http.js';
import {
  checkLogin, startSession, endSession, currentUser, getAccount, saveAccount, passwordMatches,
  normUser, send,
} from '../lib/accounts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  try {
    const b = body(req);
    if (b.action === 'login') {
      // No lock after wrong passwords: a judge can always try again.
      const user = normUser(b.username);
      const who = user && await checkLogin(user, b.password);
      if (!who) return send(res, 401, { error: 'Wrong username or password.' });
      await startSession(res, req, who.username);
      return send(res, 200, { ok: true, name: who.name || who.username });
    }
    if (b.action === 'logout') { await endSession(res, req); return send(res, 200, { ok: true }); }
    if (b.action === 'change-password') {
      const me = await currentUser(req);
      if (!me || me.role !== 'evaluator') return send(res, 403, { error: 'Log in with your evaluator account first.' });
      const a = await getAccount(me.username), pw = String(b.password || '');
      if (!(await passwordMatches(a, b.current))) return send(res, 400, { error: 'Your current password is not correct.' });
      if (pw.trim().length < 4) return send(res, 400, { error: 'Use at least 4 characters for the new password.' });
      a.password = pw.trim().slice(0, 40); delete a.pass; delete a.generated; a.passChangedAt = Date.now(); await saveAccount(a);
      return send(res, 200, { ok: true });
    }
    send(res, 400, { error: 'Unknown action.' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
