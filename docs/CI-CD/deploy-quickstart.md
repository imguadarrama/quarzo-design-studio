# Deploy quickstart — what you do, in what order

You've added the GitHub secrets. This file picks up from there. It assumes zero DevOps background.

`deploy-setup.md` is the reference manual (the "why" and full configs). This file is the operator's checklist (the "what do I click next").

---

## How the pipeline works (read this once, then refer back when something breaks)

There are **three automated workflows** and **one manual trigger**. They all live in `.github/workflows/`.

### When you open a PR → `deploy-staging.yml` runs
GitHub sees a new PR (or a push to an existing PR) and fires this workflow. It does five things in sequence:

1. **Make a throwaway DB.** Calls Neon to clone the `main` branch of your staging Postgres into a short-lived branch named `pr-<number>`. Outputs a connection string. Subsequent pushes to the same PR reuse this branch.
2. **Get the code ready.** Installs pnpm deps, runs `prisma generate` (builds the typed DB client), applies pending migrations to the throwaway DB, seeds the admin user + sample products.
3. **Ship the server.** Runs `flyctl deploy` against `quarzo-api-staging`. Fly builds your Dockerfile's `runtime` stage (which runs `tsc` — so type errors fail the build here) and blue-green-swaps the running container. There's always exactly **one** running staging API, at the same URL.
4. **Ship the website.** Runs `pnpm --filter client build` (which is `tsc -b && vite build` — type errors fail here) with `VITE_API_BASE_URL` pointing at the staging Fly URL, then uploads `client/dist/` to Cloudflare Pages as a preview deployment.
5. **Tell you.** Posts a comment on the PR with the **stable URL** (`pr-<N>.<project>.pages.dev` — always the latest build for this PR), the **per-commit URL** (immutable, good for debugging a specific build), and the API health URL.

Every push to the PR repeats this. The `concurrency` block cancels in-flight runs when you push again, so rapid pushes produce only one completed deployment.

**Doc-only PRs are skipped.** The workflow has `paths-ignore` for `**/*.md`, `docs/**`, `.gitignore`, `LICENSE`, `.editorconfig`, and `.gitattributes` — README or runbook changes don't spin up Fly + Neon.

### When the PR is closed (merged or abandoned) → `cleanup-staging.yml` runs
Deletes the `pr-<number>` Neon branch. Keeps your Neon project tidy.

### When you merge to `main` → only `ci.yml` runs (post-merge tripwire)
Install + build server + build client + docker smoke (via the shared `build-and-check` composite action). **No deploy.** This runs on `main` pushes only — **not on PRs**. Why? `deploy-staging.yml` already invokes the same composite on every PR, so running ci on PRs was duplicate work. On main it's a cheap sanity check that catches any merge-conflict weirdness that slipped past staging.

### When you want to ship prod → you click a button
GitHub → Actions tab → **Deploy Production** → **Run workflow** → type the word **`ship`** → Run. This runs `deploy-production.yml`:
- Runs migrations against the real prod Neon DB.
- Deploys the server to Fly prod (`quarzo-api`).
- Builds the client with the prod API URL and deploys it to Cloudflare Pages prod.
- Tags the commit `release-YYYYMMDD-HHMM`.

Typing `ship` is the safety gate — you can't accidentally deploy prod.

---

## Mental model for URLs (the thing that confused you)

Three hosting systems, three URL behaviors:

| System | What changes per push? | What stays stable? |
|---|---|---|
| **Fly.io** | Nothing. A new machine boots, old one shuts down (blue-green swap). Always exactly one API running per app. | `quarzo-api-staging.fly.dev` — one URL, always points at the latest deploy. |
| **Cloudflare Pages** | A new immutable URL is published per build (`<hash>.<project>.pages.dev`). Old URLs stay live forever — free rollback snapshots, zero cost (unlimited bandwidth). | `pr-<N>.<project>.pages.dev` — the branch-alias URL. Always serves the latest build for the PR. This is the URL the PR comment surfaces as "stable." |
| **Neon** | Nothing per push — the same `pr-<N>` DB branch is reused until the PR closes. | The branch URL Neon hands back is the same across all pushes to the PR. |

