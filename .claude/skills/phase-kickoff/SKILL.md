---
name: phase-kickoff
description: Produce a step-by-step execution playbook for a Quarzo roadmap phase. Audits the current repo state against docs/tech-roadmap.md §10, identifies what's done / partial / missing, asks clarifying scope questions, then writes docs/phase-<N>-execution-plan.md with baseline verification, security checklist, ordered cleanup + build tasks, E2E verification, and a debugging appendix. Use when the user says things like "I'm starting phase 3", "help me with phase 4", "I made a mess of phase X", "plan phase 5 for me", "what do I need to finish phase 2".
---

# phase-kickoff — start a Quarzo phase with a playbook, not vibes

Quarzo is built in phases (see `docs/tech-roadmap.md` §10). Every phase has acceptance bullets, but no per-phase execution plan. Users (especially the owner, who is learning auth / backend / deploy end-to-end) end up half-building, getting confused, and asking "wait, what's actually done?" This skill turns a phase into a single markdown checklist they can execute and debug with Postman.

## When to invoke

Trigger phrases:
- "starting phase N", "ready to start phase N"
- "help me with phase N", "plan phase N"
- "I made a mess of phase N", "I'm stuck on phase N"
- "what do I need for phase N", "what's left in phase N"

Also appropriate: after `audit-docs` reports a phase is partially complete, this skill is the natural follow-up.

## Core principle

**Respect what's already there.** Most of the time the user has already written working code for the phase. The plan's job is to *verify + clean up + harden*, not rebuild. Only propose new feature work for roadmap bullets that are genuinely unbuilt.

## Workflow

### Phase A — Identify the target phase

1. Read `docs/tech-roadmap.md`. Find §10 "Delivery phases".
2. Resolve the user's reference:
   - Explicit number ("phase 3") → use that.
   - "The current phase" / "this phase" → the first unchecked (or partially-checked) phase.
   - Ambiguous → ask the user with `AskUserQuestion`.
3. Record every bullet under that phase verbatim — those are the acceptance criteria.

### Phase B — Audit current state

Launch up to **3 Explore agents in parallel** in a single message. Split by concern — each agent gets a narrow focus and reports back with file paths, line numbers, and what's half-finished. No proposed fixes in agent output.

Standard three-agent split:

1. **Server audit** — directory tree of `server/src/`, endpoints that exist, auth/middleware state, validation patterns, anything messy (commented code, duplicates, inconsistent error handling, TODOs). Focus on the phase's bullets.
2. **Client audit** — directory tree of `client/src/`, routes in `App.tsx`, pages/components that exist, state stores, API calls, Tailwind/styling state, any half-finished UI.
3. **Schema + infra audit** — `server/prisma/schema.prisma` models, migrations, `server/src/seed.ts`, `server/src/config/env.ts`, `.env.example`, `docker-compose.yml`, relevant deps in both `package.json`s, and the phase's relevant `docs/tech-roadmap.md` sections.

For small phases (1–2 bullets), a single Explore agent is fine.

### Phase C — Classify every roadmap bullet

For each bullet under the target phase, classify:

- **Done** — working code exists; write verification steps for §2 of the output doc.
- **Partial** — some code exists but gaps remain; list the specific gaps for §4/§5.
- **Missing** — no code; list as new feature work in §5 or a new "Build" section.

### Phase D — Ask clarifying questions

Use `AskUserQuestion`. Standard questions (skip any already-answered):

- **Approach:** clean up + fill gaps vs rebuild from scratch vs hybrid. Default recommend "clean up + fill gaps."
- **Storage / integration decisions** relevant to this phase (e.g., image storage in Phase 2; payment provider in Phase 4; email provider in Phase 4).
- **Scope edges:** include any architectural scaffolding from the next phase for coherence, or strictly this phase only. Default recommend "strictly this phase."

