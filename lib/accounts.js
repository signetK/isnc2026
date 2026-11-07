// The 15 evaluator accounts (one per panel seat), the admin login, passwords and sessions.
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { redis } from './redis.js';
import { cookies, isLocal } from './http.js';
import { GROUPS, GROUP_KEYS } from './catalog.js';
export { GROUPS, GROUP_KEYS };

export const SENT = 'isnc2026:sent';           // hash: which automatic emails already went out
const ACCOUNTS = 'isnc2026:accounts';            // hash: username -> account JSON
const SESSION = t => `isnc2026:sess:${t}`;       // username, expires after 7 days
const SESSION_HOURS = 12, COOKIE = 'isnc_sess'; // a login lasts until the browser closes, and at most 12 hours

// Panels and their 3 seats come from the ranking groups. Usernames: t1-e1, t2-e1 (Theme 2 Group A), t2b-e1 (Theme 2 Group B), t3-e1, t45-e1 …
// RULE: accounts are never deleted automatically. An account whose seat no longer exists is left alone and simply can't log in.
// Judges from the evaluation schedule (Nov 12–13). An empty email means none was given: that judge downloads their file.
// Used to fill in an account's name and email when it is created, or when they are still blank.
const ROSTER = {
  't1-e1': ['Dr. Andrea Roxanne Anas', 'andrearoxanneanas@gmail.com'],
  't1-e2': ['Mr. Raymund Rosales', 'rgrosales@mmsu.edu.ph'],
  't1-e3': ['Dr. Menisa A. Antonio', 'maantonio@mmsu.edu.ph'],
  't2-e1': ['Dr. Winicel May C. Ancheta', 'wcancheta@mmsu.edu.ph'],
  't2-e2': ['Dr. Romelyn T. Lagura', 'rtlagura@mmsu.edu.ph'],
  't2-e3': ['Dr. Erwin Jun V. Daguio', ''],
  't2b-e1': ['Dr. Weena G. Franco', 'wgfranco@mmsu.edu.ph'],
  't2b-e2': ['Dr. Christy Ann M. Rahon', 'cmrahon@mmsu.edu.ph'],
  't2b-e3': ['Dr. Christine Joy Lim', 'cclim@mmsu.edu.ph'],
  't3-e1': ['Dr. Marvin Valentin', 'm.valentin@bsu.edu.ph'],
  't3-e2': ['Dr. Nathaniel Ericson Mateo', 'nrmateo@mmsu.edu.ph'],
  't3-e3': ['Engr. Thomas D. Ubiña', 'tdubina@mmsu.edu.ph'],
  't45-e1': ['Dr. Marvin Valentin', 'm.valentin@bsu.edu.ph'],
  't45-e2': ['Engr. Pricilla Faye Simon', 'ptsimon@mmsu.edu.ph'],
  't45-e3': ['Dr. Julius I. Jimenez', 'jijimenez@mmsu.edu.ph'],
};
export const SEATS = GROUP_KEYS.flatMap(group =>
  [1, 2, 3].map(slot => ({ username: `${GROUPS[group].user}-e${slot}`, group, slot })));

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
const seatOf = u => SEATS.find(s => s.username === u) || null;
/** Creates the seats that don't have an account yet. Returns the usernames created. */
export async function createMissing() {
  const have = await allAccounts(), made = [];
  for (const s of SEATS) {
    if (have[s.username]) continue;
    const [name = '', email = ''] = ROSTER[s.username] || [];
    await saveAccount({ ...s, name, email, password: newPassword(), active: true, createdAt: Date.now() });
    made.push(s.username);
  }
  return made;
}
/** Accounts made by the earlier version had long, scrambled passwords nobody can read back.
 *  Give each of them a new 4-character password the admin can see. Returns the usernames changed. */
export async function upgradePasswords() {
  const changed = [];
  for (const a of Object.values(await allAccounts())) {
    // Never delete an account. One whose seat no longer exists is skipped (it can't log in).
    const seat = seatOf(a.username); if (!seat) continue;
    // Keep the account's panel and seat number in step with its username (e.g. t2-e1 = Theme 2 Group A, Evaluator 1).
    if (a.group !== seat.group || a.slot !== seat.slot) { a.group = seat.group; a.slot = seat.slot; await saveAccount(a); }
    // Fill in a blank name or email from the schedule (never overwrites what the admin typed).
    const [name, email] = ROSTER[a.username] || [];
    if (name && !a.name) { a.name = name; await saveAccount(a); }
    if (email && !a.email) { a.email = email; await saveAccount(a); }
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
/** Returns the person for a correct username + password, otherwise null. */
export async function checkLogin(username, password) {
  const u = normUser(username);
  if (u === 'admin') return isAdminPassword(password) ? ADMIN : null;
  const a = await getAccount(u), seat = seatOf(u);
  if (!a || !seat || a.active === false || !samePassword(password, a.password)) return null;
  a.lastLogin = Date.now(); await saveAccount(a);
  return { ...a, group: seat.group, slot: seat.slot, role: 'evaluator' };
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
  const a = await getAccount(u), seat = seatOf(u);
  return a && seat && a.active !== false ? { ...a, group: seat.group, slot: seat.slot, role: 'evaluator' } : null;
}

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}
