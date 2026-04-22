# Wife's E-Commerce Store — Project Brief & Tech Roadmap

> **Purpose of this document:** complete handoff context for this project. A new engineer (human or agent) should be able to read this file and understand the business, the scope, the architecture, and the starting point for building.

---

## 1. Project context

### Client
**Relationship:** user's wife. Functions as a real client for this engagement (discovery, scope, build, deploy, handoff) — this is a deliberate practice run for the user's software company.

### Business
**What:** papelería personalizada (custom stationery).

**Products for v1 catalog:**
- Sobres (envelopes)
- Stickers
- Etiquetas de vino (wine labels)
- Tarjetas de regalo (gift cards)

**Target customers:**
- Emprendedores (solo entrepreneurs)
- Negocios formales (formal businesses)
- Mujeres, principalmente mamás

**Differentiator:** material quality, attention to detail, and close customer service throughout the purchase process.

**Location:** Saltillo, Coahuila, Mexico. All content in Spanish. All payments in MXN.

### Current sales channel
- ~4,000 Instagram followers → primary entry point
- Instagram DMs redirect to WhatsApp because the current catalog is a PDF that doesn't display well in IG
- Zero customers have ever asked for a website; the frequent question is "show me your portfolio"
- 100% of sales flow through manual DM conversation today

### Current sales flow (the pain we're replacing)
1. Customer DMs Instagram or WhatsApp asking for information
2. Client (wife) sends product info
3. Customer picks print type (foil or color)
4. Customer states quantity
5. Client quotes total and requests 50% deposit to schedule the order
6. Client sends catalog PDF → customer picks design
7. Customer sends the personalization text (e.g., name for the envelope)
8. Delivery date is agreed
9. Pickup in Saltillo, or national shipping with remaining balance + carrier fee

**Primary pain point:** time spent answering repetitive info-request DMs.

### Success criterion (6 months post-launch)
The site succeeds if it **automates the sales process** — specifically the "give me information" step — so the client reclaims operational time. Revenue is secondary to time recovery.

---

## 2. Core product constraints (non-negotiable)

These shape the architecture. They were confirmed in discovery.

1. **Customers pick designs from the catalog. They do NOT customize the design.** They only customize the text (name, message). This keeps the product simple and the operation lean — the store must preserve this.
2. **Every order line item carries personalization text.** Two orders for the same SKU are not identical. The data model must store the customer-supplied text per line item.
3. **Small scale:** up to ~10 orders/week, packed manually by the client. The admin UX must be efficient for one person doing everything.
4. **Catalog is small and slow-moving:** <20 SKUs, refreshed roughly every 6 months, managed by the client via the admin panel.
5. **~3 variants per product on average** (typically print type: foil vs color, but can be size/material).
6. **Product photos exist** and are ready to upload.
7. **Must-have on day one:** a browsable catalog / portfolio page. If nothing else works, this must.

---

## 3. Scope for v1 (locked)

### In scope
- Public catalog (list + detail)
- Product detail with variant selection + **personalization text field per item**
- Shopping cart (guest-first; localStorage for guests, DB if user creates account)
- Checkout with two payment paths:
  - **MercadoPago** (card, Oxxo, SPEI) — handled via webhook
  - **Bank transfer** (order marked pending until client manually confirms receipt in admin)
- Shipping logic:
  - National (Mexico) — fee by package size, default package 25×30 cm envelope
  - Pickup option — Saltillo, Coahuila only
- Order confirmation email (customer) and order notification email (admin)
- **Guest checkout by default** (see §4)
- **Optional** account creation post-purchase (see §4)
- Customer account area (when opted in): order history
- Admin panel:
  - Admin login (separate from customer auth)
  - CRUD products + variants + images
  - Order list with status updates (pendiente → pagado → enviado → entregado)
  - Bank-transfer orders: manual "confirm payment received" action
  - Inventory per variant (stock decreases on paid order; shows "agotado" at 0)
- Mobile responsive (primary device: phone, since traffic comes from IG)
- All copy in Spanish (Mexico)

