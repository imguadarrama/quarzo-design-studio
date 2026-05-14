# Estimation Worksheet

Use this **after** the discovery checklist is filled in. The worksheet is the bridge between "I know what to build" and "I know what to charge."

## How to use

1. List every feature from the SoW's Inclusions section, broken into sub-tasks.
2. **No sub-task may exceed 3 days.** If it does, you don't understand it well enough — split it further.
3. Estimate each sub-task in **half-days** (0.5, 1, 1.5, 2, 2.5, 3). Half-days force honesty; hours invite false precision.
4. Apply a **risk multiplier** per sub-task:
   - 1.2 — boring CRUD you've done before
   - 1.5 — new but standard (auth, payments with a familiar provider)
   - 2.0 — unfamiliar territory (a SDK you've never touched, a custom flow)
   - 2.5–3.0 — research required before you can even estimate
5. Fill `Actual` retroactively, **as each sub-task ships**. This is what makes the worksheet a learning tool, not a one-shot.

## Worksheet

| Feature | Sub-task | Half-days | Multiplier | Adjusted | Actual | Delta | Notes |
|---|---|---:|---:|---:|---:|---:|---|
| Auth | Login | 1 | 1.5 | 1.5 |  |  |  |
| Auth | Forgot password | 2 | 2.0 | 4.0 |  |  | needs email infra |
| Auth | Admin login | 1 | 1.5 | 1.5 |  |  |  |
| ... |  |  |  |  |  |  |  |
| **Subtotal — Auth** |  |  |  | **7.0** |  |  |  |
|  |  |  |  |  |  |  |  |
| Products | Admin CRUD | 4 | 1.5 | 6.0 |  |  |  |
| Products | Variants | 3 | 2.0 | 6.0 |  |  |  |
| ... |  |  |  |  |  |  |  |
| **Subtotal — Products** |  |  |  | **12.0** |  |  |  |

(Add as many sections as features.)

## Totals

```
Adjusted half-days total:                  _____
÷ 2  → business-days of pure build:        _____
+ 20% buffer (meetings, admin, support):   _____
+ infra/devops setup (first-time tax):     _____
= Final business-day estimate:             _____
```

If pricing fixed: `Final business days × your day rate = quote`.

If pricing hourly with cap: `Final business days × 8h = not-to-exceed hours`.

## Multipliers cheat sheet

For a **solo dev with realistic context-switching, no QA team, no PM**, expect:

| Confidence | Multiplier |
|---|---|
| "I've built this exact thing 3+ times" | 1.2 |
| "I've used this stack but not this feature" | 1.5 |
| "I know the stack, the feature is new" | 1.8 |
| "Stack and feature both partly new" | 2.0 |
| "I need to research before I can estimate" | 2.5–3.0 |

Default if unsure: **1.8**.

## What goes in the buffer (the +20%)

- Discovery follow-up calls
- Email / Slack with the client
- Deployment debugging
- The day you're sick
- The afternoon you're stuck on something silly
- Writing the post-launch handover doc
- Final QA pass

The buffer is **not** for scope creep. New features = change order, separately priced.

## What goes in "infra setup (first-time tax)"

Things you only pay for on project #1 with a given stack — don't fold them into per-feature estimates:

- Initial repo, Docker, CI/CD setup
- Hosting + DNS + SSL setup
- Email provider account + domain verification
- Payment provider account + webhook configuration
- Monitoring / error tracking setup
- Database hosting + backups
- Storage (S3/R2) + CDN

For Quarzo (your first), this was a real chunk of time. Subtract it from the post-mortem before estimating project #2 — it won't repeat at the same scale.

## After the project: calibration

After shipping, fill the `Actual` column for every row and compute:

```
Calibration ratio = sum(Actual) / sum(Adjusted)
```

- Ratio ≈ 1.0 → your multipliers are well-calibrated. Keep them.
- Ratio > 1.2 → you're systematically optimistic. Raise the default multiplier by 0.2 next project.
- Ratio < 0.8 → you're padding too much. Lower by 0.2.

Three projects in, your ratio stabilizes and your quotes get fast and accurate.
