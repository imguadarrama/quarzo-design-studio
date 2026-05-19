---
name: refactor-components
description: Audit and refactor existing React components in Quarzo's client (client/src/) for code-smell violations. Fixes `let body` ladders by introducing the AsyncContent wrapper, replaces hand-repeated JSX with Array.map(), extracts shared HTML into wrappers with {children}, enforces the component-folder convention (one folder, .tsx + .module.scss, named export matches folder), enforces SCSS rules (tokens only, max 2 nesting levels, no tag selectors, semantic class names), removes raw `fetch()` in favor of the service layer, and eliminates `any` types. Runs `pnpm preflight` after edits. Use when the user says things like "refactor my components", "audit my components", "check if this is clean", "review this component", "clean up the catalog page", "this got messy", "fix this spaghetti".
---

# refactor-components — fix existing React code to match Quarzo's conventions

Quarzo's `client/src/` has accumulated `let body` ladders, ad-hoc JSX repetition, and SCSS that grew organically. This skill finds those violations, reports them with file:line references, applies fixes, and verifies the build passes.

For **new** components, use `clean-component`. This skill is for code that already exists.

## When to invoke

Trigger phrases:
- "refactor my components", "clean up my components"
- "audit `<file>`", "is `<X>` clean?", "review `<X>`"
- "fix the `let body` thing", "fix this spaghetti", "no code smells"
- "make this DRY", "extract a wrapper"
- After `audit-docs` reports drift in `CLAUDE.md`'s "Code style and architecture" section.

## Core principle

**Verify, then fix, then re-verify.** Never refactor without running `pnpm preflight` afterwards. TypeScript-strict + scoped SCSS modules means a sloppy rename silently breaks a class binding or leaves a dead import. The verify gate is non-negotiable.

## Files to know

**Canonical patterns (do NOT flag these):**

