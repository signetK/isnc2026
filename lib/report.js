// Builds the Excel file of results.
//   Evaluator → their theme group only: "Ranking" (all three evaluators' totals, averages, ranks, remarks and remarks encoded by a facilitator)
//               and "My scores" (their score for every criterion of every paper they scored).
//   Admin     → "Ranking" (all papers, rank in group + overall rank, all remarks)
//               and "All score sheets" (every judge's score for every criterion).
import { CRITERIA, EVALUATORS } from './criteria.js';
import { GROUPS, GROUP_KEYS } from './catalog.js';
import { buildXlsx } from './xlsx.js';

const SECTIONS = [['s1', 'Research Structure', 40], ['s2', 'Significance of Research Results', 30], ['s3', 'Presentation', 30]];
const r2 = v => v == null ? null : Math.round(v * 100) / 100;
const when = t => t ? new Date(t).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '';

/** Ranks papers by the average of the judges who scored them; equal averages share a rank. */
function rank(list, map) {
  const rows = list.map(p => {
    const ev = Array.from({ length: EVALUATORS }, (_, i) => map[`${p.code}_e${i + 1}`] || null), got = ev.filter(Boolean);
    const avg = k => got.length ? got.reduce((a, s) => a + Number(s[k] || 0), 0) / got.length : null;
    return { p, ev, n: got.length, avg: avg('total'), s1: avg('s1'), s2: avg('s2'), s3: avg('s3') };
  });
  rows.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1) || a.p.order - b.p.order);
  let r = 0, prev = null;
  rows.forEach((x, i) => { if (x.avg == null) { x.rank = null; return; } if (x.avg !== prev) r = i + 1; x.rank = r; prev = x.avg; });
  return rows;
}

/** viewer: { role:'admin' } or an evaluator account { role:'evaluator', username, group, slot, name }. names: { group: { slot: name } } */
/** encoded: remarks facilitators encoded for evaluators, { "CODE_eN": {text, at} } (see lib/encoded.js). */
export function buildReport({ viewer, scores, papers, names = {}, encoded = {} }) {
  const enc = (code, n) => encoded[`${code}_e${n}`] || null;
  const PAPER_LIST = papers;
  const map = {}; scores.forEach(s => { map[`${s.code}_e${s.ev}`] = s; });
  const evs = Array.from({ length: EVALUATORS }, (_, i) => i + 1);
  const overall = {}; rank(PAPER_LIST, map).forEach(x => { overall[x.p.code] = x.rank; });
  const isAdmin = viewer.role === 'admin';
  const groups = isAdmin ? GROUP_KEYS : [viewer.group];
  // Ranking is per theme: Theme 2's Group A and Group B papers are ranked together.
  const themeKey = g => (String(g).startsWith('2') ? '2' : g);
  const THEME_LABEL = { '1': 'Theme 1', '2': 'Theme 2', '3': 'Theme 3', '4-5': 'Themes 4 & 5' };
  const themeKeys = isAdmin ? ['1', '2', '3', '4-5'] : [themeKey(viewer.group)];
  const panelOf = g => (g === '2a' ? 'Track 2A' : g === '2b' ? 'Track 2B' : '');

  const rankCols = [
    { header: 'Rank in theme', width: 9, type: 'int' }, ...(isAdmin ? [{ header: 'Overall rank', width: 9, type: 'int' }] : []),
    { header: 'Code', width: 9 }, { header: 'Title', width: 50, type: 'wrap' }, { header: 'Authors', width: 30, type: 'wrap' },
    ...(isAdmin ? [{ header: 'Theme group', width: 13 }] : []), { header: 'Theme', width: 9 }, { header: 'Panel', width: 9 },
    ...evs.map(n => ({ header: `Evaluator ${n} total`, width: 11 })),
    ...SECTIONS.map(([, name, max]) => ({ header: `${name} (avg, /${max})`, width: 14 })),
    { header: 'Average (/100)', width: 11, type: 'bold' },
    ...(isAdmin ? evs.map(n => ({ header: `Evaluator ${n} remarks`, width: 40, type: 'wrap' }))
      : evs.map(n => ({ header: `Evaluator ${n} remarks${n === viewer.slot ? ' (you)' : ''}`, width: 40, type: 'wrap' }))),
    ...evs.map(n => ({ header: `Evaluator ${n} remarks encoded by facilitator${!isAdmin && n === viewer.slot ? ' (you)' : ''}`, width: 40, type: 'wrap' })),
  ];
  // Each theme is ranked as a whole; an evaluator's file then keeps only the papers their panel scored.
  const rankRows = themeKeys.flatMap(t => rank(PAPER_LIST.filter(p => themeKey(p.group) === t), map)
    .filter(x => isAdmin || x.p.group === viewer.group).map(x => {
    const base = [x.rank ?? '', ...(isAdmin ? [overall[x.p.code] ?? ''] : []), x.p.label, x.p.title, x.p.authors,
      ...(isAdmin ? [THEME_LABEL[t]] : []), `Theme ${x.p.theme}`, panelOf(x.p.group), ...x.ev.map(s => s ? s.total : ''), r2(x.s1), r2(x.s2), r2(x.s3), r2(x.avg)];
    return base.concat(evs.map(n => (map[`${x.p.code}_e${n}`] || {}).remarks || ''),
      evs.map(n => (enc(x.p.code, n) || {}).text || ''));
  }));

  const sheetCols = [
    ...(isAdmin ? [{ header: 'Theme group', width: 14 }, { header: 'Evaluator', width: 10 }] : []),
    { header: 'Code', width: 9 }, { header: 'Title', width: 45, type: 'wrap' },
    ...CRITERIA.map(c => ({ header: `${c.k} (/${c.max})`, width: 8 })),
    ...SECTIONS.map(([, name, max]) => ({ header: `${name} (/${max})`, width: 13 })),
    { header: 'Total (/100)', width: 10, type: 'bold' }, { header: 'Remarks', width: 45, type: 'wrap' },
    { header: 'Remarks encoded by facilitator', width: 45, type: 'wrap' }, { header: 'Encoded on', width: 19 }, { header: 'Last saved', width: 19 },
  ];
  let scoredCount = 0;
  const mineRows = PAPER_LIST.filter(p => groups.includes(p.group)).flatMap(p => (isAdmin ? evs : [viewer.slot]).map(n => {
    const s0 = map[`${p.code}_e${n}`], e0 = enc(p.code, n); if (!s0 && !e0) return null;
    if (s0) scoredCount++;
    const s = s0 || { scores: {}, s1: '', s2: '', s3: '', total: '', remarks: '', updatedAt: null };
    return [...(isAdmin ? [GROUPS[p.group].label, `E${n}`] : []), p.label, p.title,
      ...CRITERIA.map(c => (s.scores || {})[c.k] ?? ''), s.s1, s.s2, s.s3, s.total, s.remarks || '',
      ...(e => e ? [e.text, when(e.at)] : ['', ''])(enc(p.code, n)), when(s.updatedAt)];
  })).filter(Boolean);

  const buffer = buildXlsx([
    { name: 'Ranking', columns: rankCols, rows: rankRows },
    { name: isAdmin ? 'All score sheets' : 'My scores', columns: sheetCols, rows: mineRows },
  ]);
  const filename = isAdmin ? 'isnc2026_eval_form_all.xlsx' : 'isnc2026_eval_form.xlsx';
  return { buffer, filename, scored: scoredCount, groupSize: PAPER_LIST.filter(p => p.group === viewer.group).length };
}
