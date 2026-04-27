# Phase 2.5 Execution Plan — Frontend Refactor (DRY/SOLID/KISS)

> **Purpose:** step-by-step playbook for the frontend refactor that sits between Phase 2 (functional skeleton) and Phase 3 (cart + checkout). Every task is a checkbox you tick as you go. A specialist agent is executing this; humans review per-step commits.
>
> **Mindset:** the frontend works but quality is uneven (1,082 lines across 8 .tsx files, one god component at 571 lines, no primitives, scattered palette). The fix is a disciplined cleanup, not a rewrite. Resist the urge to scope-creep into Phase 3.

---

## 0. How to use this doc

- Work top to bottom. Each of the six steps produces one commit; don't squash them.
- File paths are from repo root. `client/src/pages/AdminProductsPage.tsx:180` means "file, line 180".
- Every task here is `- [ ]`. Tick them.
- Agent vs. human touchpoints: the agent writes code and commits. A human reviews each commit before the agent starts the next step.
- `pnpm preflight` runs fast (~30 s) and must stay green throughout.

---

## 1. Audit — what's actually wrong today

| Symptom | Where | Impact |
|---|---|---|
| God component | `client/src/pages/AdminProductsPage.tsx` (571 lines) | Session check, list, form, image editor, variant editor, CRUD orchestration — all in one file. Biggest maintainability risk in the repo. |
| No primitives | all 8 .tsx files | Every page re-implements buttons, inputs, cards, and loading states with raw Tailwind. Focus rings, disabled states, and spinners already drift between pages. |
| Unused form libs | `client/package.json` | `react-hook-form` + `zod` are installed but no page uses them. Admin and login forms submit without validation; empty product names and malformed image URLs reach the API. |
| Scattered palette | ~300 occurrences of `stone-*` / `amber-*` across `client/src/**` | A palette change means a find-and-replace safari. No theme tokens, no semantic naming. |
| Inconsistent loading/error UX | `CatalogPage`, `ProductDetailPage`, `AdminProductsPage` | Each page rolls its own "Cargando…" div. No shared empty or error state. |

---

## 2. Scope & non-goals

### In scope
- Theme tokens + Tailwind extension (Step 1)
- Five UI primitives (Step 2)
- Three feedback helpers (Step 3)
- Page migration to the primitives (Step 4)
- Split the 571-line `AdminProductsPage` into orchestrator + 4 sub-components + shared schema (Step 5)
- `.gitkeep` cleanup, dead-code removal, preflight + browser smoke (Step 6)

### Non-goals — do not touch, do not scope-creep
- **No backend changes.** Image upload stays base64 JSON (server-side payload caps live in `phase-2-execution-plan.md §4.4`, separate branch).
- **No new pages.** Cart, checkout, customer auth, customer account are Phase 3+.
- **No test runner / Vitest / Playwright.** Stays deferred.
- **No Storybook, no component playground.**
- **No animation library.** Tailwind transition utilities only.
- **No `zustand` auth store yet.** Keep admin session state where it lives until Phase 3 forces a shared store.
- **No MercadoPago SDK work.** Phase 4.
- **No shadcn primitives + `cn()` helper.** Revisit in Phase 3/4 once form density actually repeats.

---

## 3. Step 1 — Theme tokens

**Goal:** stop hardcoding `stone-*` / `amber-*` hex values. Semantic tokens today → one-line palette swap tomorrow when the client delivers brand assets.

### 3.1 Extend Tailwind config

- [ ] Edit `client/tailwind.config.ts`. Extend `theme.colors` with semantic tokens mapped to the current palette:
  - `brand.ink` → current `stone.900` equivalent (primary text on paper backgrounds).
  - `brand.paper` → current `stone.50` / white equivalent (page background).
  - `brand.accent` → current `amber.700` equivalent (CTA, active states).
  - `brand.muted` → current `stone.500` equivalent (secondary text, disabled copy).
- [ ] Extend `theme.fontFamily.serif` so `font-serif` resolves consistently. (The final family arrives with brand assets; for now, pick one concrete serif and stop there.)
- [ ] Keep the existing Tailwind palette working — do not remove `stone`/`amber`. Only **add** the `brand.*` namespace.

### 3.2 Replace hardcoded hex in global CSS

