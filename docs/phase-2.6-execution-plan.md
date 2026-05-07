# Phase 2.6 Execution Plan — Image storage migration

> **Purpose:** move product images off base64-in-Postgres to a real object store (Cloudflare R2) with server-side resize via Sharp. Slice 7 shipped the admin image editor against the existing 500 KB data-URL pipeline; this phase swaps the storage backend without changing the customer-facing surface.
>
> **Mindset:** infrastructure, not features. The wife sees nothing new in the admin or the catalog after this phase. What changes is that she can upload an iPhone-sized photo (5 MB) without thinking about file size, and the public catalog response stops carrying inline base64. One PR, no slicing.

---

## 0. How to use this doc

- This is one PR, not a slice series. Land it as a single branch (`phase/2.6-image-storage`) once every checkbox below is green.
- Phase 2.6 is **a prerequisite for Phase 2.7 (designs)**. Designs add 20+ image-bearing rows per product; doing them on base64 doubles the storage problem we're fixing here.
- `pnpm preflight` green at the end. The pre-launch DB has < 10 image rows total — backfill is cheap.

---

## 1. Where we are

- **Today:** `ProductImage.url` is a `String` column that holds either an `https://...` URL or a `data:image/...;base64,...` blob. The admin editor (Slice 7) writes the latter; the public catalog returns the full base64 inline. Server validates ≤ 500 KB per data URL and ≤ 8 images per product. `express.json({ limit: "1mb" })` is the outer cap.
- **Why this needs to change:** (1) iPhone originals are 2–6 MB and require manual compression before upload, which is operator friction; (2) Phase 2.7 adds 20+ design images per product on top of product hero shots, and the public payload would balloon to 10+ MB; (3) base64-in-Postgres is fine for ~10 SKUs and unsustainable past that.
- **What stays the same:** the `ProductImage` table, the `images: []` array on `Product`, the admin form's editor UX (file picker → preview → alt text → reorder). Only the _contents_ of `url` change (from data URLs to CDN URLs) and the size/count caps relax.

---

## 2. What this phase ships (in plain language)

1. **A Cloudflare R2 bucket** (`quarzo-media`) accessible at a public CDN URL (e.g. `https://media.quarzo.shop` or, pre-domain, the `pub-<hash>.r2.dev` URL CF gives by default).
2. **A new admin upload endpoint** — `POST /api/admin/images` accepting `multipart/form-data`. Accepts originals up to 10 MB. Server runs the file through Sharp (downscale to max 1600 px on the long edge, re-encode as JPEG quality 0.82, strip EXIF), uploads to R2, returns the public URL.
3. **`ProductImageEditor` swap** — replace `FileReader.readAsDataURL` with `fetch("/api/admin/images", { method: "POST", body: formData })`. Drop the 500 KB pre-emptive guard; the server is now the size truth.
4. **Validation schema relaxation** — `imageSchema.url` accepts `https://...` only (drop the `data:image/` branch and the 500 KB byte refinement). Server rejects data URLs with a clear error so anything that slips through fails loud.
5. **Backfill script** — `server/scripts/migrate-base64-to-r2.mjs` reads every existing `ProductImage` row whose `url` starts with `data:`, runs it through the same Sharp pipeline, uploads, and rewrites the row. One-shot, run from the api container against staging then prod.
6. **CI / cleanup updates** — staging gets its own R2 prefix (`pr-<N>/`) so per-PR uploads can be wiped on PR close.

---

## 3. Server changes

### 3.0 Provision R2 (one-time setup)

This is a one-time Cloudflare dashboard walkthrough. Outputs: two buckets, **two API tokens (one per bucket)**, and the per-env GitHub secret values §3.1 needs. Estimated time: ~10 minutes.

