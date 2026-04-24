# Phase 2 Execution Plan — Catalog + Admin CRUD

> **Purpose:** step-by-step playbook to finish Phase 2 cleanly. Built from an audit of the current branch against `docs/tech-roadmap.md` §10 Phase 2. Every task is a checkbox you tick as you go.
>
> **Mindset:** the Phase 2 *foundation* merged via PR #8 on 2026-04-24 (catalog, admin CRUD, admin auth, staging CORS + cross-site cookie fix). What remains is **cleanup** — no rebuilds, no new features. Resist the urge to start over.

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

## 0.5. PR split (post-merge)

The Phase 2 foundation is on `main` via PR #8. The remaining cleanup is split across three branches so each review stays small and reviewable. Branches are already pushed and ready to work on:

| Branch | Owns | Plan sections |
|--------|------|---------------|
| `refactor/phase2-server-cleanup` | Shared product serializer, global error handler, image payload caps, duplicate-slug 409, `passwordHash`-in-response audit | §3.7, §4.1–4.5 |
| `refactor/phase2-client-auth` | Zustand auth store, `useAuth` hook, `<RequireAdmin>` route guard, `AdminLoginPage`/`AdminProductsPage` refactor, font-family fix | §5.1–5.6 |
| `feat/ui-foundation` | Shadcn primitives (Card / Input / Label), `cn()` helper, Tailwind tokens — evolving editorial/boutique look | *not in this plan — UI track runs in parallel* |

**Suggested order.** Open `refactor/phase2-server-cleanup` and `feat/ui-foundation` PRs in parallel (disjoint files, zero conflict surface). Start `refactor/phase2-client-auth` *after* `feat/ui-foundation` merges so the auth refactor can consume the new UI primitives.

§6 is the **phase-completion gate** — run it only after all three branches land on main. Until then, leave §6 boxes unticked even if individual parts pass.

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
| Public catalog | `server/src/routes/products.ts` |
| Zod validation on every request body | every route file |
| Env validation (JWT_SECRET ≥ 16, cookie names, TTL, admin creds) | `server/src/config/env.ts` |
| Seed (admin user + 4 products × 2 variants) | `server/src/seed.ts` |
| Client catalog + detail pages | `client/src/pages/CatalogPage.tsx`, `ProductDetailPage.tsx` |
| Client admin login + CRUD UI | `client/src/pages/AdminLoginPage.tsx`, `AdminProductsPage.tsx` |
| Variant selector + personalization input | `client/src/components/VariantSelector.tsx`, `PersonalizationInput.tsx` |
| Shared fetch wrapper with `credentials: "include"` | `client/src/services/api/client.ts` |

### 1.2 The "mess" (cleanup targets handled in §4 and §5)

1. **Duplicate serializer** — `serializeProduct` is defined in both `server/src/routes/admin-products.ts` and `server/src/routes/products.ts`.
2. **No zustand auth store** — admin session state lives in `AdminProductsPage` local state instead of a shared store. `client/src/store/` is empty.
3. **No `<RequireAdmin>` route guard** — gating is an imperative `useEffect` redirect inside `AdminProductsPage`. Stale UI flashes before redirect.
4. **Image payloads unbounded** — the admin CRUD accepts `data:image/...` URLs with no size or count cap. One big photo pasted in → a huge JSON row.
5. **No global error handler** — each route has its own try/catch. Unique-constraint violations (duplicate slug) bubble up as generic 500s instead of 409.
6. **Font-family inconsistency** — `client/src/index.css` sets Georgia on `:root` and Segoe UI on `body`. Pick one.
7. **Unused client deps not yet used** — `react-hook-form`, `zod` on the client. Fine to leave for now; flag for Phase 3.

### 1.3 Out of scope for Phase 2 (confirmed — do not build)

- Customer auth (Phase 5).
- Cart + checkout (Phase 3).
- MercadoPago / Resend (Phase 4).
- Moving images off data URLs to cloud storage. Keep data URLs; add caps in §4.4.

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

**If everything above is green, continue. If any step fails, see §7 before touching code.**

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

### 3.7 No passwords in responses *(belongs in `refactor/phase2-server-cleanup`)*

- [ ] Grep `server/src/routes/` for `passwordHash`. No route should include it in a response body. *Never publish hashes, even bcrypt ones.*

---

## 4. Server cleanup (do in order) *(branch: `refactor/phase2-server-cleanup`)*

### 4.1 Extract shared product serializer

- [ ] Create `server/src/lib/serializers.ts` and move the `serializeProduct` function there. Accept an options object so both routes can use it:
  ```ts
  type SerializeOpts = { includeStock?: boolean };
  export function serializeProduct(p: ProductWithRelations, opts: SerializeOpts = {}) { ... }
  ```
  - Public (`routes/products.ts`): call with `includeStock: false`. Always compute `startingPrice` (basePrice + min variant priceDelta).
  - Admin (`routes/admin-products.ts`): call with `includeStock: true`. `startingPrice` optional.
