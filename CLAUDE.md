# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

Quarzo Design Studio is a custom-stationery e-commerce store (Saltillo, Coahuila; Spanish copy, MXN payments) built for the owner's wife as a real client. It doubles as a practice run for a future software company, so the stack choices (build-your-own auth, Prisma, Docker from day one) are deliberately pedagogical — do not replace them with hosted equivalents (Auth0/Clerk/Firebase Auth are explicitly out).

The full scope, data model rationale, phased plan, and locked product decisions live in `docs/tech-roadmap.md`. Read it before making non-trivial changes — it's the source of truth for "why is it this way." `docs/client/discovery-with-client.md` has the raw client discovery notes.

As of the current commit the repo is at the end of **Phase 1 (scaffold)**: Docker Compose stack, Prisma schema + seed, Express health endpoint, and a placeholder Vite/React page. No routes, controllers, services, middleware, or frontend pages have been implemented yet — those directories are scaffolded but empty.

## Common commands

All dev commands run through Docker Compose from the repo root. Do not run `pnpm install` or `pnpm dev` on the host — deps live inside the container volumes.

```bash
pnpm dev           # docker compose up — starts db + api + web
pnpm dev:rebuild   # rebuild images (run after changing Dockerfiles or root deps)
pnpm dev:down      # stop the stack
pnpm migrate       # prisma migrate dev inside the api container
pnpm seed          # run src/seed.ts (admin user + sample products); requires stack to be up
```

Workspace-scoped commands (run inside or outside the container):

```bash
pnpm --filter server <script>   # e.g. build, prisma:generate
pnpm --filter client <script>   # e.g. build, preview
```

Ports: `api` on `3000`, `web` (Vite) on `5173`, Postgres on `5432`. The Vite dev server proxies `/api/*` → `http://api:3000` via the Compose network (`client/vite.config.ts`), so the frontend calls same-origin `/api/...` in dev.

There is no test runner, linter, or formatter wired up yet. If you add one, add the command here.

## Environment

Copy `.env.example` → `.env` at the repo root. `docker-compose.yml` reads it and forwards a subset into the `api` container. `server/src/config/env.ts` validates with Zod and exits the process on invalid env — always update that schema when adding a new variable. Never read `process.env.*` directly from app code; import `env` from `config/env.ts`.