1. **Sign in to Cloudflare** (`dash.cloudflare.com`) with the same account that owns the Pages projects (`quarzo` + `quarzo-staging`). Confirm the **Account ID** from the right-hand sidebar of the dashboard home matches the existing `CLOUDFLARE_ACCOUNT_ID` GitHub secret — R2 reuses this same value as its account ID, so no new secret is needed for it.
2. **Enable R2.** Left sidebar → **R2 Object Storage** → click through the "Subscribe to R2" / payment-method prompt. Base fee is $0; Cloudflare requires a card on file to handle overage, but you won't be charged unless you exceed the free tier (see §9).
3. **Create the production bucket.**
   - Click **Create bucket**.
   - Name: `quarzo-media`.
   - Location: **Automatic** (or **Eastern North America (ENAM)** if you want hint placement closer to MX traffic — both are fine; auto is the standard choice).
   - Default storage class: **Standard**.
   - Click **Create bucket**.
4. **Create the staging bucket.** Repeat step 3 with name `quarzo-media-staging`. This bucket holds per-PR uploads under `pr-<N>/` prefixes (see §3.6).
5. **Enable public access on both buckets.**
   - Open `quarzo-media` → **Settings** → **Public access** → under "R2.dev subdomain" click **Allow Access**.
   - Cloudflare displays a URL like `https://pub-<hash>.r2.dev`. Copy it — that's the value you'll store as `R2_PUBLIC_BASE_URL_PROD` in GitHub (and as plain `R2_PUBLIC_BASE_URL` once injected into Fly).
   - Repeat for `quarzo-media-staging` to get the staging public URL → `R2_PUBLIC_BASE_URL_STAGING`.
   - **About the warning Cloudflare shows when you click Allow Access.** CF flags the `pub-<hash>.r2.dev` subdomain as rate-limited and intended for development/staging traffic, recommending a Custom Domain for production. We accept the warning for v1: at ~20 SKUs and Instagram-driven traffic, the rate limit will not bite. The custom domain `media.quarzo.shop` is deferred to **Phase 7** because `quarzo.shop` is not yet registered or onboarded to Cloudflare DNS. When Phase 7 lands the domain, we attach `media.quarzo.shop` as a Custom Domain on `quarzo-media`, update `R2_PUBLIC_BASE_URL_PROD`, and rewrite stored `ProductImage.url` values via a one-line search-replace backfill on the URL prefix. Until then, prod stays on `pub-<hash>.r2.dev` — by design, not by oversight.
