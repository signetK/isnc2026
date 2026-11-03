// Minimal Upstash Redis REST client (no packages needed).
// Works with whichever variables Vercel's Upstash integration added:
//   KV_REST_API_URL + KV_REST_API_TOKEN, or
//   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or
//   REDIS_URL / KV_URL (rediss://default:TOKEN@HOST:6379) — the REST address is https://HOST.
function connection() {
  let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
  if ((!url || !token) && redisUrl) {
    try {
      const u = new URL(redisUrl);
      if (!url) url = 'https://' + u.hostname;
      if (!token) token = decodeURIComponent(u.password);
    } catch (e) {}
  }
  return { url, token };
}

export async function redis(...command) {
  const { url, token } = connection();
  if (!url || !token) throw new Error('Database is not connected. Add Upstash Redis to this Vercel project.');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Database error: ' + (j.error || r.status));
  return j.result;
}

export const SCORES_KEY = 'isnc2026:scores';

/** All score records as an array of objects. */
export async function allScores() {
  const flat = (await redis('HGETALL', SCORES_KEY)) || [];
  const out = [];
  for (let i = 0; i < flat.length; i += 2) {
    try { out.push(JSON.parse(flat[i + 1])); } catch (e) {}
  }
  return out;
}