**Practical takeaway:** when you or the client want to "see the latest staging" for a PR, use the stable URL from the PR comment. The per-commit URLs are there for debugging ("the build 2 pushes ago worked, this one doesn't — what changed?") and are free to ignore.

**Old per-commit URLs piling up in your CF dashboard?** Not a cost or correctness issue. If they bother you, CF Pages has a retention setting per project (Settings → Preview deployments). Or leave them — each is a one-click rollback.

---

## What you still have to do, in order

> **Before you start, these should already be done:** GitHub Environments `staging` and `production` created, all the secrets from `deploy-setup.md §4` added. You said this is done. ✅

### Step 1 — Install the Fly CLI locally (one-time)
Open PowerShell:
```powershell
iwr https://fly.io/install.ps1 -useb | iex
flyctl auth login
```
This opens a browser tab — log in with your Fly account. Done.

### Step 2 — Create the two Fly apps
```powershell
flyctl apps create quarzo-api
flyctl apps create quarzo-api-staging
```
You'll get output like `New app created: quarzo-api`. If Fly says the name is taken, pick a different one and update `FLY_APP_PROD`/`FLY_APP_STAGING` in your GitHub secrets + `fly.toml` / `fly.staging.toml` to match.

Don't deploy anything yet — GitHub Actions does that for you.

