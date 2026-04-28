# Phase 2 Execution Plan — Server Cleanup

> **Purpose:** step-by-step playbook for the remaining Phase 2 *server-side* cleanup. The Phase 2 functional foundation merged via PR #8 on 2026-04-24 (catalog routes, admin CRUD, admin auth, staging CORS + cross-site cookie fix). What's left here is server-only: shared serializer, global error handler, image payload caps, duplicate-slug 409, `passwordHash`-in-response audit. Client work is owned by [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md) — see §0.5.
>
> **Mindset:** cleanup, not rebuild. Resist the urge to start over.

---

## 0. How to use this doc

- Work top to bottom. Do not skip §2 (baseline) — it proves the stack is healthy before you change anything.
- **Postman setup** (do once):
  - Create a collection `Quarzo dev`.
  - Collection variables: `baseUrl=http://localhost:3000/api`, `adminEmail` and `adminPassword` (values from your `.env`).
  - Settings → General → **Automatically save cookies** ON. Settings → Cookies → make sure `localhost` appears after you log in.
  - All requests below use `{{baseUrl}}` and rely on cookies being auto-sent.
- Every task here is `- [ ]`. Tick them.
- File paths are from repo root. `server/src/routes/admin-auth.ts:18` means "file, line 18".

---

## 0.5. Scope split — server here, client in Phase 2.5

PR #15 (merged 2026-04-27) demolished the original Tailwind-shaped client surface (`CatalogPage`, `ProductDetailPage`, `AdminLoginPage`, `AdminProductsPage`, `VariantSelector`, `PersonalizationInput`) and rebuilt the foundation in SCSS modules + design tokens, with three sibling layouts, a zustand admin auth store (`store/adminAuth.ts`), and a `<RequireAdmin>` route guard. The earlier "Phase 2 client cleanup" track (zustand auth store, `useAuth` hook, `RequireAdmin`, `AdminLoginPage`/`AdminProductsPage` refactor, `index.css` font-family fix) and the abandoned shadcn/Tailwind UI track are both superseded — they shipped (in a different shape) or were dropped as part of PR #15.

All remaining client work — admin product CRUD UI, public catalog, public product detail, accessibility — lives in [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md) and is delivered one PR per slice.

This doc is now scoped to **server cleanup only**, on a single branch:

| Branch | Owns | Plan sections |
|--------|------|---------------|
| `refactor/phase2-server-cleanup` | Shared product serializer, global error handler, image payload caps, duplicate-slug 409, `passwordHash`-in-response audit | §3.7, §4.1–4.5 |

`refactor/phase2-server-cleanup` runs in parallel with whichever Phase 2.5 slice is active — the file surfaces are disjoint, so there are no conflicts.

§5 is the **server-cleanup completion gate** — run it after every box in §3.7 and §4 is ticked.

---

## 1. Audit — what's actually built right now

### 1.1 Working (do NOT rewrite — just verify in §2)

| Area | Location |
|------|----------|
| Admin login / logout / me | `server/src/routes/admin-auth.ts` |
| JWT sign + verify | `server/src/auth/jwt.ts` |
| Cookie helpers (httpOnly, SameSite, Secure in prod) | `server/src/auth/cookies.ts:15-25` |
| `authenticateAdmin` + `requireAdmin` middleware | `server/src/middleware/` |
| Admin product CRUD (nested variants + images) | `server/src/routes/admin-products.ts` |
| Public catalog + detail | `server/src/routes/products.ts` |
| Health check | `server/src/routes/health.ts` |
| Zod validation on every request body | every route file |
| Env validation (JWT_SECRET ≥ 16, cookie names, TTL, admin creds) | `server/src/config/env.ts` |
| Seed (admin user + 4 products × 2 variants) | `server/src/seed.ts` |

> Client UI is intentionally stubbed post-PR-#15. Phase 2.5 rebuilds it slice by slice — do not edit `client/**` from this branch.

### 1.2 The "mess" (cleanup targets handled in §4)

1. **Duplicate serializer** — `serializeProduct` is defined in both `server/src/routes/admin-products.ts` and `server/src/routes/products.ts`.
2. **Image payloads unbounded** — the admin CRUD accepts `data:image/...` URLs with no size or count cap. One big photo pasted in → a huge JSON row.
3. **No global error handler** — each route has its own try/catch. Unique-constraint violations (duplicate slug) bubble up as generic 500s instead of 409.

### 1.3 Out of scope for this branch (confirmed — do not build)

