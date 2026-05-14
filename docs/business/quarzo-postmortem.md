# Quarzo — Project Post-Mortem

> Fill this out **after Quarzo ships**. It's the single most valuable input for pricing project #2. Be honest with yourself — overestimates of your speed are the most expensive mistake a freelancer makes, and the only way to fix them is to look at real data.

---

## Project summary

- **Estimated duration (at start):** ~30 business days
- **Actual duration (at ship):** {{fill in}} business days
- **Calendar duration (start → ship):** {{fill in}} weeks
- **Overrun ratio:** Actual / Estimated = {{fill in}}x
- **Hypothetical price quoted:** MXN ${{fill in}} (what you would have quoted if this were a paid client)
- **Effective hourly rate:** quoted price ÷ actual hours worked = MXN ${{fill in}} / hr

If the effective hourly rate is below your target, the quote was too low for the actual scope. The next section is how you avoid that.

## Phase-by-phase actuals

Fill in from `docs/tech-roadmap.md` §10 and git history.

| Phase | Estimated days | Actual days | Delta | Why? |
|---|---:|---:|---:|---|
| Phase 1 — Foundation | {{...}} | {{...}} | {{...}} | {{...}} |
| Phase 2 — Auth + admin | {{...}} | {{...}} | {{...}} | {{...}} |
| Phase 2.5 — Frontend rebuild | {{...}} | {{...}} | {{...}} | {{originally not scoped — counts as scope creep}} |
| Phase 2.6 — R2 image storage | {{...}} | {{...}} | {{...}} | {{originally not scoped}} |
| Phase 2.7 — Designs/palettes/categories | {{...}} | {{...}} | {{...}} | {{originally not scoped at this depth}} |
| Phase 3 — Cart + guest checkout | {{...}} | {{...}} | {{...}} | {{...}} |
| Phase 4 — Payments | {{...}} | {{...}} | {{...}} | {{...}} |
| Phase 5 — Customer accounts | {{...}} | {{...}} | {{...}} | {{...}} |
| Phase 6 — Admin polish | {{...}} | {{...}} | {{...}} | {{...}} |
| Phase 7 — Launch | {{...}} | {{...}} | {{...}} | {{...}} |
| **Total** | | | | |

## Top 5 things that took longer than expected

For each, write: what happened, why, and what you'll do differently.

1. {{e.g. "Frontend rebuild from Tailwind to SCSS modules — discovered Tailwind was the wrong tool for the brand aesthetic mid-project. Next time: pick the styling approach during discovery, not after the first screen ships."}}
2. {{...}}
3. {{...}}
4. {{...}}
5. {{...}}

## Features that emerged mid-project

Things the discovery call did not surface but that real work required. **These become permanent additions to `discovery-checklist.md`.**

- [ ] {{e.g. "Forgot password flow — never discussed in the discovery call. ~3 days of work including email infra setup."}}
- [ ] {{e.g. "Transactional email infrastructure (Resend, domain verification, templates) — implicit in 'auth' but not separately quoted."}}
- [ ] {{e.g. "Image processing pipeline (R2, Sharp, EXIF strip) — assumed 'just upload to a folder' would work."}}
- [ ] {{e.g. "Slug aliases — old URLs breaking on slug edits wasn't on the radar until I noticed it."}}
- [ ] {{e.g. "Per-PR preview environments — wasn't required, but the muscle memory of building it ate days."}}

For each item, add a matching question to the corresponding section of `discovery-checklist.md`.

## First-time tax (do not repeat in future projects)

Time spent on things you only build once per stack. Subtract this from your "feature cost" estimate for project #2.

| Item | Days | Will I rebuild it for project #2? |
|---|---:|---|
| Docker / Compose setup | {{...}} | No — fork repo |
| CI/CD workflows (GitHub Actions, Fly, Cloudflare Pages) | {{...}} | No — fork |
| Per-PR preview environment infra | {{...}} | No — fork |
| Auth from scratch (JWT in cookie, middleware) | {{...}} | Maybe — depends on if next client needs custom auth |
| Image pipeline (R2 + Sharp) | {{...}} | No — fork |
| Prisma schema patterns, error envelope, serializers | {{...}} | No — fork |
| SCSS token system | {{...}} | Partially — token names will change |
| {{Other one-time setup}} | {{...}} | |
| **Total first-time tax** | | |

The next project's quote can deduct most of this. That's the compound interest of building your own toolkit.

## What I'd change about how I quoted Quarzo (if it had been a paid client)

- {{e.g. "I would have done a paid 2-week discovery sprint instead of a 45-minute call."}}
- {{e.g. "I would have explicitly excluded 'frontend redesign' and quoted Tailwind. Then when the brand vibe didn't fit, a Change Order would have covered the rebuild."}}
- {{e.g. "I would have separated infra setup from feature work in the quote so the client could see they were paying for first-time tax."}}

## Calibration for project #2

Based on the actuals above:

- **My multiplier for solo-dev work on a familiar stack:** {{e.g. 2.1x — I systematically underestimate by ~2x}}
- **Default buffer for solo unknowns:** {{e.g. 30% instead of 20%}}
- **Discovery sprint length:** {{e.g. 2 weeks for a project of this scope}}
- **Phase that surprised me most:** {{e.g. "anything involving admin UX — the second-order CRUD work is invisible until you build it"}}

## What I'd charge for an equivalent project as project #2

- **Discovery sprint:** MXN ${{...}} (~2 weeks)
- **Build:** MXN ${{...}} (~{{N}} business days at MXN ${{...}}/day)
- **Total:** MXN ${{...}}
- **Effective hourly rate at that price:** MXN ${{...}}/hr

If that number feels uncomfortable to say out loud, the right move is *not* to say it lower — it's to either (a) cut scope from the SoW, or (b) find a client who values the work. Quoting low to win the deal is how solo freelancers go broke.

---

## Lessons in one sentence each

After filling everything above, condense to 3–5 sentences. These are the ones you re-read before quoting project #2.

1. {{...}}
2. {{...}}
3. {{...}}
4. {{...}}
5. {{...}}
