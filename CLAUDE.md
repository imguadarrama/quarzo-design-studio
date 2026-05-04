# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

Quarzo Design Studio is a custom-stationery e-commerce store (Saltillo, Coahuila; Spanish copy, MXN payments) built for the owner's wife as a real client. It doubles as a practice run for a future software company, so the stack choices (build-your-own auth, Prisma, Docker from day one) are deliberately pedagogical — do not replace them with hosted equivalents (Auth0/Clerk/Firebase Auth are explicitly out).

The full scope, customer flows, phased plan, and locked product decisions live in `docs/tech-roadmap.md` (the PRD). Read it before making non-trivial changes — it's the source of truth for "what are we building and why." Data-model invariants, architecture, and code conventions live in this file. `docs/client/discovery-with-client.md` has the raw client discovery notes.

As of the current commit: **Phase 2 functional foundation is merged on `main`** — public `/api/products` + admin auth (JWT-in-HTTP-only-cookie), `authenticateAdmin` + `requireAdmin` middleware, admin product CRUD endpoints with nested variants + base64 images, and the parallel Phase 2 server cleanup (shared serializer, global error handler, image payload caps, 409 on duplicate slug, `passwordHash` response audit) per `docs/phase-2-execution-plan.md`. **Phase 2.5 is the active phase and pivoted in PR #15**: the original Tailwind frontend was demolished and a new SCSS-modules + design-token foundation was built in its place — three sibling layouts (`PublicLayout` / `AuthLayout` / `AdminLayout` — `PublicLayout` exists but is not yet wired into `App.tsx` until Slice 8), zustand admin auth store, `<RequireAdmin>` route guard, `AdminLoginPage` on `react-hook-form` + `zod`. Slices 0–6 have shipped: foundation (PR #15), `Typography` (commit `70b23af`), form primitives `Input` + `FormField` (PR #24), page-state helpers `PageLoading` / `PageError` / `PageEmpty` + shared `Spinner` (PR #25), the read-only admin product list at `/admin/productos` (PR #26), the admin product create form at `/admin/productos/nuevo` (PR #28), and admin product edit + delete at `/admin/productos/:id/editar` (PR #30). Slice 7 (images + variants editor) is next; the public catalog + product detail (Slices 8–9) and the cleanup/a11y pass (Slice 10) are still pending and will be built UX-first as one PR per slice per `docs/phase-2.5-execution-plan.md`. Phase 3 (cart + guest checkout) is blocked on Phase 2.5 and has not started.

## Common commands

All dev commands run through Docker Compose from the repo root. Do not run `pnpm install` or `pnpm dev` on the host — deps live inside the container volumes.

```bash
pnpm dev           # docker compose up — starts db + api + web
pnpm dev:rebuild   # rebuild images (run after changing Dockerfiles or root deps)
pnpm dev:down      # stop the stack
pnpm migrate       # prisma migrate dev inside the api container
pnpm seed          # run src/seed.ts (admin user + sample products); requires stack to be up
```

Pre-push preflight (run before `git push` to catch bugs locally that CI would otherwise catch on the PR):

```bash
pnpm preflight         # fast (~30s): prisma generate + tsc both + build both
pnpm preflight:image   # slower (~3–5 min): docker build runtime image + smoke the Prisma client loads
pnpm preflight:full    # both of the above in sequence
```

Run `pnpm preflight:image` (or `:full`) when you change `server/Dockerfile`, `server/prisma/**`, `server/package.json`, or any deploy-affecting root file — that's when runtime-only Docker bugs sneak in.

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

## CI / deploy workflows

Four workflows under `.github/workflows/`:

