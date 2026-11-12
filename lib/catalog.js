// The paper list and the panels (ranking groups).
// The list starts from lib/papers.js (made from the theme document and the conference program). On the admin
// Papers tab the admin can add papers, delete (and restore) papers, and move Theme 2 papers between Group A and B;
// those changes are kept in the database, so lib/papers.js itself never needs editing.
import { redis } from './redis.js';
import { PAPERS } from './papers.js';

const GROUP_KEY = 'isnc2026:paper-groups-v3'; // v3: Track 2A/2B as in the Program of Activities; older Papers-tab choices are ignored   // hash: code -> "2a" | "2b"
const ADDED_KEY = 'isnc2026:papers-added';   // hash: code -> paper JSON (papers the admin added)
const DELETED_KEY = 'isnc2026:papers-deleted'; // hash: code -> time deleted

// Ranking groups. Each has its own panel of 3 evaluators.
export const GROUPS = {
  '1':   { label: 'Theme 1',           user: 't1',  themes: ['1'], name: 'Climate-Smart and Nature-Based Solutions' },
  '2a':  { label: 'Theme 2 · Track 2A', user: 't2',  themes: ['2'], name: 'Climate-Resilient Health, Education, and Biocultural Systems' },
  '2b':  { label: 'Theme 2 · Track 2B', user: 't2b', themes: ['2'], name: 'Climate-Resilient Health, Education, and Biocultural Systems' },
  '3':   { label: 'Theme 3',           user: 't3',  themes: ['3'], name: 'Engineering and Clean Energy Innovations' },
  // Track 4 in the program (Themes 4 and 5 together). Account usernames stay t45-e1…e3 and stored codes stay T45-xx.
  '4-5': { label: 'Track 4',           user: 't45', themes: ['4', '5'], name: 'Policy and Governance for Carbon Neutrality / Smart Technologies and Decarbonization' },
};
/** The order groups appear in everywhere (object keys like "1" would otherwise sort before "2a"). */
export const GROUP_KEYS = ['1', '2a', '2b', '3', '4-5'];
/** The group a paper is in by its theme. Theme 2 papers are in Group A until the admin moves them. */
export const defaultGroup = theme => ({ '1': '1', '2': '2a', '3': '3', '4': '4-5', '5': '4-5' })[String(theme)];

async function readHash(key) {
  const flat = (await redis('HGETALL', key)) || [], out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}

/** All papers, each with its group, in the theme document's order (by code). */
async function allKnown() {
  const [chosen, addedRaw, deleted] = await Promise.all([readHash(GROUP_KEY), readHash(ADDED_KEY), readHash(DELETED_KEY)]);
  // A paper the admin added that is now in lib/papers.js too (same code or same title) is shown only once.
  const key = t => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const baseCodes = new Set(PAPERS.map(p => p.code)), baseTitles = new Set(PAPERS.map(p => key(p.title)));
  const added = Object.values(addedRaw).map(v => { try { return JSON.parse(v); } catch (e) { return null; } })
    .filter(p => p && !baseCodes.has(p.code) && !baseTitles.has(key(p.title)));
  return { chosen, deleted, all: PAPERS.concat(added.sort((a, b) => a.added - b.added)) };
}

// The paper list changes only when the admin edits it, so viewers' and evaluators' refreshes may reuse a copy
// (per server instance) for a few seconds. Saving a score and every admin action read it fresh.
let known = { at: 0, data: null };
const forget = () => { known = { at: 0, data: null }; };
async function knownCached(maxAgeMs) {
  if (maxAgeMs > 0 && known.data && Date.now() - known.at < maxAgeMs) return known.data;
  const data = await allKnown(); known = { at: Date.now(), data }; return data;
}