- Customer auth (Phase 5).
- Cart + checkout (Phase 3).
- MercadoPago / Resend (Phase 4).
- Moving images off data URLs to cloud storage. Keep data URLs; add caps in §4.4.
- Anything client-side. Phase 2.5 owns all client work — see [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md).

---

## 2. Baseline verification — prove the stack works before changing anything

### 2.1 Boot the stack

- [x] From repo root: `pnpm dev`. Wait for `api | listening on :3000` and `web | Local:   http://localhost:5173/`.
- [x] In a second terminal: `pnpm seed`. You should see the admin email and 4 product names printed.

### 2.2 Health check

```
GET {{baseUrl}}/health

→ 200 OK
{ "ok": true }
```

- [x] Works.

### 2.3 Admin login (captures the cookie)

```
POST {{baseUrl}}/admin/auth/login
Content-Type: application/json

{ "email": "{{adminEmail}}", "password": "{{adminPassword}}" }

→ 200 OK
Set-Cookie: quarzo_admin_session=eyJ...; HttpOnly; SameSite=Lax; Path=/
{ "admin": { "id": "c...", "email": "admin@quarzo.local" } }
```

- [x] 200. Open Postman Settings → Cookies → `localhost` and confirm `quarzo_admin_session` is stored. If not, your cookie jar is off.

### 2.4 Session check

```
GET {{baseUrl}}/admin/auth/me

→ 200 OK
{ "admin": { "id": "...", "email": "..." } }
```

- [x] 200.

### 2.5 Public catalog

```
GET {{baseUrl}}/products

→ 200 OK
{ "products": [ { "slug":"sobres-clasicos", "basePrice":"180.00", "startingPrice":"180.00", "variants":[...], "images":[...] }, ... ] }
```

- [x] 200. Four products returned.

### 2.6 Public product detail

```
GET {{baseUrl}}/products/sobres-clasicos

→ 200 OK
{ "product": { "slug":"sobres-clasicos", "variants":[...], "images":[...] } }
```

- [x] 200.

### 2.7 Admin logout

```
POST {{baseUrl}}/admin/auth/logout

→ 200 OK
Set-Cookie: quarzo_admin_session=; Max-Age=0
```

- [x] 200. Cookie gone from Postman's jar.

**If everything above is green, continue. If any step fails, see §6 before touching code.**

---

## 3. Security hardening — verify (don't rewrite)

Each item is a property to **prove** with Postman or a quick file read. The code already implements most of this; you're confirming it, not rebuilding it.

### 3.1 Secrets & hashing

- [x] Open `.env`: `JWT_SECRET` is ≥ 16 chars, looks random, is *not* the placeholder from `.env.example`. *Short/predictable secrets are brute-forceable. The env schema in `server/src/config/env.ts:9` rejects < 16 at boot.*
- [x] `server/src/seed.ts` → bcrypt cost = 12. *~250 ms per verify: slow enough to hurt brute-forcers, fast enough for interactive login.*
- [x] `.env` → `ADMIN_PASSWORD` ≥ 8 chars. *Enforced by `env.ts:16`.*
- [x] `.env` is in `.gitignore`; `.env.example` contains only placeholders. *Never commit real secrets.*


> **Resolved — `APP_ENV` is not a GitHub secret.** It's hardcoded as a string literal in each deploy workflow: `deploy-staging.yml:78` sets `APP_ENV="staging"` and `deploy-production.yml:69` sets `APP_ENV="production"`. `docker-compose.yml:30` sets `APP_ENV: development` for local. There is nothing to store under `${{ secrets.APP_ENV }}` — neither staging nor prod reads from one. Your staging failure is caused by a *different* missing/invalid secret (likely one of `FLY_API_TOKEN`, `FLY_APP_STAGING`, `JWT_SECRET_STAGING`, `ADMIN_EMAIL_STAGING`, `ADMIN_PASSWORD_STAGING`, `CLIENT_ORIGIN_STAGING`, `CLOUDFLARE_*`, or `NEON_*`). Diagnostic path: open the failed `deploy-staging` run on the Actions tab → read the red step's log → cross-check secret names against the list in `docs/CI-CD/deploy-setup.md`.

### 3.2 Cookie flags

Read `server/src/auth/cookies.ts:16-28`. Confirm:

- [x] `httpOnly: true`. *Blocks JS from reading the cookie → XSS can't steal the token.*
- [x] `sameSite: isLocalDevelopment ? "lax" : "none"`. *Staging and prod are cross-site (`*.fly.dev` API and `*.pages.dev` client are on separate eTLD+1s per the Public Suffix List), so the browser only sends the cookie on XHR with `None`. Dev stays `Lax` because the Vite proxy keeps everything same-origin and `None` would require HTTPS. **Changed on 2026-04-24** — the previous `Lax` everywhere silently broke staging admin login.*
- [x] `secure: !isLocalDevelopment`. *HTTPS-only outside dev. `SameSite=None` is rejected by browsers without `Secure`, so these two flags must move together.*



