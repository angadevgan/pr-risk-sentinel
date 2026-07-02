# PR Risk Sentinel

A GitHub App that scores every pull request for risk in real time using an explainable, weighted-feature model (diff size, sensitive-path touches, test coverage, complexity delta, author history, timing), posts inline annotations back to GitHub, and gives teams a live dashboard of review velocity and risk hotspots.

## Architecture

```
GitHub (PR opened/synced)
    → Webhook → Probot app (backend/src/app.js)
    → Fetch diff via GitHub API
    → Risk Engine (backend/src/risk-engine/) — feature extraction + weighted scoring
    → GitHub Checks API — inline annotations + status check
    → Postgres — store PR, features, score, outcome
    → Event bus → Socket.io → React dashboard (live update)
```

Model: **rule-based-v1**, a transparent weighted sum of six independent signals (see `backend/src/risk-engine/index.js` for weights and rationale). Every merged PR is tracked nightly for reverts/hotfixes (`backend/src/services/outcomeTracking.js`), building a labeled dataset for a future trained model — documented as v2 future work, not oversold as already built.

---

## Step-by-step setup

### 1. Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local install, or a free hosted instance — Railway, Supabase, Neon all work)
- A GitHub account with a repo you can install a GitHub App on (your own repos are perfect for this — `saas-pm` and `deepfake-detection-system`)
- ngrok or similar (only needed for local development, to receive webhooks)

### 2. Clone and install

```bash
cd pr-risk-sentinel/backend
npm install

cd ../frontend
npm install
```

### 3. Set up Postgres

Create a database:

```bash
createdb pr_risk_sentinel
```

Or use a hosted free-tier instance and grab its connection string.

### 4. Create the GitHub App

1. Go to **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Fill in:
   - **App name**: `PR Risk Sentinel` (or your own name, must be globally unique)
   - **Homepage URL**: `http://localhost:5173` (for now)
   - **Webhook URL**: you'll fill this in after starting ngrok in step 6 — use a placeholder for now, e.g. `https://example.com/webhooks`
   - **Webhook secret**: generate a random string and save it — you'll need it in `.env`
3. **Permissions** (under "Repository permissions"):
   - Pull requests: **Read & write**
   - Checks: **Read & write**
   - Contents: **Read-only**
   - Metadata: **Read-only** (auto-selected)
4. **Subscribe to events**: check `Pull request`.
5. Click **Create GitHub App**.
6. On the app's settings page:
   - Note the **App ID** (top of the page).
   - Click **Generate a private key** — this downloads a `.pem` file. Move it into `backend/` as `private-key.pem`.
7. Click **Install App** (left sidebar) and install it on your test repo(s) — e.g. `angadevgan/saas-pm`.

### 5. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Fill in `.env`:

```
APP_ID=<your App ID from step 4>
PRIVATE_KEY_PATH=./private-key.pem
WEBHOOK_SECRET=<the secret you generated in step 4>
DATABASE_URL=postgresql://localhost:5432/pr_risk_sentinel
GITHUB_TOKEN=<a separate Personal Access Token, repo:read scope — only used by the backfill script>
```

For `GITHUB_TOKEN`: go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**, create one scoped to `repo: read` on the repos you'll backfill.

```bash
cd ../frontend
cp .env.example .env
```

Default values are fine for local dev.

### 6. Expose your local server for webhooks (local dev only)

```bash
ngrok http 3000
```

Copy the `https://....ngrok-free.app` URL it gives you, then go back to your GitHub App settings and update the **Webhook URL** to `https://<your-ngrok-url>/webhooks`.

### 7. Run database migrations

```bash
cd backend
npm run migrate
```

You should see `✅ Migrations complete.`

### 8. Backfill historical PR data (do this first — instant demo data)

This is the step that makes your dashboard look populated immediately instead of empty until new PRs come in.

```bash
npm run backfill -- angadevgan/saas-pm
npm run backfill -- angadevgan/deepfake-detection-system
```

Watch it print each PR's computed score as it processes. This uses your `GITHUB_TOKEN`, not the GitHub App, so it works even before the App webhook is fully wired up.

### 9. Start the backend

```bash
npm run dev
```

You should see:
```
🚀 PR Risk Sentinel running on port 3000
   Webhook endpoint: /webhooks
   Dashboard API: /api
```

### 10. Start the frontend

In a new terminal:

```bash
cd frontend
npm run dev
```

Open `http://localhost:5173` — you should see your backfilled repos listed, and clicking into one shows the PR table, charts, and risk breakdowns.

### 11. Test the live webhook flow

Open a real PR (or push a commit to an existing open PR) on one of your repos with the App installed. Within a few seconds you should see:
- A new Check Run on the PR in GitHub showing the risk score
- A sticky PR comment with the breakdown
- The dashboard updating live (no refresh needed) if you have it open

### 12. Run the risk engine tests

```bash
cd backend
npm test
```

This runs scenario-based tests proving the model behaves sensibly (trivial changes score low, dangerous combinations — auth + no tests + large diff — score high). Good to screenshot for your README/portfolio.

---

## Deployment (for your live demo link)

- **Backend**: Railway (same as your saas-pm project) — set all `.env` vars in Railway's dashboard, including uploading the private key as a file or base64 env var.
- **Frontend**: Vercel — set `VITE_SOCKET_URL` to your Railway backend URL.
- **Database**: Railway Postgres add-on, or Supabase free tier.
- After deploying, update the GitHub App's **Webhook URL** to your real backend URL (`https://your-app.up.railway.app/webhooks`) and the **Homepage URL** to your Vercel frontend URL.

---

## What to highlight in interviews

- **GitHub Apps integration** (webhooks, Checks API, installation auth) — most student portfolios don't touch this.
- **Explainable scoring**, not a black box — every score breaks down into labeled, weighted contributions shown in the UI.
- **Honest scoping**: rule-based v1 with a documented path to a trained model once outcome data accumulates (the nightly revert-tracking job is already building that labeled dataset).
- **Multi-tenant architecture** reused from your SaaS PM project — installations → repos → PRs hierarchy.
- **Real-time updates** via Socket.io, not polling.

## Known limitations to mention proactively (shows maturity, not weakness)

- Revert/hotfix detection is a commit-message heuristic, not ground truth — documented as such.
- Complexity delta scoring currently degrades gracefully (neutral score) when no static analyzer is wired up for a given language — `radon` (Python) or an ESLint complexity plugin (JS) can be added per-repo.
- Author history score is intentionally dampened to avoid unfairly penalizing one bad week.
