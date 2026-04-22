---
name: audit-docs
description: Audit Quarzo's living docs against the repo's real state. Reads README.md, CLAUDE.md, and every file under docs/, then cross-references them against git state, the file tree, package scripts, env vars, and Prisma schema. Reports drift (broken links, outdated references, wrong phase checkboxes, stale commands) and proposes/applies fixes. Use when the user asks things like "audit my docs", "verify progress", "are my docs updated", "what phase am I on", after finishing a phase, or before a release.
---

# audit-docs — keep Quarzo's docs honest

Quarzo ships with a set of living docs (`README.md`, `CLAUDE.md`, `docs/tech-roadmap.md`, `docs/CI-CD/deploy-setup.md`, `docs/client/discovery-with-client.md`, plus anything else under `docs/`). They are the project's source of truth for "what are we building, where are we, what's next." They **will** drift from reality as code lands. This skill finds that drift and fixes it.

The user's stated goal: *"track what I've done, what I'm doing, and what I need to do so I can deliver this app the best way possible."* Orient every check toward that goal.

## When to invoke

Trigger phrases: "audit my docs", "check if docs are updated", "verify progress", "what phase am I on", "sync docs", "what's next", "are docs still accurate".

Also appropriate:
- After finishing a phase from `docs/tech-roadmap.md` §8.
- After a non-trivial commit or branch merge into `main`.
- Before starting a new phase — to confirm the previous one is really done.

## Files to read (source-of-truth surface)

Read these every invocation:

1. `README.md` (repo root) — dev onboarding, commands, ports, env table, troubleshooting.
2. `CLAUDE.md` (repo root) — architecture conventions and invariants.
3. `docs/tech-roadmap.md` — phased plan, scope, data model, open decisions.
4. Every `*.md` under `docs/**` (currently `docs/CI-CD/deploy-setup.md`, `docs/client/discovery-with-client.md` — adapt to whatever exists).

Also read (to ground truth):

- `git log --oneline -20` — recent commits.
- `git status` + `git branch --show-current` — uncommitted changes, current branch.
- File tree snapshots of `server/src/`, `client/src/`, `server/prisma/migrations/`, `.github/workflows/` (if exists).
- `package.json` scripts (root, `server/`, `client/`).
- `.env.example` — declared variables.
- `server/src/config/env.ts` — Zod env schema.
- `docker-compose.yml` — services and ports.
- `server/prisma/schema.prisma` — models.

## Audit checks

Run these in order. For each, emit either "OK" or a specific finding with file:line.

### 1. Phase progress vs. reality
For each checkbox in `docs/tech-roadmap.md` §8, check whether the work actually exists in the repo. Examples:

- **Phase 1** — Docker Compose has `db`/`api`/`web`? `server/prisma/schema.prisma` has all models? First migration committed under `server/prisma/migrations/`? `server/prisma/seed.ts` exists?
- **Phase 2** — `server/src/routes/` has a products route? `server/src/middleware/requireAdmin.ts` exists? `client/src/pages/` has Catalog + ProductDetail?
- **Phase 3+** — keep going with the same pattern.

Report any checkbox that is **checked but not done**, or **done but unchecked**. Never trust the checkbox alone; always verify against the filesystem.

### 2. Internal link integrity
For every `[text](path)` link in every .md under the repo, verify the target exists. Flag broken links with `file:line → target` and the fix.

### 3. Outdated references
Scan for known stale text:

- "Railway" as a deploy target → replace with "Cloudflare Pages + Fly.io + Neon" (canonical per `docs/CI-CD/deploy-setup.md`).
- Old filenames (e.g. `wife-store-discovery.md`, `wife-store-resumen-descubrimiento.docx`, `wife-store-tech-roadmap.md`) → use current names (`docs/client/discovery-with-client.md`, `docs/tech-roadmap.md`, etc.).
- Port numbers, env var names, command names that don't appear in the current code.
- Library names in `CLAUDE.md` that aren't in `package.json` dependencies (server or client).

### 4. Command accuracy
Every command in `README.md` "First-time setup" / "Daily workflow" sections must exist as a pnpm script in root `package.json`, or be a well-known CLI (git, docker, curl). Flag any that don't resolve.

