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
- **What stays the same:** the `ProductImage` table, the `images: []` array on `Product`, the admin form's editor UX (file picker → preview → alt text → reorder). Only the *contents* of `url` change (from data URLs to CDN URLs) and the size/count caps relax.

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

This is a one-time Cloudflare dashboard walkthrough. Outputs: two buckets, one API token, the five `R2_*` env values §3.1 needs. Estimated time: ~10 minutes.

1. **Sign in to Cloudflare** (`dash.cloudflare.com`) with the same account that owns the Pages projects (`quarzo` + `quarzo-staging`). Capture the **Account ID** from the right-hand sidebar of the dashboard home — that's `R2_ACCOUNT_ID`.
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
   - Cloudflare displays a URL like `https://pub-<hash>.r2.dev`. Copy it — that's `R2_PUBLIC_BASE_URL` for production.
   - Repeat for `quarzo-media-staging` to get the staging public URL.
   - (Custom domain `https://media.quarzo.shop` waits for Phase 7 — until then the `pub-<hash>.r2.dev` URL is what gets stored in `ProductImage.url`.)
6. **Create one API token covering both buckets.**
   - R2 home → **Manage R2 API Tokens** (right side) → **Create API Token**.
   - Token name: `quarzo-r2-rw`.
   - Permissions: **Object Read & Write**.
   - Specify buckets: select **Apply to specific buckets only** → tick `quarzo-media` and `quarzo-media-staging`.
   - TTL: **Forever** (rotate manually when needed).
   - Click **Create API Token**. Cloudflare shows the **Access Key ID** and **Secret Access Key** *once* — capture both immediately. They map to `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
   - The page also shows an **S3-compatible endpoint** (`https://<account-id>.r2.cloudflarestorage.com`). The `@aws-sdk/client-s3` wrapper in §3.2 derives this from `R2_ACCOUNT_ID`, so you don't need to store it separately — but copy it once for sanity-checking with the AWS CLI if you want a smoke test before wiring code.
7. **Smoke-test the token (optional but recommended).** From your host with the AWS CLI installed:
   ```bash
   AWS_ACCESS_KEY_ID=<key> AWS_SECRET_ACCESS_KEY=<secret> \
     aws s3 ls --endpoint-url https://<account-id>.r2.cloudflarestorage.com
   ```
   Should list both buckets. If it 403s, the token's bucket scope is wrong; re-create it.
8. **Record the five values.** You should now have, ready to paste into `.env` and GitHub Environments per §3.1:
   - `R2_ACCOUNT_ID` — from step 1
   - `R2_ACCESS_KEY_ID` — from step 6
   - `R2_SECRET_ACCESS_KEY` — from step 6
   - `R2_BUCKET` — `quarzo-media` for production env, `quarzo-media-staging` for staging env
   - `R2_PUBLIC_BASE_URL` — `https://pub-<hash>.r2.dev` from step 5 (different per bucket; production env gets the prod URL, staging env gets the staging URL)

### 3.1 Bucket + secrets

- [ ] Provision R2 per **§3.0** (two buckets + one API token covering both). Output: the five `R2_*` values used below.
- [ ] Add to `.env.example`:
  ```
  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET=
  R2_PUBLIC_BASE_URL=
  ```
- [ ] Extend `server/src/config/env.ts` to validate these (`min(1)` strings; `R2_PUBLIC_BASE_URL` must be a URL). Boot fails fast on misconfigured env.
- [ ] Add the same five secrets to GitHub Environments (`production` + `staging`); update `deploy-staging.yml` and `deploy-production.yml` to forward them to Fly.

### 3.2 Upload library + endpoint

- [ ] Add deps to `server/package.json`: `@aws-sdk/client-s3` (R2 is S3-compatible), `multer` (multipart parser), `sharp` (image processing). `pnpm dev:rebuild` to pull native bindings into the container.
- [ ] **NEW** `server/src/lib/storage.ts` — thin wrapper around the S3 client targeting R2. Exports `uploadImage({ buffer, contentType, prefix }): Promise<{ url: string; key: string }>`. Generates a CSPRNG-random key (`<prefix>/<cuid>.jpg`) and returns `${R2_PUBLIC_BASE_URL}/${key}` as the `url`.
- [ ] **NEW** `server/src/routes/admin-images.ts` — `POST /api/admin/images`, gated by `authenticateAdmin` + `requireAdmin`. Accepts a single file under field name `image`. Uses `multer` with an in-memory store and a 10 MB limit. Pipeline:
  1. `sharp(buffer).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()` — `.rotate()` honors EXIF orientation; the re-encode strips EXIF.
  2. `uploadImage({ buffer: processed, contentType: "image/jpeg", prefix: req.body.prefix ?? "products" })`.
  3. Return `{ url, width, height, bytes }`.
  Errors: oversized → 413; non-image content type → 415; sharp decode failure → 422 with `code: "INVALID_IMAGE"`.
- [ ] Mount under `app.use("/api/admin", adminImagesRouter)` in `server/src/index.ts`, after `authenticateAdmin` but in the same admin block.

### 3.3 Validation schema

- [ ] In `server/src/lib/validation-schemas.ts`:
  - `imageUrlSchema` accepts only `^https?:\/\/`. Drop the `data:image/` branch and the `MAX_DATA_URL_BYTES` refinement.
  - Keep `imageSchema = z.object({ url: imageUrlSchema, alt: z.string().trim().max(160).optional().or(z.literal("")) })`.
  - Keep the array-level cap `z.array(imageSchema).max(8, "Máximo 8 imágenes por producto")` for now — the cap is a UX choice, not a storage one. Revisit if the wife asks for more.
- [ ] Drop `MAX_DATA_URL_BYTES` constant + export. Grep the codebase to confirm nothing else imports it.

