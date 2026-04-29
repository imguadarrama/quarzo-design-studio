# Deploy setup — staging + production + CI/CD

Execution runbook for setting up the Quarzo deployment pipeline. Work through the checklist linearly. For the "why" behind these choices, see the planning conversation that produced this file.

---

## 1. Stack

| Component | Provider | Staging | Production | Monthly cost |
|---|---|---|---|---|
| Client (static Vite build) | Cloudflare Pages | free, preview per PR | free | $0 |
| Server (Express + Prisma) | Fly.io, `dfw` region | `shared-cpu-1x` 256 MB, scale-to-zero, **one app per PR** (review-app pattern, see §6.2) | `shared-cpu-1x` 256 MB, scale-to-zero | ~$0–1 |
| Postgres | Neon | free, DB branch per PR | free (upgrade to Launch if prod exceeds limits) | $0 |
| DNS | Cloudflare | free | free | $0 |
| **Total** | | | | **~$0–1** |

**Fly's "always-free 3 machines" allowance was retired October 2024.** All new orgs are pure pay-as-you-go — `shared-cpu-1x` 256 MB always-on is ~$1.94/mo. To keep the bill near zero pre-launch we set `auto_stop_machines = "stop"` and `min_machines_running = 0` on both apps; the machine wakes on the first request (~3–5 s cold start) and idles back to zero after a few minutes of no traffic. See `fly.toml` and `fly.staging.toml`.

**Per-PR staging apps don't change the cost story.** Each open PR has its own Fly app, but every per-PR machine sleeps when idle and bills nothing while sleeping. Apps and stopped machines are free to keep around. Realistic monthly bill at this PR volume stays $0–0.50 regardless of how many PRs are open simultaneously. The reason this is safe is precisely the scale-to-zero config above — turn that off and the math changes (every always-on PR app would cost ~$1.94/mo on its own).

**Prod VM sizing is pre-launch-only.** Production is currently a display URL for the client — no public traffic, no expected concurrency. **Before public launch**, bump prod to `shared-cpu-1x` 512 MB and flip back to always-on (`auto_stop_machines = false`, `min_machines_running = 1`) — see the Phase 7 checklist in `tech-roadmap.md`. Expected cost change at that point: ~$0 → ~$3.88/mo.

**Why staging will need to flip back to always-on at Phase 4:** MercadoPago webhooks time out after ~15s, but a cold Fly machine takes ~30s to wake. A sleeping staging would silently hide MP integration bugs — you'd see retries eventually succeed once the machine is warm, but never actually exercise the cold-path. Until Phase 4 starts, scale-to-zero is safe; **revert `fly.staging.toml` to `auto_stop_machines = false` + `min_machines_running = 1` as the first task of Phase 4** so MP integration is exercised under realistic cold-start conditions.

Domain: GoDaddy (to be purchased). Default hostnames (`*.pages.dev`, `*.fly.dev`) are used until the custom domain is wired up — see §8.

---

## 2. Branching model

```
feature/* ──open PR──▶ staging auto-deploys (isolated Neon branch DB)
               │
               └─merge to main──▶ CI runs (no deploy)
                                     │
                                     └─click "Run workflow" in Actions ──▶ production
```

Rules:
- `main` is always deployable. No direct pushes.
- Every change is a PR. Opening / pushing to a PR deploys to staging.
- Merging to `main` runs CI only. Production deploy is a **manual click** in the Actions tab (weekly cadence).
- Rollback = `git revert` + merge → new deploy.

---

## 3. Provider accounts (Session 1)

### Fly.io
1. Sign up at https://fly.io (no card required on Hobby).
2. `iwr https://fly.io/install.ps1 -useb | iex` (PowerShell) to install `flyctl` on Windows, or `curl -L https://fly.io/install.sh | sh` in WSL.
3. `flyctl auth login`.
4. Capture: `flyctl auth token` → save as GitHub secret `FLY_API_TOKEN`.

### Cloudflare
1. Sign up at https://cloudflare.com.
2. From the dashboard, capture your Account ID → `CLOUDFLARE_ACCOUNT_ID`.
3. My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" template won't work; use a **custom token** with permissions: `Account > Cloudflare Pages > Edit`. → `CLOUDFLARE_API_TOKEN`.

### Neon
1. Sign up at https://neon.tech.
2. Create **two separate projects**: `quarzo-staging` and `quarzo-prod`.
3. For each project, from Dashboard → Connection Details, capture the pooled `DATABASE_URL`.
4. From Account Settings → API Keys, create a key → `NEON_API_KEY`.
5. From each project's Settings → General, capture the Project ID → `NEON_PROJECT_ID_STAGING` and `NEON_PROJECT_ID_PROD`.

