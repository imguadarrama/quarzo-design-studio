# Phase 3 execution plan — Cart + guest checkout foundation

> **What ships:** cart in zustand+localStorage, `/carrito` page, `/checkout` form, `/pedido/:publicToken` confirmation, and a public `POST /api/orders` that creates a `PENDIENTE` order with snapshotted line items. **No payments wired** (Phase 4) and **no customer accounts** (Phase 5).
>
> **Scope locks (settled with the client before writing this plan):**
> 1. Shipping flat rate lives in `env.SHIPPING_FLAT_RATE_MXN`, not a hardcoded constant. Lets the client change it later via Fly secrets without a redeploy.
> 2. Both payment options are visible in checkout. `MERCADOPAGO` and `TRANSFERENCIA` both create a `PENDIENTE` order; Phase 4 fills in the MP preference + redirect and the bank-transfer instructions. Confirmation page is intentionally generic.
> 3. Cart UX is a single `/carrito` page. No drawer in Phase 3.
>
> Companion docs: PRD → `docs/tech-roadmap.md`; data-model invariants → `CLAUDE.md` §"Data model invariants".

---

## 0. How to use this doc

- Run the stack via `pnpm dev` (Docker Compose — `db` + `api` + `web`). Never run `pnpm install` or `prisma migrate` on the host.
- Apply pending migrations: `pnpm migrate`. Re-seed: `pnpm seed`.
- **Postman setup:**
  - Collection variable `baseUrl = http://localhost:3000/api`.
  - Cookie jar **on** (only matters for admin-protected inspection; the order endpoints in this phase are public).
  - For Spanish error strings, copy from the actual route file — never invent them.
- File-path convention: `server/src/routes/orders.ts:42` means line 42 of that file from repo root.
- Checkbox convention: each `- [ ]` is one self-contained task. Don't batch — check as you finish.
- Cite section anchors when pushing back on a step (e.g. "§3 says price recomputation; this PR trusts client subtotal").

---

## 1. Audit

### 1a. Working — do not rewrite

| Area | Where | Status |
|---|---|---|
| `Order` + `OrderItem` schema | `server/prisma/schema.prisma:158-203` | All snapshot columns + nullable `customerId` already in place. No migration needed. |
| `OrderStatus`, `PaymentMethod`, `ShippingMethod`, `VariantKind` enums | `server/prisma/schema.prisma:205-228` | `OrderStatus` defaults `PENDIENTE`. |
| `Customer` model with nullable `passwordHash` | `server/prisma/schema.prisma:10-18` | Phase 5 will own writes; Phase 3 does not touch it. |
| Error classes (`NotFoundError`, `ConflictError`) | `server/src/lib/errors.ts:1-27` | Reuse `ConflictError(code, message)` for business-rule failures. |
| Global error handler (zod → 400 with `issues`, `P2002` → 409 with mapped `code`) | `server/src/middleware/errorHandler.ts` | New routes just `next(err)`. |
| Validation-schema pattern | `server/src/lib/validation-schemas.ts` (productSchema with `.superRefine`) | Mirror for `createOrderSchema`. |
| Write-helper pattern | `server/src/lib/product-write.ts` (`buildVariantPricesCreate`, `buildImagesCreate`) | Mirror for `buildOrderItemsCreate`. |
| Serializer pattern + `loadPaletteMap` | `server/src/lib/serializers.ts` | Use the same palette-mapping helper to validate foil swatches server-side. |
| Variant-kind name map | `server/src/lib/variant-kinds.ts` (`VARIANT_KIND_NAMES`) | Used to snapshot `OrderItem.variantName`. |
| Variant-palette mapping | `server/src/lib/variant-palettes.ts` (`VARIANT_PALETTE_SLUG`) | Used to validate `foilSwatchId` is in the correct palette per variant kind. |
| `fetchJson` + `ApiError` on the client | `client/src/services/api/fetchJson.ts:35-60` | Throws `ApiError { status, code }` — branch on `code` for SLUG_CONFLICT-style errors. |
| Zustand admin pattern | `client/src/store/adminAuth.ts` | Copy the shape for `cart.ts`; add `persist` middleware. |
| Form primitives — `Button`, `Input`, `FormField`, `Textarea` | `client/src/components/{Button,Input,FormField,Textarea}/` | Cart + checkout reuse them. |
| `AsyncContent` + `PageLoading`/`PageError`/`PageEmpty` | `client/src/components/{AsyncContent,PageState}/` | Empty cart + confirmation-loading both wire to these. |
| PDP picker schema | `client/src/pages/ProductDetailPage/schema.ts` | Already resolves `{ designId, variantKind, foilSwatchId, personalizationText, quantity }`. Phase 3 only swaps the submit handler. |
| `serverFieldErrors.applyServerFieldError` | `client/src/lib/serverFieldErrors.ts:24-38` | Used on checkout for surfacing per-field 400 codes from the server. |

### 1b. The mess — cleanup targets

