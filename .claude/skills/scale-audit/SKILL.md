---
name: scale-audit
description: Holistic scalability + maintainability audit of Quarzo's client (client/src/). Fans out three specialist agents IN PARALLEL — senior-frontend (mobile-first responsiveness), senior-architect (SOLID/DRY/scalability), qa-engineer (testability + recommend & scaffold a Vitest/RTL/Playwright stack) — synthesizes their findings into docs/client-scalability-audit.md, then auto-applies the necessary refactors and test scaffolding, verifying with pnpm preflight. Never commits or pushes. Use when the user says things like "is my codebase scalable", "audit my client", "is this mobile-first", "check SOLID/DRY", "do we need tests", "scalability review", "health check the frontend", "make this maintainable".
---

# scale-audit — is the client scalable, maintainable, mobile-first, and testable?

Answers one question about `client/src/` across three lenses, then fixes what's broken:

1. **Responsiveness** — is it genuinely mobile-first?
2. **Architecture** — does it honor SOLID / DRY?
3. **Quality** — is it testable, and does it need tests?

It fans out three specialist agents in parallel, synthesizes a prioritized plan, **auto-applies** the necessary refactors + test scaffolding, and verifies with `pnpm preflight`. The working tree is left dirty for the user to test — this skill **never commits or pushes**.

For a pure code-smell sweep without the architecture/responsiveness/testing fan-out, use `refactor-components`. For brand-new components, use `clean-component`. This skill is the holistic "is the whole client healthy?" pass.

## When to invoke

Trigger phrases:
- "is my codebase scalable / maintainable", "scalability review", "health check the frontend"
- "is this mobile-first", "is it responsive"
- "check SOLID / DRY", "audit the architecture"
- "do we need tests", "is this testable", "should we add tests"

## Core principle

**Analyze read-only in parallel, synthesize once, then fix verified.** The three agents never mutate — they report. All edits happen in one place (Phase D) and every batch ends with `pnpm preflight`. Never declare done until preflight exits 0.

## Files & tools to know

- `.claude/agents/senior-frontend.md`, `senior-architect.md`, `qa-engineer.md` — the three analysts this skill spawns.
- `refactor-components` skill — the canonical client code-smell fixer (B1–B8 + verify gate). **Compose it in Phase D** instead of re-implementing it.
- `client/src/styles/_mixins.scss` — the mobile-first breakpoint mixins (`screen-md`/`screen-lg` = `min-width`; `screen-below-md` = the only sanctioned `max-width`).
- `client/src/styles/_tokens.scss` — SCSS tokens. No raw values in modules.
- `pnpm preflight` (root) — the verify gate (`prisma generate` + `tsc` both + build both).
- `CLAUDE.md` → "Code style and architecture" — the rules the architect agent audits against.

## Workflow

### Phase A — Baseline

1. Confirm scope is `client/src/` (this skill does not touch server code). If the user named a sub-area, narrow to it.
2. Run `pnpm preflight` to establish a green baseline. If it already fails, report that first — do not inherit a broken tree silently and blame the audit for it.

### Phase B — Parallel analysis (read-only)

Spawn all three agents **in a single message, three `Agent` tool calls** so they run concurrently:

- `subagent_type: senior-frontend` — mobile-first responsiveness + SCSS-token discipline.
- `subagent_type: senior-architect` — SOLID/DRY/scalability against `CLAUDE.md`.
- `subagent_type: qa-engineer` — testability + recommend & scaffold the test stack.

Give each the same scope (`client/src/`) and let its own charter drive the output schema. They return structured findings; relay nothing to the user yet — wait for all three.

### Phase C — Synthesize the plan

Merge and de-duplicate findings (the architect and frontend agents will overlap on SCSS/`any`). Assign each a severity and order the fix list by dependency:

1. **Types** — `any` removal, centralize shapes in `lib/types.ts`.
2. **Service layer** — raw `fetch`/`apiFetch` → `fetchJson` wrappers.
3. **`let body` ladders** → `AsyncContent`.
4. **`.map()` + wrapper extraction** (DRY, second-duplicate rule).
5. **Component-file convention** (folder/export/`@/` imports).
6. **SCSS** (tokens, nesting, tag selectors, semantic names).
7. **Responsiveness** (breakpoints, fluid layout, touch targets).
8. **Tests last** — scaffold the stack + seed examples.

Write the full audit + this ordered plan to `docs/client-scalability-audit.md` as the durable record. Then show the user a concise summary.

### Phase D — Auto-refactor

Apply in the Phase-C order. The user has opted into full auto-refactor — apply without asking for each item, **except** the "ask first" cases below.

- **Client code-smells (steps 1–6):** invoke the `refactor-components` skill to do the mechanical work — it already encodes the B1–B8 fixes and the safe/ask-first split. Do not duplicate its logic here.
- **Responsiveness (step 7):** apply the frontend agent's fixes — swap desktop-first media queries for the mobile-first mixins, replace fixed widths with fluid values, fix touch targets. Use existing tokens; if a value isn't tokenized, **ask before adding it to `_tokens.scss`**.
- **Tests (step 8):** scaffold the QA agent's recommended stack:
  - Add the dev-deps to `client/package.json` (Vitest, React Testing Library, `@testing-library/jest-dom`, `jsdom`, Playwright).
  - Create the config (`client/vitest.config.ts` or a `test` block in `vite.config.ts`, `client/src/test/setup.ts`, `client/playwright.config.ts`).
  - Add the `pnpm` test script(s) and seed 1–2 example tests against the highest-value targets the QA agent named (start with pure `lib/` helpers + a zod schema).
  - Because deps live in container volumes, the user must run `pnpm dev:rebuild` before the new deps resolve — call this out; do not run host `pnpm install`.

Batch edits per file. Use `Edit` for surgical changes, `Write` only for new files.

### Phase E — Verify

After each batch: `pnpm preflight`. If test deps changed `client/package.json`, note the `pnpm dev:rebuild` requirement and (once rebuilt) run the new `pnpm --filter client test` to confirm the example tests pass.

Add the new test command(s) to `CLAUDE.md` → "Common commands" — that file explicitly says to do so when a runner is added, and remove the "There is no test runner" line once one exists.

### Phase F — Report

1. **Audit summary** — the three verdicts (mobile-first? SOLID/DRY? testable?) in one line each, linking `docs/client-scalability-audit.md`.
2. **Diff summary** — one bullet per file changed, with the issue it fixed.
3. **Preflight result** — last lines, or "PASSED".
4. **Outstanding** — any "ask first" item (new token, risky extraction) awaiting a decision, plus the `pnpm dev:rebuild` reminder if deps were added.
5. **Reminder** — working tree is dirty and uncommitted, ready for the user to test locally.

## Hard rules

- **Never commit or push.** Apply to the working tree only; the user tests locally and decides when to push.
- **Analysts are read-only.** All mutation happens in Phase D, never inside the three agents.
- **Compose, don't duplicate.** Reuse `refactor-components` for client smells.
- **Honor every `CLAUDE.md` invariant:** SCSS modules only (no Tailwind/clsx), no `any`, no JWT in `localStorage`, no raw `fetch` outside `services/api/`, no raw values in SCSS, max 2 nesting levels, no tag selectors.
- **Scope is `client/src/` + client config only.** No server code, no Prisma, no migrations.
- **Ask before:** adding a token to `_tokens.scss`, a wrapper extraction needing a name, any cross-folder rename, edits to `App.tsx` / `routes/*` / `services/api/{fetchJson,client}.ts`.
- **Don't host-install.** Test deps land in `package.json`; resolution needs `pnpm dev:rebuild`.
- **No skipping `pnpm preflight`.**

## What this skill does NOT do

- Does not audit or edit server code.
- Does not commit, push, or open a PR.
- Does not run `pnpm install` on the host or rebuild containers itself — it tells the user to `pnpm dev:rebuild`.
- Does not chase 100% test coverage — it seeds a thin, high-value suite per the QA agent.
- Does not add SCSS tokens or perform risky extractions without confirming first.