The admin user is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (see `server/src/seed.ts` — lives in `src/` not `prisma/` so the single tsconfig covers it; `package.json`'s `prisma.seed` field points `tsx` at the right path). There is intentionally no public admin-registration endpoint.

## CI

A single GitHub Actions workflow at `.github/workflows/ci.yml` runs on every PR and every push to `main`. It installs deps with pnpm, runs `prisma generate`, typechecks both packages with `tsc --noEmit`, builds both, and uploads the client `dist/` artifact on PRs.

Node version is pinned to `22` in the `.node-version` file at the repo root, which CI reads via `node-version-file: .node-version`. The runtime contract is `engines.node: ">=22"` in root `package.json` — if you bump one, bump the other.

## Architecture

### Monorepo layout

pnpm workspaces with two packages: `server/` (Express + Prisma) and `client/` (Vite + React + Tailwind). `tsconfig.base.json` holds shared strictness settings (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`). Node 22, TypeScript 5.6, ESM throughout (`"type": "module"`).

### Server

Target shape (from `docs/tech-roadmap.md` §6 — dirs scaffolded, mostly empty):

```
server/src/
  routes/       REST endpoints
  controllers/  request handlers
  services/     business logic (orders, payments, email)
  middleware/   auth, requireAdmin, errorHandler, validator
  db/           Prisma client singleton (prisma.ts)
  config/       env loader (env.ts)
  lib/          MercadoPago wrapper, mailer
  index.ts      app bootstrap
```

`server/src/index.ts` is the entrypoint; `helmet`, `cors` (with `credentials: true` against `CLIENT_ORIGIN`), `cookie-parser`, and `express.json({ limit: "1mb" })` are already wired. Currently exposes only `GET /health`.

Import Prisma via `import { prisma } from "../db/prisma.js"` (note the `.js` extension — required for NodeNext ESM resolution even though the source is `.ts`).

### Auth model (to be built — non-negotiable)

Two separate principals sharing one cookie mechanism:

- **Customer auth**: `Customer` table, optional (`passwordHash` is nullable — guests allowed). Endpoints `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`. Registration must never be required to complete a purchase.
- **Admin auth**: `AdminUser` table, single seeded user, separate `/admin/login`. Gate all `/api/admin/*` with a `requireAdmin` middleware that checks the JWT's `role` claim.

Both use **JWT in an HTTP-only cookie** (not `localStorage` — XSS hardening) and `bcrypt` cost 12. See roadmap §4 for the full three-path checkout flow (guest → optional post-purchase account → returning login).

### Data model invariants (`server/prisma/schema.prisma`)

- `Order.customerId` is nullable to support pure guest orders.
- `Order.publicToken` is an unguessable URL slug — it's how a guest views their order without logging in. Generate with CSPRNG; never expose `Order.id` externally.
- `OrderItem` **snapshots** `productName`, `variantName`, and `unitPrice` at purchase time so past orders stay correct when the catalog changes. Do not lazily join back to `Product` for historical display.
- `OrderItem.personalizationText` is required and carries the customer-supplied text (name/message). Two orders of the same SKU are not interchangeable — this field is load-bearing for fulfillment.
- Inventory decrements on the transition to `OrderStatus.PAGADO`, not on order creation (bank-transfer orders sit in `PENDIENTE` until the admin confirms payment manually).
- All money is `Decimal(10,2)`. Construct with `new Prisma.Decimal(...)`, never with `Number`.

### Payments

Two paths, both produce an `Order` row:

- **MercadoPago**: server creates a preference → client redirects or uses `@mercadopago/sdk-react` → a webhook endpoint verifies the signature and transitions the order to `PAGADO`. Persist `mpPreferenceId` and `mpPaymentId` on the `Order` for reconciliation.
- **Bank transfer (TRANSFERENCIA)**: order is created `PENDIENTE`, customer sees bank details, admin manually confirms in the admin panel.

### Client

```
client/src/
  pages/        Home, Catalog, ProductDetail, Cart, Checkout,
                OrderConfirmation, OrderTracking, MiCuenta, Login, Admin/*
  components/   ProductCard, VariantSelector, PersonalizationInput, CartDrawer, …
  hooks/        useCart, useAuth, useProducts
  store/        zustand stores (cart, auth)
  services/     api/products.ts, api/orders.ts, api/auth.ts — fetch wrappers
  lib/          MXN/date formatters, zod schemas (ideally shared with server)
```

Stack: `react-router-dom`, `zustand`, `react-hook-form`, `zod`, Tailwind, native `fetch`. The cart lives in `localStorage` for guests and syncs to the DB when a customer logs in. Mobile-first — the primary traffic source is Instagram on phones.

Visual direction is clean/editorial (refs: sugarpaper.com, theatelier.com.mx). The client will deliver logo/palette/typography before Phase 2 visual polish — do not invent the brand identity.

All customer-facing copy is Spanish (Mexico). No i18n layer for v1.

## Conventions

- ESM only. When importing a local `.ts` file from another `.ts` file, write the import with the `.js` extension (`import { env } from "./config/env.js"`). TypeScript emits it; NodeNext resolution requires it.
- Validate every request body with Zod. Validate env with Zod at boot.
- Never store JWTs in `localStorage`. Never force registration before checkout. Never bypass the `requireAdmin` middleware for `/api/admin/*`.
- Don't run `prisma migrate` or `prisma generate` on the host — use `pnpm migrate` (which shells into the `api` container) so the generated client matches the container's Node/OpenSSL.