| What | Where | What happens to it |
|---|---|---|
| PDP no-op `onSubmit` | `client/src/pages/ProductDetailPage/ProductDetailPage.tsx:231` (`onSubmit={(e) => e.preventDefault()}`) | Replace with `handleAddToCart(values)`. |
| PDP "Disponible próximamente" helper line | `client/src/pages/ProductDetailPage/ProductDetailPage.tsx:288` (`<p className={styles.ctaHelper}>Disponible próximamente</p>`) | Delete. The CTA becomes live. |
| Dead `/carrito` nav link | `client/src/components/NavBarPublic/NavBarPublic.tsx:5-9` | Stays — Phase 3 builds the route it points to. Add a cart-count badge. |
| Dead `/mi-cuenta` nav link | `client/src/components/NavBarPublic/NavBarPublic.tsx:5-9` | **Leave** — Phase 5 owns it. Don't add it to this PR's scope. |
| Unused `@aws-sdk/client-s3` dep | `server/package.json` | **Out of scope.** Separate cleanup PR. Don't fold in. |

### 1c. Out of scope for this phase

- **MercadoPago preference creation + webhook verification** → Phase 4. Phase 3's `MERCADOPAGO` path just creates a `PENDIENTE` order with `mpPreferenceId = null`.
- **Resend / order-confirmation email / admin new-order alert** → Phase 4. Phase 3's confirmation page is the only customer comms.
- **Bank-transfer instructions copy + admin manual-confirm flow** → Phase 4. Phase 3's confirmation just says "Pedido recibido — pendiente de pago. Pronto te enviaremos los siguientes pasos."
- **Customer registration / login / `/mi-cuenta`** → Phase 5.
- **Post-purchase "¿Quieres guardar tus datos?"** → Phase 5.
- **Admin order list + status transitions + packing-slip view** → Phase 6. For Phase 3 verification, inspect via psql or Prisma Studio (see §6).
- **Saved addresses / multi-address / discount codes / wholesale** → v2.

---

## 2. Baseline verification

These already work. Run them once before touching code so you have a known-good reference if something breaks later in this phase.

### 2a. Health

```
GET {{baseUrl}}/health

→ 200 OK
{ "ok": true }
```

### 2b. Public catalog payload — confirm the picker payload shape

This is the input shape your checkout submit will mirror. Pay attention to:

- `palette.swatches[]` is inlined on `CON_FOIL` and `CON_FOIL_Y_TINTA` variant-price rows.
- `designs[]` array, each with `compatibleKinds: VariantKind[]`.
- `variantPrices[]` always has 4 entries; `offered: false` rows must be filtered out client-side and rejected server-side.

```
GET {{baseUrl}}/products/sobres-clasicos

→ 200 OK
{
  "product": {
    "slug": "sobres-clasicos",
    "name": "Sobres Clásicos",
    "category": { "slug": "sobres", "name": "Sobres" },
    "designs": [
      { "id": "...", "name": "Floral", "imageUrl": "...", "compatibleKinds": ["CON_FOIL", "CON_TINTA_NORMAL", "CON_FOIL_Y_TINTA"] },
      ...
    ],
    "variantPrices": [
      { "kind": "CON_FOIL", "price": "...", "sku": "sobres-clasicos-FOIL-xxxx", "offered": true,
        "palette": { "slug": "colores-foil", "swatches": [{ "id": "...", "name": "Dorado", "hex": "#..." }] } },
      { "kind": "CON_TINTA_NORMAL", "price": "...", "sku": "...", "offered": true, "palette": null },
      ...
    ],
    "images": [...]
  }
}
```

- [ ] Hit `/products` (list) — confirm `palette.swatches[]` inlined on foil-bearing rows.
- [ ] Hit `/products/sobres-clasicos` — confirm `designs[].compatibleKinds` shape.
- [ ] Confirm `Order.id` does **not** appear anywhere in public responses. *Rationale: §3 — only `publicToken` is ever exposed.*

---

## 3. Security hardening

Each item is a **property the server must enforce**, not a code template. Fail loudly with `ConflictError` or `ZodError` rather than silently coercing.

- [ ] **Server owns all money.** `unitPrice`, `subtotal`, `shippingFee`, `total` are **never read from the request body**. Server re-derives them from `ProductVariantPrice.price`, `quantity`, and `env.SHIPPING_FLAT_RATE_MXN`. *Rationale: a client can lie about prices; the server cannot.*
- [ ] **`publicToken` is unguessable.** Generate with `crypto.randomBytes(16).toString("hex")` (32 hex chars, 128 bits of entropy). Never derive from `id`, `email`, or timestamp. *Rationale: this token IS the guest's access credential to view their order.*
- [ ] **`Order.id` is never returned in any public payload.** Confirm `serializeOrderPublic()` omits it. Grep your route after writing: `rg "order\.id" server/src/routes/orders.ts` — only the internal log line (if any) may contain it. *Rationale: prevents enumeration; the public token is the only handle.*
- [ ] **`Customer.passwordHash` is never serialized.** N/A in Phase 3 (no Customer writes), but double-check `serializeOrderPublic` doesn't `include: { customer: true }` on a guest order. *Rationale: defense in depth before Phase 5 wires accounts.*
- [ ] **Variant-kind validity is checked against the product.** The submitted `variantKind` for an item must exist on that product's `ProductVariantPrice` rows AND have `offered: true`. Return 409 with `code: "VARIANT_NOT_OFFERED"` otherwise. *Rationale: the PDP already gates this; the server enforces it as defense in depth.*
- [ ] **Design compatibility is re-checked server-side.** The submitted `designId` must (a) be in the product's `designs` join AND (b) include the chosen `variantKind` in its `compatibleKinds`. Return 409 with `code: "DESIGN_INCOMPATIBLE"`. *Rationale: mirror `assertDesignsCompatibleWithProduct` from `product-write.ts`.*
- [ ] **Foil-swatch validity.** When `variantKind ∈ { CON_FOIL, CON_FOIL_Y_TINTA }`, `foilSwatchId` is required and must be an active swatch in the palette mapped by `VARIANT_PALETTE_SLUG`. For other kinds, `foilSwatchId` must be `null`. *Rationale: matches PDP's `.superRefine` from `schema.ts`.*
- [ ] **Personalization text bounded.** `min(1).max(80).trim()` — exactly like the PDP picker. *Rationale: it's load-bearing for fulfillment per CLAUDE.md.*
- [ ] **Quantity bounded.** `int`, `min(1)`, `max(999)` per line. Total cart items capped at e.g. 50 lines to prevent abuse. *Rationale: matches PDP stepper; cap prevents OOM-by-payload.*
- [ ] **Shipping address required iff `shippingMethod === "NACIONAL"`.** Use `.superRefine` — empty/null object when method is `PICKUP_SALTILLO`, fully-populated when `NACIONAL`. *Rationale: contract symmetry; an unused address shouldn't pollute the row.*
- [ ] **CORS unchanged.** The new route is public, but `credentials: true` stays so future logged-in customer carts still send cookies. *Rationale: §6 invariant.*
- [ ] **Body size cap.** `express.json({ limit: "1mb" })` is already wired in `server/src/index.ts`. Confirm not raised. *Rationale: a single order should fit comfortably in well under 100 KB.*
- [ ] **No raw `fetch()` on the client.** Every order call goes through `services/api/orders.ts` → `fetchJson`. *Rationale: CLAUDE.md "Code style and architecture" → "Client — service layer".*
- [ ] **No `localStorage` writes that contain anything secret.** Cart contains product info only — no tokens, no email, no payment data. *Rationale: cart is read by any script with same-origin access; it must stay PII-free.*

