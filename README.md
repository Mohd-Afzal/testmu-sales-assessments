# TestMu AI — Sales Assessments

A lightweight web app that turns the product-knowledge quiz Markdown files into a real,
graded assessment portal — because the LMS can't bulk-upload them. Sales reps sign in with
their Google Workspace email, take an assessment, and get a score. Managers see everything
on a dashboard.

- **Login:** Google Workspace, restricted to `testmuai.com` + `lambdatest.com`.
- **Profile:** each rep picks their designation (POD) and manager from dropdowns.
- **Assessments:** 3 independent sets per product line (Core 30 / Extended 50 / Mastery 75).
- **Rules:** 80% to pass · **2 attempts** per assessment · questions **and** options shuffled every attempt.
- **Result:** score + pass/fail only (correct answers are never shown).
- **Dashboard:** managers/admins filter results by **product line** and **designation (POD)** (plus assessment, manager, result).

---

## How it works (architecture)

GitHub Pages only serves static files, so the app pairs a static frontend with a free Google
backend — **no server to run, no database to host, no billing card anywhere.**

```
 GitHub Pages (docs/)                Google Apps Script Web App            Google Sheet
 ───────────────────                 ──────────────────────────            ────────────
 • Sign in with Google  ──idToken──▶ • verifies the token (domain)          "Responses" tab
 • loads questions          +picks   • holds the hidden ANSWER_KEY          (one row / attempt)
   (NO answers)                      • scores + enforces 2 attempts  ─────▶ stores results
 • shows score / dashboard ◀──json── • returns score / dashboard data ◀──── reads results
```

**Why it's cheat-resistant even though the frontend is public:**
- The answer key never ships to the browser — it lives only in Apps Script (`answerKey.gs`).
- Scoring and the 2-attempt limit run server-side, so a rep can't fake a score or bypass the limit.
- Identity is a Google-signed token the backend verifies (audience + `email_verified` + allowed domain).
- The answer-bearing source files (`questions-src/`, `build-output/`) are git-ignored and never published.

---

## Repo layout

```
manifest.json              Which .md files map to which product line + assessment (edit to add more)
scripts/build-questions.mjs  Markdown → JSON build step
questions-src/      (ignored) source .md files WITH answers — keep private
build-output/       (ignored) generated answerKey.gs — paste into Apps Script, keep private
docs/                        the published site (GitHub Pages serves this folder)
  index.html  styles.css  app.js  api.js  config.js
  data/questions.public.json   generated, answer-free, safe to commit
apps-script/Code.gs          the backend (paste into your Sheet's Apps Script project)
```

---

## One-time setup

### 0. Build the question data
```bash
npm run build
```
Produces `docs/data/questions.public.json` (commit this) and `build-output/answerKey.gs` (secret — used in step 2).

### 1. Google OAuth Client ID (for login)
1. <https://console.cloud.google.com> → create/select a project.
2. **APIs & Services → OAuth consent screen.** If `testmuai.com` and `lambdatest.com` are domains in
   the **same** Google Workspace org, choose **Internal**. If they're **separate** orgs, choose **External**
   (the app's own domain check still restricts who can log in).
3. **Credentials → Create credentials → OAuth client ID → Web application.**
4. Under **Authorized JavaScript origins** add:
   - `https://mohd-afzal.github.io`
   - `http://localhost:8080` (for local testing)
5. Copy the **Client ID** into **two** places: `docs/config.js` (`GOOGLE_CLIENT_ID`) and `apps-script/Code.gs` (`CLIENT_ID`).

### 2. Google Sheet + Apps Script (the backend)
1. Create a Google Sheet, e.g. **"TestMu Sales Assessments"**.
2. **Extensions → Apps Script.**
3. Replace the default `Code.gs` with `apps-script/Code.gs` from this repo. Set `CLIENT_ID` (same as step 1).
4. **File → New → Script**, name it `answerKey`, and paste the contents of `build-output/answerKey.gs`.
5. Run the `initSheet` function once (authorize when prompted) — this creates the **Responses** tab.
6. **Deploy → New deployment → Web app.** Set **Execute as: Me**, **Who has access: Anyone**. Deploy and copy the **Web app URL**.
7. Paste that URL into `docs/config.js` (`APPS_SCRIPT_URL`).

> Whenever you change `Code.gs` or `answerKey.gs`, redeploy: **Manage deployments → edit → Version: New version → Deploy.**

### 3. Publish on GitHub Pages
1. Create a GitHub repo named **`testmu-sales-assessments`** and push this project (public repo is fine — no secrets are committed).
2. **Settings → Pages → Source: Deploy from a branch → `main` / `/docs`.**
3. Your site goes live at `https://mohd-afzal.github.io/testmu-sales-assessments/`.
4. Make sure that exact origin is in the OAuth **Authorized JavaScript origins** (step 1.4).

---

## Adding the next product line (or new sets)
1. Drop the new `.md` into `questions-src/` (same format as the Kane files).
2. Add a product line / assessment entry in `manifest.json`.
3. `npm run build`.
4. Paste the regenerated `build-output/answerKey.gs` into Apps Script and **redeploy**.
5. Commit the updated `docs/data/questions.public.json` and push. Done.

The dashboard's **product line** filter populates automatically from the data.

## Local preview (visual only — login/scoring need the deployed backend)
```bash
npx serve docs -l 8080   # then open http://localhost:8080
```

## Question Markdown format
```
### Q1. <question text>
*[<Topic> · <Scope>]*
- A) <option>
- B) <option>
- C) <option>
- D) <option>
**Answer: D**
*Why:* <rationale kept server-side, never shown to reps>
---
```

## Admins / domains
Admin emails and allowed login domains are defined in **`apps-script/Code.gs`** (authoritative) and mirrored
in `docs/config.js` (for showing/hiding the Dashboard link). Keep the two in sync.
> Note: `ruehanh@testmu.ai` is on `testmu.ai`, which is **not** in the allowed domains (`testmuai.com`,
> `lambdatest.com`). Update that address (or add the domain in both files) before he can sign in.
