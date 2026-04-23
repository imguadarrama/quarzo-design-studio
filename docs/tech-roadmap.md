# Quarzo Design Studio — Product Requirements (v1)

> **What this is:** the PRD for Quarzo's v1 store — business, users, scope, flows, open decisions, and delivery phases.
>
> **What it is not:** an architecture doc or a deploy runbook. Those live elsewhere:
> - Architecture, code conventions, auth model, data model invariants → [`../CLAUDE.md`](../CLAUDE.md)
> - Authoritative data model → [`../server/prisma/schema.prisma`](../server/prisma/schema.prisma)
> - Deploy pipeline → [`CI-CD/deploy-setup.md`](CI-CD/deploy-setup.md)
> - Raw client discovery notes → [`client/discovery-with-client.md`](client/discovery-with-client.md)

---

## 1. Summary

Quarzo Design Studio is a custom-stationery (papelería personalizada) e-commerce store for Saltillo-based entrepreneurs, small businesses, and moms. It replaces a DM-driven sales process so the owner (the builder's wife) reclaims the time she currently spends answering repetitive "tell me about your products" messages on Instagram.

The project also doubles as a deliberate practice run for a future PERN-stack software company. Stack choices (build-your-own auth, Prisma, Docker from day one) are pedagogical and will not be swapped for hosted equivalents.

---

## 2. Business context

**Client.** The user's wife. Functions as a real client for this engagement: discovery → scope → build → deploy → handoff.

**Business.** Papelería personalizada — custom stationery printed to order. v1 catalog:
- Sobres (envelopes)
- Stickers
- Etiquetas de vino (wine labels)
- Tarjetas de regalo (gift cards)

**Differentiator.** Material quality, attention to detail, close service through the purchase.

**Location & language.** Saltillo, Coahuila, Mexico. All copy in Spanish (Mexico). All payments in MXN.

**Customers.**
- Emprendedores (solo entrepreneurs)
- Negocios formales (formal businesses)
- Mujeres, principalmente mamás

**Traffic source.** ~4,000 Instagram followers → DM → WhatsApp. Zero customers have ever asked for a website. The recurring question is *"show me your portfolio."*

---

## 3. Current sales flow & pain

Today every sale is a manual DM loop:

1. Customer DMs Instagram or WhatsApp
2. Client sends product info
3. Customer picks print type (foil / color)
4. Customer states quantity
5. Client quotes total, requests 50% deposit
6. Client sends catalog PDF → customer picks design
7. Customer sends personalization text (e.g., name for envelope)
8. Delivery date agreed
9. Pickup in Saltillo, or national shipping with remaining balance + carrier fee

**Primary pain point:** steps 2–4. The "give me information" DM loop consumes hours per week.

---

## 4. Goals & success criterion

**6 months post-launch**, the site succeeds if it **automates the "give me information" step** so the client reclaims operational time.

Revenue growth is a secondary goal. Time recovery is primary.

---

## 5. Core product constraints (non-negotiable)

Confirmed during discovery. These shape the product and are not open for re-litigation without going back to the client.

1. **Customers pick designs from the catalog. They do NOT customize the design.** They customize only the text (name, message). This keeps operations lean — the store must preserve this.
2. **Every order line item carries personalization text.** Two orders for the same SKU are not identical.
3. **Small scale:** up to ~10 orders/week, packed manually by one person. Admin UX must be efficient for a single operator.
4. **Catalog is small and slow-moving:** <20 SKUs, refreshed ~every 6 months, managed by the client via the admin panel.
5. **~3 variants per product on average** — typically print type (foil vs color), occasionally size/material.
6. **Product photos exist** and are ready to upload.
7. **Browsable catalog / portfolio page is day-one non-negotiable.** If only one thing ships, it's this.

---

## 6. Scope — v1

### In scope
- Public catalog (list + detail), organized by 4 categories: Sobres, Stickers, Etiquetas de vino, Tarjetas de regalo
- Product detail with variant selection + personalization text per item
- Shopping cart (guest-first; `localStorage` for guests, DB once a user creates an account)
- Checkout with two payment paths:
  - **MercadoPago** (card, Oxxo, SPEI) — webhook-confirmed
  - **Bank transfer** — order stays pending until admin manually confirms
- Shipping:
  - National (Mexico) — flat rate (amount TBD)
  - Pickup — Saltillo, Coahuila only
- Order confirmation email (customer) + order alert email (admin), sent via Resend
- **Guest checkout by default** (see §8)
- **Optional** account creation post-purchase
- Customer account area (when opted in): order history
- Admin panel: login, product/variant/image CRUD, order list with status transitions, manual bank-transfer confirmation, per-variant inventory
- Mobile responsive (primary device: phone — traffic comes from IG)
- Spanish (Mexico) copy throughout

### Deferred to v2
- **Digital custom designs** (diseños digitales personalizados)
- **Digital invitations with categorized templates** (children's invitations primarily) where the customer picks a template and changes variables: character, colors, data. **Top client priority for v2.**
- Discount codes
- Customer saved addresses
- Multi-address shipping
- Wholesale / B2B pricing
- Subscriptions

---

## 7. Open decisions

- **Shipping flat-rate amount (MXN):** client to provide. No envia.com API integration in v1.
- **Domain name:** TBD (GoDaddy).

---

## 8. Customer journeys

### End-to-end purchase flow

```
Browse catalog
    ↓
Product detail page
    ├── pick variant (foil | color)
    ├── enter personalization text (required, max 80 chars)
    ├── pick quantity
    └── Add to cart
    ↓
Cart page (localStorage; syncs to DB if logged in)
    ↓
Checkout
    ├── Shipping method: nacional | pickup Saltillo
    ├── Shipping address (if shipping)
    ├── Contact info: email, name, phone
    ├── Payment method: MercadoPago | Bank transfer
    └── Review & confirm
    ↓
    ┌──── MercadoPago ─────────┐   ┌──── Bank transfer ──────────┐
    │ Redirect / SDK checkout  │   │ Order created "pendiente"   │
    │ Webhook confirms payment │   │ Show bank details + amount  │
    │ Order → "pagado"         │   │ Customer uploads proof OR   │
    └──────────────────────────┘   │ client confirms manually    │
                                   └─────────────────────────────┘
    ↓
Order confirmation page + email (order number + public tracking link)
    ↓
Optional: "¿Crear cuenta para la próxima vez?"
```

### Auth & accounts — the three paths (UX)

**Principle:** minimize friction. Most traffic is Instagram → one-time buyer. Registration must NEVER be required to complete a purchase.

**A. Guest checkout (default).** Customer checks out with email + contact + shipping details. Receives confirmation email with order number and public tracking URL (unguessable token). No password. No account.

**B. Optional account creation post-purchase.** On the confirmation screen, prompt *"¿Quieres guardar tus datos para la próxima vez?"* — one-click account creation using the email already on file. The existing order links to the new account automatically.

**C. Returning customer logs in before checkout.** Shipping info auto-fills from last order; past orders visible in `/mi-cuenta`.

**Admin is separate** — single seeded user, separate `/admin/login`, no public admin registration.

Auth mechanics (JWT-in-HTTP-only-cookie, bcrypt cost, endpoint paths, `requireAdmin` middleware, role claims) are specified in [`../CLAUDE.md`](../CLAUDE.md) → "Auth model". No hosted auth (Auth0 / Clerk / Firebase) — the pedagogical goal of this project is to understand auth end-to-end.

---

## 9. Brand & visual direction

**References the client provided:**
- https://sugarpaper.com/ — clean, editorial, whitespace, serif headings
- https://www.theatelier.com.mx/ — warm, refined, Mexican boutique feel

**Tone:** clean and editorial, not e-commerce-busy. Product photos should breathe. Closer to a boutique stationery studio than Amazon.

**Assets:** the client will deliver logo, color palette, and typography before Phase 2 visual work starts. Do not invent the brand identity — wait for her assets.

---

## 10. Delivery phases

### Phase 1 — Setup ✅
- [x] Git repo + `main` branch
- [x] `docker-compose.yml` with `db` + `api` + `web`
- [x] `prisma init`, initial schema, first migration
- [x] Express scaffolded with target folder structure
- [x] Vite + React + Tailwind scaffolded
- [x] `docker-compose up` runs the full stack locally
- [x] Seed script: admin user + 4 sample products with variants

### Phase 1.5 — Deploy the skeleton ✅
Ship the scaffold to staging + prod before building features. Discover deploy friction on the smallest possible app; give the client a live URL from week 1; unlock per-PR preview environments for every subsequent phase. Full runbook: [`CI-CD/deploy-setup.md`](CI-CD/deploy-setup.md).
- [x] Provider signups + GitHub Environments + secrets (`deploy-setup.md` Sessions 1 & 2)
- [x] `/api/health` confirmed from staging (prod deploy not yet triggered)
- [x] Per-PR preview URLs posted as PR comments (Cloudflare Pages branch deploy + Neon DB branch)
- [x] Throwaway PR smoke test; Neon `pr-<n>` branch cleans up on PR close

Monitoring (Fly alerts + UptimeRobot) is deferred to Phase 7 — with zero traffic there is nothing the alerts would answer. See `deploy-setup.md` §11.

### Phase 2 — Catalog + admin products (next)
- [ ] Admin login (`/admin/login`) + `requireAdmin` middleware
- [ ] Admin product CRUD — variants + image upload
- [ ] Public `/api/products` + catalog page + product detail page
- [ ] Variant selector + personalization text input on the detail page
- [ ] Mobile-responsive catalog layout

### Phase 3 — Cart + guest checkout foundation
- [ ] Cart in zustand + `localStorage`
- [ ] Cart drawer / cart page
- [ ] Checkout form (contact, shipping, payment method) with `react-hook-form` + `zod`
- [ ] Shipping logic: flat national rate, pickup = free
- [ ] Create pending order on submit (no payment yet)

### Phase 4 — Payments
- [ ] MercadoPago integration: preference, redirect/SDK, webhook
- [ ] Bank transfer flow: show bank details, order stays `PENDIENTE`, admin confirms manually
- [ ] Order confirmation page with `publicToken` URL
- [ ] Resend wired up
- [ ] Order confirmation email + admin new-order alert

### Phase 5 — Accounts + order history
- [ ] Customer register/login endpoints
- [ ] Post-purchase "create account" prompt (§8, Path B)
- [ ] `/mi-cuenta` order history
- [ ] Order tracking page (public, by token)
- [ ] Inventory decrement on `PAGADO` transition; "agotado" UI at stock 0

### Phase 6 — Admin orders + polish
- [ ] Admin order list with filters and status transitions
- [ ] Admin view of personalization text per line item (needed to produce the order)
- [ ] Print-friendly order view (packing slip)
- [ ] Error and loading states across the app
- [ ] Empty states and 404

### Phase 7 — Launch polish + handoff
Prod has been live since Phase 1.5; this phase turns the live URL into the launched site. Pre-launch sizing, monitoring wiring, and the handoff ceremony. Deploy plumbing details live in [`CI-CD/deploy-setup.md`](CI-CD/deploy-setup.md) §11.
- [ ] Bump prod VM from 256 MB → 512 MB (rationale + steps: `deploy-setup.md` §1)
- [ ] Custom domain + SSL (`deploy-setup.md` §7)
- [ ] Seed production admin user (if not already done in Phase 1.5)
- [ ] Fly.io dashboard alerts (`deploy-setup.md` §11.2)
- [ ] UptimeRobot 5-min external ping on prod `/api/health`
- [ ] End-to-end test of full purchase flow on prod (both MercadoPago and bank-transfer paths)
- [ ] After first launch-day spike, reread Fly metrics and decide stay-at-512-MB vs `shared-cpu-2x`
- [ ] Admin walkthrough with client; record a short Loom
- [ ] Written admin handoff doc (add products, fulfill orders)
