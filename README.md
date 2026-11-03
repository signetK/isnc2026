# ISNC 2026 Paper Evaluation

Online score sheet for the ISNC 2026 oral presentations (MMSU College of Medicine).
Evaluators score each paper out of 100 using the Research Category criteria, and everyone else sees a live ranking per theme.

- `public/index.html`: the web page (viewer, evaluator and organizer views)
- `public/logos/`: put `mmsu.png` and `com.png` here
- `api/`: server functions (`data`, `score`, `admin`)
- `lib/papers.js`: the 58 papers from the four theme files (edit this to add or remove papers)
- `lib/criteria.js`: criteria maximums and the number of evaluators

## Deploy on Vercel (free Hobby plan)

1. **Add the logos.** Save the two images into `public/logos/` as `mmsu.png` and `com.png`:
   - https://www.mmsu.edu.ph/images/mmsu.png
   - https://www.mmsu.edu.ph/images/colleges/COM.png
2. **Put the code on GitHub.** Create a new private repository and upload this folder (everything except `LINKS-PRIVATE.txt`).
3. **Import into Vercel.** Go to vercel.com, sign in with GitHub, then **Add New → Project** and pick the repository. Leave Framework Preset as **Other**. Do not deploy yet.
4. **Add the database.** In the project, open **Storage → Create Database → Upstash (Redis)**, choose the free plan, and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
5. **Add the keys.** In **Settings → Environment Variables**, add `EVAL_KEY_1`, `EVAL_KEY_2`, `EVAL_KEY_3` and `ADMIN_KEY` with the values from `LINKS-PRIVATE.txt`.
6. **Deploy.** Open **Deployments** and deploy (or redeploy so it picks up the keys). Vercel gives you an address like `isnc2026-eval.vercel.app`.
7. **Test.** Open your organizer link, submit one score from an evaluator link, check the ranking, then delete it with **Organizer → Delete all scores**.

Alternative to GitHub: install Node.js, open a terminal in this folder and run `npx vercel` and then `npx vercel --prod`. Do steps 4–5 in the Vercel dashboard before the `--prod` deploy.

## Links

| Who | Link | Can do |
|---|---|---|
| Viewers | `https://YOUR-SITE/` | See the ranking |
| Evaluator n | `https://YOUR-SITE/?e=n&k=KEY` | Score as Evaluator n, see the ranking |
| Organizer | `https://YOUR-SITE/?admin=KEY` | See all score sheets and remarks, delete scores, download CSV |

To cut off an evaluator link, change that `EVAL_KEY_n` in Vercel and redeploy. Scores already submitted stay.

## Changing things

- **Papers:** edit `lib/papers.js` and push to GitHub. Vercel redeploys by itself.
- **Criteria or number of evaluators:** edit both `lib/criteria.js` and the `CRITERIA` list in `public/index.html`.
- **Title, colors, text:** edit `public/index.html`.