---

## 4. Server — ordered tasks

Work top-to-bottom. Each task ends with a Postman recipe so you can verify before moving to the next.

### 4a. Add `SHIPPING_FLAT_RATE_MXN` to env

- [ ] **Add to `server/src/config/env.ts` schema.** Use `z.coerce.number().positive()`. Default at parse time is fine for dev; production gets the real value via Fly secret.
- [ ] **Add to `.env.example`** with a placeholder comment: `SHIPPING_FLAT_RATE_MXN=150  # MXN, flat national rate — confirm with client before launch`.
- [ ] **Forward in `docker-compose.yml`** under the `api` service `environment:` block.
- [ ] **Set in your local `.env`** (e.g. `150`).
- [ ] Restart the stack: `pnpm dev:down && pnpm dev`.

Verify the env parses without error: `docker compose logs api --tail 20` should show no `ZodError`.

### 4b. Create `lib/shipping.ts`

- [ ] **File:** `server/src/lib/shipping.ts`.
- [ ] Export `getShippingFee(method: ShippingMethod): Prisma.Decimal`:
  - `PICKUP_SALTILLO` → `new Prisma.Decimal(0)`
  - `NACIONAL` → `new Prisma.Decimal(env.SHIPPING_FLAT_RATE_MXN)`
- [ ] **No other branches.** If the schema enum grows, this function must surface as a TS exhaustiveness error.

### 4c. Create `lib/public-token.ts`

- [ ] **File:** `server/src/lib/public-token.ts`.
- [ ] Export `generatePublicToken(): string` returning `crypto.randomBytes(16).toString("hex")`. 32 hex chars.
- [ ] **Do not log the token on creation.** It's a credential.

### 4d. Extend `lib/validation-schemas.ts` with `createOrderSchema`

- [ ] Add a `createOrderItemSchema`:
  ```
  {
    productId: string (cuid),
    variantKind: VariantKind enum,
    designId: string (cuid),
    foilSwatchId: string (cuid) | null,
    personalizationText: string.trim().min(1).max(80),
    quantity: int.min(1).max(999)
  }
  ```
- [ ] Add a `shippingAddressSchema`:
  ```
  {
    calle: string.trim().min(1).max(120),
    numero: string.trim().min(1).max(20),
    colonia: string.trim().min(1).max(80),
    ciudad: string.trim().min(1).max(80),
    estado: string.trim().min(1).max(80),
    codigoPostal: string.regex(/^\d{5}$/),
    notas: string.max(280).optional()
  }
  ```
- [ ] Compose `createOrderSchema`:
  ```
  {
    email: string.email(),
    name: string.trim().min(1).max(120),
    phone: string.trim().min(7).max(20),
    shippingMethod: ShippingMethod enum,
    shippingAddress: shippingAddressSchema | null,
    paymentMethod: PaymentMethod enum,
    items: createOrderItemSchema.array().min(1).max(50),
    notes: string.max(500).optional()
  }
  ```
- [ ] Add `.superRefine` to enforce:
  - `NACIONAL` ⇒ `shippingAddress` non-null.
  - `PICKUP_SALTILLO` ⇒ `shippingAddress` must be `null` (or coerce to `null` and emit a warning issue — preference: reject with `code: "ADDRESS_NOT_ALLOWED_FOR_PICKUP"`).

### 4e. Create `lib/order-write.ts`

This is the largest new server piece. Mirror `product-write.ts` for style.

