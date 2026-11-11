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
    body: JSON.stringify(command.map(String)),
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

/** Same as allScores, but reuses a copy up to maxAgeMs old (per server instance). Used only for viewers'
 *  ranking refreshes, to keep database use low when many screens show the ranking. Never for saving or evaluators. */
let scoresCache = { at: 0, data: null, pending: null };
export async function allScoresCached(maxAgeMs) {
  if (scoresCache.data && Date.now() - scoresCache.at < maxAgeMs) return scoresCache.data;
  if (!scoresCache.pending) scoresCache.pending = allScores().then(d => { scoresCache = { at: Date.now(), data: d, pending: null }; return d; }, e => { scoresCache.pending = null; throw e; });
  return scoresCache.pending;
}