### Out of v1 — reserved for v2
- **Digital custom designs** (diseños digitales personalizados)
- **Digital invitations with categorized templates** (principally children's invitations) where the customer changes variables: character, colors, and data. This is the client's top v2 priority.
- Discount codes
- Customer saved addresses
- Multi-address shipping
- Wholesale / B2B pricing
- Subscriptions

### Open decisions (must close before coding)
These came up or were deliberately deferred; lock them before Phase 2.
- **CFDI / facturación:** does the client need to issue tax invoices? If yes, this is a real v1 feature (PAC integration), not a checkbox.
- **Return/refund policy:** what does the site show, and what does admin need to handle?
- **Shipping rate table:** exact prices per size/zone. The client pays by size today — we need the actual numbers.
- **Product categorization scheme:** flat list vs. categories (Sobres / Stickers / Etiquetas / Tarjetas)?
- **Domain name:** to be decided.
- **Transactional email provider:** SMTP service for order emails (Resend / Brevo / AWS SES).

---

## 4. Authentication & accounts (critical design decision)

**Principle:** minimize friction for first-time buyers. Most traffic comes from Instagram and may buy once without caring about accounts. Registration must NEVER be required to complete a purchase.

### Customer auth — the three paths

#### Path A: Guest checkout (default, zero friction)
1. Customer adds items to cart (cart held in `localStorage`)
2. Clicks "Comprar"
3. Checkout form asks for: email, full name, phone, shipping address (or selects pickup), payment method
4. Customer pays (MercadoPago) or submits bank-transfer order
5. Receives order confirmation email with order number + tracking link (public URL with unguessable order token)
6. Done. No password. No account. No login.

#### Path B: Optional account creation post-purchase
On the order confirmation screen, show a prompt:
> **"¿Quieres guardar tus datos para la próxima vez?"**
> One-click account creation using the email already provided. Customer sets a password inline (or receives a magic-link email to set one).

If they opt in, the existing order is linked to the new customer account automatically.

#### Path C: Returning customer logs in before checkout
Login form on the checkout page (or in the header). Once logged in:
- Shipping info auto-fills from last order
- Past orders visible in `/mi-cuenta`

### Auth mechanics
- **JWT in HTTP-only cookie** — not `localStorage` (XSS hardening)
- Passwords hashed with `bcrypt` (cost factor 12)
- Endpoints:
  - `POST /api/auth/register` — create account (post-purchase or standalone)
  - `POST /api/auth/login` — returns cookie
  - `POST /api/auth/logout` — clears cookie
  - `GET /api/auth/me` — current user
- Customer table carries `role = 'customer'`; no admin role here.

### Admin auth (separate)
- Admin is the client herself — a single user
- Seeded manually at deploy time (no public registration endpoint for admin)
- Separate login page at `/admin/login`
- Admin JWT carries `role = 'admin'`; middleware `requireAdmin` gates all `/api/admin/*` routes
- Same cookie mechanism, different role claim

### What NOT to do
- Do not use Auth0 / Clerk / Firebase Auth. Build it from scratch. The point of this project is to understand how auth works end-to-end.
- Do not force registration before checkout. Ever.
- Do not store JWTs in `localStorage`.

---

## 5. Customer order flow (end-to-end)

```
Browse catalog
    ↓
Product detail page
    ├── pick variant (e.g., foil | color)
    ├── enter personalization text (free-text, required, max 80 chars)
    ├── pick quantity
    └── Add to cart
    ↓
Cart page (localStorage; syncs to DB if logged in)
    ↓
Checkout
    ├── Shipping method: national shipping | pickup Saltillo
    ├── Shipping address (if shipping)
    ├── Contact info (email, name, phone)
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
Optional: "¿Crear cuenta para la próxima vez?" → Path B (§4)
```

---

## 6. Tech stack

### Database — PostgreSQL
Relational fit for e-commerce (products, variants, orders, order items, customers). Reinforces the "P" in PERN, which is what the company will sell to clients.

### ORM — Prisma
Typed schema, migrations, fast iteration. Drop to raw SQL only for reports if needed.

### Backend — Node.js + Express
```
server/
  src/
    routes/        → REST endpoints
    controllers/   → Request handlers
    services/      → Business logic (orders, payments, email)
    db/            → Prisma client + helpers
    middleware/    → auth, requireAdmin, errorHandler, validator
    config/        → env loader
    lib/           → MercadoPago SDK wrapper, mailer, etc.
    index.ts
  prisma/
    schema.prisma
    migrations/
```

**Libraries:** `express`, `prisma`, `@prisma/client`, `zod` (validation), `cors`, `helmet`, `cookie-parser`, `bcrypt`, `jsonwebtoken`, `nodemailer`, `mercadopago`, `dotenv`.

### Frontend — React + Vite + Tailwind
```
client/
  src/
    pages/         → Home, Catalog, ProductDetail, Cart, Checkout,
                     OrderConfirmation, OrderTracking, MiCuenta,
                     Login, Admin/*
    components/    → ProductCard, VariantSelector, PersonalizationInput,
                     CartDrawer, Navbar, Footer, AdminLayout, …
    hooks/         → useCart, useAuth, useProducts
    store/         → zustand stores (cart, auth)
    services/      → api/products.ts, api/orders.ts, api/auth.ts
    lib/           → formatters (MXN, date), zod schemas shared w/ server
    i18n/          → not needed for v1 (Spanish only)
```
**Libraries:** `react-router-dom`, `zustand`, `react-hook-form`, `zod`, `tailwindcss`, native `fetch`, `@mercadopago/sdk-react` for checkout UI.

### Payments — MercadoPago
- Use the Checkout Pro or Checkout API (server-creates-preference → client pays → webhook confirms)
- Webhook endpoint verifies signature, updates order to `pagado`, sends confirmation email
- Store `mp_preference_id` and `mp_payment_id` on the order for reconciliation

### Containerization — Docker + Docker Compose (from day one)
Three services in `docker-compose.yml`:
- `db` — `postgres:16`
- `api` — Node backend, hot-reload in dev
- `web` — Vite dev server in dev; built + served by Nginx in prod

Development environment = production environment. Don't "dockerize later."

### Deployment — Cloudflare Pages + Fly.io + Neon
Full setup runbook in [`deploy-setup.md`](./deploy-setup.md). Summary:
- **Client** on Cloudflare Pages (free, unlimited bandwidth, per-PR previews)
- **Server** on Fly.io (free tier, always-on, scales up per-VM when traffic warrants)
- **Postgres** on Neon (free tier with DB branching — each PR gets an isolated DB)
- Same stack across staging and production so staging actually mirrors prod
- Staging auto-deploys on PR open/sync. Production deploys are triggered manually via `workflow_dispatch` on a weekly cadence
- Custom domain (GoDaddy, TBD) wired up via Cloudflare DNS once purchased

Future: the Docker-first design keeps the migration path open — the same `Dockerfile` runs unchanged on a DigitalOcean droplet, AWS ECS, or Cloud Run if scaling demands it.

### Transactional email
To be selected: Resend (easiest), Brevo, or AWS SES. Need HTML templates for:
- Order confirmation (customer)
- New order alert (admin)
- Payment confirmed (customer, for MP and bank-transfer flows)

---

## 7. Initial data model

Prisma schema sketch — authoritative version lives in `prisma/schema.prisma` once the project starts.

```prisma
model Customer {
  id          String    @id @default(cuid())
  email       String    @unique
  passwordHash String?              // null = guest who never created account
  name        String
  phone       String?
  createdAt   DateTime  @default(now())
  orders      Order[]
}

model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model Product {
  id          String    @id @default(cuid())
  slug        String    @unique
  name        String
  description String
  category    String    // "sobres" | "stickers" | "etiquetas-vino" | "tarjetas-regalo"
  basePrice   Decimal   @db.Decimal(10,2)
  images      ProductImage[]
  variants    ProductVariant[]
  active      Boolean   @default(true)
  createdAt   DateTime  @default(now())
}

model ProductVariant {
  id         String   @id @default(cuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id])
  name       String   // e.g., "Foil dorado", "Color estándar"
  priceDelta Decimal  @db.Decimal(10,2) @default(0)  // added to basePrice
  stock      Int      @default(0)
  sku        String   @unique
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id])
  url       String
  alt       String?
  position  Int     @default(0)
}

model Order {
  id              String       @id @default(cuid())
  publicToken     String       @unique           // unguessable URL for guest tracking
  customerId      String?                         // null = pure guest
  customer        Customer?    @relation(fields: [customerId], references: [id])
  // Snapshot of contact info at order time
  email           String
  name            String
  phone           String
  shippingMethod  ShippingMethod
  shippingAddress Json?                           // null if pickup
  shippingFee     Decimal      @db.Decimal(10,2) @default(0)
  subtotal        Decimal      @db.Decimal(10,2)
  total           Decimal      @db.Decimal(10,2)
  paymentMethod   PaymentMethod
  status          OrderStatus  @default(PENDIENTE)
  mpPreferenceId  String?
  mpPaymentId     String?
  notes           String?
  items           OrderItem[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model OrderItem {
  id                 String   @id @default(cuid())
  orderId            String
  order              Order    @relation(fields: [orderId], references: [id])
  productId          String
  variantId          String
  // Snapshotted at purchase time — products may change later
  productName        String
  variantName        String
  unitPrice          Decimal  @db.Decimal(10,2)
  quantity           Int
  personalizationText String                       // the custom name/message
}

enum ShippingMethod { NACIONAL PICKUP_SALTILLO }
enum PaymentMethod  { MERCADOPAGO TRANSFERENCIA }
enum OrderStatus    { PENDIENTE PAGADO ENVIADO ENTREGADO CANCELADO }
```

**Key design notes:**
- `Order.customerId` is nullable → supports pure guests
- `OrderItem.personalizationText` is **required** (empty string allowed only if the product doesn't support personalization, which for v1 means: none — all products personalize)
- Order snapshots product/variant name and price so historical orders stay correct when the catalog changes
- `publicToken` lets guests view their order via a URL without logging in

---

## 8. Project phases

### Phase 1 — Setup (Days 1–2)
- [ ] Init git repo + `main` branch
- [ ] `docker-compose.yml` with `db` + `api` + `web`
- [ ] `prisma init`, write initial schema (§7), run first migration
- [ ] Scaffold Express with the folder structure above
- [ ] Scaffold Vite + React + Tailwind
- [ ] `docker-compose up` runs the full stack locally
- [ ] Seed script: one admin user, 3 sample products with variants

### Phase 2 — Catalog + admin products (Days 3–7)
- [ ] Admin login (`/admin/login`) + `requireAdmin` middleware
- [ ] Admin product CRUD (list, create, edit, delete) — including variants and image upload
- [ ] Public `/api/products` + catalog page + product detail page
- [ ] Variant selector + personalization text input on detail page
- [ ] Mobile-responsive catalog layout

### Phase 3 — Cart + guest checkout foundation (Days 8–12)
- [ ] Cart in zustand + `localStorage`
- [ ] Cart drawer / cart page
- [ ] Checkout form (contact, shipping, payment method) with `react-hook-form` + `zod`
- [ ] Shipping logic: national rate by size, pickup = free
- [ ] Create pending order on submit (no payment yet)

### Phase 4 — Payments (Days 13–18)
- [ ] MercadoPago integration: create preference, redirect/SDK, webhook
- [ ] Bank transfer flow: show bank details, leave order `PENDIENTE`, admin confirms manually
- [ ] Order confirmation page with `publicToken` URL
- [ ] Transactional email provider wired up
- [ ] Order confirmation email + admin new-order alert

### Phase 5 — Accounts + order history (Days 19–22)
- [ ] Customer register/login endpoints
- [ ] Post-purchase "create account" prompt (Path B, §4)
- [ ] `/mi-cuenta` with order history
- [ ] Order tracking page (public, by token)
- [ ] Inventory decrement on `PAGADO` transition; "agotado" UI at stock 0

### Phase 6 — Admin orders + polish (Days 23–26)
- [ ] Admin order list with filters and status transitions
- [ ] Admin view of personalization text per line item (client needs this to produce the order)
- [ ] Print-friendly order view (packing slip)
- [ ] Error handling + loading states across the app
- [ ] Empty states and 404

### Phase 7 — Deploy + handoff (Days 27–30)
- [ ] Deploy to Railway; connect Postgres add-on
- [ ] Custom domain + SSL
- [ ] Seed production admin user
- [ ] End-to-end test of full purchase flow (both payment methods)
- [ ] Admin walkthrough with client; record a short Loom
- [ ] Written admin handoff doc (how to add products, fulfill orders)

---

## 9. Brand & visual direction

**References the client provided:**
- https://sugarpaper.com/ — clean, editorial, lots of whitespace, serif headings
- https://www.theatelier.com.mx/ — warm, refined, Mexican boutique feel

**Assets:** the client will deliver logo, color palette, and typography before Phase 2 visual work starts. Do not design the visual identity yourself — wait for her assets.

**Tone:** clean and editorial, not e-commerce-busy. Product photos should breathe. This is not Amazon; it's closer to a boutique stationery studio.

---

## 10. For a new engineer picking this up

If you just landed on this project, read in this order:
1. `wife-store-discovery.md` — raw answers from the discovery call
2. `wife-store-resumen-descubrimiento.docx` — the 1-page recap sent to the client
3. This file (`wife-store-tech-roadmap.md`) — scope, architecture, phases

Then confirm with the project owner:
- Has §3 "Open decisions" been closed? If not, you need those answers before coding Phase 2 onward.
- Has the client delivered brand assets? If not, defer visual polish.

Start with Phase 1. Do not skip Docker setup.