- [ ] Edit `client/src/index.css`. Inside `@layer base`, replace any hardcoded hex values with `theme()` references (e.g., `color: theme('colors.brand.ink')`).
- [ ] **Fix** the `:root` vs `body` font-family conflict already flagged in `docs/phase-2-execution-plan.md §5.6`. Pick one. Keep serif on `body` for the editorial look; delete the `:root` rule.

### 3.3 Acceptance

- [ ] `pnpm preflight` green.
- [ ] After later steps migrate the pages, `grep -r "text-amber-700\|bg-stone-900" client/src/` returns **zero** occurrences. (Expected to still have hits after Step 1 in isolation — this check is the Step 4/5 definition of done.)

### 3.4 Commit

- [ ] `refactor(ui): add brand theme tokens and fix font-family conflict`

---

## 4. Step 2 — Primitive components

**Goal:** one source of truth for buttons, inputs, cards, and the spinner. Only build primitives that are reused **≥ 2× today**. No speculative components.

New directory: `client/src/components/ui/`. Each file ≤ 80 lines, each with a named-export props interface.

### 4.1 `Button.tsx`

- [ ] Variants: `primary | secondary | ghost | destructive`.
- [ ] Sizes: `sm | md | lg`.
- [ ] Props: `loading`, `disabled`, `as` (optional — lets it render as a `<Link>` while keeping button styling), `leftIcon`, `rightIcon`, `pressed` (for aria-pressed toggle states; used by `VariantSelector`).
- [ ] Variant/size resolution uses an inline map or hand-rolled helper. **Do not add `cva` or a new dep.** `clsx` is fine if already present; otherwise keep the helper local.
- [ ] When `loading` is true: shows the `<Spinner size="sm" />`, disables the button, keeps the click area intact.

### 4.2 `Input.tsx` and `Textarea.tsx`

- [ ] Both controlled, both accept `label`, `error`, `hint`, and forward `ref`.
- [ ] Share a field-wrapper styling helper (small, local, in the same folder).
- [ ] When `error` is set: show the message beneath the field in `brand.accent` or a dedicated danger token, set `aria-invalid`.

### 4.3 `Card.tsx`

- [ ] Wrapper with padding and a `hover` variant.
- [ ] Used by `ProductCard` (hover) and admin product rows (no hover).

### 4.4 `Spinner.tsx`

- [ ] Single SVG, sizes `sm | md | lg`.
- [ ] Consumed by `Button loading`, page-level loaders, and form-save indicators.

### 4.5 What NOT to build now

- No `Modal`, `Toast`, `Select`, `Badge`, `IconButton`, `EmptyState`, `ErrorState` as first-class primitives. (EmptyState/ErrorState are covered by the lightweight Step 3 helpers instead.)
- Build them in Phase 3 when cart + checkout introduce the first legitimate need.

### 4.6 Acceptance

- [ ] Every file under `client/src/components/ui/` is ≤ 80 lines.
- [ ] `pnpm preflight` green.

### 4.7 Commit

- [ ] `feat(ui): add Button, Input, Textarea, Card, Spinner primitives`

---

## 5. Step 3 — Shared feedback helpers

**Goal:** one place for loading / error / empty states so pages stop rolling their own `<div>Cargando…</div>`.

### 5.1 Create the file

- [ ] `client/src/components/feedback/PageState.tsx` — three named exports, each < 20 lines:
  - `<PageLoading />` — centered spinner + optional subtitle.
  - `<PageError message />` — danger token + message + (later) retry affordance.
  - `<PageEmpty message />` — muted copy + optional CTA via `children`.
- [ ] One file (not a folder) because each is tiny and they're always imported together.

### 5.2 Acceptance

- [ ] `pnpm preflight` green.

### 5.3 Commit

- [ ] `feat(ui): add PageLoading/PageError/PageEmpty feedback helpers`

---

## 6. Step 4 — Migrate existing pages to primitives

**Goal:** sweep the 8 existing `.tsx` files and replace bespoke buttons/inputs/loaders with the Step 2 + Step 3 primitives. Behavior unchanged; visuals consolidate.

Per-file checklist:

