// GET /api/health — setup check. Shows whether every server file loads, the admin password, Gmail, the database
// and the evaluator accounts are set up. Never shows passwords.
// Everything is loaded one by one, so a missing or broken file is named here instead of crashing the whole check.
export default async function handler(req, res) {
  const out = { version: 'accounts-12-excel', files: {}, ADMIN_KEY: '', SMTP_USER: '', SMTP_PASS: '', emailLibrary: '', database: '', evaluatorAccounts: '' };
  // Each file is written out in full (not built from a list) so Vercel knows to include it.
  const load = async (name, importer) => { try { const m = await importer(); out.files[name] = 'ok'; return m; } catch (e) { out.files[name] = 'PROBLEM: ' + e.message.split('\n')[0]; return null; } };
  await load('lib/criteria.js', () => import('../lib/criteria.js'));
  await load('lib/papers.js', () => import('../lib/papers.js'));
  const redis = await load('lib/redis.js', () => import('../lib/redis.js'));
  await load('lib/http.js', () => import('../lib/http.js'));
  const accounts = await load('lib/accounts.js', () => import('../lib/accounts.js'));
  await load('lib/xlsx.js', () => import('../lib/xlsx.js'));
  await load('lib/report.js', () => import('../lib/report.js'));
  await load('lib/mail.js', () => import('../lib/mail.js'));
  await load('lib/deliver.js', () => import('../lib/deliver.js'));
  await load('api/data.js', () => import('./data.js'));
  await load('api/score.js', () => import('./score.js'));
  await load('api/auth.js', () => import('./auth.js'));
  await load('api/admin.js', () => import('./admin.js'));
  await load('api/export.js', () => import('./export.js'));

  const v = process.env.ADMIN_KEY;
  out.ADMIN_KEY = !v ? 'MISSING: this is the admin password' : v !== v.trim() ? 'set — PROBLEM: has a space at the start/end' : `set (${v.length} characters)`;
  out.SMTP_USER = process.env.SMTP_USER ? `set (${String(process.env.SMTP_USER).trim()})` : 'MISSING: the Gmail address that sends the Excel files';
  out.SMTP_PASS = process.env.SMTP_PASS ? (String(process.env.SMTP_PASS).replace(/\s+/g, '').length === 16 ? 'set (16 letters)' : 'set — PROBLEM: a Gmail App Password has 16 letters') : 'MISSING: the Gmail App Password';
  try { await import('nodemailer'); out.emailLibrary = 'installed'; } catch (e) { out.emailLibrary = 'MISSING: upload package.json and package-lock.json, then redeploy'; }

  try {
    if (!redis || !accounts) throw new Error('a server file is missing (see "files" above)');
    await redis.redis('PING'); out.database = 'connected';
    const n = Object.keys(await accounts.allAccounts()).length;
    out.evaluatorAccounts = n ? `${n} of ${accounts.SEATS.length} created` : `not created yet: log in as admin → Accounts → Create the ${accounts.SEATS.length} accounts`;
  } catch (e) { out.database = out.database || 'NOT WORKING — ' + e.message; }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}
