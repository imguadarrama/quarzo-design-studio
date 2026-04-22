# Deploy setup — staging + production + CI/CD

Execution runbook for setting up the Quarzo deployment pipeline. Work through the checklist linearly. For the "why" behind these choices, see the planning conversation that produced this file.

---

## 1. Stack

| Component | Provider | Staging | Production |
|---|---|---|---|
| Client (static Vite build) | Cloudflare Pages | free | free |
| Server (Express + Prisma) | Fly.io | free tier, scale-to-zero | free tier, always-on (upgrade if needed) |
| Postgres | Neon | free, DB branch per PR | free (upgrade to Launch if prod exceeds limits) |
| DNS | Cloudflare | free | free |

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

### 5.1 `server/Dockerfile` — convert to multi-stage

Named stages so `docker-compose` can still target `dev`:

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS dev
# used by docker-compose.yml with target: dev
CMD ["pnpm", "--filter", "server", "dev"]

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile --filter server

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules
COPY server ./server
COPY tsconfig.base.json ./
RUN pnpm --filter server exec prisma generate
RUN pnpm --filter server build
RUN pnpm --filter server deploy --prod /app/prod-server

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=build /app/prod-server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/prisma ./prisma
USER node
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

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

### 5.6 `fly.toml` (prod) and `fly.staging.toml` — new files at repo root

**`fly.toml`:**
```toml
app = "quarzo-api"
primary_region = "qro"  # Querétaro — closest to Saltillo

[build]
  dockerfile = "server/Dockerfile"
  build-target = "runtime"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    path = "/api/health"
    protocol = "http"
    timeout = "5s"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

**`fly.staging.toml`:** same but `app = "quarzo-api-staging"`, `min_machines_running = 0`, `auto_stop_machines = true`.

### 5.7 `.node-version` — new file at repo root
```
22
```

---

## 6. GitHub Actions workflows

All four go under `.github/workflows/`.

### 6.1 `ci.yml`
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter server exec prisma generate
      - run: pnpm --filter server exec tsc --noEmit
      - run: pnpm --filter client exec tsc -b --noEmit
      - run: pnpm --filter server build
      - run: pnpm --filter client build
      - uses: actions/upload-artifact@v4
        if: github.event_name == 'pull_request'
        with:
          name: client-dist
          path: client/dist
```

Enable branch protection on `main`: Settings → Branches → Add rule → require `build` status check, require PR, disallow direct pushes.

### 6.2 `deploy-staging.yml`
```yaml
name: Deploy Staging
on:
  pull_request:
    types: [opened, synchronize, reopened]

concurrency:
  group: staging-pr-${{ github.event.number }}
  cancel-in-progress: true

jobs:
  deploy:
    if: github.event.pull_request.draft == false
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Create Neon branch
        id: neon
        uses: neondatabase/create-branch-action@v5
        with:
          project_id: ${{ secrets.NEON_PROJECT_ID_STAGING }}
          branch_name: pr-${{ github.event.number }}
          api_key: ${{ secrets.NEON_API_KEY }}

      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - name: Run migrations on PR branch
        env:
          DATABASE_URL: ${{ steps.neon.outputs.db_url_pooled }}
        run: |
          pnpm --filter server exec prisma migrate deploy
          pnpm seed

      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Deploy API to Fly staging
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: |
          flyctl secrets set -a ${{ secrets.FLY_APP_STAGING }} \
            DATABASE_URL="${{ steps.neon.outputs.db_url_pooled }}" \
            JWT_SECRET="${{ secrets.JWT_SECRET_STAGING }}" \
            ADMIN_EMAIL="${{ secrets.ADMIN_EMAIL_STAGING }}" \
            ADMIN_PASSWORD="${{ secrets.ADMIN_PASSWORD_STAGING }}" \
            CLIENT_ORIGIN="${{ secrets.CLIENT_ORIGIN_STAGING }}" \
            COOKIE_DOMAIN="" \
            APP_ENV="staging" \
            NODE_ENV="production"
          flyctl deploy -a ${{ secrets.FLY_APP_STAGING }} -c fly.staging.toml --remote-only

      - name: Build client
        env:
          VITE_API_BASE_URL: https://${{ secrets.FLY_APP_STAGING }}.fly.dev
        run: pnpm --filter client build

      - name: Deploy client to Cloudflare Pages (preview)
        uses: cloudflare/pages-action@v1
        id: pages
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ${{ secrets.CLOUDFLARE_PAGES_PROJECT_STAGING }}
          directory: client/dist
          branch: pr-${{ github.event.number }}

      - name: Comment preview URL on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `**Staging deployed**\n- Web: ${{ steps.pages.outputs.url }}\n- API: https://${{ secrets.FLY_APP_STAGING }}.fly.dev/api/health`
            })
```

### 6.3 `deploy-production.yml`
```yaml
name: Deploy Production
on:
  workflow_dispatch:
    inputs:
      confirm:
        description: 'Type "ship" to confirm production deploy'
        required: true

jobs:
  deploy:
    if: inputs.confirm == 'ship'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main

      - uses: pnpm/action-setup@v4
        with: { version: 9.12.0 }
      - uses: actions/setup-node@v4
        with:
          node-version-file: .node-version
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - name: Migrate production DB
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_PROD }}
        run: pnpm --filter server exec prisma migrate deploy

      - uses: superfly/flyctl-actions/setup-flyctl@master
      - name: Deploy API to Fly prod
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
        run: |
          flyctl secrets set -a ${{ secrets.FLY_APP_PROD }} \
            DATABASE_URL="${{ secrets.DATABASE_URL_PROD }}" \
            JWT_SECRET="${{ secrets.JWT_SECRET_PROD }}" \
            ADMIN_EMAIL="${{ secrets.ADMIN_EMAIL_PROD }}" \
            ADMIN_PASSWORD="${{ secrets.ADMIN_PASSWORD_PROD }}" \
            CLIENT_ORIGIN="${{ secrets.CLIENT_ORIGIN_PROD }}" \
            COOKIE_DOMAIN="${{ secrets.COOKIE_DOMAIN_PROD }}" \
            APP_ENV="production" \
            NODE_ENV="production"
          flyctl deploy -a ${{ secrets.FLY_APP_PROD }} -c fly.toml --remote-only

      - name: Build client for prod
        env:
          VITE_API_BASE_URL: https://${{ secrets.FLY_APP_PROD }}.fly.dev
        run: pnpm --filter client build

      - name: Deploy client to Cloudflare Pages (prod)
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ${{ secrets.CLOUDFLARE_PAGES_PROJECT_PROD }}
          directory: client/dist
          branch: main

      - name: Tag release
        run: |
          TAG="release-$(date -u +%Y%m%d-%H%M)"
          git tag "$TAG"
          git push origin "$TAG"
```

**How to deploy production:** GitHub → Actions tab → "Deploy Production" → Run workflow → type `ship` → Run. That's the weekly release ritual.

### 6.4 `cleanup-staging.yml`
```yaml
name: Cleanup Staging
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: neondatabase/delete-branch-action@v3
        with:
          project_id: ${{ secrets.NEON_PROJECT_ID_STAGING }}
          branch: pr-${{ github.event.number }}
          api_key: ${{ secrets.NEON_API_KEY }}
```

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
- Sentry / error monitoring.
- Uptime monitoring (UptimeRobot is a 5-min add later).
- Blue/green or canary deploys.
- DB backups beyond Neon's default PITR.
- Per-branch preview deploys for non-PR pushes.