- [ ] Replace the inline `serializeProduct` in both route files with `import { serializeProduct } from "../lib/serializers.js"` (note `.js` extension — NodeNext ESM requires it).
- [ ] Re-run §2.5 and §2.6. Responses should be byte-identical to before.

### 4.2 Global error handler middleware

- [ ] Create `server/src/middleware/errorHandler.ts`:
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
- [ ] In `server/src/index.ts`, mount this **after all route `app.use("/api/...", ...)` calls** (last middleware):
  ```ts
  app.use(errorHandler);
  ```
- [ ] In `admin-products.ts` and `products.ts`, refactor the inline `try/catch` blocks. Replace every `catch (err) { res.status(500).json(...) }` with:
  ```ts
  } catch (err) { next(err); }
  ```
  Add `next: NextFunction` to handler signatures where needed.

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

- [ ] Cap array length: `z.array(imageSchema).max(8, "Máximo 8 imágenes por producto")`.
- [ ] Add a refinement on the `url` field: if it starts with `data:image/`, reject when the decoded size exceeds ~500 KB.
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

## 5. Client cleanup (do in order) *(branch: `refactor/phase2-client-auth`)*

### 5.1 Zustand auth store

- [ ] Create `client/src/store/auth.ts`:
  ```ts
  import { create } from "zustand";
  import { loginAdmin, logoutAdmin, fetchAdminSession } from "../services/api/admin";

  type AdminSession = { id: string; email: string } | null;
  type Status = "idle" | "loading" | "authenticated" | "unauthenticated";

  type AuthState = {
    admin: AdminSession;
    status: Status;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
  };

  export const useAuthStore = create<AuthState>((set) => ({
    admin: null,
    status: "idle",
    error: null,
    login: async (email, password) => {
      set({ status: "loading", error: null });
      try {
        const { admin } = await loginAdmin(email, password);
        set({ admin, status: "authenticated" });
      } catch (e: any) {
        set({ admin: null, status: "unauthenticated", error: e.message });
        throw e;
      }
    },
    logout: async () => {
      await logoutAdmin();
      set({ admin: null, status: "unauthenticated" });
    },
    refresh: async () => {
      set({ status: "loading" });
      try {
        const { admin } = await fetchAdminSession();
        set({ admin, status: "authenticated" });
      } catch {
        set({ admin: null, status: "unauthenticated" });
      }
    },
  }));
  ```

### 5.2 `useAuth` hook

- [ ] Create `client/src/hooks/useAuth.ts` as a thin selector wrapper:
  ```ts
  import { useAuthStore } from "../store/auth";
  export const useAuth = () => useAuthStore();
  ```

### 5.3 Refactor `AdminLoginPage`

- [ ] Remove local `loading`/`error` state. Read them from `useAuth()`.
- [ ] On submit: `await login(email, password)`; on success, `navigate(state?.from ?? "/admin/productos")`.
- [ ] Browser verify: wrong creds → error text shows. Right creds → lands on admin page.

### 5.4 Refactor `AdminProductsPage`

- [ ] Delete the `fetchAdminSession`/redirect `useEffect` and the local session state. `RequireAdmin` (next step) handles auth.
- [ ] Read `admin` from `useAuth()` to show the logged-in email in the header.
- [ ] Logout button calls `useAuth().logout()` and then `navigate("/admin/login")`.

### 5.5 `<RequireAdmin>` route guard

- [ ] Create `client/src/components/RequireAdmin.tsx`:
  ```tsx
  import { useEffect } from "react";
  import { Navigate, useLocation } from "react-router-dom";
  import { useAuth } from "../hooks/useAuth";

  export function RequireAdmin({ children }: { children: React.ReactNode }) {
    const { status, refresh } = useAuth();
    const location = useLocation();

    useEffect(() => { if (status === "idle") refresh(); }, [status, refresh]);

    if (status === "idle" || status === "loading") return <div className="p-8 text-stone-500">Cargando…</div>;
    if (status === "unauthenticated") return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />;
    return <>{children}</>;
  }
  ```
- [ ] In `client/src/App.tsx`, wrap the admin route:
  ```tsx
  <Route path="/admin/productos" element={<RequireAdmin><AdminProductsPage /></RequireAdmin>} />
  ```
- [ ] Browser verify: visit `/admin/productos` logged out → brief loading → `/admin/login` with the "from" state preserved.

### 5.6 Minor polish

