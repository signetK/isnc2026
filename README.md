# ISNC 2026 Paper Evaluation

Online score sheet and live ranking for the ISNC 2026 oral presentations (MMSU College of Medicine).

- **Viewers** open the site and see the ranking: overall, or per theme group (Themes 4 and 5 are one group).
- **Evaluators** have their own account (12 in total: 3 per theme group). They log in with a username such as `t2-e1` (Theme 2, Evaluator 1) and a password, score only their own group's papers, and edit scores under **My scores**.
- **Admin** logs in with username `admin` and the `ADMIN_KEY` password: sees all scores and remarks, manages the 12 accounts (names, new passwords, disable), deletes scores, downloads the CSV.

## Files

| Path | What it is |
|---|---|
| `public/index.html` | The whole web page (criteria list for the score sheet is near the top of the script) |
| `public/logos/` | `mmsu.png` and `com.png` |
| `public/vendor/` | SweetAlert2 (pop-ups) |
| `api/auth.js` | Log in, log out, change password |
| `api/data.js` | Sends papers and scores to the page (more for evaluators and admin) |
| `api/score.js` | Saves or edits a score (checks the account's theme group and every criterion) |
| `api/admin.js` | Accounts (create, name and email, new password, disable) and deleting scores |
| `api/export.js` | Excel file: download (evaluator or admin) and "Email me my Excel file" |
| `api/health.js` | Setup check: `https://YOUR-SITE/api/health` |
| `lib/criteria.js` | Criteria maximums the server checks (must match the page) |
| `lib/papers.js` | The 58 papers |
| `lib/accounts.js` | The 12 accounts, passwords (stored scrambled), login sessions |
| `lib/http.js` | Small shared helpers |
| `lib/report.js` | What goes in each Excel file |
| `lib/xlsx.js` | Writes .xlsx files (no extra package) |
| `lib/mail.js` | Sends email through Gmail |
| `lib/deliver.js` | Emails a judge their Excel file (automatically when they finish) |
| `package.json` | Tells Vercel to install Nodemailer (for email) |
| `lib/redis.js` | Talks to the Upstash database |

## Vercel environment variables

| Name | Value |
|---|---|
| `ADMIN_KEY` | The admin password (username `admin`) |
| `SMTP_USER` | The Gmail address that sends the Excel files, e.g. `isnc2026.eval@gmail.com` |
| `SMTP_PASS` | That Gmail's 16-letter **App Password** (not its normal password) |
| `MAIL_FROM_NAME` | Optional sender name, e.g. `ISNC 2026 Evaluation` |

`EVAL_KEY_1`–`3` are no longer used and can be deleted.

Plus the Upstash database variables Vercel added. After any change: **Deployments → ⋯ → Redeploy**.

## Accounts
| Username | Seat |
|---|---|
| `t1-e1`, `t1-e2`, `t1-e3` | Theme 1 · Evaluator 1, 2, 3 |
| `t2-e1`, `t2-e2`, `t2-e3` | Theme 2 · Evaluator 1, 2, 3 |
| `t3-e1`, `t3-e2`, `t3-e3` | Theme 3 · Evaluator 1, 2, 3 |
| `t45-e1`, `t45-e2`, `t45-e3` | Themes 4 & 5 · Evaluator 1, 2, 3 |

First time: log in as `admin` → **Accounts** → **Create the 12 accounts**. The passwords appear once: copy them. Lost one? **New password** on that row. Judges can change their own password from the menu with their name (top right).

## Excel files
- **Evaluators** (My scores tab): **Download my Excel file**, and **Email me my Excel file** if the admin saved their email.
  Their file has their theme group's ranking (all three judges' totals, averages, ranks) with **only their own remarks**, and a sheet with their score for every criterion.
- **Automatic:** when a judge saves the last paper of their group, their file is emailed to them once. Later edits don't re-send; they can press Email me.
- **Admin** (Admin tab): **Download Excel file** with all 58 papers, both ranks, judges' names, all remarks and every score sheet.

### Gmail App Password (for the emails)
1. Create a Gmail for the site (a personal Gmail; school accounts often block step 3).
2. myaccount.google.com → **Security** → turn on **2-Step Verification**.
3. myaccount.google.com/apppasswords → name `ISNC site` → **Create** → copy the 16 letters into `SMTP_PASS`.

## Shared computers
A login ends when the browser is closed, after 30 minutes without activity, or after 12 hours at most.

## Criteria
1. Research Structure (40): a 10, b 10, c 10, d 10
2. Significance of Research Results (30): a 10, b 10, c 10
3. Presentation (30): a 15, b 15

To change criteria, edit both `lib/criteria.js` and the `CRITERIA` list in `public/index.html`, then delete test scores.