### 3.4 Express body limit

- [ ] In `server/src/index.ts`: keep `express.json({ limit: "1mb" })` for non-image JSON bodies. The new image upload endpoint uses `multer`, not `express.json`, so the body parser is bypassed for that route.

### 3.5 Backfill script

- [ ] **NEW** `server/scripts/migrate-base64-to-r2.mjs`:
  ```js
  // For each ProductImage where url LIKE 'data:%':
  //   1. decode base64 → Buffer
  //   2. run through the same Sharp pipeline as the upload route
  //   3. upload to R2 (prefix: "products/migrated")
  //   4. update ProductImage.url with the new https URL
  // Logs each row's id + before/after URL. Stops on first error.
  ```
- [ ] Run order:
  1. Local: `pnpm dev:down && pnpm dev:rebuild && pnpm dev`. `pnpm seed` (which already produces `picsum.photos` URLs, so dev backfill is a no-op).
  2. Staging: open a PR, get the per-PR API URL, exec the script in the per-PR Fly app: `flyctl ssh console -a $FLY_APP_STAGING-pr-<N> -C "node scripts/migrate-base64-to-r2.mjs"`. Confirm the PR's Postman test of `/api/products` returns CDN URLs.
  3. Prod: after merge to `main`, run via `flyctl ssh console -a $FLY_APP_PROD -C "node scripts/migrate-base64-to-r2.mjs"`. **Take a Neon prod backup first.**

### 3.6 Cleanup workflow

- [ ] Update `.github/workflows/cleanup-staging.yml`: on PR close, delete every R2 key under prefix `pr-<N>/` from the staging bucket. Use `aws s3 rm` against the R2 endpoint or a small Node script. `continue-on-error: true` so it doesn't fail closed PRs that never deployed.

---

## 4. Client changes

### 4.1 Service helper

- [ ] **NEW** `client/src/services/api/uploadImage.ts`:
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

- [ ] In `client/src/pages/admin/AdminProductForm/components/ProductImageEditor.tsx`:
  - Drop `readFileAsDataUrl` and `isOverSize`. Drop the `MAX_IMAGE_BYTES` import.
  - `handlePick` now: `for (const file of files) { try { const { url } = await uploadImage(file); append({ url, alt: "" }); } catch (e) { /* surface inline */ } }`. Keep the "X / 8" counter and disable-at-cap logic.
  - Show "Subiendo…" state on the picker button while requests are in flight.
  - The compression hint copy (`Sube imágenes ya comprimidas …`) goes away — operator no longer needs to compress.

### 4.3 Schema relaxation

- [ ] In `client/src/pages/admin/AdminProductForm/schema.ts`:
  - `imageSchema.url` becomes `z.string().url("URL inválida")`. Drop `MAX_IMAGE_BYTES`, `dataUrlOrHttp`, `dataUrlSizeOk`.
  - Same `images.max(8)` array cap stays.

### 4.4 Public catalog (no change required, but verify)

- The public `Product.images[].url` already typed as `string` in `client/src/lib/types.ts`. No change. After backfill, every `<img src={url}>` tag now points to a CDN URL — Cloudflare's edge cache handles delivery.

---

## 5. Decisions to lock before opening the PR

| Decision | Recommendation | Why |
|---|---|---|
| Bucket provider | **Cloudflare R2** | Matches existing CF Pages footprint, no egress fees, S3-compatible SDK. AWS S3 / Backblaze B2 also fine. |
| Image variants generated | **Single 1600 px JPEG** | Simplest. ~20 SKUs × ~5 images at <300 KB each is well under what a CDN handles. Multi-size variants (thumb / detail / hero) are a Phase 4+ optimization if Lighthouse scores demand. |
| EXIF stripping | **Yes (automatic via Sharp re-encode)** | Removes geolocation from photos. Important: iPhone shots include GPS by default. |
| URL shape in DB | **Full public URL** stored in `ProductImage.url` | Stable across deploys, no client-side base-URL knowledge. Path: `https://media.quarzo.shop/products/<cuid>.jpg`. |
| Original retention | **Discard after upload** | Keeps R2 storage tight. If the wife ever needs originals, she has them locally; we're not building an archive. |
| Format | **JPEG only** | Universal browser support. Add WEBP next to it only if Phase 7 Lighthouse measures meaningful savings. |
| Per-PR isolation | **Per-PR key prefix `pr-<N>/`** in staging bucket | Lets `cleanup-staging.yml` delete cleanly on PR close. |
| Image size cap (UX) | **Keep `images.max(8)`** | The product detail UX gets noisy past 8 photos. This is a product decision, not a storage one. |
| 10 MB upload cap | **Yes, hard cap at multer layer** | Sharp can decode bigger but most iPhone JPEGs are 5–8 MB. 10 MB leaves headroom; anything bigger is a misconfigured camera. |

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
- **Cost ceiling:** R2 free tier is 10 GB storage + 1M Class A ops/month + 10M Class B ops/month. Quarzo v1 demand:
  - Storage: ~30 MB (20 products × ~5 images × ~300 KB processed). After Phase 2.7 designs, worst-case ~1.5 GB at 100 products × 30 designs.
  - Class A (writes): admin uploads only — ~500/month ceiling.
  - Class B (reads): Cloudflare edge cache absorbs nearly all public reads; origin sees low thousands/month.
  All three sit 3+ orders of magnitude under the free tier. Cloudflare requires a card on file to enable R2 even on the $0 plan, but charges only kick in on overage. If we somehow blow past it, that's a problem worth having.

---

*This plan was added 2026-05-04 in response to Phase 2.7 needing image storage that doesn't bottleneck on Postgres row sizes. When every box in §§3–8 is ticked, Phase 2.6 is complete and Phase 2.7 starts.*