### Secrets to generate locally
- Two `JWT_SECRET` values, one per env (32+ random bytes each):
  ```powershell
  [Convert]::ToBase64String((1..48 | % { Get-Random -Min 0 -Max 255 }))
  ```

---

## 4. GitHub Environments + secrets

### Create Environments
GitHub → repo Settings → Environments → **New environment**:
- `staging` — no deployment protection rules.
- `production` — no approval gate needed (the manual `workflow_dispatch` trigger IS the gate).

### Repo-level secrets (Settings → Secrets and variables → Actions → Repository secrets)
- `FLY_API_TOKEN` — must be **org-scoped**, not app-scoped, because the staging workflow creates per-PR apps. Generate with `flyctl tokens create org <FLY_ORG_STAGING>`. App-scoped deploy tokens (`flyctl tokens create deploy -a <app>`) cannot create new apps and will fail the staging workflow.
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `NEON_API_KEY`
- `NEON_PROJECT_ID_STAGING`
- `NEON_PROJECT_ID_PROD`

### `staging` environment secrets
- `DATABASE_URL_STAGING_BASE` — the `quarzo-staging/main` URL (PR workflows branch off this)
- `JWT_SECRET_STAGING`
- `ADMIN_EMAIL_STAGING`
- `ADMIN_PASSWORD_STAGING`
- `CLIENT_ORIGIN_STAGING` — fill once Fly staging app exists, e.g. `https://quarzo-api-staging.fly.dev` (used for CORS; will be replaced by the per-PR Pages URL in env wiring)
- `COOKIE_DOMAIN_STAGING` — leave empty initially (cross-site cookies until domain wired)
- `FLY_APP_STAGING` = `quarzo-api-staging` — **base name only**. The actual per-PR app is `${FLY_APP_STAGING}-pr-<N>` (review-app pattern, §6.2).
- `FLY_ORG_STAGING` — Fly org slug (run `flyctl orgs list` to find it; usually `personal` for solo accounts). Required so the workflow can create per-PR apps via `flyctl apps create --org <slug>`.
- `CLOUDFLARE_PAGES_PROJECT_STAGING` = `quarzo-staging`

### `production` environment secrets
- `DATABASE_URL_PROD`
- `JWT_SECRET_PROD`
- `ADMIN_EMAIL_PROD`
- `ADMIN_PASSWORD_PROD`
- `CLIENT_ORIGIN_PROD`
- `COOKIE_DOMAIN_PROD`
- `FLY_APP_PROD` = `quarzo-api`
- `CLOUDFLARE_PAGES_PROJECT_PROD` = `quarzo`

---

## 5. Repo changes

### 5.1 `server/Dockerfile` — multi-stage

File: [`../../server/Dockerfile`](../../server/Dockerfile).

Named stages so one file serves both dev and prod:

- **`dev`** — targeted by `docker-compose.yml` (`target: dev`). Self-contained so the container boots without a follow-up install; compose volumes overlay `server/` for hot reload.
- **`deps` → `build` → `runtime`** — the prod chain. `flyctl deploy` targets `runtime` via `fly.toml`'s `build-target = "runtime"`. The final image is `node:22-alpine` + `dist/` + pruned prod `node_modules` + `prisma/` — no pnpm, no source.

See the file's stage comments for implementation details.

### 5.2 `docker-compose.yml` — pin dev target
On the `api` service, change:
```yaml
build:
  context: .
  dockerfile: server/Dockerfile
  target: dev
```

### 5.3 `server/src/routes/health.ts` — new file
```ts
import { Router } from "express";
export const healthRouter = Router();
healthRouter.get("/health", (_req, res) => res.json({ ok: true }));
```
Wire it into `server/src/index.ts` at `app.use("/api", healthRouter)`.

### 5.4 `server/src/config/env.ts` — add `APP_ENV`
Add to the Zod schema:
```ts
APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
```
Leave `NODE_ENV` alone — it stays `production` in both staging and prod so libraries behave correctly.

### 5.5 `client/vite.config.ts` + client fetch layer — `VITE_API_BASE_URL`
Leave the dev `/api` proxy in place. In the client fetch layer (e.g. `client/src/services/api/client.ts`), use:
```ts
const BASE = import.meta.env.VITE_API_BASE_URL ?? "";
export const apiFetch = (path: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, { credentials: "include", ...init });
```
Empty string in dev → Vite proxy handles it. Absolute URL in staging/prod → direct cross-origin call.

