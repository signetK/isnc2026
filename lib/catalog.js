// The paper list and the panels (ranking groups).
// The list starts from lib/papers.js (made from the theme document and the conference program). On the admin
// Papers tab the admin can add papers, delete (and restore) papers, and move Theme 2 papers between Group A and B;
// those changes are kept in the database, so lib/papers.js itself never needs editing.
import { redis } from './redis.js';
import { PAPERS } from './papers.js';

const GROUP_KEY = 'isnc2026:paper-groups';   // hash: code -> "2a" | "2b"
const ADDED_KEY = 'isnc2026:papers-added';   // hash: code -> paper JSON (papers the admin added)
const DELETED_KEY = 'isnc2026:papers-deleted'; // hash: code -> time deleted

// Ranking groups. Each has its own panel of 3 evaluators.
export const GROUPS = {
  '1':   { label: 'Theme 1',           user: 't1',  themes: ['1'], name: 'Climate-Smart and Nature-Based Solutions' },
  '2a':  { label: 'Theme 2 · Group A', user: 't2a', themes: ['2'], name: 'Climate-Resilient Health, Education, and Biocultural Systems' },
  '2b':  { label: 'Theme 2 · Group B', user: 't2b', themes: ['2'], name: 'Climate-Resilient Health, Education, and Biocultural Systems' },
  '3':   { label: 'Theme 3',           user: 't3',  themes: ['3'], name: 'Engineering and Clean Energy Innovations' },
  '4-5': { label: 'Themes 4 & 5',      user: 't45', themes: ['4', '5'], name: 'Smart Technologies and Decarbonization; Policy and Governance for Carbon Neutrality' },
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

/** All papers, each with its group, in presentation order (program number; papers not in the program last). */
async function allKnown() {
  const [chosen, addedRaw, deleted] = await Promise.all([readHash(GROUP_KEY), readHash(ADDED_KEY), readHash(DELETED_KEY)]);
  const added = Object.values(addedRaw).map(v => { try { return JSON.parse(v); } catch (e) { return null; } }).filter(Boolean);
  return { chosen, deleted, all: PAPERS.concat(added.sort((a, b) => a.added - b.added)) };
}

export async function getPapers() {
  const { chosen, deleted, all } = await allKnown();
  const list = all.filter(p => !deleted[p.code]).map((p, i) => {
    let group = p.group || defaultGroup(p.theme);
    if (String(p.theme) === '2') {
      const g = chosen[p.code]; // the admin's choice on the Papers tab, if any
      if (g === '2a' || g === '2b') group = g;
    }
    return { code: p.code, theme: String(p.theme), group, no: p.no || null, session: p.session || '', title: p.title, authors: p.authors, affiliation: p.affiliation || '', i };
  });
  list.sort((a, b) => GROUP_KEYS.indexOf(a.group) - GROUP_KEYS.indexOf(b.group) || (a.no ?? 999) - (b.no ?? 999) || a.i - b.i);
  return list.map(({ i, ...p }, order) => ({ ...p, order }));
}

/** Papers the admin deleted (they can be restored). */
export async function deletedPapers() {
  const { deleted, all } = await allKnown();
  return all.filter(p => deleted[p.code]).map(p => ({ code: p.code, theme: String(p.theme), title: p.title, authors: p.authors, deletedAt: Number(deleted[p.code]) }));
}
export const deletePaper = code => redis('HSET', DELETED_KEY, code, String(Date.now()));
export const restorePaper = code => redis('HDEL', DELETED_KEY, code);

/** Paper codes start with the theme's prefix: T1-, T2-, T3-, T45-. */
const prefixFor = theme => ({ '1': 'T1', '2': 'T2', '3': 'T3', '4': 'T45', '5': 'T45' })[String(theme)];

/** Adds a paper and gives it the next free code for its theme (e.g. T2-33). Codes of deleted papers are never reused. */
export async function addPaper({ theme, group, no, session, title, authors }) {
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
    title, authors: String(authors || '').trim().replace(/\s+/g, ' ').slice(0, 600), affiliation: '', added: Date.now(),
  };
  await redis('HSET', ADDED_KEY, code, JSON.stringify(paper));
  return paper;
}

/** Puts a Theme 2 paper in Group A ("2a") or Group B ("2b"). */
export async function setGroup(code, group) {
  const p = (await allKnown()).all.find(x => x.code === code);
  if (!p) throw new Error('No such paper.');
  if (String(p.theme) !== '2' || !['2a', '2b'].includes(group)) throw new Error(`${code} can't go in that group.`);
  await redis('HSET', GROUP_KEY, code, group);
}