### 3.3 No user enumeration

An attacker must not be able to learn which emails are admins by diffing error responses.

- [x] Postman: `POST /admin/auth/login` with `email="ghost@nope.com"` → 401.
- [x] Postman: `POST /admin/auth/login` with correct `adminEmail` and **wrong** password → 401.
- [x] The `error` field in both responses is **identical** (e.g. `"Credenciales inválidas"`). *Different messages leak which email exists.*

### 3.4 Token tampering / missing token

- [x] Postman: clear cookies. `GET /admin/auth/me` → 401.
- [x] Postman: manually set `Cookie: quarzo_admin_session=garbage.jwt.here` in the request headers. `GET /admin/auth/me` → 401.
- [x] Postman: clear cookies. `GET /admin/products` → 401. *Confirms `requireAdmin` is actually mounted on the admin product routes.*

### 3.5 No admin self-registration

> **Resolved — the absence is the design.** Repo-wide grep for `adminUser.create|AdminUser.create|adminUser.upsert` returns exactly one match: `prisma.adminUser.upsert` in `server/src/seed.ts:84`. No `.create` call exists anywhere, and `server/src/routes/admin-auth.ts` exposes only `/login`, `/logout`, `/me` — no register route. This is intentional (CLAUDE.md: *"There is intentionally no public admin-registration endpoint"*). A runtime admin-create endpoint would be a permanent backdoor; the only path is `pnpm seed` driven by `ADMIN_EMAIL` / `ADMIN_PASSWORD`, which the operator controls. `upsert` keeps seed idempotent.

- [x] In your editor, search the whole repo for `AdminUser.create` and `prisma.adminUser.create`. Only hit should be `server/src/seed.ts`. *A runtime admin-create endpoint is a permanent backdoor.*

- [x] There is no `POST /admin/auth/register` route. Confirm by scanning `server/src/routes/admin-auth.ts`.

### 3.6 Transport headers + CORS

Open `server/src/index.ts`:

- [x] `helmet()` is mounted **before** any routes. *Sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, etc.*
- [x] CORS `origin` is a **predicate function**, not a string or `"*"`. It allows three cases: (1) no `Origin` header (curl / server-to-server), (2) exact match on `env.CLIENT_ORIGIN`, (3) regex match on `env.CLIENT_ORIGIN_PREVIEW_PATTERN` (staging-only — prod leaves it unset, so prod is strict by omission). *Hotfixed on 2026-04-24 after Cloudflare Pages per-commit preview URLs were blocked. Empty string in the env normalizes to `undefined` at `config/env.ts` so an unset prod secret cannot silently open CORS.*

**Extension note.** If prod ever needs a second canonical origin (e.g. `quarzo.mx` + `www.quarzo.mx`), extend `CLIENT_ORIGIN` to accept comma-separated values and adjust the predicate. Do **not** widen the preview regex to cover prod — preview is a staging-only relaxation by design.

### 3.7 No passwords in responses

- [x] Grep `server/src/routes/` for `passwordHash`. No route should include it in a response body. *Never publish hashes, even bcrypt ones.* **Verified 2026-04-28** — only hit is `admin-auth.ts:37` (`bcrypt.compare(password, adminUser.passwordHash)`); used as input, never serialized.

---

## 4. Server cleanup (do in order) *(branch: `refactor/phase2-server-cleanup`)*

> **Scope expansion — 2026-04-28.** A product-model redesign landed on this branch alongside the cleanup. The real Quarzo product is a *package* (e.g. "10 sobres clásicos") sold in priced configurations — the wife's example: *con foil* $250 (with a foil-color picker) vs *con tinta normal* $200 (texto only). Both have a personalization text option. Schema changes:
>
> - **Dropped:** `ProductVariant.priceDelta`, `ProductVariant.stock`, `Product.basePrice`.
> - **Added:** `ProductVariant.price` (Decimal). Each variant carries its own price.
> - **Added:** `ProductVariantOption` table — `{ name, type: VariantOptionType (SELECT|TEXT), values: Json?, required, position }`. Per-variant configurators.
> - **Added:** `OrderItem.selections` (Json) — snapshots the customer's per-option choices at purchase. `personalizationText` stays for admin printouts.
>
> The serializer emits no `basePrice` and no `startingPrice`; the catalog computes "desde $X" from `variants[].price` client-side. The admin Zod accepts `variants[].price` and a nested `options` array. The seed re-models the four sample products around this shape. This is intentionally **not** byte-identical to the pre-cleanup baseline — the §5 byte-identical check is replaced with a "new shape matches the redesigned data model" check.

