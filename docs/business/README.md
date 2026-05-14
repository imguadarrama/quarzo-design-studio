# Business / Process Artifacts

Reusable templates for client engagements. Quarzo is the first real use; everything here is designed to be forked into future projects.

## Recommended order of use

```
Discovery call → Discovery checklist → Estimation worksheet → SoW → Build → Post-mortem
```

1. **Have the discovery call** (informal, 30–60 min) — get the client talking about their business. See `docs/client/discovery-with-client.md` for the Quarzo example.
2. **Walk the discovery checklist** (`discovery-checklist.md`) — solo, after the call. Anywhere you don't have a confident answer is a follow-up question, not an assumption.
3. **Build the estimation worksheet** (`estimation-worksheet.md`) — break the scope into half-day units, multiply, sum.
4. **Write the Statement of Work** (`sow-template.md`) — inclusions, **exclusions**, milestones, payment schedule, change-order clause. Both parties sign before code is written.
5. **Build the project.**
6. **Fill the post-mortem** (`quarzo-postmortem.md` is the Quarzo-specific instance) — log estimated vs actual per phase; surprises become permanent additions to the discovery checklist; calibrate the next quote.

## Files

| File | Purpose | When |
|---|---|---|
| [`discovery-checklist.md`](./discovery-checklist.md) | Category-by-category questionnaire | Before quoting |
| [`estimation-worksheet.md`](./estimation-worksheet.md) | Features → half-days → multiplier → quote | Before quoting |
| [`sow-template.md`](./sow-template.md) | Statement of Work template | Before starting work |
| [`quarzo-postmortem.md`](./quarzo-postmortem.md) | Quarzo-specific retro (fill at end of Quarzo) | After shipping |

## Conventions

These are templates. For each real client, fork them into a separate folder (e.g. `clients/<name>/`, kept out of this repo) and fill in the specifics. Update the templates here only when you discover a gap that applies to *every* future project — for example, "I forgot to ask about password reset" → permanent new line in the discovery checklist.

## Disclaimer

The SoW template is a starting point, not legal advice. Before using it with a non-family client, have a Mexican lawyer review the change-order clause, warranty language, and payment terms against local contract law.
