// GET /api/health — setup check. Shows whether the admin password, the evaluator accounts and the database are set up.
// Never shows passwords.
import { redis } from '../lib/redis.js';
import { allAccounts, SEATS } from '../lib/accounts.js';

export default async function handler(req, res) {
  const v = process.env.ADMIN_KEY;
  const out = {
    version: 'accounts-12',
    ADMIN_KEY: !v ? 'MISSING: this is the admin password' : v !== v.trim() ? 'set — PROBLEM: has a space at the start/end' : `set (${v.length} characters)`,
    SMTP_USER: process.env.SMTP_USER ? `set (${String(process.env.SMTP_USER).trim()})` : 'MISSING: the Gmail address that sends the Excel files',
    SMTP_PASS: process.env.SMTP_PASS ? (String(process.env.SMTP_PASS).replace(/\s+/g, '').length === 16 ? 'set (16 letters)' : 'set — PROBLEM: a Gmail App Password has 16 letters') : 'MISSING: the Gmail App Password',
    database: 'checking',
    evaluatorAccounts: 'checking',
  };
  try {
    await redis('PING'); out.database = 'connected';
    const n = Object.keys(await allAccounts()).length;
    out.evaluatorAccounts = n ? `${n} of ${SEATS.length} created` : `not created yet: log in as admin → Accounts → Create the ${SEATS.length} accounts`;
  } catch (e) { out.database = 'NOT WORKING — ' + e.message; }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}