- [ ] **`client/src/App.tsx`** — header/nav links become `<Button variant="ghost" as={NavLink}>`. Preserve `react-router-dom` semantics via `as={NavLink}` so active-link highlighting still works.
- [ ] **`client/src/pages/CatalogPage.tsx`** — loading/error/empty divs → `<PageLoading />`, `<PageError />`, `<PageEmpty />`. Category filter chips → `<Button variant="secondary" size="sm" pressed={...}>`.
- [ ] **`client/src/pages/ProductDetailPage.tsx`** — same loading/error migration. "Agregar al carrito" button → `<Button variant="primary">`, **disabled** when personalization text is empty. No cart wiring (Phase 3) — just the correct styled disabled state.
- [ ] **`client/src/pages/AdminLoginPage.tsx`** — migrate to `react-hook-form` + `zod`. Inputs → `<Input>`, submit → `<Button loading>`. Expected final size ~50 lines.
- [ ] **`client/src/components/ProductCard.tsx`** — wrap in `<Card hover>`.
- [ ] **`client/src/components/VariantSelector.tsx`** — variant buttons → `<Button variant="secondary" size="sm" pressed={isSelected}>`. Rely on `aria-pressed` + Tailwind `data-[pressed=true]` for the selected visual state.
- [ ] **`client/src/components/PersonalizationInput.tsx`** — migrate to `<Textarea>` with `hint` showing the char counter.

### 6.1 Acceptance

- [ ] `pnpm preflight` green.
- [ ] `grep -r "Cargando\.\.\." client/src/` returns hits **only** inside `PageState.tsx`.
- [ ] Browser smoke: `/`, `/productos/<slug>`, `/admin/login` — all render and behave identically to before.

### 6.2 Commit

- [ ] `refactor(client): migrate pages and shared components to UI primitives`

---

## 7. Step 5 — Split `AdminProductsPage` (the big one)

**Goal:** 571-line god component → thin orchestrator + four focused sub-components + one shared schema. Every file ≤ 150 lines.

### 7.1 New layout

```
client/src/pages/admin/
  AdminProductsPage.tsx              ~120 lines — orchestration, session check, list view, top-level state
  components/
    ProductListTable.tsx             ~80  lines — table of products with edit/delete actions
    ProductForm.tsx                  ~120 lines — useForm + zodResolver, renders name/slug/category/description/basePrice fields
    ProductImageEditor.tsx           ~100 lines — image list, add via FileReader→base64, remove, reorder
    ProductVariantEditor.tsx         ~90  lines — variant list, add/remove/edit variant rows
  schema.ts                          ~40  lines — shared zod schema for the product form
```

### 7.2 Rules

- [ ] `ProductForm` owns the form state via `useForm` + `zodResolver`. `ProductImageEditor` and `ProductVariantEditor` receive `control` and use `useFieldArray` for their slices — no prop drilling of raw arrays + setters.
- [ ] `AdminProductsPage` stays thin: orchestrates `fetchAdminProducts`, holds `editingProductId`, and decides which of list / form to render.
- [ ] Keep base64 image upload (per §2 Scope). But validate in the zod schema:
  - Reject images > 2 MB with a user-facing error.
  - Reject empty `name`, `slug`, `description`.
  - Enforce 1–8 images per product (match the server-side shape).
- [ ] All buttons → `<Button>`. All inputs → `<Input>` / `<Textarea>`.
- [ ] Delete the old `client/src/pages/AdminProductsPage.tsx` after the new location is working.

### 7.3 Acceptance

- [ ] No file in `pages/admin/` exceeds 150 lines (`wc -l client/src/pages/admin/*.tsx client/src/pages/admin/components/*.tsx`).
- [ ] `pnpm preflight` green.
- [ ] Browser smoke on `/admin/productos`:
  - Login → list renders.
  - "Nuevo producto" → form opens.
  - Create round-trips.
  - Edit round-trips.
  - Delete round-trips.
  - Image upload still works.
  - Zod rejects empty name and oversized (>2 MB) image with visible error copy.

### 7.4 Commit

- [ ] `refactor(admin): split AdminProductsPage into focused modules`

---

## 8. Step 6 — Cleanup pass

**Goal:** leave the tree honest.