### 5.6 `fly.toml` (prod) and `fly.staging.toml` — at repo root

Files: [`../../fly.toml`](../../fly.toml), [`../../fly.staging.toml`](../../fly.staging.toml).

Both apps run `shared-cpu-1x` 256 MB in `dfw` (Dallas — closest active Fly region to Saltillo after `qro` was deprecated in 2026). Healthcheck is `GET /api/health`. Both configs point at `server/Dockerfile` with `build-target = "runtime"`.

**Pre-launch sizing.** `memory_mb = 256` is the cheapest tier — prod is currently a demo URL for the client, not a serving workload. Before public launch, bump prod to `512` (see Phase 7 in `tech-roadmap.md`).

**Both apps scale to zero (pre-launch).** `auto_stop_machines = "stop"` + `min_machines_running = 0` on both files. Machines stop after idle and wake on the first request (~3–5 s cold start). Phase 4 must flip staging back to `auto_stop_machines = false` + `min_machines_running = 1` before MercadoPago integration begins; Phase 7 flips prod back at public launch. See §1.

### 5.7 `.node-version` — new file at repo root
```
22
```

---

## 6. GitHub Actions workflows

Four workflows under `.github/workflows/`. **The YAML files themselves are the source of truth** — this section describes *when each runs and why*, not *how*. Read the file + its inline comments for implementation. For an operator's narrative of what happens during a deploy, see [`deploy-quickstart.md`](./deploy-quickstart.md).

### 6.1 `ci.yml` — post-merge tripwire on `main`

File: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

Runs on `push: main` only — not on PRs. Delegates to the shared `build-and-check` composite action (install → build server → build client → docker smoke), so post-merge runs the same pipeline the deploy workflows run.

**Why CI doesn't run on PRs.** `deploy-staging.yml`'s Fly Docker build runs `tsc` (via `pnpm --filter server build`), and the client's build script is `tsc -b && vite build` — so every type error `ci.yml` would catch is also caught during the staging deploy. Running both on every PR doubled install + build work for no new signal.

Enable branch protection on `main` when the repo goes public: Settings → Branches → Add rule → require `build` status check, require PR, disallow direct pushes. (Paywalled on private repos — skip until public.)

### 6.2 `deploy-staging.yml` — per-PR preview (review-app pattern)

File: [`.github/workflows/deploy-staging.yml`](../../.github/workflows/deploy-staging.yml).

Triggered on `pull_request` (opened / synchronize / reopened). Skipped for docs-only PRs via `paths-ignore` (`**/*.md`, `docs/**`, `.gitignore`, `LICENSE`, `.editorconfig`, `.gitattributes`). Concurrency cancels in-flight runs when you push again to the same PR.

**Every PR gets its own complete stack — frontend, DB, *and* API.** That isolation is the whole point: closing or pushing to one PR can never affect another reviewer's environment. Specifically, the workflow:

1. Resolves the per-PR app name as `${FLY_APP_STAGING}-pr-<N>` (e.g. `quarzo-api-staging-pr-15`).
2. Creates a per-PR Neon branch (`pr-<N>`).
3. On first deploy for the PR, runs `flyctl apps create <per-PR-app> --org ${FLY_ORG_STAGING}` (idempotent — subsequent pushes find the existing app and skip).
4. Sets that app's secrets and runs `flyctl deploy -a <per-PR-app> -c fly.staging.toml`. The `app = "..."` line in `fly.staging.toml` is overridden by `-a`, so the same toml is reused across every per-PR app.
5. Deploys the client to Cloudflare Pages with `branch: pr-<N>` (per-PR preview).
6. Comments two URLs back on the PR: the stable Pages branch-alias URL (always the latest build for this PR) and the per-commit URL (immutable, good for debugging a specific build), plus the per-PR API health URL `https://<per-PR-app>.fly.dev/api/health`.

This is paired with `cleanup-staging.yml` (§6.4) which destroys the per-PR Fly app on PR close. There is no shared staging API anymore — the original single `quarzo-api-staging` app is decommissioned and can be destroyed manually once the new flow is verified.

### 6.3 `deploy-production.yml` — manual release

File: [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml).

`workflow_dispatch` only — you must click the button and type `ship` in the confirmation input. Runs prod migrations, deploys API to Fly prod, deploys client to Cloudflare Pages prod, and tags the commit `release-<utc-stamp>`.

**How to deploy production:** GitHub → Actions tab → "Deploy Production" → Run workflow → type `ship` → Run. That's the weekly release ritual.

### 6.4 `cleanup-staging.yml` — per-PR teardown