- [ ] **File:** `server/src/lib/order-write.ts`.
- [ ] Export `buildOrderItemsForCreate(tx: Prisma.TransactionClient, items: OrderItemInput[]): Promise<{ create: Prisma.OrderItemCreateWithoutOrderInput[]; subtotal: Prisma.Decimal }>`.
- [ ] For each input item:
  1. Fetch the `Product` with `include: { variantPrices: true, designs: { include: { design: { include: { variantCompat: true, categoryLinks: true } } } } }`. Single query per item is fine for v1; ~10 orders/week, max 50 lines per order.
  2. Assert product exists → `NotFoundError("Producto no encontrado")` otherwise.
  3. Find the matching `ProductVariantPrice` row by `kind`. Assert `offered === true` → `ConflictError("VARIANT_NOT_OFFERED", "...")` otherwise.
  4. Assert the design is joined to this product AND its `variantCompat` includes the chosen `variantKind` → `ConflictError("DESIGN_INCOMPATIBLE", "...")`.
  5. If `variantKind ∈ { CON_FOIL, CON_FOIL_Y_TINTA }`:
     - Look up the palette via `VARIANT_PALETTE_SLUG[variantKind]`.
     - Fetch the swatch by `foilSwatchId`; assert `active === true` AND `paletteId` matches → `ConflictError("FOIL_SWATCH_INVALID", "...")`.
     - Snapshot into `selections: { foilColor: swatch.name, foilSwatchId: swatch.id, hex: swatch.hex }`.
  6. Otherwise: assert `foilSwatchId === null` (zod already enforces, but server is defense-in-depth) and `selections = {}`.
  7. Snapshot:
     - `productId` (no FK — it's snapshot)
     - `variantKind` (enum)
     - `sku` from `ProductVariantPrice.sku`
     - `productName` from `Product.name`
     - `variantName` from `VARIANT_KIND_NAMES[variantKind]`
     - `unitPrice` from `ProductVariantPrice.price` (Decimal)
     - `quantity`
     - `personalizationText` (trimmed)
     - `selections` (Json)
     - `designId`, `designName` (from `Design.name`), `designImageUrl` (from `Design.imageUrl`) — all nullable snapshot fields
- [ ] Sum `unitPrice * quantity` into a `Decimal` subtotal using `Prisma.Decimal` math, never `Number`. *Rationale: floating-point on money is forbidden per CLAUDE.md.*
- [ ] Return `{ create, subtotal }`.

### 4f. Add `serializeOrderPublic` to `lib/serializers.ts`

- [ ] Export `serializeOrderPublic(order: OrderWithItems)`:
  - Include: `publicToken`, `status`, `email`, `name`, `phone`, `shippingMethod`, `shippingAddress`, `shippingFee` (string), `subtotal` (string), `total` (string), `paymentMethod`, `createdAt`, `items[]`.
  - Each item: all snapshot columns, formatted: `unitPrice` as string, `selections` passed through as object.
  - **Exclude:** `Order.id`, `Order.customerId`, `Order.mpPreferenceId`, `Order.mpPaymentId`, `Order.notes` (admin-only, even if Phase 3 has none yet), and `OrderItem.id`. *Rationale: §3 — public payload exposes only what the customer needs to see their own order.*

### 4g. Create `routes/orders.ts`

- [ ] **File:** `server/src/routes/orders.ts`.
- [ ] Build the router with two routes:

```
POST {{baseUrl}}/orders
Content-Type: application/json

{
  "email": "ana@example.com",
  "name": "Ana López",
  "phone": "8441234567",
  "shippingMethod": "NACIONAL",
  "shippingAddress": {
    "calle": "Av. Reforma",
    "numero": "1234",
    "colonia": "Centro",
    "ciudad": "Saltillo",
    "estado": "Coahuila",
    "codigoPostal": "25000",
    "notas": "Tocar timbre"
  },
  "paymentMethod": "TRANSFERENCIA",
  "items": [
    {
      "productId": "<cuid from /api/products>",
      "variantKind": "CON_FOIL",
      "designId": "<cuid>",
      "foilSwatchId": "<cuid>",
      "personalizationText": "Mariana López",
      "quantity": 2
    }
  ]
}

→ 201 Created
{
  "order": {
    "publicToken": "a1b2c3...",
    "status": "PENDIENTE",
    "subtotal": "180.00",
    "shippingFee": "150.00",
    "total": "330.00",
    "items": [ ... ],
    ...
  }
}
```

- [ ] Inside a `prisma.$transaction(async (tx) => { ... })`:
  1. `createOrderSchema.parse(req.body)`.
  2. Call `buildOrderItemsForCreate(tx, parsed.items)` → `{ create, subtotal }`.
  3. `const shippingFee = getShippingFee(parsed.shippingMethod);`
  4. `const total = subtotal.plus(shippingFee);`
  5. Generate `publicToken`; retry once on `P2002` (unique-collision is ~impossible at 128 bits but harmless to handle).
  6. `await tx.order.create({ data: { publicToken, status: "PENDIENTE", customerId: null, email, name, phone, shippingMethod, shippingAddress: parsed.shippingAddress ?? Prisma.JsonNull, shippingFee, subtotal, total, paymentMethod, items: { create } }, include: { items: true } })`.
- [ ] Respond `201` with `{ order: serializeOrderPublic(order) }`.
- [ ] Errors → `next(err)`.

Second route:

```
GET {{baseUrl}}/orders/<publicToken>

→ 200 OK
{ "order": { ... } }

→ 404 Not Found
{ "code": "NOT_FOUND", "message": "Pedido no encontrado" }
```

- [ ] Look up by `publicToken` only. **Never expose lookup by `id`.**
- [ ] `throw new NotFoundError("Pedido no encontrado")` on miss.

### 4h. Mount the router

- [ ] In `server/src/index.ts`, add `app.use("/api/orders", ordersRouter)` alongside the existing public `productsRouter` mount. *Rationale: keep the route tree predictable — public routes under `/api`, admin under `/api/admin`.*

### 4i. Server smoke run (full §4 verification)

- [ ] **Restart stack:** `pnpm dev:down && pnpm dev`.
- [ ] **Postman: happy path** — TRANSFERENCIA + NACIONAL, two items. → 201, `status: "PENDIENTE"`, totals match `unitPrice × qty + 150`.
- [ ] **Postman: PICKUP + null address.** → 201, `shippingFee: "0.00"`.
- [ ] **Postman: PICKUP + non-null address.** → 400 with `code: "ADDRESS_NOT_ALLOWED_FOR_PICKUP"` (or your zod issues array).
- [ ] **Postman: foil variant with no `foilSwatchId`.** → 400.
- [ ] **Postman: foil variant with a `foilSwatchId` from a different palette.** → 409 `FOIL_SWATCH_INVALID`.
- [ ] **Postman: variant with `offered: false`** (toggle one in admin first). → 409 `VARIANT_NOT_OFFERED`.
- [ ] **Postman: design not in product's designs.** → 409 `DESIGN_INCOMPATIBLE`.
- [ ] **Postman: GET by publicToken from the happy-path order.** → 200, item snapshots populated.
- [ ] **Postman: GET with a tampered token.** → 404 `NOT_FOUND`.
- [ ] **Inspect DB:** `docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT \"publicToken\", status, subtotal, total FROM \"Order\" ORDER BY \"createdAt\" DESC LIMIT 5;"` — confirm rows exist with correct values.
- [ ] **Grep the response:** confirm no `"id"` field at the Order level appears anywhere in the JSON.

---

## 5. Client — ordered tasks

Build inside-out: types → store → service → PDP wire → navbar → cart page → checkout page → confirmation page → route wiring.

### 5a. Extend `lib/types.ts`

- [ ] Add:
  ```ts
  export type ShippingMethod = "NACIONAL" | "PICKUP_SALTILLO";
  export type PaymentMethod = "MERCADOPAGO" | "TRANSFERENCIA";
  export type OrderStatus = "PENDIENTE" | "PAGADO" | "ENVIADO" | "ENTREGADO" | "CANCELADO";

  export interface CartLine {
    id: string;                  // uuid, generated when added
    productId: string;
    productSlug: string;         // for product-link back from cart
    productName: string;
    productImageUrl: string;
    variantKind: VariantKind;
    variantName: string;         // snapshot from VARIANT_KIND_NAMES
    unitPrice: string;           // string from server, formatted at render
    quantity: number;
    designId: string;
    designName: string;
    designImageUrl: string;
    foilSwatchId: string | null;
    foilColorName: string | null;
    personalizationText: string;
  }

  export interface ShippingAddress {
    calle: string;
    numero: string;
    colonia: string;
    ciudad: string;
    estado: string;
    codigoPostal: string;
    notas?: string;
  }

  export interface OrderItemPublic { /* mirrors serializeOrderPublic item */ }
  export interface OrderPublic {
    publicToken: string;
    status: OrderStatus;
    email: string; name: string; phone: string;
    shippingMethod: ShippingMethod;
    shippingAddress: ShippingAddress | null;
    shippingFee: string; subtotal: string; total: string;
    paymentMethod: PaymentMethod;
    createdAt: string;
    items: OrderItemPublic[];
  }
  ```

### 5b. Create `store/cart.ts`

- [ ] **File:** `client/src/store/cart.ts`.
- [ ] Use `zustand` with the `persist` middleware (`from "zustand/middleware"`) keyed on `quarzo-cart-v1` so a future schema change (`v2`) can ignore old shapes.
- [ ] State:
  - `lines: CartLine[]`
- [ ] Actions:
  - `addLine(line: Omit<CartLine, "id">): void` — generate uuid via `crypto.randomUUID()`, append.
  - `removeLine(id: string): void`
  - `updateQuantity(id: string, quantity: number): void` — clamp to `[1, 999]`.
  - `clear(): void`
- [ ] Selectors (exported as hooks):
  - `useCartLineCount(): number` — sum of `quantity`.
  - `useCartSubtotal(): number` — sum of `Number(unitPrice) * quantity`. **Display only** — server still recomputes.
- [ ] **Cart line identity rule:** every "Agregar al carrito" creates a new line with its own `id`. **Do not merge by signature.** *Rationale: personalization text per line means two of "the same" SKU with different names are not interchangeable. Quantity grouping in the cart UI would be misleading.*

### 5c. Create `services/api/orders.ts`

- [ ] **File:** `client/src/services/api/orders.ts`.
- [ ] One-line wrappers around `fetchJson`:
  ```ts
  export const createOrder = (payload: CreateOrderPayload) =>
    fetchJson<{ order: OrderPublic }>("/orders", { method: "POST", body: payload });

  export const getOrderByToken = (token: string) =>
    fetchJson<{ order: OrderPublic }>(`/orders/${encodeURIComponent(token)}`);
  ```
- [ ] No raw `fetch()`. No business logic in this file. *Rationale: CLAUDE.md "Client — service layer".*

### 5d. Wire the PDP submit handler

- [ ] **File:** `client/src/pages/ProductDetailPage/ProductDetailPage.tsx`.
- [ ] Delete line 288: `<p className={styles.ctaHelper}>Disponible próximamente</p>`.
- [ ] Remove the unused `ctaHelper` SCSS rule from `ProductDetailPage.module.scss`.
- [ ] Replace `onSubmit={(e) => e.preventDefault()}` (line 231) with `onSubmit={handleSubmit(handleAddToCart)}`.
- [ ] Implement `handleAddToCart(values: PickerValues)`:
  - Resolve `productImageUrl` from `product.images[0]?.url`.
  - Resolve `variantName` from `VARIANT_KIND_NAMES[values.variantKind]`.
  - Resolve `unitPrice` from the matching `product.variantPrices` row by `kind`.
  - Resolve `design{Id,Name,ImageUrl}` from `product.designs.find(d => d.id === values.designId)`.
  - Resolve `foilColorName` from the matching swatch in `variantPrice.palette?.swatches`, or `null`.
  - Call `useCart.getState().addLine({...})`.
  - On success: navigate to `/carrito` (recommended) or stay with a "Producto agregado" toast (skip toast in Phase 3 — keep simple).
- [ ] **Reset the form** after add (`reset()` from RHF) so the next add starts clean.

### 5e. Add cart-count to public navbar

- [ ] **File:** `client/src/components/NavBarPublic/NavBarPublic.tsx`.
- [ ] Import `useCartLineCount` and render the count next to the "Carrito" link only when `count > 0`. Style: a small pill with `t.$color-accent` background, `t.$color-bg-cream-light` text, padding `0 t.$space-2`.
- [ ] Add the new selector to a small SCSS module rule, semantic class name `.cartCount`. *Rationale: CLAUDE.md SCSS rules — semantic names, max 2 levels of nesting, tokens only.*
- [ ] Verify the badge updates live when adding to cart on PDP (zustand subscribers re-render automatically).

### 5f. Build `/carrito` page

- [ ] **Folder:** `client/src/pages/CartPage/` containing `CartPage.tsx` + `CartPage.module.scss`.
- [ ] Layout: single column on mobile; on `>= screen-md` show items + a sticky summary aside.
- [ ] Empty state via `<PageEmpty>` — `title="Tu carrito está vacío"`, message + `<ButtonLink to="/catalogo">Ver el catálogo</ButtonLink>`.
- [ ] Each line renders:
  - Thumbnail (`design.imageUrl` or `product.imageUrl` — prefer design since the customer chose it).
  - Product name + variant name + design name (small subline).
  - Personalization text (in quotes).
  - Foil color swatch + name when applicable.
  - Quantity stepper (reuses `QuantityInput` if portable from PDP, otherwise inline — `−`/`+` buttons with `aria-label="Reducir cantidad"`/`"Aumentar cantidad"`).
  - Unit price + line total.
  - "Quitar" button (text button, no confirm — easy to re-add from `/producto/:slug`).
- [ ] Subtotal at the bottom. **No shipping yet** — that's chosen in checkout. Label: "Subtotal (envío se calcula al pagar)".
- [ ] CTA `<Button as={Link} to="/checkout">Continuar a checkout</Button>` — disabled when cart is empty (it won't render in that case, but defense in depth).
- [ ] No async work — the cart is pure local state. No `AsyncContent` needed.

### 5g. Build `/checkout` page

The bulk of the work.

- [ ] **Folder:** `client/src/pages/CheckoutPage/` containing `CheckoutPage.tsx` + `CheckoutPage.module.scss` + `schema.ts`.
- [ ] `schema.ts` mirrors `createOrderSchema` on the server. **Same constraints**, same error keys (use server's `code` strings where applicable for friendly mapping):
  - `email: z.string().email("Correo inválido")`
  - `name: z.string().trim().min(1, "Ingresa tu nombre").max(120)`
  - `phone: z.string().trim().min(7, "Teléfono inválido").max(20)`
  - `shippingMethod: z.enum(["NACIONAL", "PICKUP_SALTILLO"])`
  - `shippingAddress: shippingAddressSchema.nullable()` + `.superRefine` to require it when `NACIONAL`
  - `paymentMethod: z.enum(["MERCADOPAGO", "TRANSFERENCIA"])`
  - `notes: z.string().max(500).optional()`
- [ ] Two-column layout on desktop (`>= screen-md`): form on the left, sticky order summary on the right. Single column on mobile (summary collapses to a fixed bottom bar or accordion — recommend accordion for simplicity).
- [ ] Form sections, top to bottom:
  1. **Datos de contacto** — email, nombre, teléfono.
  2. **Método de envío** — `<fieldset>` + `<legend>Método de envío</legend>` wrapping two `<input type="radio">` (NACIONAL, PICKUP_SALTILLO). Mirrors the PDP picker a11y pattern.
  3. **Dirección de envío** — conditional on `watch("shippingMethod") === "NACIONAL"`. Standard MX address fields.
  4. **Método de pago** — `<fieldset>` + `<legend>` + two `<input type="radio">` (MERCADOPAGO, TRANSFERENCIA). No grayed-out state — both are valid Phase 3 picks. Add a 1-line helper under each: "Tarjeta, Oxxo, SPEI" / "Transferencia interbancaria (CLABE)".
  5. **Notas (opcional)** — `<Textarea>`.
- [ ] Order summary (right column / collapsed accordion): line items (thumbnail + name + qty + line total), subtotal, shippingFee (computed client-side as preview: `0` for pickup, `env-mirrored constant` for nacional — see §5h), total. Add a small note: "Total calculado al confirmar."
- [ ] Submit handler:
  1. Build payload: `{ email, name, phone, shippingMethod, shippingAddress, paymentMethod, items: cart.lines.map(toServerItem), notes }`.
  2. `toServerItem(line)` returns `{ productId, variantKind, designId, foilSwatchId, personalizationText, quantity }`. **Never send `unitPrice`, `subtotal`, etc.** — server recomputes.
  3. `await createOrder(payload)` via `useFormSubmit` hook for the try/catch + `submitError` state.
  4. On success: `clear()` cart, `navigate(\`/pedido/${order.publicToken}\`, { replace: true })`.
  5. On `ApiError`: map known codes to per-field RHF errors via `applyServerFieldError`:
     - `VARIANT_NOT_OFFERED` / `DESIGN_INCOMPATIBLE` / `FOIL_SWATCH_INVALID` → general banner ("Algún producto en tu carrito ya no está disponible. Vuelve al catálogo.") + a "Limpiar carrito" CTA. *Rationale: these errors mean the cart is stale — admin toggled `offered` or deleted a design while the customer was filling the form.*
     - `ADDRESS_NOT_ALLOWED_FOR_PICKUP` → setError on `shippingAddress` (defensive — UI prevents it).
- [ ] **Redirect when cart is empty.** On mount, if `cart.lines.length === 0`, `navigate("/carrito", { replace: true })`.

### 5h. Client-side shipping-fee preview

- [ ] **Decision:** the server is authoritative on the fee. The client shows a preview.
- [ ] Add a small `lib/shipping-preview.ts`: `const NATIONAL_SHIPPING_PREVIEW_MXN = 150; export const previewShippingFee = (m: ShippingMethod) => m === "PICKUP_SALTILLO" ? 0 : NATIONAL_SHIPPING_PREVIEW_MXN;` — with a comment: `// Display-only preview. Server recomputes from SHIPPING_FLAT_RATE_MXN; if they drift, server wins on the receipt.`
- [ ] If you ever change `SHIPPING_FLAT_RATE_MXN`, remember to update this constant too. *Rationale: this is a known minor drift surface — simpler than fetching the rate from the server, and the server still wins the actual order.*

### 5i. Build `/pedido/:publicToken` confirmation page

- [ ] **Folder:** `client/src/pages/OrderConfirmationPage/` containing `OrderConfirmationPage.tsx` + `OrderConfirmationPage.module.scss`.
- [ ] Fetch with `getOrderByToken(token)`; wrap render in `<AsyncContent data={order} error={err} onRetry={refetch}>`.
- [ ] On load, show:
  - Big "¡Gracias por tu pedido!" heading.
  - Order number / token reference (small, monospace).
  - Status badge: "Pendiente de pago".
  - Generic message: "Recibimos tu pedido. Pronto te enviaremos los siguientes pasos para completar tu pago."
  - **No bank details, no MP redirect — both are Phase 4.** *Rationale: §1c.*
  - Order summary (items + totals + shipping).
  - Contact email + shipping method.
  - "Guarda este enlace" instruction with the current URL displayed.
  - `<ButtonLink to="/catalogo">Seguir explorando</ButtonLink>`.
- [ ] On 404: dedicated empty state ("Pedido no encontrado") — not the generic PageError.

### 5j. Mount the new routes

- [ ] **File:** `client/src/routes/publicRoutes.tsx`. Add three routes under `PublicLayout`:
  - `/carrito` → `CartPage`
  - `/checkout` → `CheckoutPage`
  - `/pedido/:publicToken` → `OrderConfirmationPage`

### 5k. Client smoke run

- [ ] Hard refresh after building. Add an item to cart from PDP → navbar count updates.
- [ ] Refresh the browser → cart persists.
- [ ] Open `/carrito` → see line. Bump quantity. Remove line.
- [ ] Add a line, click "Continuar a checkout".
- [ ] Try with PICKUP → address fields disappear → submit → land on `/pedido/<token>`.
- [ ] Go back to `/catalogo`, add another item.
- [ ] Try with NACIONAL → fill address → submit MERCADOPAGO → land on `/pedido/<token>` → generic message.
- [ ] DevTools → Application → Local Storage → confirm cart cleared after submit, key is `quarzo-cart-v1`.
- [ ] Tab-key through the checkout form on a clean reload → confirm focus order is sane and the radio fieldsets allow arrow-key roving (browser-native behavior with `<input type="radio">`).
- [ ] Resize browser to ~375 px (iPhone width). Confirm form + summary stack reasonably.

---

## 6. End-to-end verification

Run this once when both §4 and §5 are checked off. If anything fails, do not start §7-style debugging until you've found the boundary — it's almost always either schema parse (server) or `applyServerFieldError` mapping (client).

- [ ] Clean boot: `pnpm dev:down && pnpm dev`.
- [ ] Apply migrations + reseed: `pnpm migrate && pnpm seed`.
- [ ] **Postman full sweep (§2 + §4i recipes).** All pass.
- [ ] **Browser full sweep:**
  - `/catalogo` → click product → fill picker → "Agregar al carrito" → navbar count = 1.
  - Add a second product → count = 2.
  - `/carrito` → both lines render correctly with design thumbnails, personalization, foil color where applicable.
  - Bump quantity on one line → subtotal updates.
  - "Continuar a checkout" → `/checkout`.
  - Fill contact, NACIONAL, full address, TRANSFERENCIA, submit → land on `/pedido/<token>`, cart empty, summary correct.
  - Copy the URL, paste in a new tab → confirmation loads (publicToken-based read works).
  - Repeat the flow with PICKUP + MERCADOPAGO → same outcome.
- [ ] **DB inspection:**
  ```
  docker compose exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
  SELECT "publicToken", "shippingMethod", "paymentMethod", "subtotal", "shippingFee", "total", "status" FROM "Order" ORDER BY "createdAt" DESC LIMIT 5;
  SELECT "productName", "variantName", "personalizationText", "quantity", "unitPrice", "sku", "selections" FROM "OrderItem" ORDER BY "id" DESC LIMIT 10;
  ```
  Confirm `selections` is `{...}` for foil orders and `{}` for non-foil. Confirm `sku` is populated. Confirm `designId`/`designName`/`designImageUrl` are populated.
- [ ] **Mobile responsive check at 375 px / 414 px:** PDP, `/carrito`, `/checkout`, `/pedido/<token>` all render without horizontal scroll.
- [ ] **Preflight:** `pnpm preflight:full` green.
- [ ] **Update roadmap:** check the five Phase 3 boxes in `docs/tech-roadmap.md` §10. Optionally invoke the `audit-docs` skill to sync CLAUDE.md's status paragraph.

---

## 7. Debugging appendix

Most likely failure modes for this phase, in rough order of probability.

### 7a. "Server rejects valid order with 400"

**Symptom:** Postman or the checkout form returns 400 with a `ZodError` `issues` array.

**Likely causes (most common first):**
1. `shippingAddress` is `{}` instead of `null` for PICKUP. Add `shippingAddress: shippingMethod === "PICKUP_SALTILLO" ? null : data.shippingAddress` in your client payload builder.
2. `foilSwatchId: undefined` instead of `null` for non-foil items. zod treats `undefined` and `null` differently; the schema must accept `null` explicitly.
3. `quantity` sent as a string ("2") instead of a number. RHF text inputs return strings by default — coerce with `valueAsNumber: true` in `register` or use `z.coerce.number()`.
4. `personalizationText` over 80 chars (the trim happens server-side, but if client validation is `max(80)` on the un-trimmed value, edge cases slip through).

**Diagnosis:** open the Network tab, find the 400, expand the response. Each `issues[]` entry has `path: ["items", 0, "quantity"]` style — fix the exact field.

### 7b. "Cart not persisting across reloads"

**Symptom:** add items, refresh, cart is empty.

**Likely causes:**
1. `persist` middleware not configured. Check `store/cart.ts` imports `persist` from `zustand/middleware` and wraps the store creator.
2. Storage key collision. Use a versioned key (`quarzo-cart-v1`) so a stale dev-tools key doesn't leak.
3. SSR/hydration mismatch — N/A here (we're SPA-only via Vite), but if you see a "hydration mismatch" warning in console, that's the cause.

**Diagnosis:** DevTools → Application → Local Storage → look for the key. If present but empty, the action writes aren't firing. If absent, the middleware isn't wired.

### 7c. "Subtotal doesn't match between client preview and server receipt"

**Symptom:** cart preview shows `$300` but the confirmation page shows `$300.01` or similar.

**Likely cause:** Decimal vs Number arithmetic. The client uses `Number()` for preview math. The server uses `Prisma.Decimal`. With money in MXN you'll usually not see drift, but if you ever sum 30 items the rounding may differ.

**Fix:** trust the server. The receipt is the receipt. If users complain, switch the client preview to a smaller Decimal lib (`decimal.js`) — Phase 7 polish.

### 7d. "publicToken returned a 404 immediately after creating the order"

**Symptom:** order created (201), but the confirmation page 404s.

**Likely causes:**
1. URL-encoding mismatch. The token is hex (`[a-f0-9]{32}`) — safe in URLs — but verify your `navigate` call uses the exact string from the response.
2. The `GET` route is matching `/orders/:publicToken` as `/orders` (root) somehow — check route ordering in `index.ts` and that the new router is mounted **before** the global 404 handler.
3. Transaction rolled back. Re-inspect server logs — if you see `Rollback`, an item-level assertion failed after the order was tentatively created. Should never happen because the transaction wraps the whole thing, but check that the order row exists with `SELECT * FROM "Order" WHERE "publicToken" = '...'`.

### 7e. "Cart store contains a line for a product/design/swatch that was deleted in admin"

**Symptom:** customer fills checkout, submits, gets 409 `DESIGN_INCOMPATIBLE` or `VARIANT_NOT_OFFERED`.

**Likely cause:** the admin toggled a variant or deleted a design while the customer's cart was sitting in localStorage from a prior visit.

**Fix already specified in §5g:** the checkout submit handler shows a banner "Algún producto en tu carrito ya no está disponible. Vuelve al catálogo." plus a "Limpiar carrito" CTA. **Don't** auto-clear — the customer should see what they lost.

**Avoid:** writing complex "validate cart on every mount" code. The cart is best-effort. Server is authoritative.

---

## Definition of done

- All five Phase 3 boxes checked in `docs/tech-roadmap.md` §10.
- A clean run of §6's E2E checklist with no warnings in the dev console or server log.
- `pnpm preflight:full` green.
- `CLAUDE.md` status paragraph mentions Phase 3 as merged — defer to the `audit-docs` skill to sync that section.
- PR description references this doc and lists which §3 properties were verified end-to-end.
