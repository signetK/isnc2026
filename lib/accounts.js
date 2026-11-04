// The 12 evaluator accounts (one per panel seat), the admin login, passwords and sessions.
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { redis } from './redis.js';
import { cookies, isLocal } from './http.js';

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
/** "j***@gmail.com": shown on screen so a shared computer doesn't display the full address. */
export const maskEmail = e => String(e || '').replace(/^(.)[^@]*(@.*)$/, (_, a, b) => `${a}***${b}`);

/** A simple 4-character password like "K7QM" (no 0/O, 1/I/L, so it's easy to read out). */
export function newPassword() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 4; i++) s += a[randomInt(a.length)];
  return s;
}
// Passwords are kept so the admin can always see them on the Accounts tab.
// Capital letters and spaces don't matter when typing them (k7qm = K7QM).
const normPw = v => String(v || '').replace(/\s+/g, '').toUpperCase();
function samePassword(typed, saved) {
  const a = Buffer.from(normPw(typed)), b = Buffer.from(normPw(saved));
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
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
/** Creates the seats that don't have an account yet. Returns the usernames created. */
export async function createMissing() {
  const have = await allAccounts(), made = [];
  for (const s of SEATS) {
    if (have[s.username]) continue;
    await saveAccount({ ...s, name: NAMES[s.username] || '', password: newPassword(), active: true, createdAt: Date.now() });
    made.push(s.username);
  }
  return made;
}
/** Accounts made by the earlier version had long, scrambled passwords nobody can read back.
 *  Give each of them a new 4-character password the admin can see. Returns the usernames changed. */
export async function upgradePasswords() {
  const changed = [];
  for (const a of Object.values(await allAccounts())) {
    if (a.password) continue;
    a.password = newPassword(); delete a.pass; delete a.generated; a.passChangedAt = Date.now();
    await saveAccount(a); changed.push(a.username);
  }
  return changed;
}
/** What the admin's Accounts tab shows, including the password. */
export const view = a => ({ username: a.username, group: a.group, slot: a.slot, name: a.name || '', email: a.email || '', password: a.password || '', active: a.active !== false,
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
  if (!a || a.active === false || !samePassword(password, a.password)) return null;
  a.lastLogin = Date.now(); await saveAccount(a);
  return { ...a, role: 'evaluator' };
}
export const passwordMatches = (account, pw) => samePassword(pw, account.password);

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