File: [`.github/workflows/cleanup-staging.yml`](../../.github/workflows/cleanup-staging.yml).

Triggered on `pull_request: closed`. Tears down the per-PR stack regardless of whether the PR was merged or abandoned:

1. Deletes the `pr-<N>` Neon branch.
2. Runs `flyctl apps destroy ${FLY_APP_STAGING}-pr-<N> -y` to remove the per-PR Fly app.

Both steps are `continue-on-error: true`. PRs that closed without ever deploying (`paths-ignore` filtered every push, draft PRs that never opened, etc.) won't have a Neon branch or Fly app to delete, and that's fine — the workflow shouldn't fail just because there's nothing to clean up.

Because each PR has its own dedicated Fly app, this teardown cannot affect any other open PR. That's the property that the previous "scale shared app to zero" approach lacked.

---

## 7. Execution checklist

### Session 1 — accounts + CI (no deploys yet)
- [ ] Sign up for Fly.io; install `flyctl`; `flyctl auth login`; capture `FLY_API_TOKEN`.
- [ ] Sign up for Cloudflare; capture `CLOUDFLARE_ACCOUNT_ID`; create API token → `CLOUDFLARE_API_TOKEN`.
- [ ] Sign up for Neon; create projects `quarzo-staging` + `quarzo-prod`; capture connection URLs, API key, project IDs.
- [ ] Generate two `JWT_SECRET` values.
- [ ] Create `staging` + `production` GitHub Environments.
- [ ] Add all secrets per §4.
- [ ] Add `.node-version` file with `22`.
- [ ] Commit `.github/workflows/ci.yml`.
- [ ] Enable branch protection on `main` (require CI, require PR, no direct pushes).
- [ ] Open a throwaway PR → confirm CI is green.

### Session 2 — Dockerfile, Fly/CF apps, deploy workflows
- [ ] Refactor `server/Dockerfile` per §5.1.
- [ ] Update `docker-compose.yml` → `api.target: dev`. Run `pnpm dev:rebuild && pnpm dev` → confirm local dev still works.
- [ ] Add `GET /api/health` per §5.3. Hit `http://localhost:3000/api/health` locally → confirm `{ ok: true }`.
- [ ] Add `APP_ENV` to Zod env schema (§5.4).
- [ ] Wire `VITE_API_BASE_URL` in client fetch layer (§5.5).
- [ ] Add `fly.toml` + `fly.staging.toml` per §5.6.
- [ ] `flyctl apps create quarzo-api` for production. **Don't pre-create a staging app** — `deploy-staging.yml` now creates one per PR on demand (§6.2). Capture the Fly org slug with `flyctl orgs list` → store as `FLY_ORG_STAGING` secret.
- [ ] Create two Cloudflare Pages projects (`quarzo` + `quarzo-staging`). In each project's Settings → Builds & deployments, **disable the GitHub auto-build** (we deploy from Actions, not from CF's integration).
- [ ] Run `prisma migrate deploy` once manually against the prod Neon DB:
  ```bash
  DATABASE_URL="<prod-neon-url>" pnpm --filter server exec prisma migrate deploy
  ```
- [ ] Run `pnpm seed` once manually against prod to create the admin user.
- [ ] Commit `.github/workflows/deploy-staging.yml`, `deploy-production.yml`, `cleanup-staging.yml`.
- [ ] Open a dummy PR → watch the full staging pipeline run → open the preview URL posted as a comment → hit `/api/health` on the staging API.
- [ ] Merge the dummy PR → confirm CI runs on `main` but no deploy triggers.
- [ ] Actions tab → "Deploy Production" → Run workflow → type `ship` → confirm prod deploys end-to-end.
- [ ] Close the dummy PR → confirm the Neon `pr-<n>` branch disappears.

### Session 3 (conditional) — custom domain
Run these only after buying the GoDaddy domain.

- [ ] Option A (recommended): change nameservers at GoDaddy to Cloudflare's. Adds the zone to your Cloudflare account for free.
- [ ] Option B: keep DNS at GoDaddy, manually add records there. GoDaddy's bundled SSL is irrelevant — CF Pages and Fly issue their own.
- [ ] In Cloudflare Pages prod project → Custom domains → add `www.<domain>` and apex `<domain>`.
- [ ] Add a CNAME `api.<domain>` → `quarzo-api.fly.dev`. Then: `flyctl certs add api.<domain> -a quarzo-api`.
- [ ] Repeat for staging: `staging.<domain>` (CF Pages), `staging-api.<domain>` (Fly staging).
- [ ] Update production secrets:
  - `CLIENT_ORIGIN_PROD = https://<domain>`
  - `COOKIE_DOMAIN_PROD = .<domain>` (leading dot — shares cookie across subdomains)
