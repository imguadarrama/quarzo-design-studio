# Client scalability audit — `client/src/`

**Date:** 2026-06-03
**Scope:** `client/src/` only (no server code). Baseline: `pnpm preflight` green before the audit.
**Method:** three specialist agents (senior-frontend, senior-architect, qa-engineer) analyzed read-only in parallel; findings synthesized and de-duplicated below.

## Verdicts

| Lens | Verdict | One-line |
|---|---|---|
| **Mobile-first responsiveness** | **mostly** | `min-width` mixins and single-column grid defaults are correct, but the public navbar has no mobile pattern, `Button.sm` touch targets are ~30px, and the design-form preview overflows sub-360px. |
| **SOLID / DRY architecture** | **mostly** | Hard invariants are clean (zero `any`, zero raw `fetch` outside the service layer, no `let body` ladders, no redeclared response shapes, no JWT in `localStorage`). List pages are a model of reuse; debt is concentrated in 4 copy-pasted admin **form** pages and a duplicated `ButtonLink`. |
| **Testability** | **yes — and needed before Phase 4** | All `lib/` helpers and every `schema.ts`/`mappers.ts` are pure and testable today with zero mocking. Two checkout-blocking validation rules (foil-swatch `superRefine`, "≥1 offered variant") have no automated coverage. No runner is wired up yet. |

---

## Prioritized fix plan (dependency order)

### 1. Types — no findings
Zero `any` in the tree. Server response shapes already centralized in `lib/types.ts`. No action.

### 2. Service layer — no findings
All HTTP goes through `fetchJson`/`apiFetch`; endpoint files are one-line wrappers. `uploadImage.ts`'s raw `apiFetch` is a legitimate multipart-`FormData` exception, not a bypass. No action.

### 3. `let body` ladders — no findings
All async UI uses `AsyncContent`. No action.

### 4. DRY — repeated JSX / shared extractions (architecture)
| # | Finding | Files | Fix | Needs a name? |
|---|---|---|---|---|
| A1 | **Two `ButtonLink` components** (`Button/ButtonLink.tsx` used by 5 admin pages re-declares `ButtonSize`/`ButtonVariant`; `ButtonLink/ButtonLink.tsx` used only by CartPage) | both `ButtonLink` files + 6 call sites | Consolidate to one `components/ButtonLink/ButtonLink.tsx`, import the types from `Button.tsx`, delete the dup, repoint imports | cross-folder rename |
| A2 | **Edit-load state ladder duplicated 4×** (`editId`/`mode`/`loadIdRef`/`loadError`/`loaded` + load `useCallback` + effect + 2 early-return blocks) | `AdminCategoryFormPage`, `AdminDesignFormPage`, `AdminPaletteFormPage`, `AdminProductFormPage` | Extract `useAdminEditResource<T>(editId, fetchFn)` + a `<FormPageState>` wrapper | new hook + component |
| A3 | **`describeUploadError` copied 3×** | `AdminProductFormPage`, `AdminDesignFormPage`, `AdminPaletteFormPage` | Hoist to `services/api/uploadImage.ts` as `describeUploadError(err, fileName?)` | touches services/api |
| A4 | **Categories-fetch effect duplicated 2×** | `AdminProductFormPage`, `AdminDesignFormPage` | Extract `useActiveCategories()` | new hook |
| A5 | **Two-phase deferred-upload submit duplicated 2×** (`Promise.allSettled` + rollback) | `AdminProductFormPage`, `AdminPaletteFormPage` | Extract `resolvePendingUploads(...)` | new helper |
| A6 | **"Activo en catálogo" checkbox JSX duplicated 4×** | the 4 form pages | Extract `<ActiveToggle label hint {...register}/>` | new component |
| A7 | **Slug auto-derivation pattern duplicated 3×** | `AdminCategoryFormPage`, `AdminPaletteFormPage`, `AdminProductFormPage` | Extract `useSlugSync(watch, setValue, register)` | new hook |
| A8 | **`missingFields` re-implements `pickerSchema` rules by hand** | `ProductDetailPage.tsx` | Derive from RHF `errors` instead of a parallel checklist | refactor |

> A2–A7 are the real scalability story: list pages share `useAdminListResource`/`useAdminDeleteFlow`, but **form pages have no equivalent substrate**, so the same logic is copy-pasted across 4 files. Each is past the second-duplicate threshold.

### 5. Component-file convention
- A1 (the duplicate `ButtonLink`) is also a convention violation (named export must match folder; one folder per component).

### 6. SCSS — token discipline & nesting
| # | Finding | Files | Fix | New token? |
|---|---|---|---|---|
| S1 | Tag selector `.requiredLabel input` inside a module | `ProductVariantEditor.module.scss:221` | Give the checkbox a `.requiredCheckbox` class | no |
| S2 | Raw `rgba(0,0,0,0.45)` overlay | `ConfirmDialog.module.scss:6` | `$color-overlay` token | **yes** |
| S3 | Raw `font-size: 10px` | `AdminDesignsPage`, `ProductDesignsSelector` | `$font-size-nano: 10px` or fall back to `$font-size-xxs` | **yes** |
| S4 | Raw `2px` micro-spacing | `AdminDesignsPage`, `ProductDesignsSelector`, `PhaseFlowHint`, `FormField`, `QuantityInput` | `$space-0-5: 2px` token; bare `4px` → `$space-1` | **yes** |
| S5 | Fixed component sizes as bare integers (`72px` tile, `88px` cart thumb, `64px` nav, `40px` logo, `32px`/`24px`) | `DesignPicker`, `CartPage`, `NavBar` | Tokenize sizes (`$size-*`) | **yes** |
| S6 | `$font-size-display: 64px` not fluid | `_tokens.scss` / `NotFoundPage` | `clamp(36px, 12vw, 64px)` | edits token |
| S7 | `AdminLayout` mixin-include wraps class instead of nesting (cosmetic inconsistency) | `AdminLayout.module.scss:20` | Nest the include inside `.content` | no |