### 4.1 Extract shared product serializer

- [x] Create `server/src/lib/serializers.ts`. **Two exports** — `serializeProductPublic` and `serializeProductAdmin` — because the admin payload still needs `active`, `createdAt`, image `position`, and option `required`/`position` that the public catalog must not leak. Shared helpers (`sortByPosition`, `optionValues`, per-variant/option formatters) keep the duplication minimal.
- [x] Co-locate the Prisma `include` in the same module: `export const productInclude = { images: true, variants: { include: { options: true } } } satisfies Prisma.ProductInclude;` and derive `export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;`. Both routes import `productInclude` and pass query results straight into the serializers — no `as unknown as` casts.
- [x] Replace the inline `serializeProduct` in `routes/products.ts` and `routes/admin-products.ts` with `import { productInclude, serializeProductPublic } from "../lib/serializers.js"` (public) / `serializeProductAdmin` (admin) (note `.js` extension — NodeNext ESM requires it).
- [x] Re-run §2.5 and §2.6. Responses should match the new shape: variants are `{ id, name, sku, price, options }`, no `priceDelta`, no `stock`, no `startingPrice`. Public payload must not include `active`, `createdAt`, or image `position`; admin payload must.

### 4.2 Global error handler middleware

- [x] Create `server/src/middleware/errorHandler.ts`:
  ```ts
  import { ErrorRequestHandler } from "express";
  import { ZodError } from "zod";
  import { Prisma } from "@prisma/client";

  export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: "Datos inválidos", issues: err.issues });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return res.status(409).json({ error: "Ya existe un registro con ese valor único" });
      if (err.code === "P2025") return res.status(404).json({ error: "No encontrado" });
    }
    console.error("[errorHandler]", err);
    return res.status(500).json({ error: "Error interno" });
  };
  ```
- [x] In `server/src/index.ts`, mount this **after all route `app.use("/api/...", ...)` calls** (last middleware):
  ```ts
  app.use(errorHandler);
  ```
- [x] In `admin-products.ts` and `products.ts`, refactor the inline `try/catch` blocks. Replace every `catch (err) { res.status(500).json(...) }` with:
  ```ts
  } catch (err) { next(err); }
  ```
  Add `next: NextFunction` to handler signatures where needed. **Note:** Express 4 (per `server/package.json`) does not auto-forward async rejections, so every async handler in `admin-products.ts` and `products.ts` is wrapped in `try { ... } catch (err) { next(err) }`. Validation now uses `productSchema.parse(...)` (throws `ZodError` → 400 via the central handler) instead of `safeParse`.

### 4.3 Verify 409 on duplicate slug

```
(logged in)
POST {{baseUrl}}/admin/products
{ "slug": "sobres-clasicos", "name": "dup", "description": "x", "category": "sobres", "basePrice": "100.00", "active": true, "variants": [{ "name":"a","sku":"TEST-DUP","priceDelta":"0","stock":1 }], "images": [] }

→ 409 Conflict
{ "error": "Ya existe un registro con ese valor único" }
```

- [ ] 409, not 500.

### 4.4 Image payload caps

In the image sub-schema inside `server/src/routes/admin-products.ts`:

- [x] Cap array length: `z.array(imageSchema).max(8, "Máximo 8 imágenes por producto")`.
- [x] Add a refinement on the `url` field: if it starts with `data:image/`, reject when the decoded size exceeds ~500 KB.
  ```ts
  .refine((url) => {
    if (!url.startsWith("data:image/")) return true;
    const b64 = url.split(",", 2)[1] ?? "";
    const bytes = Math.floor(b64.length * 0.75);
    return bytes <= 500_000;
  }, "Imagen demasiado grande (máx 500 KB)");
  ```
- [ ] Postman: POST a product with 9 images → 400 with issues array.
- [ ] Postman: POST with a data URL that's > 500 KB → 400.

### 4.5 Admin CRUD smoke test end-to-end

Log in first, then:

- [ ] `POST /admin/products` with a valid body → 201 + body with new `id`.
- [ ] `GET /admin/products` → new product present.
- [ ] `PATCH /admin/products/{id}` changing `name` and adding a variant → 200.
- [ ] `DELETE /admin/products/{id}` → 200 (or 204).
- [ ] `GET /admin/products/{id}` → 404.

---

## 5. End-to-end verification — server-cleanup completion gate

