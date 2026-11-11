import { redis } from './redis.js';

export const ENCODED_KEY = 'isnc2026:encoded';
export const MAX_ENCODED = 400;

/** All encoded remarks: { "T2-14_e2": {code, ev, text, at}, … } */
export async function allEncoded() {
  const flat = (await redis('HGETALL', ENCODED_KEY)) || [], out = {};
  for (let i = 0; i < flat.length; i += 2) { try { const x = JSON.parse(flat[i + 1]); if (x && x.text) out[flat[i]] = x; } catch (e) {} }
  return out;
}

/** Saves one encoded remark; empty text removes it. Returns the saved remark (or null when removed). */
export async function saveEncoded({ code, ev, text }) {
  const id = `${code}_e${ev}`;
  const clean = String(text || '').replace(/\r\n/g, '\n').trim().slice(0, MAX_ENCODED);
  if (!clean) { await redis('HDEL', ENCODED_KEY, id); return null; }
  const rec = { code, ev, text: clean, at: Date.now() };
  await redis('HSET', ENCODED_KEY, id, JSON.stringify(rec));
  return rec;
}
