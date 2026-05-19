---
name: clean-component
description: Generate new clean React components for Quarzo's client (Vite + React + SCSS modules, TypeScript strict, no Tailwind, no React Query). Enforces the component-folder convention, Array.map() for all lists, AsyncContent for async data states, SCSS-token discipline, and reuse of existing primitives (Button, Card, Typography, Input, FormField, Textarea, Spinner, PageLoading/PageError/PageEmpty, PageSection, AsyncContent, ConfirmDialog) and hooks (useFormSubmit, useAdminListResource, useAdminDeleteFlow). Use when the user says things like "create a ProductCard component", "build the catalog page", "generate a component for X", "scaffold a new admin page", "I need a wrapper for Y".
---

# clean-component — scaffold React components that pass review on the first try

Quarzo's client (`client/src/`) follows a tight convention: one folder per component, semantic SCSS modules with tokens, no Tailwind, no clsx, no React Query, no `let body` ladders for async UIs. This skill writes new components that already comply, instead of writing them sloppy and refactoring later.

For auditing or fixing **existing** components, use `refactor-components` — not this skill.

## When to invoke

Trigger phrases:
- "create a `<Name>` component", "build a component for X", "generate a `<Name>`"
- "scaffold the catalog page", "I need a new admin page for Y"
- "add a wrapper that does X"
- "write the PDP", "write the cart drawer"

Do **not** invoke for: pure SCSS edits, prop additions to an existing component, file renames. Those are direct `Edit` jobs.

## Files to know (the reuse surface)

Before writing anything, grep these paths to know what already exists.

**Primitives (always prefer over raw HTML):**

- `client/src/components/Button/Button.tsx` — `<Button>`, `<ButtonLink>`
- `client/src/components/Typography/Typography.tsx` — `<Typography as size>` (use instead of raw `<h1>`/`<p>` with a class)
- `client/src/components/Card/Card.tsx`
- `client/src/components/Input/Input.tsx`, `Textarea/Textarea.tsx`
- `client/src/components/FormField/FormField.tsx` — label + error wrapper (never re-roll `<label>` + error `<p>`)
- `client/src/components/Spinner/Spinner.tsx`
- `client/src/components/PageState/PageState.tsx` — `PageLoading`, `PageError`, `PageEmpty`
- `client/src/components/PageSection/PageSection.tsx` — page shell (title, subtitle, actions, prefix, children)
- `client/src/components/ConfirmDialog/ConfirmDialog.tsx`
- `client/src/components/AsyncContent/AsyncContent.tsx` — async-state wrapper (see "AsyncContent contract" below)
- `client/src/components/NavBar/NavBar.tsx` — every navbar variant MUST use this as outer shell

**Hooks:**

- `client/src/hooks/useFormSubmit.ts` — wrap any async submit handler
- `client/src/hooks/useAdminListResource.ts` — admin GET-list with reload + setData
- `client/src/hooks/useAdminDeleteFlow.ts` — two-click delete with per-row error state

**Services (all HTTP goes here — never raw `fetch()`):**

- `client/src/services/api/fetchJson.ts` — `fetchJson<T>()` + `ApiError`
- `client/src/services/api/admin.ts`, `products.ts`, `uploadImage.ts` — one-line wrappers; add to these, never call `fetchJson` from a page

**Tokens & mixins:**

- `client/src/styles/_tokens.scss` — every color, space, font, radius, breakpoint
- `client/src/styles/_mixins.scss` — `focus-ring`, `flex-center`, `sticky-header`, `screen-md`, `screen-lg`, `below-md`, `form-error-banner`

**Types:**

- `client/src/lib/types.ts` — server response shapes; do not redeclare them in pages or services

## Workflow

### Step 1 — Resolve intent

In order, determine:

1. **What is it?** Component name + what it renders (one sentence).
2. **Where does it live?** `components/<Name>/` (reusable) vs `pages/<Group>/<Name>Page/` (route target) vs a sub-folder under an existing page.
3. **Async data?** If yes — what endpoint, what response type, what's the empty-state copy.
4. **Form?** If yes — `react-hook-form` + `zod`, schema in a sibling `schema.ts`.
5. **Reusable wrapper potential?** Will a second consumer want this same outer shell? If yes, `children: ReactNode` is mandatory.

Use `AskUserQuestion` only when truly ambiguous. Single-answer cases just decide.

### Step 2 — Find what to reuse

Before writing anything, grep:

```
Grep: pattern="export function"  path=client/src/components
Glob: client/src/hooks/*.ts
Glob: client/src/services/api/*.ts
```

If a similar component or hook already exists, extend or compose it. State explicitly: *"reusing `<X>` from `<path>`"* or *"no existing primitive matches, creating new"*.

### Step 3 — Decide structure

Walk this decision tree:

- Renders a **list**? → `array.map()`, never repeated JSX blocks.
- Reads **async data**? → wrap the happy path in `<AsyncContent>`. Never write `let body`.
- Two consumers share the **same outer HTML**? → make it a wrapper with `children: ReactNode`. The wrapper holds the shell; the children hold the content.
- Has **forms**? → `useForm` from `react-hook-form` + `zodResolver`, schema in `schema.ts`. Submit via `useFormSubmit`.
- Calls an **endpoint**? → add a one-line wrapper in `services/api/<file>.ts`. The page imports the wrapper, never `fetchJson` directly.

### Step 4 — Write the pair

Always two files, co-located:

```
client/src/components/<Name>/<Name>.tsx
client/src/components/<Name>/<Name>.module.scss
```

(Or under `pages/` for route targets — same convention.)

**The `.tsx`:**

- Props interface immediately above the function.
- Named export matches the folder name.
- No `React.FC`. Plain `function Name(props: NameProps)`.
- Cross-folder imports use `@/`. Same-folder imports use `./Foo`.
- `useState`/`useEffect` only when state is genuinely local. If the same pair would appear in a sibling, extract a hook to `client/src/hooks/`.

**The `.module.scss`:**

- Header: `@use "../../styles/tokens" as t;` (adjust depth) and `@use "../../styles/mixins" as m;` if mixins are used.
- Class names are semantic (`.row`, `.errorBanner`, `.chipActive`), not generic (`.box`, `.wrapper`).
- Max **2 levels of nesting**. Tables (`tbody td`) are the only exception.
- No tag selectors inside modules — always class-based.
- Every value is a `t.$...` token. Raw colors, raw `px` (except border widths), raw hex are forbidden. If a value isn't tokenized, add it to `_tokens.scss` first.

### Step 5 — Self-verify

Before declaring done, walk this checklist out loud:

- [ ] One folder, two files. Named export matches folder name.
- [ ] No raw `fetch()`. All HTTP through `services/api/`.
- [ ] No `clsx`. Class composition uses template strings: `` `${styles.a} ${flag ? styles.b : ""}` ``.
- [ ] No `any`. Narrow with zod or type guards.
- [ ] Every list rendered via `.map()`.
- [ ] Async data wrapped in `<AsyncContent>`, not `let body`.
- [ ] Shared HTML structure → wrapper with `{children}`.
- [ ] SCSS: tokens only, ≤2 nesting, semantic class names, no tag selectors, `@use` header present.
- [ ] Cross-folder imports use `@/`. Same-folder use relative `./`.
- [ ] Spanish copy for all user-visible strings.

## The AsyncContent contract

`AsyncContent` is the wrapper that replaces every `let body` ladder. It lives at `client/src/components/AsyncContent/AsyncContent.tsx`.

**Signature:**

```tsx
function AsyncContent<T>({
  data,           // T | null | undefined — null/undefined = still loading
  error,          // string | null
  onRetry?,       // () => void
  emptyTitle?,    // string (default: "No hay nada por aquí todavía")
  emptyMessage?,  // string
  loadingLabel?,  // string
  children,       // ReactNode | ((data: NonNullable<T>) => ReactNode)
})
```

**Guard order:** `error` → `data == null` → empty array → children.

**Two children forms:**

```tsx
// Plain children (data already narrowed in closure):
<AsyncContent data={product} error={error}>
  <ProductDetail product={product!} />
</AsyncContent>

// Render-prop (TypeScript narrows data for you):
<AsyncContent data={products} error={error} onRetry={reload} emptyTitle="Sin productos">
  {(items) => (
    <ul>{items.map((p) => <ProductCard key={p.id} product={p} />)}</ul>
  )}
</AsyncContent>
```

Use the render-prop form whenever the happy-path JSX reads directly from `data`.

## Output format

1. **Reuse decisions** — bullet list of what was reused vs. newly created, and why.
2. **Files written** — absolute paths, one per line.
3. **Token additions** — if any new token was added to `_tokens.scss`, list it with value and rationale.
4. **Wire-up needed** — what route to register in `App.tsx` / `routes/`, what service wrapper was added.
5. **Self-verify checklist** — paste Step-5 with every item ticked, or explicitly call out any conscious exceptions.

## Hard rules

- **No Tailwind. No clsx. No `styled-components`.** SCSS modules only.
- **No `let body`.** Always `<AsyncContent>`.
- **No repeated JSX.** Same-shape elements → `.map()`.
- **No raw `fetch()`** in component code. Always `services/api/...`.
- **No `any`** to silence the compiler. Narrow with zod or a type guard.
- **No tag selectors in SCSS modules.**
- **No raw values in SCSS.** Add to `_tokens.scss` first.
- **No new component without a named export matching the folder name.**
- **Spanish copy** for all user-facing strings.

## What this skill does NOT do

- Does not edit existing components — use `refactor-components`.
- Does not write tests (no test runner is wired up).
- Does not register routes in `App.tsx` — it tells the user to do it.
- Does not run `pnpm preflight` (new single-component scope is small; user runs it).
- Does not invent endpoints — if a backing endpoint doesn't exist, surface the gap and stop.
