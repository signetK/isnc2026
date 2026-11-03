// GET /api/health — setup check. Shows whether the codes and database are set up, never the codes themselves.
import * as auth from '../lib/auth.js';
import { redis } from '../lib/redis.js';

export default async function handler(req, res) {
  const look = name => {
    const v = process.env[name];
    if (v == null || v === '') return 'MISSING';
    const notes = [];
    if (v !== v.trim()) notes.push('has a space or line break at the start/end');
    if (/^["']|["']$/.test(v.trim())) notes.push('has quote marks around it');
    if (/^[A-Z0-9_]+=/.test(v)) notes.push('value includes "NAME=" — paste only the part after =');
    return notes.length ? `set (${v.length} characters) — PROBLEM: ${notes.join('; ')}` : `set (${v.length} characters)`;
  };
  const out = {
    codeCheckVersion: auth.AUTH_VERSION ? `v${auth.AUTH_VERSION} (current)` : 'OLD lib/auth.js — upload the new one',
    EVAL_KEY_1: look('EVAL_KEY_1'), EVAL_KEY_2: look('EVAL_KEY_2'), EVAL_KEY_3: look('EVAL_KEY_3'), ADMIN_KEY: look('ADMIN_KEY'),
    database: 'checking',
  };
  try { await redis('PING'); out.database = 'connected'; } catch (e) { out.database = 'NOT WORKING — ' + e.message; }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(out);
}
