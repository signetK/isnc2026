// Small helpers shared by the api/ functions.
export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
export function body(req) {
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  return b;
}
export function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
export function isLocal(req) { return /^(localhost|127\.0\.0\.1)(:|$)/.test(String(req.headers.host || '')); }
/** The site's own address, e.g. https://isnc2026-eval.vercel.app — used in email links. */
export function siteUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const proto = req.headers['x-forwarded-proto'] || (isLocal(req) ? 'http' : 'https');
  return `${proto}://${host}`;
}
export function clientIp(req) { return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local'; }