- `ci.yml` — **`push: main` only** (not on PRs). Post-merge tripwire: delegates to the shared `build-and-check` composite action, so post-merge runs the same install → build server → build client → docker-smoke pipeline the deploy workflows run. Skips pushes that only touch `**/*.md`, `docs/**`, `.gitignore`, `LICENSE`, `.editorconfig`, `.gitattributes` via `paths-ignore`. PR coverage comes from `deploy-staging.yml` invoking the same composite — no duplicated install/tsc/build work.
- `deploy-staging.yml` — PR-triggered (with `paths-ignore` for `**/*.md`, `docs/**`, `.gitignore`, `LICENSE`, `.editorconfig`, `.gitattributes`). Review-app pattern: every PR gets its own complete stack — Neon DB branch, **Fly app** `${FLY_APP_STAGING}-pr-<N>` (created idempotently on first deploy), and Cloudflare Pages preview. Runs `build-and-check`, deploys API to the per-PR Fly app, client to Cloudflare Pages, then upserts a single sticky PR comment (`marocchino/sticky-pull-request-comment@v2`, header `staging-preview`) linking the stable per-PR Pages alias `pr-<N>.<project>.pages.dev` and the per-PR API. The same comment is updated on every push — no stacking.
- `deploy-production.yml` — `workflow_dispatch` only. Requires typing `ship` to confirm. Runs `build-and-check` **before** `prisma migrate deploy`, `flyctl deploy`, and the Cloudflare upload — so prod state is never mutated unless every gate has passed.
- `cleanup-staging.yml` — on PR close, deletes the per-PR Neon branch, destroys the per-PR Fly app (`flyctl apps destroy ${FLY_APP_STAGING}-pr-<N>`), and deletes every Cloudflare Pages preview deployment for branch `pr-<N>` via the CF API (`DELETE /pages/projects/.../deployments/{id}?force=true`, reusing the existing `Pages: Edit` token). All three steps are `continue-on-error: true` so a PR that closed without ever deploying doesn't fail cleanup.

Shared pre-deploy gate: `.github/actions/build-and-check/action.yml`. Both deploy workflows and `ci.yml` invoke it so staging, prod, and post-merge main run the exact same pipeline (install → build server → build client → `docker build --target runtime` + Prisma-client smoke test). `pnpm install` runs `postinstall: prisma generate` automatically, and the `build` scripts (`tsc` for server, `tsc -b && vite build` for client) run the TypeScript compiler — so explicit `prisma generate` / `tsc --noEmit` steps would be duplicate work. Changing the pre-deploy gates = edit one file, all three workflows pick it up. The smoke step specifically catches runtime-only Dockerfile bugs (e.g. missing generated Prisma client in the image) that typechecks can't see.

Belt-and-suspenders at the Fly layer: `fly.toml` and `fly.staging.toml` both set `[deploy] release_command = "node scripts/smoke-prisma.mjs"`. Fly runs this in an ephemeral machine before rolling out serving machines; a non-zero exit aborts the deploy, so even a hand-run `flyctl deploy` can't push a broken image.

Node version is pinned to `22` in the `.node-version` file at the repo root, read via `node-version-file: .node-version`. The runtime contract is `engines.node: ">=22"` in root `package.json` — if you bump one, bump the other.

Operator runbooks: `docs/CI-CD/deploy-setup.md` (full reference) and `docs/CI-CD/deploy-quickstart.md` (plain-language operator checklist).

## Architecture

### Monorepo layout

