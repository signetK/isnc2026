import { timingSafeEqual } from 'node:crypto';
import { EVALUATORS } from './criteria.js';

// Bumped when the code check changes; /api/health shows it so you can tell which version is live.
export const AUTH_VERSION = 2;

// Codes are compared without regard to capital letters or spaces, so "7kq4-m2xp" works for "7KQ4-M2XP".
const norm = v => String(v || '').replace(/\s+/g, '').toUpperCase();

function same(a, b) {
  const x = Buffer.from(norm(a)), y = Buffer.from(norm(b));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** Evaluator n's code comes from the EVAL_KEY_n environment variable. */
export function isEvaluator(n, key) {
  n = Number(n);
  if (!(Number.isInteger(n) && n >= 1 && n <= EVALUATORS)) return false;
  return same(key, process.env['EVAL_KEY_' + n]);
}

export function isAdmin(key) { return same(key, process.env.ADMIN_KEY); }

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