6. **Create two API tokens — one per bucket.** A staging token must not be able to write to the prod bucket; this mirrors the same blast-radius split that `JWT_SECRET_STAGING` / `JWT_SECRET_PROD` already give us. The Account ID returned by both tokens is the same (it's the Cloudflare account, not per-token); only the Access Key ID and Secret Access Key differ.

   **Token A — staging:**
   - R2 home → **Manage R2 API Tokens** (right side) → **Create API Token**.
   - Token name: `quarzo-r2-rw-staging`.
   - Permissions: **Object Read & Write**.
   - Specify buckets: select **Apply to specific buckets only** → tick **only** `quarzo-media-staging`.
   - TTL: **Forever** (rotate manually when needed).
   - Click **Create API Token**. Cloudflare shows the **Access Key ID** and **Secret Access Key** _once_ — capture both immediately. They map to `R2_ACCESS_KEY_ID_STAGING` and `R2_SECRET_ACCESS_KEY_STAGING` in GitHub.

   **Token B — production:**
   - Repeat the flow with token name `quarzo-r2-rw-prod`, scoped to **only** `quarzo-media`. The captured keys map to `R2_ACCESS_KEY_ID_PROD` and `R2_SECRET_ACCESS_KEY_PROD`.

   The token-creation page also shows an **S3-compatible endpoint** (`https://<account-id>.r2.cloudflarestorage.com`). The `@aws-sdk/client-s3` wrapper in §3.2 derives this from the account ID, so you don't need to store it separately — but copy it once for sanity-checking with the AWS CLI if you want a smoke test before wiring code.

7. **Smoke-test the token (optional but recommended).** From your host with the AWS CLI installed:
   ```bash
   AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> \
     aws s3 ls --endpoint-url https://<account-id>.r2.cloudflarestorage.com
   ```
   Should list both buckets. If it 403s, the token's bucket scope is wrong; re-create it.
8. **Record the values.** You should now have everything needed for §3.1. Two layers — the **GitHub Actions secrets** the workflows reference, and the **Fly app env vars** they inject (unsuffixed, what `server/src/config/env.ts` validates).

   **GitHub Actions secrets — reuse:**
   - `CLOUDFLARE_ACCOUNT_ID` — already configured (used by `cloudflare/pages-action@v1` in both deploy workflows). R2 needs this exact same value as its account ID; **do not** create a separate `R2_ACCOUNT_ID` GitHub secret.

   **GitHub Actions secrets — add (eight new, four per env, follows the `<NAME>_STAGING` / `<NAME>_PROD` convention used by `JWT_SECRET`, `ADMIN_EMAIL`, `CLIENT_ORIGIN`, etc.):**
   - `R2_ACCESS_KEY_ID_STAGING` / `R2_ACCESS_KEY_ID_PROD` — from step 6 token A / token B respectively
   - `R2_SECRET_ACCESS_KEY_STAGING` / `R2_SECRET_ACCESS_KEY_PROD` — from step 6 token A / token B respectively
   - `R2_BUCKET_STAGING` (= `quarzo-media-staging`) / `R2_BUCKET_PROD` (= `quarzo-media`)
   - `R2_PUBLIC_BASE_URL_STAGING` / `R2_PUBLIC_BASE_URL_PROD` — from step 5 (one `pub-<hash>.r2.dev` URL per bucket; the hashes differ)

   **Fly app env vars (unsuffixed — what app code reads):** `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`. The Cloudflare account ID flows through with the same name on every layer (GitHub secret → Fly env → `env.ts`); the four R2 vars are renamed from their `_STAGING`/`_PROD`-suffixed GitHub form, exactly the way `JWT_SECRET="${{ secrets.JWT_SECRET_STAGING }}"` already does. See §3.1 for the snippet.

### 3.1 Bucket + secrets

- [x] Provision R2 per **§3.0**: two buckets (`quarzo-media` + `quarzo-media-staging`) + two API tokens (`quarzo-r2-rw-prod` scoped to `quarzo-media`, `quarzo-r2-rw-staging` scoped to `quarzo-media-staging`).
- [x] Add to `.env.example` (unsuffixed — these are the in-app names, matching the Fly env var shape and `server/src/config/env.ts`):
  ```
  CLOUDFLARE_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET=
  R2_PUBLIC_BASE_URL=
  ```
  Local dev requires the staging values pasted in — `env.ts` validates these as `min(1)` so the API will not boot with empty R2 vars. The staging token (`quarzo-r2-rw-staging`) is bucket-scoped to `quarzo-media-staging`, so a local mistake cannot touch prod. Use `prefix: "dev"` when smoke-testing so test uploads land under `dev/` and don't pollute `products/` or `pr-<N>/`.
- [x] Extend `server/src/config/env.ts` to validate the five unsuffixed names (`min(1)` strings; `R2_PUBLIC_BASE_URL` must be a URL). Boot fails fast on misconfigured env.
- [x] **Add the eight new secrets to GitHub** (Repo → Settings → Secrets and variables → Actions → Environments). Add to the `staging` environment: `R2_ACCESS_KEY_ID_STAGING`, `R2_SECRET_ACCESS_KEY_STAGING`, `R2_BUCKET_STAGING`, `R2_PUBLIC_BASE_URL_STAGING`. Add to the `production` environment: `R2_ACCESS_KEY_ID_PROD`, `R2_SECRET_ACCESS_KEY_PROD`, `R2_BUCKET_PROD`, `R2_PUBLIC_BASE_URL_PROD`. **Do not** add `R2_ACCOUNT_ID` — the workflows reference the existing `CLOUDFLARE_ACCOUNT_ID` instead.
- [x] **Update `.github/workflows/deploy-staging.yml`** — extend the existing `flyctl secrets set` block (the one that already sets `JWT_SECRET`, `ADMIN_EMAIL`, etc.) with five more lines:
  ```yaml
  CLOUDFLARE_ACCOUNT_ID="${{ secrets.CLOUDFLARE_ACCOUNT_ID }}" \
  R2_ACCESS_KEY_ID="${{ secrets.R2_ACCESS_KEY_ID_STAGING }}" \
  R2_SECRET_ACCESS_KEY="${{ secrets.R2_SECRET_ACCESS_KEY_STAGING }}" \
  R2_BUCKET="${{ secrets.R2_BUCKET_STAGING }}" \
  R2_PUBLIC_BASE_URL="${{ secrets.R2_PUBLIC_BASE_URL_STAGING }}" \
  ```
- [x] **Update `.github/workflows/deploy-production.yml`** — same shape, prod-suffixed:
  ```yaml
  CLOUDFLARE_ACCOUNT_ID="${{ secrets.CLOUDFLARE_ACCOUNT_ID }}" \
  R2_ACCESS_KEY_ID="${{ secrets.R2_ACCESS_KEY_ID_PROD }}" \
  R2_SECRET_ACCESS_KEY="${{ secrets.R2_SECRET_ACCESS_KEY_PROD }}" \
  R2_BUCKET="${{ secrets.R2_BUCKET_PROD }}" \
  R2_PUBLIC_BASE_URL="${{ secrets.R2_PUBLIC_BASE_URL_PROD }}" \
  ```
  Pattern matches the existing `JWT_SECRET="${{ secrets.JWT_SECRET_STAGING }}"` line at `deploy-staging.yml` and the `JWT_SECRET="${{ secrets.JWT_SECRET_PROD }}"` line in `deploy-production.yml` — suffixed GitHub secret on the right, unsuffixed Fly env var on the left.

### 3.2 Upload library + endpoint

- [x] Add deps to `server/package.json`: `@aws-sdk/client-s3` (R2 is S3-compatible), `multer` (multipart parser), `sharp` (image processing). `pnpm dev:rebuild` to pull native bindings into the container.
- [x] **NEW** `server/src/lib/storage.ts` — thin wrapper around the S3 client targeting R2. Exports `uploadImage({ buffer, contentType, prefix }): Promise<{ url: string; key: string }>`. Generates a CSPRNG-random key (`<prefix>/<cuid>.jpg`) and returns `${R2_PUBLIC_BASE_URL}/${key}` as the `url`.
- [x] **NEW** `server/src/routes/admin-images.ts` — `POST /api/admin/images`, gated by `authenticateAdmin` + `requireAdmin`. Accepts a single file under field name `image`. Uses `multer` with an in-memory store and a 10 MB limit. Pipeline:
  1. `sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()` — `.rotate()` honors EXIF orientation; the re-encode strips EXIF.
  2. `uploadImage({ buffer: processed, contentType: "image/jpeg", prefix: req.body.prefix ?? "products" })`.
  3. Return `{ url, width, height, bytes }`.
     Errors: oversized → 413; non-image content type → 415; sharp decode failure → 422 with `code: "INVALID_IMAGE"`.
- [x] Mount under `app.use("/api/admin", adminImagesRouter)` in `server/src/index.ts`, after `authenticateAdmin` but in the same admin block.

### 3.3 Validation schema

- [x] In `server/src/lib/validation-schemas.ts`:
  - `imageUrlSchema` accepts only `^https?:\/\/`. Drop the `data:image/` branch and the `MAX_DATA_URL_BYTES` refinement.
  - Keep `imageSchema = z.object({ url: imageUrlSchema, alt: z.string().trim().max(160).optional().or(z.literal("")) })`.
  - Keep the array-level cap `z.array(imageSchema).max(8, "Máximo 8 imágenes por producto")` for now — the cap is a UX choice, not a storage one. Revisit if the wife asks for more.
- [x] Drop `MAX_DATA_URL_BYTES` constant + export. Grep the codebase to confirm nothing else imports it.

### 3.4 Express body limit

- [x] In `server/src/index.ts`: keep `express.json({ limit: "1mb" })` for non-image JSON bodies. The new image upload endpoint uses `multer`, not `express.json`, so the body parser is bypassed for that route.

### 3.5 Backfill script

- [x] **NEW** `server/scripts/migrate-base64-to-r2.mjs`:
  ```js
  // For each ProductImage where url LIKE 'data:%':
  //   1. decode base64 → Buffer
  //   2. run through the same Sharp pipeline as the upload route
  //   3. upload to R2 (prefix: "products/migrated")
  //   4. update ProductImage.url with the new https URL
  // Logs each row's id + before/after URL. Stops on first error.
  ```
  Sharp pipeline extracted to `server/src/lib/image-pipeline.ts` so the route and the script can't drift.
- [x] Run order:
  1. Local: `pnpm dev:down && pnpm dev:rebuild && pnpm dev`. `pnpm seed` (which already produces `picsum.photos` URLs, so dev backfill is a no-op).
  2. Staging: open a PR, get the per-PR API URL, exec the script in the per-PR Fly app: `flyctl ssh console -a $FLY_APP_STAGING-pr-<N> -C "node scripts/migrate-base64-to-r2.mjs"`. Confirm the PR's Postman test of `/api/products` returns CDN URLs.
  3. Prod: after merge to `main`, run via `flyctl ssh console -a $FLY_APP_PROD -C "node scripts/migrate-base64-to-r2.mjs"`. **Take a Neon prod backup first.**

### 3.6 Cleanup workflow

- [x] Update `.github/workflows/cleanup-staging.yml`: on PR close, delete every R2 key under prefix `pr-<N>/` from the staging bucket. Use `aws s3 rm` against the R2 endpoint or a small Node script. `continue-on-error: true` so it doesn't fail closed PRs that never deployed.

  **Implementation note — `R2_KEY_PREFIX`:** the staging bucket only sees `pr-<N>/...` keys because `server/src/lib/storage.ts` prepends the optional `R2_KEY_PREFIX` env var, which `deploy-staging.yml` sets to `pr-${{ github.event.number }}` per-PR. Prod leaves `R2_KEY_PREFIX` unset, so prod keys stay at `products/<uuid>.jpg` (no migration of already-uploaded prod images). Without this prefix wiring the cleanup step would be a no-op — staging uploads would have intermingled at `products/<uuid>.jpg` alongside prod-shape paths and accumulated indefinitely. Cleanup uses `aws s3 rm s3://$R2_BUCKET/pr-<N>/ --recursive --endpoint-url https://$CF_ACCOUNT_ID.r2.cloudflarestorage.com`; the AWS CLI v2 ships preinstalled on `ubuntu-latest`, and the staging R2 token is bucket-scoped so it can never touch prod.

---

## 4. Client changes

### 4.1 Service helper

- [x] **NEW** `client/src/services/api/uploadImage.ts`:
  ```ts
  export async function uploadImage(file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/admin/images", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  }
  ```
  Lives in `services/api/` (not `lib/`) — it's HTTP-bearing.

### 4.2 ProductImageEditor swap

- [x] In `client/src/pages/admin/AdminProductForm/components/ProductImageEditor.tsx`:
  - Drop `readFileAsDataUrl` and `isOverSize`. Drop the `MAX_IMAGE_BYTES` import.
  - `handlePick` now: `for (const file of files) { try { const { url } = await uploadImage(file); append({ url, alt: "" }); } catch (e) { /* surface inline */ } }`. Keep the "X / 8" counter and disable-at-cap logic.
  - Show "Subiendo…" state on the picker button while requests are in flight.
  - The compression hint copy (`Sube imágenes ya comprimidas …`) goes away — operator no longer needs to compress.

### 4.3 Schema relaxation

- [x] In `client/src/pages/admin/AdminProductForm/schema.ts`:
  - `imageSchema.url` becomes `z.string().url("URL inválida")`. Drop `MAX_IMAGE_BYTES`, `dataUrlOrHttp`, `dataUrlSizeOk`.
  - Same `images.max(8)` array cap stays.

### 4.4 Public catalog (no change required, but verify)

- The public `Product.images[].url` already typed as `string` in `client/src/lib/types.ts`. No change. After backfill, every `<img src={url}>` tag now points to a CDN URL — Cloudflare's edge cache handles delivery.

---

## 5. Decisions to lock before opening the PR

| Decision                 | Recommendation                                    | Why                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bucket provider          | **Cloudflare R2**                                 | Matches existing CF Pages footprint, no egress fees, S3-compatible SDK. AWS S3 / Backblaze B2 also fine.                                                                              |
| Image variants generated | **Single 1600 px JPEG**                           | Simplest. ~20 SKUs × ~5 images at <300 KB each is well under what a CDN handles. Multi-size variants (thumb / detail / hero) are a Phase 4+ optimization if Lighthouse scores demand. |
| EXIF stripping           | **Yes (automatic via Sharp re-encode)**           | Removes geolocation from photos. Important: iPhone shots include GPS by default.                                                                                                      |
| URL shape in DB          | **Full public URL** stored in `ProductImage.url`  | Stable across deploys, no client-side base-URL knowledge. Path: `https://media.quarzo.shop/products/<cuid>.jpg`.                                                                      |
| Original retention       | **Discard after upload**                          | Keeps R2 storage tight. If the wife ever needs originals, she has them locally; we're not building an archive.                                                                        |
| Format                   | **JPEG only**                                     | Universal browser support. Add WEBP next to it only if Phase 7 Lighthouse measures meaningful savings.                                                                                |
| Per-PR isolation         | **Per-PR key prefix `pr-<N>/`** in staging bucket | Lets `cleanup-staging.yml` delete cleanly on PR close.                                                                                                                                |
| Image size cap (UX)      | **Keep `images.max(8)`**                          | The product detail UX gets noisy past 8 photos. This is a product decision, not a storage one.                                                                                        |
| 10 MB upload cap         | **Yes, hard cap at multer layer**                 | Sharp can decode bigger but most iPhone JPEGs are 5–8 MB. 10 MB leaves headroom; anything bigger is a misconfigured camera.                                                           |

---

## 6. Out of scope (intentional)

- Multi-size variants (thumb / detail / hero) — single 1600 px is enough for v1. Revisit at Phase 7 polish if Lighthouse demands.
- WEBP / AVIF output — JPEG only. Encoding savings are real but every minute spent on this is not in scope before launch.
- Browser-side resize / canvas compression — server is the truth now; the wife can upload originals.
- Per-image admin replace UI ("change just this image without re-saving the whole product") — current PATCH still does delete-recreate of the whole product; the upload endpoint just produces URLs. The form keeps its existing batch-save flow.
- A media library / asset browser — every upload is product-scoped via the form. We're not building a CMS.
- Image cropping — the wife crops in Photos before uploading. Re-eval if real customers complain.

---

## 7. Verification

### 7.1 Local

- [ ] `pnpm dev:rebuild` completes (Sharp native bindings install cleanly).
- [ ] `pnpm preflight` green.
- [ ] Browser smoke at `/admin/productos/nuevo`:
  - Upload a 5 MB iPhone JPEG → succeeds, thumbnail loads from R2 URL, no 413/422.
  - Upload a 12 MB image → 413 with clear inline error.
  - Upload a `.txt` file → 415.
  - Save the product → list page shows it; the new product's image renders from the CDN URL.
  - Edit the product, swap an image, save → old R2 key is **not** orphaned-cleanup'd here (that's a future janitor); the row points at the new URL. Acceptable for v1.

