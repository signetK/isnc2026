// POST /api/admin {action, ...} — admin only (logged in as "admin").
//   Scores:   delete-score {id} · clear-scores
//   Accounts: accounts (with passwords) · create-accounts · edit {username, name, email} · set-active {username, active}
//   Papers:   add-paper {theme, group, no, session, title, authors} · delete-paper {code} · restore-paper {code}
//             deleted-papers · move-paper {code, group}   (Theme 2 papers: Group A "2a" or Group B "2b")
import { redis, SCORES_KEY, allScores } from '../lib/redis.js';
import { setGroup, addPaper, deletePaper, restorePaper, deletedPapers, getPapers } from '../lib/catalog.js';
import { body } from '../lib/http.js';
import {
  currentUser, allAccounts, getAccount, saveAccount, createMissing, upgradePasswords, view, SEATS, SENT, send,
} from '../lib/accounts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  try {
    const me = await currentUser(req);
    if (!me || me.role !== 'admin') return send(res, 403, { error: 'Admins only. Log in again as admin.' });
    const b = body(req);
    switch (b.action) {
      case 'clear-scores': await redis('DEL', SCORES_KEY); await redis('DEL', SENT); return send(res, 200, { ok: true });
      case 'delete-score': if (!b.id) break; await redis('HDEL', SCORES_KEY, String(b.id)); return send(res, 200, { ok: true });

      case 'accounts': {
        const upgraded = await upgradePasswords(), have = await allAccounts();
        return send(res, 200, { upgraded, accounts: SEATS.map(s => have[s.username] ? view(have[s.username]) : { ...s, missing: true }) });
      }
      case 'create-accounts': return send(res, 200, { created: await createMissing() });

      case 'move-paper': await setGroup(String(b.code || ''), String(b.group || '')); return send(res, 200, { ok: true });
      case 'add-paper': return send(res, 200, { paper: await addPaper(b) });
      case 'deleted-papers': return send(res, 200, { papers: await deletedPapers() });
      case 'delete-paper': {
        const code = String(b.code || '');
        const paper = (await getPapers()).find(p => p.code === code);
        if (!paper) return send(res, 404, { error: 'No such paper.' });
        const n = (await allScores()).filter(x => x.code === code).length;
        if (n) return send(res, 400, { error: `${paper.label} already has ${n} score${n > 1 ? 's' : ''}. Delete them in the Admin tab first, then delete the paper.` });
        await deletePaper(code); return send(res, 200, { ok: true });
      }
      case 'restore-paper': await restorePaper(String(b.code || '')); return send(res, 200, { ok: true });
      case 'edit': {
        const a = await getAccount(b.username); if (!a) return send(res, 404, { error: 'No such account.' });
        const email = String(b.email || '').trim().toLowerCase();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'That email address does not look right.' });
        a.name = String(b.name || '').trim().slice(0, 120); a.email = email.slice(0, 160); await saveAccount(a);
        return send(res, 200, { ok: true });
      }
      case 'set-active': {
        const a = await getAccount(b.username); if (!a) return send(res, 404, { error: 'No such account.' });
        a.active = Boolean(b.active); await saveAccount(a);
        return send(res, 200, { ok: true });
      }
    }
    send(res, 400, { error: 'Unknown action.' });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
