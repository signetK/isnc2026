// Builds the Excel file of results.
//   Evaluator → their theme group only: "Ranking" (all three judges' totals, averages, ranks and remarks)
//               and "My scores" (their score for every criterion of every paper they scored).
//   Admin     → "Ranking" (all 58 papers, rank in group + overall rank, judges' names and all remarks)
//               and "All score sheets" (every judge's score for every criterion).
import { PAPERS } from './papers.js';
import { CRITERIA, EVALUATORS } from './criteria.js';
import { GROUPS } from './accounts.js';
import { buildXlsx } from './xlsx.js';

const SECTIONS = [['s1', 'Research Structure', 40], ['s2', 'Significance of Research Results', 30], ['s3', 'Presentation', 30]];
const groupOf = p => String(p.group || (p.theme === '4' || p.theme === '5' ? '4-5' : p.theme));
const PAPER_LIST = PAPERS.map((p, i) => ({ code: p.code, group: groupOf(p), theme: String(p.theme), title: p.title, authors: p.authors, order: i }));
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
export function buildReport({ viewer, scores, names = {} }) {
  const map = {}; scores.forEach(s => { map[`${s.code}_e${s.ev}`] = s; });
  const evs = Array.from({ length: EVALUATORS }, (_, i) => i + 1);
  const overall = {}; rank(PAPER_LIST, map).forEach(x => { overall[x.p.code] = x.rank; });
  const isAdmin = viewer.role === 'admin';
  const groups = isAdmin ? Object.keys(GROUPS) : [viewer.group];

  const rankCols = [
    { header: 'Rank in group', width: 9, type: 'int' }, ...(isAdmin ? [{ header: 'Overall rank', width: 9, type: 'int' }] : []),
    { header: 'Code', width: 9 }, { header: 'Title', width: 50, type: 'wrap' }, { header: 'Authors', width: 30, type: 'wrap' },
    ...(isAdmin ? [{ header: 'Theme group', width: 13 }] : []), { header: 'Theme', width: 9 },
    ...evs.map(n => ({ header: `Evaluator ${n} total`, width: 11 })),
    ...SECTIONS.map(([, name, max]) => ({ header: `${name} (avg, /${max})`, width: 14 })),
    { header: 'Average (/100)', width: 11, type: 'bold' },
    ...(isAdmin ? evs.map(n => ({ header: `Evaluator ${n} name`, width: 22, type: 'wrap' })).concat(evs.map(n => ({ header: `Evaluator ${n} remarks`, width: 40, type: 'wrap' })))
      : evs.map(n => ({ header: `Evaluator ${n} remarks${n === viewer.slot ? ' (you)' : ''}`, width: 40, type: 'wrap' }))),
  ];
  const rankRows = groups.flatMap(g => rank(PAPER_LIST.filter(p => p.group === g), map).map(x => {
    const base = [x.rank ?? '', ...(isAdmin ? [overall[x.p.code] ?? ''] : []), x.p.code, x.p.title, x.p.authors,
      ...(isAdmin ? [GROUPS[g].label] : []), `Theme ${x.p.theme}`, ...x.ev.map(s => s ? s.total : ''), r2(x.s1), r2(x.s2), r2(x.s3), r2(x.avg)];
    if (isAdmin) return base.concat(evs.map(n => (names[g] || {})[n] || ''), evs.map(n => (map[`${x.p.code}_e${n}`] || {}).remarks || ''));
    return base.concat(evs.map(n => (map[`${x.p.code}_e${n}`] || {}).remarks || ''));
  }));

  const sheetCols = [
    ...(isAdmin ? [{ header: 'Theme group', width: 14 }, { header: 'Evaluator', width: 10 }, { header: 'Judge', width: 22, type: 'wrap' }] : []),
    { header: 'Code', width: 9 }, { header: 'Title', width: 45, type: 'wrap' },
    ...CRITERIA.map(c => ({ header: `${c.k} (/${c.max})`, width: 8 })),
    ...SECTIONS.map(([, name, max]) => ({ header: `${name} (/${max})`, width: 13 })),
    { header: 'Total (/100)', width: 10, type: 'bold' }, { header: 'Remarks', width: 45, type: 'wrap' }, { header: 'Last saved', width: 19 },
  ];
  const mineRows = PAPER_LIST.filter(p => groups.includes(p.group)).flatMap(p => (isAdmin ? evs : [viewer.slot]).map(n => {
    const s = map[`${p.code}_e${n}`]; if (!s) return null;
    return [...(isAdmin ? [GROUPS[p.group].label, `E${n}`, (names[p.group] || {})[n] || ''] : []), p.code, p.title,
      ...CRITERIA.map(c => (s.scores || {})[c.k] ?? ''), s.s1, s.s2, s.s3, s.total, s.remarks || '', when(s.updatedAt)];
  })).filter(Boolean);

  const buffer = buildXlsx([
    { name: 'Ranking', columns: rankCols, rows: rankRows },
    { name: isAdmin ? 'All score sheets' : 'My scores', columns: sheetCols, rows: mineRows },
  ]);
  const filename = isAdmin ? 'isnc2026_eval_form_all.xlsx' : 'isnc2026_eval_form.xlsx';
  return { buffer, filename, scored: mineRows.length, groupSize: PAPER_LIST.filter(p => p.group === viewer.group).length };
}