- [ ] Update staging secrets similarly with `staging.` prefixes.
- [ ] In `server/src/index.ts`, flip the cookie options to `sameSite: "lax"` (from `"none"`) now that web + api share an eTLD+1.
- [ ] Re-run "Deploy Production" to pick up new secrets.

---

## 8. Verification (end-to-end smoke test)

1. `git checkout -b feature/deploy-smoke-test` → change a string in `client/src/App.tsx` → push → open PR.
2. CI should go green. `deploy-staging.yml` should then run and post a comment with preview + API URLs.
3. Open the preview URL → confirm the copy change is live. `curl https://quarzo-api-staging.fly.dev/api/health` → `{ "ok": true }`.
4. In Neon console, confirm a `pr-<number>` branch exists under `quarzo-staging`.
5. Merge to `main` → confirm CI runs but no prod deploy.
6. Actions → Deploy Production → Run workflow → type `ship`. Wait for it to finish.
7. `curl https://quarzo-api.fly.dev/api/health` → `{ "ok": true }`. Open `https://quarzo.pages.dev` (or custom domain if wired) → confirm change live.
8. Close the dummy PR → confirm Neon `pr-<n>` branch is deleted within ~1 min.

---

## 9. Rollback

- **App:** `flyctl releases list -a quarzo-api` → `flyctl releases rollback <version> -a quarzo-api`. For the client, Cloudflare Pages dashboard → Deployments → "Rollback to this deployment".
- **DB:** forward-only. Write a new migration that reverses. Neon free tier keeps 7 days of point-in-time recovery for true emergencies.
- **Fast path:** `git revert <sha>` → PR → merge → Deploy Production.

---

## 10. Out of scope for now

- ESLint / Prettier / test runner (Vitest). Add in a later phase; CI is install + build both packages + docker smoke only.
- E2E tests (Playwright) in the staging pipeline.
- Sentry / error monitoring (Fly dashboard + UptimeRobot cover enough for v1 — see §11).
- Blue/green or canary deploys.
- DB backups beyond Neon's default PITR.
- Per-branch preview deploys for non-PR pushes.

---

## 11. Monitoring

Wire these in Phase 7, before public launch. Skipped earlier because pre-launch prod has no traffic — alerts would fire on noise and an external uptime ping would only confirm Fly is up, which isn't a question anyone's asking yet. Once the site is serving real customers (~10 orders/week, solo operator), the question flips to "will I notice before the client does." These four things answer that for ~$0/mo.

### 11.1 Fly.io dashboard metrics (built in)
Already available on every Fly app at no extra cost:
- CPU % per machine
- Memory usage per machine
- HTTP request rate, p50 / p95 latency
- Healthcheck pass/fail counts

You read these when something feels slow. They also back the alerts below.

### 11.2 Fly.io alerts
In each app's dashboard → Monitoring → Alerts, create:

| Metric | Threshold | Why |
|---|---|---|
| CPU | > 70% sustained 5 min | Early signal to upgrade VM size before users feel it |
| Memory | > 80% sustained 5 min | Prevents OOM crashes |
| p95 latency | > 800 ms sustained 5 min | User-perceived slowness before it's a pager |
| Healthcheck failures | > 3 consecutive | App is broken; page immediately |

Destination: email to the operator's address. Add Slack/Discord later if you want.

### 11.3 UptimeRobot (external uptime ping)
Free plan gives 50 monitors at 5-min interval. Configure one monitor:
- Type: HTTP(s)
- URL: `https://quarzo-api.fly.dev/api/health` (or the prod custom-domain equivalent once §7 Session 3 is done)
- Interval: 5 min
- Alert contact: email

Why this matters: Fly's own alerts go dark when the whole Fly region has a problem. UptimeRobot lives outside Fly and tells you when Fly *itself* is the issue.

### 11.4 Provider status-page subscriptions
Subscribe to incident email/RSS for each provider whose outage can take prod down:
- https://status.fly.io
- https://neon.tech/status (or their current status page URL)
- https://cloudflarestatus.com

When a page lights up during an outage, you know it's not your code before you waste 20 minutes debugging.

### Out of scope for v1
- Sentry or similar error tracking — add once you have real user errors to triage.
- Log aggregation (Logtail, Axiom). Fly's built-in `flyctl logs` is sufficient for one operator.
- Performance tracing (OpenTelemetry). Not warranted at this scale.
