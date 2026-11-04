// The 12 evaluator accounts (one per panel seat), the admin login, passwords and sessions.
import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { redis } from './redis.js';
import { cookies, isLocal } from './http.js';

const scrypt = promisify(scryptCb);
export const SENT = 'isnc2026:sent';           // hash: which automatic emails already went out
const ACCOUNTS = 'isnc2026:accounts';            // hash: username -> account JSON
const SESSION = t => `isnc2026:sess:${t}`;       // username, expires after 7 days
const FAILS = id => `isnc2026:fail:${id}`;       // wrong-login counter, expires after 15 minutes
const SESSION_HOURS = 12, COOKIE = 'isnc_sess'; // a login lasts until the browser closes, and at most 12 hours

// Theme groups and their 3 seats. Usernames: t1-e1 … t45-e3.
export const GROUPS = {
  '1':   { label: 'Theme 1',      user: 't1' },
  '2':   { label: 'Theme 2',      user: 't2' },
  '3':   { label: 'Theme 3',      user: 't3' },
  '4-5': { label: 'Themes 4 & 5', user: 't45' },
};
// Judges' names from ISNC2026_Theme1-5.docx. Empty = not in the document yet (rename it on the Accounts tab).
const NAMES = {
  't1-e1': 'Dr. Andrea Anas', 't1-e2': 'Mr. Raymund Rosales', 't1-e3': 'Dr. Menisa Antonio',
  't3-e1': 'Engr. Marvin Valentin', 't3-e2': 'Mr. Nathaniel Erickson Mateo', 't3-e3': 'Engr. Thomas Ubina',
  't45-e1': 'Doreen I. Allasiw',
};
export const SEATS = Object.entries(GROUPS).flatMap(([group, g]) =>
  [1, 2, 3].map(slot => ({ username: `${g.user}-e${slot}`, group, slot })));

export const normUser = u => String(u || '').trim().toLowerCase();

/** A readable random password like "K7QM-4XPA" (no 0/O, 1/I/L, so it's easy to read out). */
export function newPassword() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 8; i++) { s += a[randomInt(a.length)]; if (i === 3) s += '-'; }
  return s;
}
export async function hashPassword(pw) {
  const salt = randomBytes(16).toString('base64url');
  return ['scrypt', salt, (await scrypt(String(pw), salt, 32)).toString('base64url')].join(':');
}
async function checkPassword(pw, stored) {
  const p = String(stored || '').split(':');
  if (p.length !== 3 || p[0] !== 'scrypt') return false;
  const got = await scrypt(String(pw), p[1], 32), want = Buffer.from(p[2], 'base64url');
  return got.length === want.length && timingSafeEqual(got, want);
}

/* ---------- accounts ---------- */
export async function getAccount(username) {
  const v = await redis('HGET', ACCOUNTS, normUser(username));
  return v ? JSON.parse(v) : null;
}
export const saveAccount = a => redis('HSET', ACCOUNTS, a.username, JSON.stringify(a));
export async function allAccounts() {
  const flat = (await redis('HGETALL', ACCOUNTS)) || [], out = {};
  for (let i = 0; i < flat.length; i += 2) { try { out[flat[i]] = JSON.parse(flat[i + 1]); } catch (e) {} }
  return out;
}
/** Creates the seats that don't have an account yet. Returns [{username, password}] for the new ones only. */
export async function createMissing() {
  const have = await allAccounts(), made = [];
  for (const s of SEATS) {
    if (have[s.username]) continue;
    const password = newPassword();
    await saveAccount({ ...s, name: NAMES[s.username] || '', pass: await hashPassword(password), generated: true, active: true, createdAt: Date.now() });
    made.push({ username: s.username, password });
  }
  return made;
}
/** What the page may see about an account (never the password). */
export const view = a => ({ username: a.username, group: a.group, slot: a.slot, name: a.name || '', email: a.email || '', active: a.active !== false,
  lastLogin: a.lastLogin || null, passChangedAt: a.passChangedAt || null, label: `${GROUPS[a.group].label} · Evaluator ${a.slot}` });

/* ---------- logging in ---------- */
// The admin logs in as username "admin" with the ADMIN_KEY password from Vercel.
export const ADMIN = { username: 'admin', name: 'Admin', role: 'admin' };
function isAdminPassword(pw) {
  // Like the old admin code: capital letters and spaces don't matter (admin1234 = ADMIN1234).
  const norm = v => String(v || '').replace(/\s+/g, '').toUpperCase();
  const a = Buffer.from(norm(pw)), b = Buffer.from(norm(process.env.ADMIN_KEY));
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
export async function tooManyFails(id) { return Number(await redis('GET', FAILS(id)) || 0) >= 5; }
export async function addFail(id) { if (Number(await redis('INCR', FAILS(id))) === 1) await redis('EXPIRE', FAILS(id), 900); }
export const clearFails = id => redis('DEL', FAILS(id));

/** Returns the person for a correct username + password, otherwise null. */
export async function checkLogin(username, password) {
  const u = normUser(username);
  if (u === 'admin') return isAdminPassword(password) ? ADMIN : null;
  const a = await getAccount(u);
  // Passwords made by the site are all capitals, so they work typed in small letters too. A password the judge chose is exact.
  const ok = a && a.active !== false && (await checkPassword(password, a.pass) || (a.generated && await checkPassword(String(password || '').trim().toUpperCase(), a.pass)));
  if (!ok) return null;
  a.lastLogin = Date.now(); await saveAccount(a);
  return { ...a, role: 'evaluator' };
}
export async function passwordMatches(account, pw) {
  return await checkPassword(pw, account.pass) || (account.generated && await checkPassword(String(pw || '').trim().toUpperCase(), account.pass));
}

/* ---------- sessions: random token in an http-only cookie; the token is stored in the database ---------- */
const tail = req => `; Path=/; HttpOnly; SameSite=Lax${isLocal(req) ? '' : '; Secure'}`;
export async function startSession(res, req, username) {
  const t = randomBytes(32).toString('base64url');
  await redis('SET', SESSION(t), username, 'EX', SESSION_HOURS * 3600);
  // No Max-Age: the browser forgets the login when it is closed (important on shared computers).
  res.setHeader('Set-Cookie', `${COOKIE}=${t}${tail(req)}`);
}
export async function endSession(res, req) {
  const t = cookies(req)[COOKIE];
  if (t) await redis('DEL', SESSION(t));
  res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0${tail(req)}`);
}
/** Who is logged in: the admin, an evaluator account ({username, group, slot, name, role:'evaluator'}), or null. */
export async function currentUser(req) {
  const t = cookies(req)[COOKIE];
  if (!t || t.length < 20) return null;
  const u = await redis('GET', SESSION(t));
  if (!u) return null;
  if (u === 'admin') return ADMIN;
  const a = await getAccount(u);
  return a && a.active !== false ? { ...a, role: 'evaluator' } : null;
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