/** maxAgeMs: how old a reused copy may be (0 = read the database now). */
export async function getPapers(maxAgeMs = 0) {
  const { chosen, deleted, all } = await knownCached(maxAgeMs);
  const list = all.filter(p => !deleted[p.code]).map((p, i) => {
    let group = p.group || defaultGroup(p.theme);
    if (String(p.theme) === '2') {
      const g = chosen[p.code]; // the admin's choice on the Papers tab, if any
      if (g === '2a' || g === '2b') group = g;
    }
    return { code: p.code, theme: String(p.theme), group, no: p.no || null, session: p.session || '', title: p.title, authors: p.authors, principal: Array.isArray(p.principal) ? p.principal : (p.principal ? [p.principal] : []), affiliation: p.affiliation || '', i };
  });
  // Papers are listed in the schedule's order (presentation #), and the code people see follows it:
  // T3-01 is presentation #1 of Theme 3, T2-27 is #27 of Theme 2, and so on. Papers without a # come last and
  // get the next free number. Scores are saved under each paper's fixed code (lib/papers.js), never under this label,
  // so changing a # never moves a score.
  const num = c => Number(String(c).split('-')[1]) || 0;
  list.sort((a, b) => GROUP_KEYS.indexOf(a.group) - GROUP_KEYS.indexOf(b.group) || (a.no ?? 1e6) - (b.no ?? 1e6) || num(a.code) - num(b.code) || a.i - b.i);
  const taken = {}, labelOf = {};
  const pad = n => String(n).padStart(2, '0');
  for (const p of list) if (p.no) {           // numbered papers keep their schedule #
    const pre = labelPrefix(p.theme); taken[pre] ||= new Set();
    if (!taken[pre].has(p.no)) { taken[pre].add(p.no); labelOf[p.code] = `${pre}-${pad(p.no)}`; }
  }
  for (const p of list) if (!labelOf[p.code]) { // no # (or a repeated #): next free number in the theme
    const pre = labelPrefix(p.theme); taken[pre] ||= new Set();
    let n = 1; while (taken[pre].has(n)) n++;
    taken[pre].add(n); labelOf[p.code] = `${pre}-${pad(n)}`;
  }
  return list.map(({ i, ...p }, order) => ({ ...p, label: labelOf[p.code], order }));
}

/** Papers the admin deleted (they can be restored). */
export async function deletedPapers() {
  const { deleted, all } = await allKnown();
  return all.filter(p => deleted[p.code]).map(p => ({ code: p.code, theme: String(p.theme), title: p.title, authors: p.authors, deletedAt: Number(deleted[p.code]) }));
}
export const deletePaper = code => { forget(); return redis('HSET', DELETED_KEY, code, String(Date.now())); };
export const restorePaper = code => { forget(); return redis('HDEL', DELETED_KEY, code); };

/** Paper codes start with the theme's prefix: T1-, T2-, T3-, T45-. */
const prefixFor = theme => ({ '1': 'T1', '2': 'T2', '3': 'T3', '4': 'T45', '5': 'T45' })[String(theme)];
/** The prefix of the code people see: Track 4 (Themes 4 and 5) shows as T4-01, T4-02 … (stored codes stay T45-xx). */
const labelPrefix = theme => ({ '4': 'T4', '5': 'T4' })[String(theme)] || prefixFor(theme);

/** Adds a paper and gives it the next free code for its theme (e.g. T2-33). Codes of deleted papers are never reused. */
export async function addPaper({ theme, group, no, session, title, authors, affiliation }) {
  theme = String(theme);
  if (!prefixFor(theme)) throw new Error('Choose a theme from 1 to 5.');
  title = String(title || '').trim().replace(/\s+/g, ' ').slice(0, 400);
  if (!title) throw new Error('Enter the paper title.');
  const { all, deleted } = await allKnown(), prefix = prefixFor(theme);
  const same = all.find(p => !deleted[p.code] && p.title.toLowerCase() === title.toLowerCase());
  if (same) throw new Error(`This title is already on the list as ${same.code}.`);
  const used = all.filter(p => p.code.startsWith(prefix + '-')).map(p => Number(p.code.slice(prefix.length + 1)) || 0);
  const code = `${prefix}-${String(Math.max(0, ...used) + 1).padStart(2, '0')}`;
  const num = Number(no);
  const paper = {
    code, theme, ...(theme === '2' && group === '2b' ? { group: '2b' } : {}),
    no: Number.isInteger(num) && num > 0 && num < 1000 ? num : null, session: String(session || '').trim().slice(0, 80),
    title, authors: String(authors || '').trim().replace(/\s+/g, ' ').slice(0, 600),
    affiliation: String(affiliation || '').trim().replace(/\s+/g, ' ').slice(0, 600), added: Date.now(),
  };
  forget(); await redis('HSET', ADDED_KEY, code, JSON.stringify(paper));
  return paper;
}

/** Puts a Theme 2 paper in Group A ("2a") or Group B ("2b"). */
export async function setGroup(code, group) {
  const p = (await allKnown()).all.find(x => x.code === code);
  if (!p) throw new Error('No such paper.');
  if (String(p.theme) !== '2' || !['2a', '2b'].includes(group)) throw new Error(`${code} can't go in that group.`);
  forget(); await redis('HSET', GROUP_KEY, code, group);
}