### 7.2 Staging

- [ ] Open the PR. Per-PR Fly app boots; per-PR Neon branch ready; per-PR Pages preview links posted in the comment.
- [ ] On the per-PR API: run the backfill script. Confirm seeded `picsum.photos` URLs (or any pre-existing data URLs in the staging branch) get rewritten to R2 URLs. `GET /api/products` returns CDN URLs.
- [ ] Browser smoke on the per-PR Pages URL: upload a real photo from your phone, confirm it round-trips.
- [ ] Close the PR. `cleanup-staging.yml` deletes the per-PR Neon branch, the per-PR Fly app, the Pages previews, **and** the per-PR R2 keys under `pr-<N>/`.

### 7.3 Prod

- [ ] Take a Neon prod snapshot.
- [ ] `flyctl ssh console -a $FLY_APP_PROD -C "node scripts/migrate-base64-to-r2.mjs"`. Watch logs.
- [ ] Visit prod `/api/products`. Every `images[].url` is a CDN URL.
- [ ] Visit `/admin/productos/<id>/editar` for one product. Image shows. Save without changes. Reload. Still shows.

### 7.4 Regression

- [ ] Slice 4 admin product list still renders thumbnails (they're now CDN-served).
- [ ] Slice 6 two-click delete still works.
- [ ] Slice 7 variant editor untouched. Run a create + edit through to confirm.

---

## 8. Phase exit criteria

Phase 2.6 is done when:

1. R2 buckets provisioned, secrets in GitHub Environments + Fly.
2. Upload endpoint live; admin editor uses it.
3. Backfill script run cleanly against staging and prod; zero remaining `data:` URLs in `ProductImage.url` (verify with a `psql` count query).
4. `cleanup-staging.yml` cleans per-PR R2 keys.
5. `pnpm preflight:full` green.
6. `docs/tech-roadmap.md` §10 Phase 2.6 boxes ticked. `CLAUDE.md` "Currently" paragraph mentions image storage as moved to R2.

Once all six are green, **Phase 2.7 (designs) is unblocked**.

---

## 9. Out-of-band notes

- **Why R2 over S3:** zero egress fees on R2 (S3 charges per GB egressed to internet). For a stationery store served from a CDN, egress cost dominates storage cost. R2's S3-compatible API means migrating to S3 later is a config swap, not a code change.
- **Why not Cloudinary / imgix:** both are excellent but they're hosted services with their own SDK, pricing, and learning curves. The pedagogical goal of this project says: own the storage layer the way we own auth. Sharp + R2 is ~120 lines of code we control end-to-end.
- **Why prod is on `pub-<hash>.r2.dev` instead of a custom domain:** Cloudflare's recommended production path for a public R2 bucket is a Custom Domain (e.g. `media.quarzo.shop`). That requires the apex domain to be registered and onboarded to Cloudflare DNS — neither is true yet for `quarzo.shop` (custom domain is a Phase 7 deliverable). For v1's traffic profile (~20 SKUs, Instagram-driven), the `r2.dev` subdomain's rate limit is irrelevant. The CF warning shown when enabling public access is acknowledged and deferred, not ignored. Phase 7 swap is one line: re-attach the custom domain on the bucket, update `R2_PUBLIC_BASE_URL_PROD`, and run a one-shot `UPDATE "ProductImage" SET url = REPLACE(url, '<old-base>', '<new-base>')` SQL.
- **Why two R2 tokens instead of one shared token:** mirrors the `JWT_SECRET_STAGING` / `JWT_SECRET_PROD` blast-radius split. A leaked staging key cannot write to the prod bucket; a leaked prod key cannot accidentally clobber per-PR staging artifacts. The Cloudflare account ID is shared (it identifies the account, not the credential), which is why GitHub stores it once as `CLOUDFLARE_ACCOUNT_ID` and the workflows reuse that value for both envs.
- **Cost ceiling:** R2 free tier is 10 GB storage + 1M Class A ops/month + 10M Class B ops/month. Quarzo v1 demand:
  - Storage: ~30 MB (20 products × ~5 images × ~300 KB processed). After Phase 2.7 designs, worst-case ~1.5 GB at 100 products × 30 designs.
  - Class A (writes): admin uploads only — ~500/month ceiling.
  - Class B (reads): Cloudflare edge cache absorbs nearly all public reads; origin sees low thousands/month.
    All three sit 3+ orders of magnitude under the free tier. Cloudflare requires a card on file to enable R2 even on the $0 plan, but charges only kick in on overage. If we somehow blow past it, that's a problem worth having.

---

_This plan was added 2026-05-04 in response to Phase 2.7 needing image storage that doesn't bottleneck on Postgres row sizes. When every box in §§3–8 is ticked, Phase 2.6 is complete and Phase 2.7 starts._
