# Phase 2.5 Execution Plan — Client Foundation Rebuild (SCSS modules)

> **Purpose:** the playbook for finishing Phase 2.5. Replaces the original Tailwind-shaped plan, which was abandoned when PR #15 pivoted the client to SCSS modules + design tokens + 3-layout routing.
>
> **Mindset:** small PR slices, each one a complete unit you can review and merge. Every slice spells out architecture and style decisions *before* code lands so you can push back early. Resist scope creep — if a slice grows past one screen of decisions, split it.

---

## 0. How to use this doc

- Each numbered slice = one PR. Don't bundle two slices into one PR even if they look small.
- Every slice has the same five sections: **Goal**, **Decisions**, **Files**, **Out of scope**, **Acceptance** + a PR body skeleton.
- Before coding any slice, fill in the **Decisions** with concrete answers (a bullet, a sentence, a one-liner — whatever's clearest). Save them to the PR body as the "Why" trail. PR #15's body is the reference for tone and depth.
- Order is the suggested execution order, but slices are largely independent — feel free to reorder if Phase 3 priorities shift.
- `pnpm preflight` (root) must stay green at the end of every slice. No commit lands the client in a non-buildable state.

---

## 1. Where we are

### 1.1 Foundation already shipped (locked unless a slice explicitly amends it)

| Layer | Where | Notes |
|---|---|---|
| Design tokens | `client/src/styles/_tokens.scss` | Brand palette + semantic aliases (`$color-bg`, `$color-accent`, `$space-*`, `$radius-*`, `$bp-*`). Re-emitted as CSS custom properties on `:root` so JS / media queries can read them. |
| Mixins | `client/src/styles/_mixins.scss` | `focus-ring`, `screen-md`, `screen-lg`. |
| Global stylesheet | `client/src/index.scss` | Reset + body defaults reading from CSS custom properties. |
| Fonts | `client/index.html` | Lora (primary, serif) + Quicksand (secondary, sans) via Google Fonts. |
| Routing | `client/src/App.tsx` | `BrowserRouter`. Three sibling layouts (`PublicLayout` / `AuthLayout` / `AdminLayout`), `*` → `NotFoundPage`, `/admin` → `Navigate` to `/admin/productos`. |
| Layouts | `client/src/layouts/{PublicLayout,AuthLayout,AdminLayout}.tsx` | Each with its own `.module.scss`. `AdminLayout` internally wraps its `Outlet` in `<RequireAdmin>`. |
| Admin auth state | `client/src/store/adminAuth.ts` (zustand) | `admin`, `status: "idle" \| "loading" \| "auth" \| "guest"`, `hydrate / login / logout`. |
| Admin route guard | `client/src/components/RequireAdmin.tsx` | Hydrates store on first mount, shows `FullPageSpinner` while loading, redirects guests to `/admin/login` (preserves `from` location). |
| Admin login page | `client/src/pages/admin/AdminLoginPage/` | `react-hook-form` + `@hookform/resolvers/zod`, inline field errors, top-level submit error, loading state on button. Redirects to `/admin/productos`. |
| Components shipped | `Button`, `Card`, `FullPageSpinner`, `NavBarAdmin`, `NavBarPublic`, `RequireAdmin`, `Typography` | Each is a folder with `<Name>.tsx` + `<Name>.module.scss`. |
| Stubs intentionally left | `AdminProductsPage` (13-line placeholder), `/catalogo` (`<h1>hello</h1>` placeholder), `NotFoundPage` | Real implementations are slices below. |

### 1.2 Slices already merged

- **Slice 0 — Foundation** (PR #15, commit `9c12bc5`) — everything in §1.1 except `Typography`.
- **Slice 1 — Typography component** (commit `70b23af`) — `Typography` exposes `as` (`h1..h6`, `p`), `size` (`xs..xxl`), `weight`, and `margin` overrides. Used by `AdminLoginPage`.

### 1.3 What remains

The slices in §3 below. None of them are gated on each other except where called out — slice priority is yours to set per Phase 3 needs.

---

## 2. Slice template (use this as the PR body skeleton)

Every Phase 2.5 PR follows this shape. Copy it into the PR description before opening review.

```markdown
## Summary

<one paragraph: what this slice ships and why it matters now>

## What's in here

### <subsystem 1>
- <file/component> — <what it does, what changed>

### <subsystem 2>
- ...

## Decisions

- **<decision name>** → <choice>. Why: <one sentence>.
- **<decision name>** → <choice>. Why: <one sentence>.

## Why <X> and not <Y>

<short answer to the obvious counter-question>

## Out of scope (intentional)

- <thing that looks like it belongs but is deferred to a later slice>

## Test plan

- [ ] <browser smoke step>
- [ ] <pnpm preflight or build check>
- [ ] <Postman or curl check, if API touched>
```

---

## 3. Slice 2 — Form primitives (Input, FormField)

### Goal
Extract reusable form pieces from the raw `<input>` / `<label>` / `<p class={fieldError}>` markup currently inlined in `AdminLoginPage.tsx`. Lock the field-level UX shape (label position, error placement, ARIA wiring) before any other form is written.

### Decisions to make
- **Component split** — one `<Input>` (raw input + styling) plus a `<FormField>` wrapper (label + input slot + error + hint), or a single `<TextField>` that bundles all four? *Recommendation: split. `<FormField>` works with future `<Textarea>` / `<Select>` / file pickers without inheritance.*
- **Error model** — does `<FormField>` accept a string `error` prop directly, or does it accept the `react-hook-form` `FieldError` object? *Recommendation: string. RHF integration stays in the page, primitive stays library-agnostic.*
- **Label placement** — above the input only, or float-on-focus? *Recommendation: above. Consistent with admin tone, simpler ARIA.*
- **Disabled / loading state visuals** — same color shift or distinct? *Style decision; pick one and document.*
- **`focus-ring` mixin** — apply on the `<input>` itself or on the `<FormField>` wrapper? *Recommendation: input — keeps focus tied to the actual interactive element.*

### Files
- **Created:** `client/src/components/Input/Input.tsx`, `client/src/components/Input/Input.module.scss`, `client/src/components/FormField/FormField.tsx`, `client/src/components/FormField/FormField.module.scss`.
- **Modified:** `client/src/pages/admin/AdminLoginPage/AdminLoginPage.tsx` — replace the two inline `<div className={styles.field}>` blocks with `<FormField label="…" error={errors.email?.message}><Input {...register("email")} /></FormField>`.
- **Modified:** `client/src/pages/admin/AdminLoginPage/AdminLoginPage.module.scss` — delete the now-unused `.field`, `.label`, `.input`, `.fieldError` rules.

### Out of scope
- `Textarea`, `Select`, file inputs — built when their consuming slice arrives.
- Form-wide error toast / banner — keep the inline `submitError` block in `AdminLoginPage` as-is.
- A generic `<Form>` wrapper — RHF + native `<form>` is enough.

### Acceptance
- AdminLoginPage renders identically to before (visual diff is zero or near-zero).
- `pnpm preflight` green.
- Browser smoke: empty submit shows zod errors below each field; valid creds redirect to `/admin/productos`.
- `Input` and `FormField` each ≤ 60 lines.

---

## 4. Slice 3 — Page-state feedback helpers

### Goal
One file that exports `<PageLoading>`, `<PageError>`, `<PageEmpty>` so future pages stop hand-rolling a "Cargando…" div. Land this *before* the admin product list (Slice 4) so the list can adopt all three from day one.

### Decisions to make
- **Co-located file vs. folder per component** — the rest of `client/src/components/` uses `<Name>/<Name>.tsx + .module.scss` per component. Three nearly-identical files, or one `PageState/` folder with three named exports? *Recommendation: one folder, one `.tsx`, one `.module.scss`. They're tiny and always imported as a set.*
- **Spinner reuse** — should `<PageLoading>` reuse `FullPageSpinner` or use a smaller in-flow spinner? *`FullPageSpinner` is full-viewport; `<PageLoading>` is in-content. Build a shared `<Spinner>` primitive now (size prop) or duplicate the SVG?*
- **`<PageEmpty>` action slot** — does it accept `children` for a CTA button, or a `cta` prop? *Recommendation: `children`. Lets pages drop in any element.*
- **Error retry** — does `<PageError>` accept an `onRetry` callback? *Recommendation: optional `onRetry` — when set, shows a "Reintentar" button.*

### Files
- **Created:** `client/src/components/PageState/PageState.tsx`, `client/src/components/PageState/PageState.module.scss`. Optionally `client/src/components/Spinner/Spinner.tsx` if the Spinner-reuse decision goes that way.

### Out of scope
- Toast notifications — wait until checkout (Phase 3) or admin success feedback needs them.
- Skeleton loaders — only worthwhile once a page has a deterministic layout.

### Acceptance
- `grep -rn "Cargando" client/src/` returns hits only inside `PageState.tsx`.
- `pnpm preflight` green.
- Demoable via temporary inclusion in any page during review (delete the demo before merge).

---

## 5. Slice 4 — Admin product list (read-only)

### Goal
Replace the 13-line `AdminProductsPage` stub with a real list view: fetch products via `services/api/admin.ts`, render rows, surface loading / error / empty states. Read-only — no create / edit / delete yet.

### Decisions to make
- **List shape: table, card grid, or stacked rows?** Mobile-first matters — admin uses this on phone occasionally. *Recommendation: card list on mobile, table on `screen-md+`. CSS-only switch via the existing breakpoint mixins.*
- **Per-row info** — name, slug, category, base price, variant count, active flag, primary image thumbnail? Pick the minimum that lets the operator confirm "this is the right product."
- **Image rendering** — show the primary image (first by `sortOrder`) as a thumbnail, or hide images in the list and only show them in the form? *Recommendation: thumb in the list. The wife identifies products by sight.*
- **Sorting / filtering** — do you want a category filter or a name search now, or punt to a later slice? *Recommendation: punt. Catalog is < 20 SKUs. YAGNI until there are 50.*
- **Inactive product visibility** — show all, or hide inactive behind a toggle? *Decide based on operator workflow.*
- **Action buttons** — even though create/edit/delete are next slices, do you want disabled placeholder buttons in this slice or no buttons at all? *Recommendation: no buttons. Don't ship dead UI.*

### Files
- **Modified:** `client/src/pages/admin/AdminProductsPage/AdminProductsPage.tsx`, `…/AdminProductsPage.module.scss`.
- **Possibly created:** `client/src/pages/admin/AdminProductsPage/components/ProductListRow.tsx` (+ scss) if the row markup grows past ~30 lines.
- **Touch (verify only):** `client/src/services/api/admin.ts` should already expose `fetchAdminProducts`. Confirm the response shape matches `lib/types.ts`.

### Out of scope
- Create / edit / delete — Slices 5–7.
- Bulk actions, multi-select.
- Product preview pane.

### Acceptance
- Logged-in operator sees the seeded products with their core info.
- Loading flash shows `<PageLoading>`; network failure shows `<PageError onRetry={…}>`; empty database shows `<PageEmpty>`.
- Mobile (375 px): no horizontal scroll, every row's primary action is tappable.
- `pnpm preflight` green.

---

## 6. Slice 5 — Admin product create form

### Goal
"Nuevo producto" CTA opens a form that creates a product (no images, no variants yet — those are Slice 7). Handles client-side validation, server errors (409 duplicate slug), and redirects back to the list on success.

### Decisions to make
- **Form location** — modal, drawer, dedicated route (`/admin/productos/nuevo`)? *Recommendation: dedicated route. Modals don't survive refresh and complicate URL-based bookmarking; a route also lets the form scroll naturally on mobile.*
- **Slug input** — auto-derive from name with a manual override, or always manual? *Recommendation: auto-derive with override. Saves typing and ensures URL-safety on first try.*
- **Active flag default** — new products start `active=true` or `active=false` (draft)? *Recommendation: `active=false`. Lets operator review the listing before it goes public; one click to publish.*
- **Price input** — single text field with manual decimals, or a separated peso/centavos input? *Recommendation: single field, validated as `Decimal(10,2)`.*
- **Cancel behavior** — `navigate(-1)` or hard route to `/admin/productos`? *Recommendation: hard route. `navigate(-1)` from a deep link sends the user out of the app.*
- **Server error mapping** — show 409 inline on the slug field, vs. as a top-level banner? *Recommendation: inline on slug — that's where the operator can fix it.*

### Files
- **Created:** `client/src/pages/admin/AdminProductForm/AdminProductForm.tsx` (+ scss), `…/schema.ts` (zod schema, exported so edit slice can reuse).
- **Modified:** `client/src/App.tsx` — add `/admin/productos/nuevo` route under `AdminLayout`.
- **Modified:** `client/src/pages/admin/AdminProductsPage/AdminProductsPage.tsx` — wire the "Nuevo producto" button.
- **Touch:** `services/api/admin.ts` — confirm `createAdminProduct` exists with the right shape.

### Out of scope
- Image upload — Slice 7.
- Variants — Slice 7.
- Edit / delete — Slice 6.

### Acceptance
- `/admin/productos/nuevo` renders the form behind `RequireAdmin`.
- Empty submit → zod errors per field via `<FormField error>`.
- Duplicate slug → 409 surfaces inline on the slug field.
- Successful submit → redirect to `/admin/productos`, new product visible in the list.
- `pnpm preflight` green.

---

## 7. Slice 6 — Admin product edit + delete

### Goal
Round out admin CRUD for product *metadata* (still no images / variants). Editing a row from the list opens the same form pre-filled; delete asks for confirmation and removes the product.

### Decisions to make
- **Edit route** — `/admin/productos/:id/editar`, or `/admin/productos/:slug`? *Recommendation: `:id`. Slugs change; ids don't.*
- **Delete confirmation UX** — native `confirm()`, an inline "click again to confirm" pattern, or a real modal? *Recommendation: inline two-click. Native `confirm` is jarring on mobile, and a modal is overkill for a single CTA.*
- **Soft-delete or hard-delete** — currently the API hard-deletes. Keep that, or flip to setting `active=false`? *Recommendation: keep hard-delete; the catalog is small and there's no order-history coupling yet.*
- **Optimistic UI** — remove the row immediately on delete and roll back on failure, or wait for the response? *Recommendation: wait. Failures are rare; the visual flicker isn't worth the complexity.*

### Files
- **Created:** `…/AdminProductForm` already exists from Slice 5; add a `mode: "create" | "edit"` prop or split the route components (whichever the form's size argues for at that point).
- **Modified:** `AdminProductsPage` — wire edit/delete buttons per row.
- **Modified:** `App.tsx` — add `/admin/productos/:id/editar`.
- **Touch:** `services/api/admin.ts` — confirm `updateAdminProduct(id)`, `deleteAdminProduct(id)` exist.

### Out of scope
- Images / variants — Slice 7.
- Audit log of changes.

### Acceptance
- Edit round-trips name/slug/category/description/basePrice/active.
- Delete asks for confirmation, then removes the product server-side and from the list.
- `pnpm preflight` green.

---

## 8. Slice 7 — Admin product images + variants editor

### Goal
The hardest slice. Add image upload (base64, ≤ 8 images, ≤ 500 KB each per `phase-2-execution-plan.md` §4.4) and variant editing to the product form. Each variant has `name`, `sku`, `price`, and a nested `options` array — each option has `name`, `type` (SELECT or TEXT), `values` (only for SELECT), `required`, `position`. Two levels of `useFieldArray` (variants → options).

> **Schema decision to make first (queued from PR #18 review).** `ProductVariant` has no `position` column today — variant order in API responses is whatever Prisma returns (insertion order in practice). The wife's example explicitly orders "Con foil $250" before "Con tinta normal $200"; if she wants control over that order in the editor, add `ProductVariant.position Int @default(0)` in the same migration class as Slice 7's other backend changes (if any), update `productInclude`/serializers to `sortByPosition` variants the same way images and options already are, and have `buildVariantsCreate` write `position: index`. Cheap now (one column, no data backfill — pre-launch DB), expensive once production has orders that snapshot variant references. **Decide before opening the Slice 7 PR.**

### Decisions to make
- **Sub-component split** — `ProductImageEditor` and `ProductVariantEditor` as siblings of `AdminProductForm`, or inline? *Recommendation: separate components. Each owns its own field-array slice and can be tested visually in isolation.*
- **`useFieldArray` ownership** — `AdminProductForm` registers and passes `control` down, or each editor calls `useFormContext`? *Recommendation: pass `control` explicitly. `FormProvider` is needed only for deep trees; this is two levels.*
- **Image reorder UX** — drag-and-drop, or up/down arrow buttons? *Recommendation: arrow buttons. dnd-kit is a dep + accessibility surface; arrows ship in an afternoon.*
- **Image preview size** — thumb in editor list and full-size on hover, or just thumb? *Style decision; pick one for now.*
- **Client-side image size guard** — match the server's 500 KB cap exactly, or warn at 400 KB? *Recommendation: hard reject at 500 KB to mirror server. Show a clear error, not an alert.*
- **Variant uniqueness** — block duplicate `sku` client-side, or rely on server P2002 → 409? *Recommendation: both. Client warn for fast feedback, server is the truth.*
- **Empty variant** — does a product require ≥ 1 variant before submit? *Server requires ≥ 1; mirror in zod.*

### Files
- **Created:** `client/src/pages/admin/AdminProductForm/components/ProductImageEditor.tsx`, `…/ProductVariantEditor.tsx` (each + scss).
- **Modified:** `…/AdminProductForm/schema.ts` — extend with images + variants arrays + size refinement.
- **Modified:** `AdminProductForm.tsx` — wire the new editors.

### Out of scope
- Cloud-storage migration (S3 / R2) — Phase 4+.
- Cropping / resizing in the browser.
- Per-variant images.

### Acceptance
- Create + edit both round-trip with multiple images and multiple variants.
- 9th image rejected client-side; > 500 KB image rejected client-side; both with visible inline error.
- Server P2002 on duplicate variant SKU surfaces inline, not as a 500.
- `pnpm preflight` green; browser smoke covers create/edit/delete with images + variants.

---

## 9. Slice 8 — Public catalog page (`/catalogo`)

### Goal
Replace `<h1>hello</h1>` with a real catalog under `PublicLayout`. Reads `/api/products`, lists active products, optional category filter. UX is your call — the wife wasn't satisfied with the previous version.

### Decisions to make
- **Hero / header** — full-bleed hero photo, simple title + subtitle, or category tiles up top? *Open. Mood-board it before opening the PR.*
- **Grid** — 2-up on mobile / 3-up on tablet / 4-up on desktop, or 1-up / 2-up / 3-up? *Recommendation: 1 / 2 / 3 — IG traffic prefers larger cards.*
- **Card hierarchy** — image-first card with name + price, or info-leading? *Recommendation: image-first. Stationery is a visual purchase.*
- **Category filter** — chips at top, sidebar, or `/catalogo?categoria=…` URL only? *Recommendation: chips — trivial to thumb on mobile.*
- **Empty state copy** — what reads well in Spanish for "no products in this category yet"? *Pick the line; it's the brand voice.*

### Files
- **Created:** `client/src/pages/CatalogPage/CatalogPage.tsx` (+ scss), `client/src/components/ProductCard/ProductCard.tsx` (+ scss).
- **Modified:** `App.tsx` — replace the `/catalogo` placeholder route.
- **Touch:** `services/api/products.ts` — confirm `fetchProducts` exists.

### Out of scope
- Search.
- Saved favorites.
- Adding to cart from the card (Phase 3).

### Acceptance
- `/catalogo` lists active products with image, name, price, category badge.
- Category filter narrows the grid; clearing filter restores it.
- Loading / error / empty go through `<PageState>`.
- Mobile (375 px): grid renders cleanly, no horizontal scroll, taps are ≥ 44 px.
- `pnpm preflight` green.

---

## 10. Slice 9 — Public product detail page (`/producto/:slug`)

### Goal
A detail page that is the customer's last stop before adding to cart (Phase 3). Variant selection, personalization text input, quantity, and a CTA-ready "Agregar al carrito" button (disabled until Phase 3 wires the cart store).

> **Server prep (queued from PR #18 review).** `serializeProductPublic` currently drops `ProductVariantOption.required`, so the public payload doesn't tell the client which options must be filled before the CTA un-disables. Either (a) add `required` to `serializeOptionPublic` in `server/src/lib/serializers.ts` (one line — public consumers can't write it, only read it), or (b) treat every option as required client-side. Pick (a) and ship it in the same PR as this slice; otherwise this slice ships with a guess that the spec already disagrees with.

### Decisions to make
- **Image gallery** — single hero image with thumbnails below, swipeable carousel, or stacked column? *Mobile-first; pick one.*
- **Variant selector UX** — pills/chips, segmented control, or radio group? *Recommendation: chips with `aria-pressed`. Reads as visual choice.*
- **Personalization input** — single-line input or textarea? Char limit (server says 80) — show counter as "23/80" or "57 left"? *Recommendation: textarea; "23/80" reads cleaner.*
- **Quantity input** — `<input type="number">` with `+`/`-` buttons, or `+`/`-` only? *Recommendation: input + buttons. Power users type, casual users tap.*
- **CTA disabled rules** — disabled until variant chosen AND personalization filled, or only one of those? *Server requires both at order-creation; mirror in client.*

### Files
- **Created:** `client/src/pages/ProductDetailPage/ProductDetailPage.tsx` (+ scss), `client/src/components/VariantSelector/VariantSelector.tsx` (+ scss), `client/src/components/PersonalizationInput/PersonalizationInput.tsx` (+ scss).
- **Modified:** `App.tsx` — add `/producto/:slug` under `PublicLayout`. (Final route name is your call — `/producto/:slug` vs `/productos/:slug`.)
- **Touch:** `services/api/products.ts` — confirm `fetchProductBySlug` exists.

### Out of scope
- Add-to-cart wiring — Phase 3.
- Reviews / ratings.
- Related products.

### Acceptance
- Detail page reads from API by slug, renders gallery, variants, personalization, quantity.
- "Agregar al carrito" stays disabled until both variant and personalization are valid; clicking does nothing yet (or shows a "próximamente" placeholder — your call).
- 404 path: invalid slug renders `<PageError>` with a "back to catalog" CTA.
- `pnpm preflight` green.

---

## 11. Slice 10 — Cleanup + accessibility pass

### Goal
Last slice before declaring Phase 2.5 done. No new features.

### Decisions to make
- **Lighthouse target** — what mobile a11y / perf score do you want before merging? *Recommendation: a11y ≥ 95, perf ≥ 80 on staging.*
- **Keyboard tab order** — manually verify across catalog, detail, login, admin list, admin form? *Recommendation: yes, in 5 min on each page.*
- **Screen reader spot-check** — VoiceOver / NVDA / Narrator on at least the login + product detail.

### Files
- **Touch:** any file flagged during the audit.
- **Modified:** `docs/tech-roadmap.md` §10 Phase 2.5 — tick the slice boxes (this doc + the roadmap are the source of truth for "we're done").

### Out of scope
- New components.
- New routes.

### Acceptance
- `pnpm preflight:full` green.
- Lighthouse mobile a11y ≥ 95 on `/catalogo` and `/producto/:slug` on staging.
- Manual checklist below all green:
  - Tab navigation reaches every interactive element on every page.
  - Every form field has a programmatically associated label.
  - Every image has alt text (decorative gets `alt=""`).
  - Color contrast: brand-ink on brand-bg ≥ 4.5:1; brand-accent on brand-bg ≥ 3:1.
  - Focus rings visible on every interactive element.

---

## 12. Phase exit criteria

Phase 2.5 is done when:

1. Every slice in §§3–11 is merged.
2. `pnpm preflight:full` passes.
3. Browser smoke from a fresh container:
   - `/catalogo` lists products, filter works, mobile renders cleanly.
   - `/producto/<slug>` shows variant selection + personalization counter; CTA disabled state is correct.
   - `/admin/login` validates, redirects.
   - `/admin/productos` lists products, create/edit/delete round-trip with images + variants.
   - `/admin` redirects to `/admin/productos`.
   - Unknown route → `NotFoundPage`.
4. `docs/tech-roadmap.md` §10 Phase 2.5 has the slice boxes ticked and §10 Phase 3 is unblocked.
5. `CLAUDE.md` client section accurately lists the components and pages that now exist.

Once all five are green, Phase 3 (cart + guest checkout) starts on a clean foundation.

---

## 13. Files at the end of Phase 2.5 (target shape)

```
client/src/
  App.tsx                                    # 3 layouts, 6 real routes + redirects + 404
  index.scss                                 # global reset
  index.html                                 # font preconnects + Lora/Quicksand
  styles/
    _tokens.scss
    _mixins.scss
  layouts/
    PublicLayout.tsx       (+ .module.scss)
    AuthLayout.tsx         (+ .module.scss)
    AdminLayout.tsx        (+ .module.scss)
  components/
    Button/                Card/                FormField/         (Slice 2)
    FullPageSpinner/       Input/      (Slice 2)  PageState/        (Slice 3)
    NavBarAdmin/           NavBarPublic/        PersonalizationInput/  (Slice 9)
    ProductCard/           (Slice 8)
    RequireAdmin.tsx       Spinner/    (Slice 3, optional)
    Typography/            VariantSelector/     (Slice 9)
  pages/
    NotFoundPage/
    CatalogPage/                              (Slice 8)
    ProductDetailPage/                        (Slice 9)
    admin/
      AdminLoginPage/
      AdminProductsPage/                      (Slice 4)
      AdminProductForm/                       (Slice 5–7)
        components/
          ProductImageEditor.tsx              (Slice 7)
          ProductVariantEditor.tsx            (Slice 7)
        schema.ts
  store/
    adminAuth.ts
  services/
    api/{admin.ts, client.ts, products.ts}
  lib/
    types.ts
```

---

*This plan replaces the original Tailwind-shaped Phase 2.5 plan after the SCSS pivot in PR #15. When every slice in §§3–11 is merged and §12 passes, Phase 2.5 is complete.*