### Step 3 — Create the two Cloudflare Pages projects
1. Log in at https://dash.cloudflare.com.
2. Workers & Pages → **Create** → **Pages** tab → **Upload assets** (NOT "Connect to Git").
3. Project name: `quarzo` → click **Create project**. You don't need to actually upload anything — just create the empty project so the deploy action has a target.
4. Repeat for `quarzo-staging`.
5. In each project: Settings → Builds & deployments → make sure no Git integration is configured. (We deploy from GitHub Actions, not from CF's auto-build.)

### Step 4 — Seed the prod database once, by hand
The prod DB starts empty. Your admin user needs to exist before you ever click "Deploy Production", otherwise you can't log into `/admin/login`.

Grab the pooled `DATABASE_URL` from your Neon `quarzo-prod` project (Dashboard → Connection Details → choose "Pooled"), then from your repo root in PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://...-pooler...neon.tech/neondb?sslmode=require"
$env:JWT_SECRET = "any-long-random-string-at-least-16-chars"
$env:CLIENT_ORIGIN = "https://quarzo.pages.dev"
$env:ADMIN_EMAIL = "your-client-email@example.com"
$env:ADMIN_PASSWORD = "a-strong-password-you-will-remember"
pnpm --filter server exec prisma generate
pnpm --filter server exec prisma migrate deploy
pnpm --filter server seed
```

Expected last lines:
```
Seeded admin: your-client-email@example.com
Seeded product: sobres-clasicos
Seeded product: stickers-redondos
Seeded product: etiquetas-vino-premium
Seeded product: tarjetas-regalo-boutique
```

Save that `ADMIN_EMAIL` / `ADMIN_PASSWORD` pair in your password manager — the same values must be in your `production` GitHub Environment secrets.

### Step 5 — Open a test PR (end-to-end smoke test)
```powershell
git checkout -b feature/deploy-smoke-test
# change any string in client/src/App.tsx
git add -A
git commit -m "chore: smoke test deploy pipeline"
git push -u origin feature/deploy-smoke-test
```
Open the PR in GitHub. Go to the Actions tab and watch **Deploy Staging** run. When it finishes (5–10 min on first run, the Fly deploy is the slow part), it posts a comment on the PR with two URLs.

- Click the **Web** URL → you should see your string change.
- Open **API** URL (ends in `/api/health`) → should return `{"ok":true}`.
- In the Neon console, confirm a `pr-<number>` branch appeared under `quarzo-staging`.

### Step 6 — Merge the test PR
On GitHub, click Merge. This triggers `ci.yml` (typecheck+build only) and `cleanup-staging.yml` (deletes the `pr-<number>` Neon branch). Confirm both pass. Confirm the Neon branch disappears.

### Step 7 — Ship prod for the first time
GitHub → Actions → **Deploy Production** → Run workflow → type `ship` → Run. Wait for it. Expected:
- `curl https://quarzo-api.fly.dev/api/health` returns `{"ok":true}`.
- `https://quarzo.pages.dev` loads the site with your string change.

### Step 8 — Tick Phase 1.5 off the roadmap
Open `docs/tech-roadmap.md`, find the Phase 1.5 section, check off each item. Phase 1.5 done — you're ready to start Phase 2 feature work, with every PR getting its own staging URL automatically.

> Monitoring (Fly alerts + UptimeRobot ping + provider status pages) lives in `deploy-setup.md` §11 and is wired up in **Phase 7** before public launch, not now. Pre-launch alerts fire on noise; skip until there's real traffic to monitor.

---

## Debugging a failure

Always start in the **Actions tab** of your GitHub repo. Click the failed run. Each step is collapsible — the red ❌ tells you which one broke. Scroll to the bottom of that step's log for the actual error.

### If "Create Neon branch" fails
- Wrong `NEON_API_KEY` or `NEON_PROJECT_ID_STAGING` secret. Regenerate the API key in Neon → Account Settings → API Keys, paste the new value into GitHub → repo Settings → Secrets.
- Rate-limit error ("too many branches") → free tier caps at 10 simultaneous branches. Close stale PRs to clean them up, or run `cleanup-staging.yml` by hand on one.

### If "Run migrations on PR branch" or the install step fails
- "DATABASE_URL resolved to an empty string" → the Neon step didn't produce an output. Check the previous step's logs; usually a secret mismatch.
- "Cannot find module '@prisma/client'" → `pnpm install` didn't run. Check that step's logs.
- "does not provide an export named 'Prisma'" → `prisma generate` didn't run. It runs automatically as the server's `postinstall` hook (see `server/package.json`). If it's silently skipped, check the install step's log for errors from that hook.

### If "Deploy API to Fly" fails
- "App not found" → you haven't run `flyctl apps create quarzo-api-staging` yet. Go back to Step 2 above.
- "Invalid API token" → `FLY_API_TOKEN` secret is wrong. Run `flyctl auth token` locally and paste the output into GitHub secrets.
- Build fails at Docker stage → open the log for the exact Dockerfile line. Usually a dependency mismatch that reproduces locally with `docker build -f server/Dockerfile --target runtime .`.

### If "Deploy client to Cloudflare Pages" fails
- "Project not found" → you haven't created the Pages project. Go back to Step 3.
- Auth error → `CLOUDFLARE_API_TOKEN` is wrong or lacks the `Cloudflare Pages: Edit` permission. Recreate the token.

### If the PR comment never appears but everything else green
The workflow has a top-level `permissions:` block granting `issues: write` + `pull-requests: write`. If comments still fail, check repo Settings → Actions → General → Workflow permissions. "Read and write" should be allowed, or at minimum "Read repository contents and packages permissions" plus per-workflow permissions via the block (which is what we use).

### General rule
Before asking me for help, **copy the last ~30 lines of the failing step** and paste them in chat. I need the real error, not "it broke." The logs are where the truth lives.

---

## What NOT to touch

- **Don't commit `.env`.** It's in `.gitignore`. Your real secrets only live in GitHub Environments.
- **Don't push to `main` directly.** Always open a PR. (Branch protection is paywalled on private repos, so this is on discipline until the repo goes public.)
- **Don't `flyctl deploy` from your laptop.** All deploys go through Actions so there's one audit trail. If you ever need to, you'll know.
- **Don't hand-edit `.prisma/client` or anything under `node_modules`.** Run `prisma generate` instead.
- **Don't rename the Fly apps, Cloudflare projects, or Neon projects after the fact.** The secret values are wired to these names. If you must rename, update all the `FLY_APP_*`, `CLOUDFLARE_PAGES_PROJECT_*`, and `NEON_PROJECT_ID_*` secrets in the same commit.

---

## Mental model for prompting me (or anyone) for help

When something breaks, frame it with these three things and the debug goes fast:

1. **What step failed** (copy the step name from the Actions log, e.g. "Deploy API to Fly staging").
2. **The last ~30 lines of log** from that step.
3. **What you changed since the last green run** (new secret? new workflow tweak? bumped a dep?).

Without those three, I'm guessing. With them, most failures are a one-line fix.