Do not ask questions the roadmap already answers unambiguously (e.g., don't ask which auth method — `docs/tech-roadmap.md` §8 locks JWT-in-httpOnly-cookie with bcrypt 12).

### Phase E — Write the playbook

Write to `docs/phase-<N>-execution-plan.md` (where `<N>` is the phase number). Structure:

0. **How to use this doc** — Postman setup (collection vars `baseUrl`, relevant creds; cookie jar ON), env prereqs, checkbox convention, path convention (`file:line`).
1. **Audit** — three tables: "Working (do not rewrite)", "The mess (cleanup targets)", "Out of scope for this phase". Include file paths + line numbers for every entry.
2. **Baseline verification** — Postman recipes for every endpoint already built. Each recipe uses the block format below. Cover the happy path top to bottom.
3. **Security hardening** — checklist. Each item is a **property to verify** with one-line italic rationale. Prefer "verify in file X" over "rewrite X" when the property is already enforced. Must-have items where applicable:
   - Secrets (JWT_SECRET length, bcrypt cost, env validation, .gitignore)
   - Cookie flags (httpOnly, SameSite, Secure-in-prod)
   - No user enumeration (identical error messages)
   - Token tampering rejection
   - Missing-auth rejection
   - No self-registration backdoors
   - Transport: helmet + CORS explicit origin
   - No secrets leaked in responses (grep `passwordHash`)
4. **Server cleanup** — ordered tasks, each with file path and Postman verification immediately after.
5. **Client cleanup / build** — ordered tasks, each with file path and browser verification.
6. **End-to-end verification** — single checklist to run once to prove the phase is done: clean boot, seed, full Postman run, full browser walk, mobile responsive check, then update the corresponding `docs/tech-roadmap.md` §10 checkbox.
7. **Debugging appendix** — the 3-4 most likely failure modes for this phase, each with diagnosis + fix. Draw these from the phase's specific risks (auth → cookie-flag issues; payments → webhook signature; email → DNS/sender verification; etc.).

### Phase F — Stop

**Do not implement any of the cleanup or build work yourself.** The doc is the deliverable. The user executes it to learn. This is non-negotiable — the project is explicitly pedagogical per `CLAUDE.md`.

If the user explicitly asks you to start implementing a specific section after reading the doc, fine — start with the first unchecked task in that section.

## Format conventions (required in output doc)

- Every task line: `- [ ] …`.
- Endpoint recipes are fenced code blocks:
  ```
  POST {{baseUrl}}/admin/products
  Content-Type: application/json
  (cookie auto-sent)

  { "slug": "...", "name": "...", ... }

  → 201 Created
  { "product": { "id": "...", ... } }
  ```
- File paths are from repo root: `server/src/routes/admin-auth.ts:18`.
- Spanish error messages: grep the actual route to get the exact string. Never invent.
- Security items include a short *rationale* in italics.
- No aspirational claims. Only describe what the code does today, or what it will do after a specific listed change.

## Hard rules

- **Read-only during audit and planning.** No code edits, no non-read tool use, until the playbook file is written and the user tells you to proceed with the work inside it.
- **Do not propose replacing pedagogical stack choices.** bcrypt / JWT / Prisma / Docker / build-your-own auth stay. Do not suggest Auth0 / Clerk / Firebase Auth — they are explicitly out per `CLAUDE.md`.
- **Do not propose admin self-registration endpoints.** Admin is seeded only.
- **Do not propose storing JWTs in localStorage.** HttpOnly cookie only.
- **Do not invent brand identity.** If the phase has visual work and the client hasn't delivered logo/palette/typography yet, flag the blocker instead of inventing.
- **Do not forget the `.js` import extension** in TypeScript examples that import local files (NodeNext ESM).
- **Do not write content into `MEMORY.md`** as part of this skill. Memory lives elsewhere; this skill only writes to `docs/phase-<N>-execution-plan.md`.

## Example invocations

- *"I'm starting phase 3, set me up"* → audit client cart state, audit server order routes (scaffolded only), ask about shipping-rate source, produce `docs/phase-3-execution-plan.md`.
- *"I think phase 2 is done but I made a mess"* → audit, find most bullets done but with cleanup needs, produce `docs/phase-2-execution-plan.md` focused on verify + clean up.
- *"Help me plan phase 4 payments"* → audit `mercadopago` SDK usage (likely zero), ask for MP test credentials + Resend account status, produce `docs/phase-4-execution-plan.md` heavy on integration setup + webhook security.

## What this skill does NOT do

- Does not run `pnpm dev`, migrations, or any mutating command.
- Does not edit code. (`docs/phase-<N>-execution-plan.md` is the only file it writes.)
- Does not update `docs/tech-roadmap.md` checkboxes — that's the `audit-docs` skill's job after the user finishes the work.
- Does not replace `audit-docs`. Use `audit-docs` to check doc drift; use this skill to plan a phase's execution.