### 5. Env var coverage
Every var in `.env.example` should be:

- Validated by the Zod schema in `server/src/config/env.ts`, **and**
- Documented in the `README.md` "Environment variables" table.

Flag vars missing from either side, and vars validated/documented but not in `.env.example`.

### 6. Git-state sanity
- Report current branch and last commit.
- Report count of unpushed commits (if any).
- Report uncommitted changes (just list, don't act).
- If the current branch is `main`, note that any audit-proposed edits will be committed directly — ask before writing.

### 7. Open decisions status (`docs/tech-roadmap.md` §3)
For each open decision, check for evidence it's been closed:

- **Domain name** → is a concrete domain referenced in `deploy-setup.md` or `.env`? If yes, propose updating §3.
- **Transactional email provider** → is a specific provider (Resend / Brevo / SES) referenced in code or deps?
- Same pattern for CFDI, return policy, shipping table, categorization.

Don't invent closure — require evidence in the repo.

## Output format

Emit a single report in this order:

1. **Current state** — branch, last commit message (short), inferred-from-filesystem phase (NOT the checkbox count), uncommitted change summary.
2. **Phase progress** — a table: `Phase | Item | Checkbox | Reality | Notes`. One row per checkbox item.
3. **Drift findings** — bulleted list. Each bullet: `file:line — finding — one-line fix`.
4. **Recommended next steps** — the next 3–5 concrete tasks the user should work on, pulled from the roadmap and filtered to what isn't already done.
5. **Proposed doc edits** — explicit list of edits to apply, one per finding. Group by file.

Keep the report scannable. Tables and bullets, not paragraphs.

## Applying edits

After presenting the report, apply the **safe** edits directly using the `Edit` tool. Ask the user before applying the **risky** ones.

**Safe (apply without asking):**
- Fixing a broken internal link when the new path is unambiguous.
- Updating a command name that was renamed in `package.json`.
- Checking or unchecking a phase item to match filesystem reality.
- Replacing "Railway" with the current deploy stack.
- Fixing file references to renamed/moved files (e.g. `docs/discovery-with-client.md` → `docs/client/discovery-with-client.md`).
- Correcting a port number, env var name, or library name that no longer matches code.

**Ask first (risky):**
- Rewording a section for clarity.
- Adding a new section or checklist item.
- Changing phase definitions or scope.
- Marking an Open Decision as closed (requires user confirmation of the decision).
- Any edit to `CLAUDE.md` conventions/rules (vs. mere factual corrections).
- Any edit when the current branch is `main` (commit there should go through a PR).

When applying, batch edits per file and keep each change minimal — the goal is to remove drift, not to editorialize.

## What NOT to do

- Don't rewrite sections that are already accurate just to "improve" them. This skill fixes drift, not style.
- Don't trust checkboxes. The filesystem and git log are ground truth; checkboxes are claims to verify.
- Don't add new phases, checklists, or scope items — that's planning, not auditing. Surface the gap in "Recommended next steps" and let the user decide.
- Don't mark Open Decisions as closed without repo-based evidence.
- Don't touch files outside the documentation surface (no code edits, no package.json changes). If code needs to change to match docs, flag it — don't do it.
- Don't run any destructive git commands. Reads only on git.

## Example finding (format reference)

```
- README.md:132 — link `[docs/discovery-with-client.md]` is broken; file is at `docs/client/discovery-with-client.md`.
  Fix: update the href.

- docs/tech-roadmap.md:425 — Phase 7 says "Deploy to Railway; connect Postgres add-on", but §6 Deployment was changed to Cloudflare Pages + Fly.io + Neon.
  Fix: replace with "Deploy via workflow_dispatch per docs/CI-CD/deploy-setup.md; point DNS at Cloudflare Pages + Fly.io".

- docs/tech-roadmap.md:449–451 — "For a new engineer" section references `wife-store-discovery.md`, `wife-store-resumen-descubrimiento.docx`, `wife-store-tech-roadmap.md`. None exist; current names are `docs/client/discovery-with-client.md` and `docs/tech-roadmap.md`.
  Fix: replace the three filenames.
```
