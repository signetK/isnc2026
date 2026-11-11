# ISNC 2026 Presentation Evaluation

Online score sheet and live ranking for the oral presentations of the 2026 International Sustainability Nexus Conference (Nov 12–13, Center for Flexible Learning, MMSU).

- **Viewers** open the site and see the live ranking: overall, or per theme (Theme 1, Theme 2, Theme 3, Track 4). No login needed.
- **Evaluators** (15 accounts, 3 per panel) log in with a username such as `t2b-e1` and a 4-character password, score only their own panel's presentations, and edit scores under **My scores**.
- **Admin** logs in with username `admin` and the `ADMIN_KEY` password: sees every score and remark, manages accounts and presentations, encodes evaluators' remarks, and downloads the Excel file.

## Panels and accounts (15, one per panel seat)

| Panel | Presentations | Accounts | Evaluators |
|---|---|---|---|
| Theme 1 | T1-01 – T1-15 | `t1-e1`, `t1-e2`, `t1-e3` | Anas, Rosales, Antonio |
| Theme 2 · Track 2A | T2-01 – T2-09 (Day 2) and T2-18 – T2-26 (Day 3) | `t2-e1`, `t2-e2`, `t2-e3` | Ancheta, Lagura, Daguio (no email) |
| Theme 2 · Track 2B | T2-10 – T2-17 (Day 2) and T2-27 – T2-34 (Day 3) | `t2b-e1`, `t2b-e2`, `t2b-e3` | Franco, Rahon, Lim |
| Theme 3 | T3-01 – T3-10 | `t3-e1`, `t3-e2`, `t3-e3` | Valentin, Mateo, Ubiña |
| Track 4 (Themes 4 & 5) | T4-01 – T4-07 | `t45-e1`, `t45-e2`, `t45-e3` | Valentin, Simon, Jimenez |

- Passwords: Admin → **Accounts** tab (shown there, with **Copy list**). Capital letters and spaces don't matter when typing them.
- Names and emails come from `lib/accounts.js` when the accounts are created; change them in Accounts → **Edit**.
- **Disable / Enable** an account on the Accounts tab. Accounts are never deleted automatically.
- Several people can be logged in to the same account (for example, a facilitator encoding for an evaluator on a laptop while the evaluator uses a phone).

## Decisions (keep these)
- **Codes follow the Program of Activities:** the code is the theme + presentation # (T3-01 = Theme 3's presentation #1, T2-27 = Theme 2's #27). Lists, the ranking and the Excel files are in that order.
- **Theme 2 has two panels** (Track 2A and Track 2B) but **one ranking**: the track only decides who scores a presentation. The ranking's **Show** list is Overall, Theme 1, Theme 2, Theme 3, Track 4.
- **Themes 4 and 5 are one panel, shown as Track 4** (codes T4-01 – T4-07). The accounts stay `t45-e1` – `t45-e3`, and the codes scores are saved under stay T45-01 – T45-07 (in `lib/papers.js`).
- **Only the admin** adds, deletes, restores and moves presentations, and encodes remarks.
- **No lock after wrong passwords:** an evaluator can always try again.
- The ranking note says only "Updates every 15 seconds."

## Files