- `client/src/components/AsyncContent/AsyncContent.tsx` — the wrapper that replaces every `let body` ladder
- `client/src/components/PageState/PageState.tsx` — `PageLoading`, `PageError`, `PageEmpty`
- `client/src/components/PageSection/PageSection.tsx` — page shell with `prefix`, `actions`, `children`
- `client/src/components/Button/Button.tsx:17-18` — class composition via template string (this project's `clsx` substitute)
- `client/src/components/Spinner/Spinner.tsx:16-18` — class composition via filter-join (also fine)
- `client/src/services/api/fetchJson.ts` — `fetchJson<T>` is the single HTTP entrypoint
- `client/src/hooks/useAdminListResource.ts`, `useAdminDeleteFlow.ts`, `useFormSubmit.ts`
- `client/src/styles/_tokens.scss`, `_mixins.scss`

**Known `let body` locations (re-grep before trusting — this list goes stale):**

- `client/src/pages/admin/AdminProductsPage/AdminProductsPage.tsx:47`
- `client/src/pages/admin/AdminPalettesPage/AdminPalettesPage.tsx`
- `client/src/pages/admin/AdminDesignsPage/AdminDesignsPage.tsx`
- `client/src/pages/admin/AdminCategoriesPage/AdminCategoriesPage.tsx`
- `client/src/pages/CatalogPage/CatalogPage.tsx`

## Workflow

### Phase A — Resolve scope

Ask, in order:

1. **One file or sweep?** "Refactor `<file>`" vs "audit all of `client/src/`". Default to the explicit file the user named; if vague, propose `pages/admin/` or all pages.
2. **Apply or dry-run?** Default: report findings first, then ask permission before mutating. The user can pre-grant with "fix everything you find".

### Phase B — Audit (read-only)

For each in-scope file, walk the following checklist. Emit findings as `file:line — violation — proposed fix`.

#### B1. `let body` ladder

Grep for `let body` and `let body:`. Each hit is a violation. Fix with `<AsyncContent>`.

Use the **render-prop** form when the happy-path branch reads directly from `data`:

```tsx
<AsyncContent data={products} error={error} onRetry={reload} emptyTitle="..." emptyMessage="...">
  {(items) => <table><tbody>{items.map((p) => <Row key={p.id} product={p} />)}</tbody></table>}
</AsyncContent>
```

Use the **plain children** form when the data is already non-null in a closure (e.g., from `useMemo` after a guard).

Drop the `import type { ReactNode }` once the local `body` variable is gone — it becomes unused.

#### B2. Hand-repeated JSX

Flag any two or more consecutive JSX elements with the same tag that differ only in prop values that could come from an array:

```
<Tag prop="a" />
<Tag prop="b" />   ← violation
<Tag prop="c" />
```

Fix: lift to `const items = [...]` and render via `.map((item) => <Tag key={item.id} {...item} />)`.

#### B3. Missing wrapper abstraction

Flag only when **two or more** existing components share an identical JSX shell and differ only in inner content. The rule from `CLAUDE.md` is: "extract on the second duplicate, not the first." Three near-identical lines side-by-side are fine; an abstraction that has to bend to fit each caller is worse.

When flagging, propose a name for the wrapper and where it lives (`components/<Name>/`).

#### B4. Component file convention

For every file under `client/src/components/`:

- Is it inside a folder named exactly like the component?
- Is there a matching `<Name>.module.scss` co-located? (Exception: style-less components like `RequireAdmin.tsx` and `AsyncContent.tsx` at the folder root — intentional.)
- Does the named export match the folder name?
- Are cross-folder imports using `@/`? Same-folder using relative `./`?

#### B5. SCSS violations

For every `.module.scss`:

- Header must start with `@use "../../styles/tokens" as t;` (adjust depth). Flag if missing.
- Grep for raw hex (`#[0-9a-fA-F]{3,8}`), `rgb(`, bare `rem`, bare `px` (except `1px` borders). Each is a token violation.
- Count `&` nesting depth. If >2 levels deep — flag (tables `tbody td` are exempt).
- Grep for top-level tag selectors (`^button`, `^a`, `^input`, `^p` etc.) inside modules — flag, replace with a class.
- Class names: flag `.title` or `.box` that collides across files with a *different* meaning. Consistent reuse of the same semantic name across files is fine.

#### B6. Raw `fetch()` in components

Grep for `fetch(` outside `client/src/services/api/`. Each hit is a violation. Fix: move to a typed one-liner in `services/api/<resource>.ts` wrapping `fetchJson`, and import the wrapper in the component.

Also flag direct `apiFetch(` calls outside `services/api/`.

#### B7. `any` types

Grep for ` as any`, `: any`, `<any>` in `client/src/`. Fix by type:

- API response shape → add to `client/src/lib/types.ts` and use it.
- DOM event → use the correct `React.SyntheticEvent` subtype.
- Generic container → introduce a real generic parameter.

Never re-add `any` to silence the compiler.

#### B8. JWT in `localStorage` (security invariant)

Grep for `localStorage.setItem(` / `localStorage.getItem(` with keys containing `token`, `jwt`, or `auth`. Each is a critical violation. Fix: route through the cookie-based auth store (`store/adminAuth.ts`). This is a hard security rule from `CLAUDE.md`.

### Phase C — Report findings

Emit:

1. **Scope** — files audited (count + paths).
2. **Findings** — grouped by B1–B8. Each entry: `file:line — what — fix`. Use a table when the list is long.
3. **Refactor plan** — ordered task list. Apply in this order:
   1. B6 (service-layer extraction) — types flow downstream, fix first.
   2. B7 (`any` removal) — types must be correct before logic changes.
   3. B1 (`let body` → `AsyncContent`) — biggest win, touches many files.
   4. B2 (`.map()`) and B3 (wrapper extraction).
   5. B4 (file convention) — low risk now that imports are consolidated.
   6. B5 (SCSS) — pure presentational, last.
4. **Risk flags** — list any refactor that needs a decision before applying (e.g., a wrapper extraction that needs a name, a new token value).

### Phase D — Apply

**Safe (apply without asking):**
- `let body` → `<AsyncContent>` (mechanical swap)
- Raw `fetch()` → service wrapper where the endpoint already exists
- SCSS token substitution where the token already exists in `_tokens.scss`
- `any` → known type from `lib/types.ts`
- Unused `import type { ReactNode }` removal after `let body` is gone

**Ask first (risky):**
- Wrapper extraction (needs a name + location decision)
- Adding a new token to `_tokens.scss` (needs a value decision)
- Any rename that crosses folders
- Any change to `App.tsx`, `routes/*.tsx`, `services/api/fetchJson.ts`, or `services/api/client.ts`

Batch edits per file. Use `Edit` (not `Write`) — surgical changes only, never full rewrites.

### Phase E — Verify

After every batch of mutations:

```bash
pnpm preflight
```

If `preflight` fails:
- Missing import after rename → fix and re-run.
- Type error from removing `any` → narrow the type properly, never re-add.
- SCSS error → confirm the token name in `_tokens.scss` before guessing.

Do not declare done until `pnpm preflight` exits 0.

## Output format

After applying:

1. **Diff summary** — one bullet per file changed, with the violation it fixed.
2. **Preflight result** — paste the last 5 lines of output, or "PASSED".
3. **Outstanding** — any "ask first" item the user has not yet decided on.
4. **Near-violations** — files that have patterns close to a violation but conformant (e.g., a single element repetition — leave it, but note it).

## Hard rules

- **No `let body`.** Replace with `<AsyncContent>`.
- **No repeated JSX.** Same-shape elements → `.map()`.
- **No raw `fetch()`** outside `services/api/`.
- **No `any`** anywhere in `client/src/`.
- **No JWT in `localStorage`.** Security invariant — never introduce.
- **No Tailwind, no clsx, no `styled-components`.** SCSS modules only.
- **No tag selectors in SCSS modules.**
- **No raw values in SCSS.** If the token doesn't exist, ask before adding it.
- **No improvement for improvement's sake.** This skill fixes named violations. Ugly-but-conformant code stays. First-duplicate-no-extract applies.
- **No skipping `pnpm preflight`.**

## What this skill does NOT do

- Does not scaffold new components — use `clean-component`.
- Does not write tests.
- Does not edit server code. Scope is `client/src/`.
- Does not touch `services/api/fetchJson.ts` or `client.ts` without explicit user approval.
- Does not add tokens to `_tokens.scss` without confirming the value with the user.
- Does not commit — leaves the working tree dirty for the user to inspect.

## Example finding format

```
B1 — client/src/pages/admin/AdminProductsPage/AdminProductsPage.tsx:47
  `let body: ReactNode` ladder duplicates the canonical async-state shape.
  Fix: wrap table in <AsyncContent data={products} error={error} onRetry={reload}
       emptyTitle="Aún no hay productos" emptyMessage="Cuando agregues productos aparecerán aquí.">
       {(items) => <table>...</table>}</AsyncContent>.
  Drop `import type { ReactNode }` once `body` is gone.

B2 — client/src/pages/SomePage/SomePage.tsx:88
  Three consecutive <Chip label="..." /> calls.
  Fix: const chips = [{ id, label }, ...]; chips.map((c) => <Chip key={c.id} {...c} />).
```