pnpm workspaces with two packages: `server/` (Express + Prisma) and `client/` (Vite + React + SCSS modules via `sass-embedded`). `tsconfig.base.json` holds shared strictness settings (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`). Node 22, TypeScript 5.6, ESM throughout (`"type": "module"`).

### Server

Current layout (folders land when their first occupant does):

```
server/src/
  auth/         JWT sign/verify, cookie helpers, shared auth types
  config/       env loader (env.ts)
  db/           Prisma client singleton (prisma.ts)
  middleware/   authenticateAdmin, requireAdmin
  routes/       REST endpoints (health, products, admin-auth, admin-products)
  types/        Express augmentations (e.g. req.auth shape)
  index.ts      app bootstrap
  seed.ts       admin user + sample products seed
```

Planned (added when their first consumer lands): `controllers/` (if routes grow thick enough to justify splitting), `services/` (orders, payments, email — Phase 3+), `lib/` (MercadoPago wrapper, Resend mailer — Phase 4).

`server/src/index.ts` is the entrypoint; `helmet`, `cors` (predicate function — exact match on `env.CLIENT_ORIGIN` plus optional `env.CLIENT_ORIGIN_PREVIEW_PATTERN` regex for Cloudflare Pages previews, `credentials: true`), `cookie-parser`, and `express.json({ limit: "1mb" })` are already wired. Routes currently mounted under `/api` and `/api/admin`: `healthRouter` (`GET /api/health`), `productsRouter` (public `/api/products`, `/api/products/:slug`), `adminAuthRouter` (`/api/admin/auth/{login,logout,me}`), `adminProductsRouter` (`/api/admin/products*`, gated by `authenticateAdmin` + `requireAdmin`). Future routes follow the same pattern.

Import Prisma via `import { prisma } from "../db/prisma.js"` (note the `.js` extension — required for NodeNext ESM resolution even though the source is `.ts`).

### Auth model

**Status:** admin path is implemented (`server/src/routes/admin-auth.ts`, `server/src/auth/*`, `server/src/middleware/{authenticateAdmin,requireAdmin}.ts`). Customer path is Phase 5 — not implemented yet.

Two separate principals sharing one cookie mechanism:

- **Customer auth** *(Phase 5 — pending)*: `Customer` table, optional (`passwordHash` is nullable — guests allowed). Endpoints `POST /api/auth/{register,login,logout}`, `GET /api/auth/me`. Registration must never be required to complete a purchase.
- **Admin auth** *(implemented)*: `AdminUser` table, single seeded user, separate `/admin/login`. All `/api/admin/*` routes mount `authenticateAdmin` + `requireAdmin` which check the JWT's `role` claim.

Both use **JWT in an HTTP-only cookie** (not `localStorage` — XSS hardening) and `bcrypt` cost 12. See `docs/tech-roadmap.md` §8 for the full three-path checkout flow (guest → optional post-purchase account → returning login).

### Data model invariants (`server/prisma/schema.prisma`)

- `Order.customerId` is nullable to support pure guest orders.
- `Order.publicToken` is an unguessable URL slug — it's how a guest views their order without logging in. Generate with CSPRNG; never expose `Order.id` externally.
- `OrderItem` **snapshots** `productName`, `variantName`, and `unitPrice` at purchase time so past orders stay correct when the catalog changes. Do not lazily join back to `Product` for historical display.
- `OrderItem.personalizationText` is required and carries the customer-supplied text (name/message). Two orders of the same SKU are not interchangeable — this field is load-bearing for fulfillment.
- `OrderItem.selections` (Json) snapshots the customer's per-option choices at purchase time (e.g. `{ "Color del foil": "Dorado", "Texto": "Sofía 15 años" }`). `personalizationText` stays as a denormalized convenience field so admin printouts don't have to JSON-dive.
- No inventory tracking. Products are always available; `ProductVariant` has no `stock` column.
- Pricing lives on `ProductVariant.price` (Decimal). `Product` has no price column. A product surfaces multiple priced configurations (e.g. *con foil $250* / *con tinta normal $200*); the catalog computes a "desde $X" headline from the variants.
- `ProductVariantOption` carries the customer-facing configurators on a variant. `type: SELECT` requires `values: Json` (e.g. foil color list); `type: TEXT` is free-text input (e.g. the personalization message). Options are per-variant — *con foil* exposes color + texto; *con tinta normal* exposes only texto.
- All money is `Decimal(10,2)`. Construct with `new Prisma.Decimal(...)`, never with `Number`.

### Payments

Two paths, both produce an `Order` row:

- **MercadoPago**: server creates a preference → client redirects or uses `@mercadopago/sdk-react` → a webhook endpoint verifies the signature and transitions the order to `PAGADO`. Persist `mpPreferenceId` and `mpPaymentId` on the `Order` for reconciliation.
- **Bank transfer (TRANSFERENCIA)**: order is created `PENDIENTE`, customer sees bank details, admin manually confirms in the admin panel.

### Client

Current layout (folders / files land when their first occupant does — many are stubs awaiting their Phase 2.5 slice):

```
client/src/
  App.tsx                    BrowserRouter + composed route groups (currently adminRoutes + 404)
                             (PublicLayout defined but unwired until Slice 8)
  index.scss                 global reset; reads CSS custom properties
  styles/
    _tokens.scss             SCSS vars + semantic aliases + :root custom properties
    _mixins.scss             focus-ring, screen-md/lg/below-md, flex-center, sticky-header, form-error-banner
  layouts/
    PublicLayout.tsx         public navbar + Outlet (Slice 8/9 will mount routes under it)
    AuthLayout.tsx           bare centered shell (login)
    AdminLayout.tsx          admin navbar + Outlet, internally wraps in RequireAdmin
  routes/
    adminRoutes.tsx          AuthLayout (/admin/login) + AdminLayout (/admin/productos*) + /admin redirect
  components/
    Button/  Card/  FormField/  FullPageSpinner/  Input/  NavBarAdmin/  NavBarPublic/
    PageState/  Spinner/  Textarea/  Typography/
    RequireAdmin.tsx
    (Slice 8 → ProductCard/; Slice 9 → VariantSelector/, PersonalizationInput/)
  pages/
    NotFoundPage/
    admin/AdminLoginPage/      react-hook-form + zod
    admin/AdminProductsPage/   list with two-click delete (Slices 4 + 6) — fetch + table/cards via PageState
    admin/AdminProductForm/    create + edit form (Slices 5–6) — AdminProductFormPage.tsx, schema.ts, mappers.ts
    (Slice 8 → CatalogPage/; Slice 9 → ProductDetailPage/)
  store/
    adminAuth.ts             zustand: admin / status / hydrate / login / logout
  services/
    api/{client.ts, fetchJson.ts, admin.ts, products.ts}
  hooks/
    useFormSubmit.ts         wraps async submit handlers with submitError state
  lib/
    types.ts                 mirrors server response shapes
```

**Path alias.** Client cross-folder imports use the `@/` alias (e.g. `import { Button } from "@/components/Button/Button"`); same-folder imports stay relative (`./schema.js`, `./mappers.js`). Wired in `client/tsconfig.json` (`paths`) and `client/vite.config.ts` (`resolve.alias`). Server has no alias — keep using `../db/prisma.js`-style relative imports there (NodeNext resolution + `tsc` emit, no bundler in the loop).

**Component file convention.** One folder per component, `<Name>.tsx` + `<Name>.module.scss` co-located (e.g. `Button/Button.tsx` + `Button/Button.module.scss`). The named export matches the folder. Plain `.tsx` files at the top of `components/` (e.g. `RequireAdmin.tsx`) are reserved for components with no styles of their own.

**Styling.** SCSS modules only — no global utility classes, no Tailwind, no `clsx`. Tokens live in `styles/_tokens.scss`. Components import `_tokens.scss` via `@use "../../styles/tokens" as t;` (or `mixins`) and reference values as `t.$color-accent`. The same semantic tokens are re-emitted as CSS custom properties on `:root` so runtime consumers (media queries, future theme switching, JS-set overrides) can read them as `var(--color-accent)`.

**Stack.** `react-router-dom`, `zustand`, `react-hook-form`, `@hookform/resolvers/zod`, `zod`, native `fetch`. The cart will live in `localStorage` for guests and sync to the DB when a customer logs in (Phase 3+). Mobile-first — primary traffic is Instagram on phones.

**Brand assets.** Brand palette (cream-light bg, cream surface, pink accent, mint/sage/lavender, grey muted) is in `_tokens.scss`. Typography is Lora (primary, serif) + Quicksand (secondary, sans), loaded via Google Fonts in `index.html`. References: sugarpaper.com, theatelier.com.mx.

All customer-facing copy is Spanish (Mexico). No i18n layer for v1.

## Conventions

- ESM only. When importing a local `.ts` file from another `.ts` file, write the import with the `.js` extension (`import { env } from "./config/env.js"`). TypeScript emits it; NodeNext resolution requires it.
- Validate every request body with Zod. Validate env with Zod at boot.
- Never store JWTs in `localStorage`. Never force registration before checkout. Never bypass the `requireAdmin` middleware for `/api/admin/*`.
- Don't run `prisma migrate` or `prisma generate` on the host — use `pnpm migrate` (which shells into the `api` container) so the generated client matches the container's Node/OpenSSL.

## Code style and architecture

These rules are enforceable in code review. Cite them by name when pushing back on a PR.

**Principles.** SOLID / KISS / DRY. Default to one-shape-one-place. Bias toward extraction on the *second* duplicate, not the first — if a pattern only exists once, leaving it inline is correct. Three near-identical lines side-by-side are better than a premature abstraction that has to bend to fit each caller.

**Comments.** Only when the *why* is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug. Don't explain *what* the code does (well-named identifiers do that). Don't write reference-comments like "used by X" or "added for Y flow" — that belongs in the PR description and rots fast. No multi-paragraph docstrings.

**Client — when to extract a hook.** Extract when at least two consumers want the same `useState` + `useEffect` shape, or the same async-submit-with-error pattern. Hooks live under `client/src/hooks/`. Examples: `useFormSubmit` (form submit + submitError state) wraps the try/catch each form page would otherwise repeat. Don't pre-extract for one consumer — wait for the second use.

**Client — service layer.** All HTTP goes through `services/api/fetchJson.ts` (which wraps `apiFetch` for the cookie + base URL). `fetchJson<T>` throws `ApiError` (with `status` and `code`) on non-ok responses; consumers check `err instanceof ApiError && err.code === "..."` for structured branches (slug conflict, etc). Endpoint files (`admin.ts`, `products.ts`) should be one-line wrappers around `fetchJson`. No raw `fetch(...)` calls in pages or hooks.

**Client — types.** Server response shapes live in `lib/types.ts`. Don't redeclare them in pages or services. Form schemas (zod) live next to the form (`pages/.../schema.ts`) since they're form-specific.

**SCSS rules.**

- One module per component, co-located with the `.tsx`.
- **Class names are semantic and describe the file's role.** If two files want a generic name like `.title`, ask whether they mean the same thing. If yes, leave it (consistent use is fine even though scoped). If no, give one a more specific name (e.g. `.errorCode` for the giant 404, not `.title`).
- **Max 2 levels of nesting.** Deeper selectors fight CSS-module scoping when you're debugging in dev tools. The one principled exception is HTML `<table>` — `tbody td` style selectors are unavoidable for table semantics, so allow the structural depth a table requires.
- **No raw values in components** — colors, font sizes, spacing, shadows, breakpoints. Always reference `t.$...` tokens or `m.@include ...` mixins. If a value isn't tokenized yet, add it to `_tokens.scss` first.
- **No tag selectors** (`button`, `input`, `a`) inside modules — use a class. Tag selectors leak intent and make grep harder.
- Repeated style combos go in `_mixins.scss` once they have a second consumer (`flex-center`, `sticky-header`, `form-error-banner`, `focus-ring`).

**Server — route shape.** Route files do: parse → call helper → serialize → respond. They don't define schemas inline or build Prisma input shapes — those live in `server/src/lib/`:

- `lib/validation-schemas.ts` — zod schemas (`productSchema`, `imageUrlSchema`, etc.)
- `lib/<resource>-write.ts` — Prisma write builders (`buildProductWriteInput`, `buildVariantsCreate`)
- `lib/serializers.ts` — response serializers (already exists)
- `lib/errors.ts` — typed error classes (`NotFoundError`)

**Server — error handling.** `throw new NotFoundError("...")` instead of `res.status(404).json(...)`. The global error handler at `middleware/errorHandler.ts` maps typed errors and Prisma `P2002` (returns `code: "SLUG_CONFLICT"`) to consistent JSON envelopes. Error responses always include a stable `code` field clients can branch on.

**Forbidden.**

- No `localStorage` for JWTs (XSS surface).
- No bypassing `requireAdmin` on `/api/admin/*`.
- No `any` to silence types — narrow with zod or a type guard.
- No backwards-compat shims for code we control. If you change a shape, change every caller.

## Model / agent ladder (Claude Max cost discipline)

Project-level `.claude/settings.json` pins the main loop to **Sonnet** so routine work doesn't burn the weekly Opus cap. Use `/model opus` explicitly for hard sessions (architecture, security review, tricky multi-file refactors), then `/model default` to drop back.

Subagent defaults (see `.claude/agents/`):

- **Explore → Haiku** — open-ended codebase lookups. Spawn freely.
- **general-purpose → Sonnet** — multi-step research and coding across files.
- **Plan → Opus** — only when architectural trade-offs are actually in play.

Prefer `Grep` / `Glob` / `Read` directly when the target file is known — don't spawn `Explore` for a file you can name. Skills under `.claude/skills/*` inherit the main model, so don't invoke `audit-docs` while the main model is on Opus unless you need Opus-level reasoning.