- [ ] Fix font-family conflict in `client/src/index.css`: remove whichever of `:root { font-family: ... }` vs `body { font-family: ... }` you don't want. Recommended: keep the serif on `body` for the editorial look; delete the `:root` rule.
- [ ] In `AdminProductsPage`'s file picker handler, add a client-side size guard (~500 KB) so users get instant feedback instead of a 400 from the server.

---

## 6. End-to-end verification — phase completion gate

Run this once everything above is ticked.

- [ ] `pnpm dev:down && pnpm dev:rebuild`. Clean boot, no errors in any container log.
- [ ] `pnpm seed`.
- [ ] Run the Postman collection top-to-bottom (§2 + §3 + §4.3 + §4.5). All pass.
- [ ] Browser `/`: catalog renders, 4 products, category badges visible.
- [ ] Browser `/productos/sobres-clasicos`: detail page, variant buttons toggle, personalization counter increments up to 80 chars, quantity spinner works.
- [ ] Browser `/admin/productos` while logged out → `/admin/login` (with `from` preserved).
- [ ] Log in → lands on admin page. Email shows in header.
- [ ] Create a new product through the UI. It appears in the admin list and on the public `/` after refresh.
- [ ] Edit the product; changes persist. Delete it; it's gone from both lists.
- [ ] DevTools → responsive mode → iPhone SE (375 px). Catalog and detail are readable, no horizontal scroll.
- [ ] Update `docs/tech-roadmap.md` §10 Phase 2 checkboxes (all already `[x]` — just confirm they're honest). If anything's truly missing, add a note under "Deferred to Phase 3".

Once every box in this §6 is ticked, **Phase 2 is done**. Move to `docs/tech-roadmap.md` §10 Phase 3 (cart + guest checkout foundation).

---

## 7. Debugging appendix — likely failure modes

### 7.1 "Login returns 200 but `/me` returns 401"

Your Postman cookie jar isn't actually saving. Fix:

- Settings → General → "Automatically save cookies" must be ON.
- Settings → Cookies → after login you should see a `localhost` entry with `quarzo_admin_session`. If not, toggle the domain on manually.
- Don't mix `http://localhost:3000` and `http://127.0.0.1:3000`. They are different cookie jars.

### 7.2 "Admin route returns 401 even after a fresh login" (browser, not Postman)

Usually a cookie-flag mismatch:

- `APP_ENV=production` in your local `.env` → `secure: true` → browser refuses to send the cookie over `http://`. Set `APP_ENV=development`.
- Cross-site flow (API on a different origin than the client) + `SameSite=Lax` → cookie dropped on POSTs. In dev, the Vite proxy keeps you same-origin, so this shouldn't happen. If you swapped that proxy out, re-add it.

### 7.3 "Prisma P1001: Can't reach database"

- `pnpm dev` hasn't fully started `db` yet. Watch `docker compose logs db` — wait for `database system is ready to accept connections`.
- `.env` has `DATABASE_URL=postgresql://...@localhost:5432/...`. Inside the `api` container, the hostname is `db`, not `localhost`. Should be `postgresql://quarzo:...@db:5432/quarzo?schema=public`.

### 7.4 "CORS error in the browser" (local dev)

- `CLIENT_ORIGIN` in `.env` doesn't match the URL you loaded (`5173` vs `3000`, `localhost` vs `127.0.0.1`).
- API not running → the "CORS error" is actually a connection refused. Check `docker compose ps`.

### 7.5 "CORS blocked on a Cloudflare Pages preview URL" (staging)

The allowlist in `server/src/index.ts` accepts `env.CLIENT_ORIGIN` (exact match) plus `env.CLIENT_ORIGIN_PREVIEW_PATTERN` (optional regex). If previews aren't matching:

- Secret `CLIENT_ORIGIN_PREVIEW_PATTERN_STAGING` is unset or misspelled in the GitHub `staging` environment. Expected value: `^https://[a-z0-9-]+\.quarzo-staging\.pages\.dev$`
- Anchors matter. Without `^` and `$` the regex accepts origins like `https://evil.example.com/?x=quarzo-staging.pages.dev`.
- Empty string (secret exists but value is empty) is safe — `config/env.ts` normalizes it to `undefined`, so CORS falls back to exact-match only on `CLIENT_ORIGIN`.
- Prod intentionally does *not* set this secret. If you see prod accepting preview-shaped origins, someone added it — remove it.

### 7.6 "Admin login works but `/me` 401s" (staging / prod, browser)

Cross-site cookie policy. Verify `Set-Cookie` on the login response includes `SameSite=None; Secure; HttpOnly`. If it shows `SameSite=Lax`, the `APP_ENV` on Fly is `development` (shouldn't be) or the cookie helper was reverted. See `server/src/auth/cookies.ts:21`.

---

*This plan replaces ad-hoc Phase 2 tracking. When every checkbox in §§2–6 is ticked, Phase 2 is complete and verified.*
