# Quarzo Design Studio

Custom-stationery e-commerce store (Saltillo, Coahuila — Spanish copy, MXN payments) built on a deliberately pedagogical stack: TypeScript monorepo, Express + Prisma, Vite + React, Postgres, all wrapped in Docker Compose.

**Live:** [quarzo.pages.dev](https://quarzo.pages.dev/)

> **Status:** **Phases 2, 2.5, 2.6, and 2.7 are complete. Phase 3 (cart + guest checkout) is next.** Phase 2 shipped the functional skeleton (catalog, product detail, admin auth, admin product CRUD). Phase 2.5 (all 10 slices) rebuilt the client on SCSS modules + design tokens — three sibling layouts, zustand admin auth, full admin CRUD, public `/catalogo` and `/producto/:slug` with the design-first picker flow, a11y-clean out of the box. Phase 2.6 (PR #34) moved product images to Cloudflare R2 with a server-side Sharp pipeline. Phase 2.7 (PR #36) introduced the fixed `VariantKind` enum, global `Design` library, first-class `Category`, `ProductSlugAlias`, and server-generated SKUs. Plans: [`docs/phase-2-execution-plan.md`](docs/phase-2-execution-plan.md) · [`docs/phase-2.5-execution-plan.md`](docs/phase-2.5-execution-plan.md) · [`docs/phase-2.6-execution-plan.md`](docs/phase-2.6-execution-plan.md) · [`docs/phase-2.7-execution-plan.md`](docs/phase-2.7-execution-plan.md).
>
> See [`docs/tech-roadmap.md`](docs/tech-roadmap.md) for the phased plan and [`CLAUDE.md`](CLAUDE.md) for architecture conventions and invariants.

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Docker Desktop (Windows/macOS) or Docker Engine + Compose v2 (Linux) | current | Runs the whole stack — must be started before any `pnpm dev*` command |
| Node.js | ≥ 22 | Only needed on the host for workspace-scoped scripts (e.g. `pnpm --filter server build`); container-based dev does not require host Node |
| pnpm | ≥ 9.12 | Package manager (same reason as above) |
| Git | any recent | Clone the repo |

You do **not** need Postgres installed on the host — the `db` service runs it in a container.

---

## First-time setup

Run these once per machine after cloning.

```bash
# 1. Clone and enter the repo
git clone <repo-url> quarzo-design-studio
cd quarzo-design-studio

# 2. Create your local .env from the template
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
```

Then open `.env` and update:

- `JWT_SECRET` — paste a long random string (≥ 32 chars).
- `ADMIN_PASSWORD` — real password for the seeded admin user.
- `POSTGRES_PASSWORD` — replace `change-me-in-local-env`, and mirror the same password inside `DATABASE_URL`.

```bash
# 3. Build the images and start the stack (leave this running)
pnpm dev:rebuild

# 4. In a second terminal, apply the Prisma migrations
pnpm migrate                    # Prisma prompts for a name on the first run

# 5. Seed the admin user + sample products
pnpm seed
```

Smoke-check:

- Web: http://localhost:5173 should load the Vite placeholder page.
- API health: http://localhost:3000/api/health should return `{"ok":true}`.

---

## Daily workflow

```bash
pnpm dev            # start the stack (db + api + web) — same as `docker compose up`
pnpm dev:down       # stop the stack
pnpm dev:rebuild    # rebuild images (after Dockerfile or root-dep changes)
pnpm migrate        # create/apply a new Prisma migration after editing schema.prisma
pnpm seed           # re-run the seed script (requires the stack to be up)
```

Hot reload is already wired: the `api` service runs `tsx watch` and the `web` service runs `vite` — edits in `server/` or `client/` are picked up inside the containers via bind mounts.

---

## Ports & services

| Port | Service | Notes |
|---|---|---|
| `5173` | Vite dev server (`web`) | Frontend. Proxies `/api/*` → `api:3000` (see `client/vite.config.ts`), so the browser calls same-origin `/api/...` |
| `3000` | Express API (`api`) | `/api/health`, `/api/products`, `/api/admin/auth/*`, `/api/admin/products/*`, `/api/admin/categories/*`, `/api/admin/designs/*`, `/api/admin/palettes/*`, `POST /api/admin/images` are live. Cart/checkout routes land in Phase 3. |
| `5432` | Postgres 16 (`db`) | Exposed on localhost so you can connect with TablePlus / DBeaver / `psql` |

---

## Workspace-scoped commands

The repo is a pnpm workspace with two packages: `server/` and `client/`. Most of the time you should let Docker run everything — but when you need to invoke a one-off script:

```bash
pnpm --filter server <script>   # e.g. pnpm --filter server build
pnpm --filter client <script>   # e.g. pnpm --filter client preview
```

These can technically run on the host, but the container volumes own `node_modules`. **Do not run `pnpm install` on the host** — let the Docker build do it. If you need deps updated inside the container, run `pnpm dev:rebuild`.

---

## Environment variables

All variables live in `.env` at the repo root. `docker-compose.yml` reads it and forwards the relevant subset into the `api` container. `server/src/config/env.ts` validates them with Zod and exits the process on invalid config — that file is the single source of truth; update its schema when you add a variable.

| Variable | Purpose |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credentials the `db` container boots with |
| `DATABASE_URL` | Prisma connection string — must match the Postgres vars above; host is `db` (the Compose service name) |
| `NODE_ENV` | Standard Node/library signal (`development` \| `test` \| `production`). Defaults to `development` via the Zod schema; left as-is locally, set to `production` in both staging and prod deploys so libraries behave correctly |
| `APP_ENV` | Deploy-env signal used by app code (`development` \| `staging` \| `production`). Separate from `NODE_ENV` — drives things like cookie `secure` flag |
| `PORT` | Port the Express API listens on (default `3000`) |
| `CLIENT_ORIGIN` | Origin allowed by CORS, used for cookie `SameSite` handling (default `http://localhost:5173`) |
| `COOKIE_DOMAIN` | Domain scope for the auth cookie (default `localhost`) |
| `JWT_SECRET` | Signing secret for auth JWTs — must be long and random (≥ 16 chars, enforced by the Zod schema) |
| `CLIENT_ORIGIN_PREVIEW_PATTERN` | Optional regex (staging only) allowing Cloudflare Pages preview URLs through CORS. Leave empty in dev and prod. See `server/src/index.ts` |
| `ADMIN_AUTH_COOKIE_NAME` | Admin-session cookie name (default `quarzo_admin_session`) |
| `CUSTOMER_AUTH_COOKIE_NAME` | Customer-session cookie name (default `quarzo_customer_session`; wired in Phase 5) |
| `AUTH_TOKEN_TTL_HOURS` | Lifetime of admin/customer JWTs in hours (default `12`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seeded admin-user credentials (consumed by `server/src/seed.ts`). There is intentionally no public admin registration endpoint |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID — used by the R2 S3-compatible client. Same value as the GitHub secret of the same name |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Credentials for the R2 access token. Local dev uses the **staging-only** token (`quarzo-r2-rw-staging`) so a mistake can't touch prod. Captured once on token creation; if lost, delete and recreate the token |
| `R2_BUCKET` | R2 bucket name (default `quarzo-media-staging` locally; `quarzo-media` in prod) |
| `R2_PUBLIC_BASE_URL` | Public `pub-<hash>.r2.dev` base URL Cloudflare assigns after enabling public access on the bucket. No trailing slash |
| `R2_KEY_PREFIX` | Optional segment prefixed to every R2 key. Empty locally and in prod; `deploy-staging.yml` sets it to `pr-<N>` per PR so `cleanup-staging.yml` can purge per-PR uploads on close |

Never read `process.env.*` directly from app code — import `env` from `server/src/config/env.ts`.

---

## Troubleshooting

- **`port is already allocated`** — something else on the host is using `5432`, `3000`, or `5173`. Stop that process (commonly a local Postgres or a previous `pnpm dev` you forgot to `pnpm dev:down`), or edit the port mapping in `docker-compose.yml`.
- **`Prisma Client did not initialize`** — the generated client inside the image is stale. Run `pnpm dev:rebuild` so the `api` image regenerates it against the current `schema.prisma`.
- **Don't run Prisma/pnpm on the host** — always use `pnpm migrate`, `pnpm seed`, and the `pnpm dev*` wrappers. They shell into the `api` container so the generated client matches the container's Node and OpenSSL. Running `prisma generate` directly on Windows will produce a binary target that doesn't work inside Alpine.
- **Frontend edits don't hot-reload** — Vite's watcher is configured to poll the filesystem (`server.watch.usePolling` in `client/vite.config.ts`). This is required on Windows and macOS because host filesystem events do not propagate through Docker bind mounts on those OSes; without polling, Vite never notices your saves. If you change that config and lose HMR, flip polling back on.
- **Seed fails with `relation does not exist`** — you skipped `pnpm migrate`. Run it first, then `pnpm seed`.
- **Windows line endings** — if Docker builds fail with odd shell errors after a fresh clone, confirm `git config core.autocrlf false` so Dockerfiles and scripts keep LF endings.
- **Reset the database** — `pnpm dev:down` then `docker volume rm quarzo-design-studio_db_data` (Compose may prefix the name — check with `docker volume ls`). Next `pnpm dev` starts with an empty database; rerun migrate + seed.

---

## Where to read next

- [`CLAUDE.md`](CLAUDE.md) — architecture conventions, auth model, data-model invariants, coding rules.
- [`docs/tech-roadmap.md`](docs/tech-roadmap.md) — full scope, phased plan, and locked product decisions (source of truth for "why is it this way").
- [`docs/client/discovery-with-client.md`](docs/client/discovery-with-client.md) — raw client discovery notes.
- [`.env.example`](.env.example) — canonical template for local `.env`..