Run this once every box in §3.7 and §4 is ticked.

- [ ] `pnpm dev:down && pnpm dev:rebuild`. Clean boot, no errors in any container log.
- [ ] `pnpm seed`.
- [ ] `pnpm preflight` green (server + client typecheck + build). The client still builds even though Phase 2.5 is in progress — its current shape is the post-PR-#15 stub set, and that must stay buildable.
- [ ] Run the Postman collection top-to-bottom (§2 + §3 + §4.3 + §4.5). All pass.
- [ ] Re-run §2.5 (`GET /products`) and §2.6 (`GET /products/sobres-clasicos`) — responses match the new post-cleanup shape: variants are `{ id, name, sku }`; no `priceDelta`, `stock`, or `startingPrice` anywhere. (Byte-identical to the pre-cleanup baseline is **intentionally** broken by the schema migration noted at the top of §4.)
- [ ] Confirm `docs/tech-roadmap.md` §10 Phase 2 checkboxes are still honest. (No edits expected — Phase 2 was already declared complete on `main`.)

Once every box in this §5 is ticked, **the Phase 2 server cleanup branch is done** and `refactor/phase2-server-cleanup` can merge. Phase 2.5 client work continues independently per [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md).

Phase 3 (cart + guest checkout) is unblocked when this branch lands AND Phase 2.5 reaches its own §12 exit criteria.

---

## 6. Debugging appendix — likely failure modes

### 6.1 "Login returns 200 but `/me` returns 401"

Your Postman cookie jar isn't actually saving. Fix:

- Settings → General → "Automatically save cookies" must be ON.
- Settings → Cookies → after login you should see a `localhost` entry with `quarzo_admin_session`. If not, toggle the domain on manually.
- Don't mix `http://localhost:3000` and `http://127.0.0.1:3000`. They are different cookie jars.

### 6.2 "Admin route returns 401 even after a fresh login" (browser, not Postman)

Usually a cookie-flag mismatch:

- `APP_ENV=production` in your local `.env` → `secure: true` → browser refuses to send the cookie over `http://`. Set `APP_ENV=development`.
- Cross-site flow (API on a different origin than the client) + `SameSite=Lax` → cookie dropped on POSTs. In dev, the Vite proxy keeps you same-origin, so this shouldn't happen. If you swapped that proxy out, re-add it.

### 6.3 "Prisma P1001: Can't reach database"

- `pnpm dev` hasn't fully started `db` yet. Watch `docker compose logs db` — wait for `database system is ready to accept connections`.
- `.env` has `DATABASE_URL=postgresql://...@localhost:5432/...`. Inside the `api` container, the hostname is `db`, not `localhost`. Should be `postgresql://quarzo:...@db:5432/quarzo?schema=public`.

### 6.4 "CORS error in the browser" (local dev)

- `CLIENT_ORIGIN` in `.env` doesn't match the URL you loaded (`5173` vs `3000`, `localhost` vs `127.0.0.1`).
- API not running → the "CORS error" is actually a connection refused. Check `docker compose ps`.

### 6.5 "CORS blocked on a Cloudflare Pages preview URL" (staging)

The allowlist in `server/src/index.ts` accepts `env.CLIENT_ORIGIN` (exact match) plus `env.CLIENT_ORIGIN_PREVIEW_PATTERN` (optional regex). If previews aren't matching:

- Secret `CLIENT_ORIGIN_PREVIEW_PATTERN_STAGING` is unset or misspelled in the GitHub `staging` environment. Expected value: `^https://[a-z0-9-]+\.quarzo-staging\.pages\.dev$`
- Anchors matter. Without `^` and `$` the regex accepts origins like `https://evil.example.com/?x=quarzo-staging.pages.dev`.
- Empty string (secret exists but value is empty) is safe — `config/env.ts` normalizes it to `undefined`, so CORS falls back to exact-match only on `CLIENT_ORIGIN`.
- Prod intentionally does *not* set this secret. If you see prod accepting preview-shaped origins, someone added it — remove it.

### 6.6 "Admin login works but `/me` 401s" (staging / prod, browser)

Cross-site cookie policy. Verify `Set-Cookie` on the login response includes `SameSite=None; Secure; HttpOnly`. If it shows `SameSite=Lax`, the `APP_ENV` on Fly is `development` (shouldn't be) or the cookie helper was reverted. See `server/src/auth/cookies.ts:21`.

---

*This plan covers the Phase 2 server cleanup branch. Client work after the SCSS pivot is in [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md). When every checkbox in §§2–5 is ticked, the server cleanup is complete and ready to merge.*
