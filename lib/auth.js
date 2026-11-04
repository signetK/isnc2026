// POST /api/auth {action:"login", username, password}
// POST /api/auth {action:"logout"}
// POST /api/auth {action:"change-password", current, password}   (evaluators)
import { body, clientIp } from '../lib/http.js';
import {
  checkLogin, startSession, endSession, currentUser, getAccount, saveAccount, passwordMatches, hashPassword,
  tooManyFails, addFail, clearFails, normUser, send,
} from '../lib/accounts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  try {
    const b = body(req);
    if (b.action === 'login') {
      const user = normUser(b.username), ipKey = 'ip:' + clientIp(req), userKey = 'user:' + user;
      if (await tooManyFails(userKey) || await tooManyFails(ipKey)) return send(res, 429, { error: 'Too many wrong tries. Wait 15 minutes, then try again.' });
      const who = user && await checkLogin(user, b.password);
      if (!who) { await addFail(userKey); await addFail(ipKey); return send(res, 401, { error: 'Wrong username or password.' }); }
      await clearFails(userKey);
      await startSession(res, req, who.username);
      return send(res, 200, { ok: true, name: who.name || who.username });
    }
    if (b.action === 'logout') { await endSession(res, req); return send(res, 200, { ok: true }); }
    if (b.action === 'change-password') {
      const me = await currentUser(req);
      if (!me || me.role !== 'evaluator') return send(res, 403, { error: 'Log in with your evaluator account first.' });
      const a = await getAccount(me.username), pw = String(b.password || '');
      if (!(await passwordMatches(a, b.current))) return send(res, 400, { error: 'Your current password is not correct.' });
      if (pw.length < 6) return send(res, 400, { error: 'Use at least 6 characters for the new password.' });
      a.pass = await hashPassword(pw); a.generated = false; a.passChangedAt = Date.now(); await saveAccount(a);
      return send(res, 200, { ok: true });
    }
    send(res, 400, { error: 'Unknown action.' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
