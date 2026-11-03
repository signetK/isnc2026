import { timingSafeEqual } from 'node:crypto';
import { EVALUATORS } from './criteria.js';

function same(a, b) {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

/** Evaluator n's key comes from the EVAL_KEY_n environment variable. */
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
