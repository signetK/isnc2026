// Emails a judge their Excel file (their theme group's ranking, their own scores and remarks).
import { allScores, redis } from './redis.js';
import { allAccounts, GROUPS, SENT, maskEmail } from './accounts.js';
import { buildReport } from './report.js';
import { sendMail, mailReady } from './mail.js';


/** Judges' names per seat, for the admin's file: { group: { slot: name } } */
export async function panelNames() {
  const out = {};
  for (const a of Object.values(await allAccounts())) (out[a.group] ||= {})[a.slot] = a.name || a.username;
  return out;
}

export async function emailReport(account, siteUrl, reason) {
  if (!account.email) throw new Error('No email address is saved for this account. Ask the admin to add it, or use Download instead.');
  if (!mailReady()) throw new Error('Email is not set up on the site yet. Use Download instead.');
  const { buffer, filename, scored, groupSize } = buildReport({ viewer: { ...account, role: 'evaluator' }, scores: await allScores() });
  const G = GROUPS[account.group];
  await sendMail({
    to: account.email,
    subject: `Your ISNC 2026 scores · ${G.label}`,
    heading: reason === 'finished' ? `Thank you: all ${groupSize} papers scored` : 'Your ISNC 2026 scores',
    lines: [
      `Hello ${account.name || account.username},`,
      reason === 'finished'
        ? `You have scored every paper in ${G.label}. Your Excel file is attached.`
        : `Here is your Excel file for ${G.label} (${scored} of ${groupSize} papers scored so far).`,
      'Sheet "Ranking" has your theme group\'s current ranking with the totals and remarks of all three evaluators. Sheet "My scores" has your score for every criterion.',
    ],
    button: { text: 'Open the evaluation site', url: siteUrl },
    footer: 'If you edit a score later, use "Email me my Excel file" on the site to get an updated copy.',
    attachments: [{ filename, content: buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
  });
  return maskEmail(account.email);
}

/** After a score is saved: if the judge has just finished their whole group, email them once. Never throws. */
export async function afterScore(account, siteUrl) {
  try {
    if (!account.email || !mailReady()) return null;
    const { scored, groupSize } = buildReport({ viewer: { ...account, role: 'evaluator' }, scores: await allScores() });
    if (scored < groupSize) return null;
    if (Number(await redis('HSETNX', SENT, `${account.username}:${account.group}`, String(Date.now()))) !== 1) return null; // already sent once
    return { emailedTo: await emailReport(account, siteUrl, 'finished') };
  } catch (e) {
    return { emailError: e.message };
  }
}