- [ ] Delete `.gitkeep` files in directories that now have real files.
- [ ] Remove unused imports, unused helper functions, stale `client/src/` files the refactor orphaned.
- [ ] `pnpm preflight` green (tsc + vite build both packages, no type errors).
- [ ] Browser smoke — all four routes work:
  - `http://localhost:5173/` — catalog loads, cards render, category filter works.
  - `http://localhost:5173/productos/<slug>` — detail loads, variant toggles, personalization counter increments up to 80.
  - `http://localhost:5173/admin/login` — zod validation (empty email → error), successful login redirects.
  - `http://localhost:5173/admin/productos` — list renders, CRUD round-trips, image upload works, zod rejects empty name / oversized image.
- [ ] Diff review: every deleted line either moved to a primitive or was truly dead.

### 8.1 Commit

- [ ] `chore(client): remove dead code and .gitkeep files after refactor`

---

## 9. Files touched (summary)

### Modified
- `client/tailwind.config.ts`
- `client/src/index.css`
- `client/src/App.tsx`
- `client/src/pages/CatalogPage.tsx`
- `client/src/pages/ProductDetailPage.tsx`
- `client/src/pages/AdminLoginPage.tsx`
- `client/src/components/ProductCard.tsx`
- `client/src/components/VariantSelector.tsx`
- `client/src/components/PersonalizationInput.tsx`

### Created
- `client/src/components/ui/Button.tsx`
- `client/src/components/ui/Input.tsx`
- `client/src/components/ui/Textarea.tsx`
- `client/src/components/ui/Card.tsx`
- `client/src/components/ui/Spinner.tsx`
- `client/src/components/feedback/PageState.tsx`
- `client/src/pages/admin/AdminProductsPage.tsx` (replaces old location)
- `client/src/pages/admin/components/ProductListTable.tsx`
- `client/src/pages/admin/components/ProductForm.tsx`
- `client/src/pages/admin/components/ProductImageEditor.tsx`
- `client/src/pages/admin/components/ProductVariantEditor.tsx`
- `client/src/pages/admin/schema.ts`

### Deleted
- `client/src/pages/AdminProductsPage.tsx` (moved into `pages/admin/`)
- `.gitkeep` files where directories now have real content
- Any dead imports / helpers found during Step 6

### Not touched (out of scope)
- `client/src/services/api/*` — API wrappers are fine as-is.
- `client/src/lib/types.ts`, `client/src/lib/format.ts` — small and correct.
- Backend — anything.
- `zustand` — no cart until Phase 3.
- `@mercadopago/sdk-react` — Phase 4.

---

## 10. Verification (phase-completion gate)

Run all of these before declaring Phase 2.5 done. A human ticks them after reviewing the final commit.

1. `pnpm preflight` passes (tsc + vite build both packages, no type errors).
2. `pnpm dev` boots; visit:
   - `http://localhost:5173/` — catalog loads, cards render, category filter works.
   - `http://localhost:5173/productos/<slug>` — detail page loads, variant selector toggles, personalization textarea shows char count.
   - `http://localhost:5173/admin/login` — form validates (empty email → zod error), successful login redirects.
   - `http://localhost:5173/admin/productos` — list renders, "Nuevo producto" opens form, create + edit + delete round-trip, image upload (base64) still works, zod rejects empty name / oversized image.
3. Grep check: `grep -r "Cargando\.\.\." client/src/` returns hits **only** inside `PageState.tsx`.
4. Line-count check: `wc -l client/src/pages/admin/*.tsx client/src/pages/admin/components/*.tsx` — no file over 150 lines.
5. Git diff review: every deleted line either moved to a primitive or was truly dead.
6. Update `docs/tech-roadmap.md §10 Phase 2.5` — tick the six step boxes.

Once all six are green, Phase 2.5 is complete. Move to Phase 3 per `docs/tech-roadmap.md §10 Phase 3` — cart + guest-checkout foundation builds on the now-clean primitives.

---

## 11. Agent execution note

- Senior-frontend-specialist framing: React 18, TypeScript strict, Tailwind, **KISS > cleverness**. Prefer the boring, copy-paste-able solution. No premature abstraction.
- Commit after each of Steps 1–6 with descriptive messages (templates in each §). Do not squash.
- Run `pnpm preflight` before declaring any step done.
- Re-read §2 (non-goals) before every step. Scope-creep into Phase 3 is the failure mode.
- If the scope feels wrong mid-step, stop and flag to the user. Do not silently redesign.

---

*This plan replaces ad-hoc Phase 2.5 tracking. When every box in §§3–8 is ticked and §10 passes, Phase 2.5 is complete.*