| Path | What it is |
|---|---|
| `public/index.html` | The whole web page (the criteria list for the score sheet is near the top of the script) |
| `public/logos/` | `ISNC.png` (white ISNC logo) and `SDG.png` (SDG wheel) for the header; `favicon.png` and `apple-touch-icon.png` (tab and phone icons) |
| `public/favicon.ico` | Tab icon browsers look for automatically |
| `public/vendor/` | SweetAlert2 (pop-ups) |
| `api/auth.js` | Log in, log out, change password |
| `api/data.js` | Sends presentations and scores to the page (more for evaluators and admin) |
| `api/score.js` | Saves or edits a score (checks the account's panel and every criterion) |
| `api/admin.js` | Accounts, deleting scores, presentations (add, delete, restore, move), encoded remarks |
| `api/export.js` | Excel file: **Download Excel file** and **Send to email** |
| `api/health.js` | Setup check: `https://YOUR-SITE/api/health` (every file should say `ok`) |
| `lib/criteria.js` | Criteria maximums the server checks (must match the page) |
| `lib/papers.js` | The 66 presentations (codes, #, times and titles from the program; authors from the abstracts) |
| `lib/catalog.js` | Panels; adding, deleting and restoring presentations; Track 2A/2B; the codes people see |
| `lib/accounts.js` | The 15 accounts, their passwords, login sessions |
| `lib/encoded.js` | Remarks facilitators encode for evaluators |
| `lib/report.js` | What goes in each Excel file |
| `lib/xlsx.js` | Writes .xlsx files (no extra package) |
| `lib/mail.js` | Sends email through Gmail |
| `lib/deliver.js` | Emails an evaluator their Excel file (automatically when they finish) |
| `lib/redis.js` | Talks to the Upstash database (with a short cache for ranking screens) |
| `lib/http.js` | Small shared helpers |
| `package.json`, `package-lock.json` | Tell Vercel to install Nodemailer (for email) |
| `vercel.json` | Vercel settings (the site is in `public/`) |

**Upload new or changed files together.** If a file another file needs is missing (for example `lib/encoded.js`), the site stops loading. After each deploy, open `/api/health`.

## Vercel environment variables

| Name | Value |
|---|---|
| `ADMIN_KEY` | The admin password (username `admin`) |
| `SMTP_USER` | The Gmail address that sends the Excel files |
| `SMTP_PASS` | That Gmail's 16-letter **App Password** (not its normal password) |
| `MAIL_FROM_NAME` | Optional sender name, e.g. `ISNC 2026 Evaluation` |

Plus the Upstash database variables Vercel added. After any change: **Deployments → ⋯ → Redeploy**.
To test without sending emails, remove `SMTP_PASS` and redeploy; put it back (and redeploy) before the event.

## Presentations (admin **Presentations** tab)
- **Add a presentation:** theme (and Track 2A/2B for Theme 2), presentation #, session, title, authors. Its code follows its # (Theme 2 #35 shows as T2-35); without a #, it goes last in its theme.
- **Delete** a presentation (only if it has no scores yet; delete its scores first in the Admin tab), and **Restore** it from "Deleted presentations".
- **Move** a Theme 2 presentation between Track 2A and 2B. Choices are saved in `isnc2026:paper-groups-v3`; older choices are ignored.
- These changes are kept in the database; `lib/papers.js` doesn't need editing. Don't change a code in `lib/papers.js` once scoring has started.
- T3-10 is not in the program (no #). T2-16, T2-32 and T4-07 are only in the program, so their authors may still be blank.

## Encode remarks (admin **Encode remarks** tab)
For typing the remarks an evaluator gave (for example, comments written on paper).
- Choose the panel with the buttons **T1 · T2A · T2B · T3 · T4**, then the presentation (or **‹ Prev / Next ›**).
- There is one box per evaluator (Evaluator 1, 2, 3 with their names), each with its own **Save**. Saving again replaces the remark; an empty box removes it.
- Saved apart from the evaluator's own remarks: never overwrites them, never changes a score or the ranking, never shown on the public ranking.
- Several facilitators can encode at the same time. If the same box is saved twice, the latest save counts. Other facilitators' saves appear within 15 seconds.
- The remark appears in that evaluator's Excel file (Ranking: "Evaluator n remarks encoded by facilitator"; My scores: "Remarks encoded by facilitator" and "Encoded on") and in the admin's file, and on the evaluator's score sheet (read-only).
- Remarks encoded after an evaluator's automatic email are not in that email; the evaluator can press **Send to email** or **Download Excel file** for an updated copy.

## Excel files
- **Evaluators** (My scores tab): **Download Excel file**, and **Send to email** if their email is saved. The file (`isnc2026_eval_form.xlsx`) has their panel's ranking with all three evaluators' totals, averages, ranks, remarks and encoded remarks, and a sheet with their own score for every criterion.
- **Automatic:** when an evaluator saves the last presentation of their panel, their file is emailed to them once. Later edits don't re-send; they can press **Send to email**.
- **Admin** (Admin tab): **Download Excel file** (`isnc2026_eval_form_all.xlsx`) with every presentation, rank in theme and overall rank, all remarks (Evaluator 1, 2, 3), encoded remarks and every score sheet.

### Gmail App Password (for the emails)
1. Create a Gmail for the site (a personal Gmail; school accounts often block step 3).
2. myaccount.google.com → **Security** → turn on **2-Step Verification**.
3. myaccount.google.com/apppasswords → name `ISNC site` → **Create** → copy the 16 letters into `SMTP_PASS`.

## Before the event
1. `/api/health`: every file `ok`, database connected, 15 accounts.
2. Accounts tab: every name and email right, every account enabled.
3. Presentations tab → Show: Theme 2: T2-01 – T2-09 and T2-18 – T2-26 are Track 2A; T2-10 – T2-17 and T2-27 – T2-34 are Track 2B.
4. `SMTP_PASS` is set (emails on).
5. Admin tab → **Delete all scores** (this also removes test encoded remarks and resets the automatic emails).

## Shared computers
A login ends when the browser is closed, after 30 minutes without activity, or after 12 hours at most. Use **Log out** before another person uses the computer.

## Criteria
1. Research Structure (40): a 10, b 10, c 10, d 10
2. Significance of Research Results (30): a 10, b 10, c 10
3. Presentation (30): a 15, b 15

To change criteria, edit both `lib/criteria.js` and the `CRITERIA` list in `public/index.html`, then delete test scores.