### 7. Responsiveness
| # | Finding | Files | Fix | New token? |
|---|---|---|---|---|
| R1 | **Public navbar has no mobile nav** — links never hidden, no hamburger/drawer; overflows/compresses on 375px (admin nav already hides links below `screen-md`) | `NavBarPublic.tsx` + `.module.scss` | Hide `.links` below `screen-md`, add a 44px hamburger toggle + drawer/dropdown | maybe |
| R2 | **`Button.sm` ≈30px touch target** (pervasive in admin CRUD rows, design-card actions, ReorderControls) | `Button.module.scss:60` | `min-height: 44px` (matches `QuantityStepper` which already enforces it) | 44px raw is already used by QuantityStepper; tokenize as `$size-touch-target` |
| R3 | **Design-form preview `240px×240px` overflows sub-360px** | `AdminDesignFormPage.module.scss:15` | `width: min(240px, 100%); height: auto; aspect-ratio: 1` | no |
| R4 | `.iconButton` `32px` reorder/variant buttons below 44px | `ReorderControls`, `ProductVariantEditor` | `min-width/min-height: 44px` | same as R2 |
| R5 | `ProductDesignsSelector` grid can wedge two near-zero-gap columns at ~375px | `ProductDesignsSelector.module.scss:59` | `minmax(min(180px, 100%), 1fr)` | no |

### 8. Tests (scaffold last)
**Stack:** Vitest + React Testing Library + `@testing-library/jest-dom` + `@testing-library/user-event` + jsdom + msw (unit/component); Playwright (E2E).

**Config:** `client/vitest.config.ts`, `client/src/test/setup.ts`, `client/playwright.config.ts`, `client/e2e/`.

**Scripts:** `test`, `test:watch`, `test:coverage`, `test:e2e` in `client/package.json`.

**Highest-value first targets (ranked):**
1. `lib/slug.ts` — `slugify` (accents, dashes, empty)
2. `pages/ProductDetailPage/schema.ts` — foil-swatch `superRefine` (checkout-blocking)
3. `pages/admin/AdminProductForm/schema.ts` — `length(4)` + "≥1 offered" rule
4. `lib/format.ts` — `formatMxn`
5. `lib/variant-kinds.ts` — `isFoilKind` / `isSelectableVariant`
6. `pages/admin/AdminProductForm/mappers.ts` — round-trip sort/fill
7. `hooks/useAdminDeleteFlow.ts` — 5-state flow
8. `lib/serverFieldErrors.ts` — `applyServerFieldError`

**Note:** deps live in container volumes — `pnpm dev:rebuild` required after `package.json` changes; no host `pnpm install`.

---

## Outcome (applied 2026-06-03)

Applied in one pass (working tree left dirty for local testing; nothing committed):

- **Architecture (full substrate):** `ButtonLink` consolidated to one component; `describeUploadError` hoisted to `services/api/uploadImage.ts`; `resolvePendingUploads` added to `pending-images.ts`; new hooks `useAdminEditResource`, `useCategories`, `useSlugSync`; new `<FormPageState>` + `<ActiveToggle>`. All 4 admin form pages rewired onto them (each ~60–120 lines lighter). Dead `ProductVariantOption`-era CSS pruned from `ProductVariantEditor.module.scss` (also resolved S1 tag-selector + R4 dead icon button).
- **Responsiveness:** public navbar mobile menu (44px hamburger + drawer, R1); `Button.sm` + `ReorderControls` 44px touch targets (R2/R4); design-form preview overflow fix (R3); design grid floor (R5).
- **SCSS tokens:** `$color-overlay`, `$space-0-5`, `$font-size-nano`, `$size-touch-target`, `$size-nav`, `$size-nav-logo`, `$size-design-tile`, `$size-cart-thumb` added; `$font-size-display` made fluid. All flagged raw values swapped to tokens (S2–S7).
- **Tests:** Vitest + RTL + jsdom + Playwright wired (`client/vitest.config.ts`, `src/test/setup.ts`, `playwright.config.ts`, `e2e/`), 4 `pnpm` scripts, and 4 seed test files (`slug`, `format`, both checkout-critical zod schemas). Test files excluded from the build `tsconfig` so `pnpm preflight` stays green before `pnpm dev:rebuild`.

**Consciously deferred:**
- **A8** (`ProductDetailPage` `missingFields`): left as-is. It drives the checkout CTA gate + the friendly "falta:" labels; rewriting it to derive from RHF `errors` risked a regression in a customer-critical gate for marginal DRY gain — exactly the premature change `CLAUDE.md` warns against.
- **Dead `active*` CSS classes** in `AdminCategory/Palette/Product` form modules: harmless scoped rules now superseded by `<ActiveToggle>`; left to avoid extra churn (design form's were pruned only because that file was already being edited for the preview fix).

## What's already healthy (do not touch)
- No `any`, no raw `fetch` outside `services/api/`, no `let body` ladders, no redeclared response shapes, no JWT in `localStorage`.
- List pages (`useAdminListResource` + `useAdminDeleteFlow` + `AsyncContent` + `ConfirmDialog`) are the reuse model the form pages should follow.
- Public storefront pages (`CatalogPage`, `ProductDetailPage`, `CartPage`) have clean fluid layouts.
