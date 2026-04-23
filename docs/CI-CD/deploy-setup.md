# Deploy setup — staging + production + CI/CD

Execution runbook for setting up the Quarzo deployment pipeline. Work through the checklist linearly. For the "why" behind these choices, see the planning conversation that produced this file.

---

## 1. Stack

| Component | Provider | Staging | Production | Monthly cost |
|---|---|---|---|---|
| Client (static Vite build) | Cloudflare Pages | free | free | $0 |
| Server (Express + Prisma) | Fly.io, `dfw` region | `shared-cpu-1x` 256 MB, always-on (`min_machines_running = 1`) | `shared-cpu-1x` 256 MB, always-on | $0 |
| Postgres | Neon | free, DB branch per PR | free (upgrade to Launch if prod exceeds limits) | $0 |
| DNS | Cloudflare | free | free | $0 |
| **Total** | | | | **$0** |

**Prod VM sizing is pre-launch-only.** Production is currently a display URL for the client — no public traffic, no expected concurrency. Two 256 MB machines fit inside Fly's Hobby free allowance (3 × `shared-cpu-1x` 256 MB always free). **Before public launch**, bump prod to `shared-cpu-1x` 512 MB (~$1.94/mo) and reassess after the first launch-day spike — see the Phase 7 checklist in `tech-roadmap.md`.

**Why staging is always-on (not scale-to-zero):** MercadoPago webhooks time out after ~15s, but a cold Fly machine takes ~30s to wake. A sleeping staging would silently hide MP integration bugs — you'd see retries eventually succeed once the machine is warm, but never actually exercise the cold-path. Staging stays up.

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
- `FLY_API_TOKEN`
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
- `FLY_APP_STAGING` = `quarzo-api-staging`
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

**Pre-launch sizing.** `memory_mb = 256` fits Fly's Hobby free allowance — prod is currently a demo URL for the client, not a serving workload. Before public launch, bump prod to `512` (see Phase 7 in `tech-roadmap.md`). Expected cost change at that point: $0 → ~$1.94/mo.

**Staging always-on.** `fly.staging.toml` keeps `min_machines_running = 1` and `auto_stop_machines = false`. MercadoPago webhooks time out at ~15s but a cold Fly machine wakes in ~30s — a sleeping staging would silently hide MP integration bugs. Staging stays up. See §1.

### 5.7 `.node-version` — new file at repo root
```
22
```

---

## 6. GitHub Actions workflows

Four workflows under `.github/workflows/`. **The YAML files themselves are the source of truth** — this section describes *when each runs and why*, not *how*. Read the file + its inline comments for implementation. For an operator's narrative of what happens during a deploy, see [`deploy-quickstart.md`](./deploy-quickstart.md).

### 6.1 `ci.yml` — post-merge tripwire on `main`

File: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml).

Runs on `push: main` only — not on PRs. Typechecks + builds both packages as a sanity check after merge.

**Why CI doesn't run on PRs.** `deploy-staging.yml`'s Fly Docker build runs `tsc` (via `pnpm --filter server build`), and the client's build script is `tsc -b && vite build` — so every type error `ci.yml` would catch is also caught during the staging deploy. Running both on every PR doubled install + build work for no new signal.

Enable branch protection on `main` when the repo goes public: Settings → Branches → Add rule → require `build` status check, require PR, disallow direct pushes. (Paywalled on private repos — skip until public.)

### 6.2 `deploy-staging.yml` — per-PR preview

File: [`.github/workflows/deploy-staging.yml`](../../.github/workflows/deploy-staging.yml).

Triggered on `pull_request` (opened / synchronize / reopened). Skipped for docs-only PRs via `paths-ignore` (`**/*.md`, `docs/**`, `.gitignore`). Concurrency cancels in-flight runs when you push again to the same PR.

Creates a per-PR Neon branch, deploys API to Fly staging, deploys client to Cloudflare Pages (preview), and comments two URLs back on the PR: the stable branch-alias URL (`pr-<N>.<project>.pages.dev` — always the latest build for this PR) and the per-commit URL (immutable, good for debugging a specific build).

### 6.3 `deploy-production.yml` — manual release

File: [`.github/workflows/deploy-production.yml`](../../.github/workflows/deploy-production.yml).

`workflow_dispatch` only — you must click the button and type `ship` in the confirmation input. Runs prod migrations, deploys API to Fly prod, deploys client to Cloudflare Pages prod, and tags the commit `release-<utc-stamp>`.

**How to deploy production:** GitHub → Actions tab → "Deploy Production" → Run workflow → type `ship` → Run. That's the weekly release ritual.

### 6.4 `cleanup-staging.yml` — per-PR Neon cleanup

File: [`.github/workflows/cleanup-staging.yml`](../../.github/workflows/cleanup-staging.yml).

Triggered on `pull_request: closed`. Deletes the `pr-<number>` Neon branch that `deploy-staging.yml` created, regardless of whether the PR was merged or abandoned.

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
- [ ] `flyctl apps create quarzo-api` and `flyctl apps create quarzo-api-staging`.
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

- ESLint / Prettier / test runner (Vitest). Add in a later phase; CI is typecheck + build only.
- E2E tests (Playwright) in the staging pipeline.
- Sentry / error monitoring (Fly dashboard + UptimeRobot cover enough for v1 — see §11).
- Blue/green or canary deploys.
- DB backups beyond Neon's default PITR.
- Per-branch preview deploys for non-PR pushes.

---

## 11. Monitoring

Wire these in Phase 1.5, not later. At ~10 orders/week and a solo operator, the question isn't "is observability beautiful" — it's "will I notice before the client does." These four things answer that for ~$0/mo.

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
