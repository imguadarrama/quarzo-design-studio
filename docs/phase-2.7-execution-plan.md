# Phase 2.7 Execution Plan — Product designs (visual selection)

> **Purpose:** add a "design style" axis to the catalog so customers can browse 20+ visual designs per product (currently scoped to *sobres*) before picking a variant. Surfaced during Slice 7 review when the wife clarified that the real customer flow is **design → variant → options**, not **variant → options** as originally modeled.
>
> **Mindset:** schema + admin UI now, customer-facing UX in Slice 9. This phase ships no public-facing UX — that is intentional. Slice 9 (revised) integrates the design picker into the product detail page once this phase lands.
>
> **Blocked on:** [`phase-2.6-execution-plan.md`](phase-2.6-execution-plan.md). Designs add 20+ image-bearing rows per product; doing them on the base64 pipeline would balloon the public payload and require a second migration.

---

## 0. How to use this doc

- One PR, single branch (`phase/2.7-designs`).
- Designs land **after Phase 2.6**. Image storage is solved; this phase consumes it.
- `pnpm preflight` green at the end.

---

## 1. Where we are

- **What Phase 2.5 + 2.6 leave us with:** a working admin form that edits product metadata + hero images + variants + per-variant options. Image uploads go to R2 via the upload endpoint built in Phase 2.6.
- **What this phase fills in:** a third array on `Product` — `designs[]` — sibling of `images[]` and `variants[]`. Each design carries a name + image URL + position + active flag, and a many-to-many relation to `ProductVariant` capturing which variants a design is compatible with.
- **What stays the same:** `Product`, `ProductImage`, `ProductVariant`, `ProductVariantOption`. No changes to existing tables. `OrderItem` gains three nullable snapshot columns (`designId`, `designName`, `designImageUrl`) for forward-compat with Phase 3 cart.
- **What does not ship in this phase:**
  - The customer-facing design picker UX. That is **Slice 9** of Phase 2.5, revised. Slice 9's plan is updated in [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md) §10 but not implemented here.
  - A "default design" or "no-design" fallback on the product detail page. Slice 9 handles that branch.

---

## 2. Customer flow this phase enables

```
Catalog → Product detail page (Slice 9 builds this)
            │
            ▼
  ┌────────────────────────────────┐
  │ Pick Diseño  (visual grid)     │   ← active=true designs only
  │   - "Floral primavera"  IMG    │
  │   - "Botánico minimal"  IMG    │
  │   - ... 20+ designs            │
  └────────────────────────────────┘
            │
            ▼
  ┌────────────────────────────────┐
  │ Pick Variante  (chips)         │   ← only variants compatible with
  │   • Tinta normal  $200         │     the chosen design enabled
  │   • Con foil      $250         │
  └────────────────────────────────┘
            │
            ▼
  ┌────────────────────────────────┐
  │ Fill Opciones                  │   ← unchanged (Slice 7 model)
  │   • Color del foil (SELECT)    │
  │   • Texto personalizado (TEXT) │
  └────────────────────────────────┘
            │
            ▼
        Agregar al carrito
```

Compatibility is **per-design** (some designs only render in foil, some only in tinta normal, most in both). The default in the admin UI is "compatible with every variant"; the wife unchecks the exceptions.

For products without designs (stickers, etiquetas, gift cards), the design step is skipped — the product detail page goes straight to variant selection. Slice 9 handles the "no designs" branch.

---

## 3. Server changes

### 3.1 Schema (`server/prisma/schema.prisma`)

Add two models. Extend `Product`, `ProductVariant`, and `OrderItem`.

```prisma
model Product {
  // ... existing fields
  designs ProductDesign[]
}

model ProductDesign {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  name      String
  imageUrl  String                              // R2 CDN URL (Phase 2.6)
  position  Int     @default(0)
  active    Boolean @default(true)
  variants  DesignVariantCompat[]

  @@index([productId])
  @@index([active])
}

model DesignVariantCompat {
  designId  String
  design    ProductDesign  @relation(fields: [designId], references: [id], onDelete: Cascade)
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@id([designId, variantId])
  @@index([variantId])
}

model ProductVariant {
  // ... existing fields
  designs DesignVariantCompat[]
}

model OrderItem {
  // ... existing fields
  designId       String?     // nullable: products without designs
  designName     String?     // snapshot
  designImageUrl String?     // snapshot — old order receipts still render correctly if design is later deleted
}
```

Migration name: `add_product_designs`. No data backfill needed — all existing rows default `null` / `[]` / `0` cleanly.

### 3.2 Validation schemas (`server/src/lib/validation-schemas.ts`)

```ts
export const designSchema = z.object({
  name: z.string().trim().min(1).max(120),
  imageUrl: z.string().url("URL inválida"),
  active: z.boolean().default(true),
  // Array of variant indices in the same product payload that this design is compatible with.
  // Indices not IDs because variants are full-replaced on PATCH (no stable ID across edits).
  compatibleVariantIndices: z.array(z.number().int().min(0)).default([]),
});

export const productSchema = z.object({
  // ... existing
  designs: z.array(designSchema).max(50, "Máximo 50 diseños").default([]),
});
```

**Why "indices into the variants array" instead of "variantIds":** the existing PATCH route deletes and recreates all variants in a transaction (see `routes/admin-products.ts`). Variant IDs are unstable across edits. Indices into the same payload's `variants[]` are stable and the write builder resolves them after `tx.productVariant.create` returns.

### 3.3 Write builder (`server/src/lib/product-write.ts`)

The transaction inside `PATCH /admin/products/:id` becomes:

```ts
return tx.product.update({
  where: { id },
  data: {
    // ... existing fields
    images: { create: buildImagesCreate(data.images) },
    designs: { /* deferred — see below */ },
    variants: { /* deferred — see below */ },
  },
});
```

Designs reference variants by index, so we need variants created first. Reshape the transaction:

```ts
// 1. delete existing variants, designs, compat (all cascade via FK on delete)
await tx.productVariant.deleteMany({ where: { productId } });
await tx.productImage.deleteMany({ where: { productId } });
await tx.productDesign.deleteMany({ where: { productId } });

// 2. update product + images (no FK out)
await tx.product.update({ where: { id }, data: { ...metadata, images: { create: buildImagesCreate(data.images) } } });

// 3. create variants, capture returned IDs in payload-index order
const createdVariants = await Promise.all(
  data.variants.map((v, i) => tx.productVariant.create({
    data: { productId, ...buildVariantWriteInput(v, i) },
  }))
);

// 4. create designs with compat join rows resolving indices to IDs
await Promise.all(
  data.designs.map((d, i) => tx.productDesign.create({
    data: {
      productId, name: d.name, imageUrl: d.imageUrl, active: d.active, position: i,
      variants: {
        create: d.compatibleVariantIndices
          .filter((idx) => idx < createdVariants.length)
          .map((idx) => ({ variantId: createdVariants[idx].id })),
      },
    },
  }))
);
```

Same shape on POST /admin/products (create), minus the deletes.

`buildVariantsCreate` (from Slice 7) is split into `buildVariantWriteInput(variant, index)` returning a single-variant Prisma input — the wrapper that nested `options.create` stays.

### 3.4 Serializers (`server/src/lib/serializers.ts`)

- `serializeProductPublic` and `serializeProductAdmin` both gain `designs`.
- Public design shape: `{ id, name, imageUrl, position, compatibleVariantIds: string[] }`. Position is exposed because the catalog renders in saved order.
- Admin design shape: same plus `active: boolean`.
- `productInclude` extends to `designs: { include: { variants: true } }` so `compatibleVariantIds` can be derived without a second query.

```ts
const serializeDesignPublic = (d: DesignWithVariants) => ({
  id: d.id,
  name: d.name,
  imageUrl: d.imageUrl,
  position: d.position,
  compatibleVariantIds: d.variants.map((v) => v.variantId),
});

// Public payload only emits active designs:
designs: sortByPosition(product.designs)
  .filter((d) => d.active)
  .map(serializeDesignPublic),
```

Admin emits all designs (active + inactive), client renders the active flag.

### 3.5 Routes (`server/src/routes/admin-products.ts`)

No new routes — existing POST/PATCH/DELETE/GET on `/admin/products` extend to handle `designs` automatically through the serializer + write builder. Confirm 409 on `P2002` still surfaces (no new unique constraints added — `DesignVariantCompat` is `@@id([designId, variantId])` which can't conflict because both sides are fresh per write).

### 3.6 Public route (`server/src/routes/products.ts`)

`GET /api/products` and `GET /api/products/:slug` automatically pick up the new `designs` field through `serializeProductPublic`. Verify the slug-fetch returns the full design list with `compatibleVariantIds` populated.

### 3.7 Image upload prefix

Phase 2.6's `/api/admin/images` accepts an optional `prefix` body field. Admin design editor passes `"designs"` so design uploads land at `<R2_PUBLIC_BASE_URL>/designs/<cuid>.jpg` separate from product hero shots. Helps when scanning the bucket later.

---

## 4. Client changes

### 4.1 Types (`client/src/lib/types.ts`)

```ts
export type ProductDesign = {
  id: string;
  name: string;
  imageUrl: string;
  position: number;
  compatibleVariantIds: string[];
};

export type AdminProductDesign = ProductDesign & {
  active: boolean;
};

export type ProductDesignPayload = {
  name: string;
  imageUrl: string;
  active: boolean;
  compatibleVariantIndices: number[];
};

export type Product = { /* ... */ designs: ProductDesign[]; };
export type AdminProduct = { /* ... */ designs: AdminProductDesign[]; };
export type ProductPayload = { /* ... */ designs: ProductDesignPayload[]; };
```

### 4.2 Form schema (`pages/admin/AdminProductForm/schema.ts`)

Add a `designs` array to `productFormSchema`:

```ts
const designFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  imageUrl: z.string().url("URL inválida"),
  active: z.boolean(),
  // Array of indices into the form's variants[] this design is compatible with.
  compatibleVariantIndices: z.array(z.number().int().min(0)),
});

export const productFormSchema = z.object({
  // ... existing
  designs: z.array(designFormSchema).max(50, "Máximo 50 diseños"),
});
```

### 4.3 Mappers (`pages/admin/AdminProductForm/mappers.ts`)

`productToFormValues` gains a `designs` mapping that translates `compatibleVariantIds` (strings) to `compatibleVariantIndices` (numbers) by looking up each ID in the loaded variants array. `formValuesToPayload` passes `compatibleVariantIndices` straight through.

### 4.4 New component: `ProductDesignEditor`

**NEW** `client/src/pages/admin/AdminProductForm/components/ProductDesignEditor.tsx` (+ `.module.scss`).

Pattern mirrors `ProductImageEditor` (file picker → upload → preview row) and `ProductVariantEditor` (per-row card with name, active checkbox, reorder arrows, remove). Per-row UI:

```
┌─────────────────────────────────────────────────┐
│ [thumb 96×96]   Diseño 1                        │
│                 Nombre: [Floral primavera     ] │
│                 Compatible con:                 │
│                   ☑ Tinta normal                │
│                   ☑ Con foil                    │
│                 ☑ Activo            [↑] [↓] [×] │
└─────────────────────────────────────────────────┘
```

Implementation details:
- `useFieldArray({ control, name: "designs" })`.
- "Agregar diseño" button → hidden file input → on file pick → `uploadImage(file, { prefix: "designs" })` → `append({ name: "", imageUrl: url, active: true, compatibleVariantIndices: <all current variant indices> })`.
- Compat checkboxes: render one per current variant in the form (read from `useWatch({ control, name: "variants" })`). When the variant list changes (add/remove/reorder), re-render the compat checkboxes. **Note:** when a variant is removed, its index disappears from the list — sweep the design's `compatibleVariantIndices` to filter out indices ≥ new variant count. Do this in a `useEffect` on `variants.length` change.
- Counter "X / 50" with disable-at-cap on the picker button.
- Defaults: new designs are compatible with **all** current variants (one click to uncheck the exceptions, per the wife's expected workflow).

Mount in `AdminProductFormPage.tsx` after `<ProductVariantEditor>`:

```tsx
<ProductDesignEditor fieldErrors={errors.designs} rootError={designsRootError} />
```

### 4.5 No catalog / detail-page changes here

The catalog (Slice 8) already exists in plan; it's untouched by this phase. The product detail page (Slice 9) is the consumer of `designs` — its build is documented in the revised [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md) §10 and ships in its own slice.

---

## 5. Decisions to lock before opening the PR

| Decision | Recommendation | Why |
|---|---|---|
| Per-product vs. global library | **Per-product `designs[]` on Product** | Matches the wife's mental model. De-dup is a non-problem at <20 SKUs. |
| Variant compatibility | **Many-to-many via `DesignVariantCompat` join** | Some designs are foil-only or tinta-only. Default in admin: all-checked, one click to uncheck the exceptions. |
| Compat representation in payload | **`compatibleVariantIndices: number[]`** keyed by position in the same payload's `variants[]` | Variant IDs are unstable across PATCH (delete-recreate). Indices are stable within the request. |
| Design pricing | **No price modifier** | Final price = `variant.price`. Designs are aesthetic, not tier-bearing. Add `priceModifier` only if the wife introduces tiered designs. |
| Storage layer | **Inherits Phase 2.6's R2 + Sharp pipeline** | Designs use `prefix: "designs"` so the R2 bucket is browsable by purpose. |
| Admin UI placement | **Inline in `AdminProductFormPage`** between Variants and the active-flag row | Matches the images / variants pattern. Form gets long for sobres but it's the operator's screen, not a customer's. |
| OrderItem snapshot fields | **Add now (`designId`, `designName`, `designImageUrl` — all nullable)** | Phase 3 cart is one phase away. Adding three nullable columns now is cheaper than a follow-up migration on a table with order data. |
| Inactive designs in public payload | **Filter out server-side** | Public never sees `active: false`. Same pattern as `Product.active`. |
| Max designs per product | **50** | Order of magnitude above the wife's 20+ stated. Keeps the form schema honest without anyone bumping into it. |

---

## 6. Out of scope (intentional)

- Customer-facing product detail page UX — Slice 9 of Phase 2.5 (revised).
- "Default design" auto-pick — Slice 9 problem (likely first-design-in-list, but it's a UX call for that slice).
- Search across designs — catalog is small; YAGNI.
- Per-design pricing — see Decision in §5.
- Re-using designs across products — global design library was rejected in §5; revisit if/when sticker designs get reused across SKUs.
- Order-side `designSelections` for designs that themselves have configurable parts — designs are visual-only in v1. The future invitation builder (PRD §6 v2 deferred) is where this would live.
- Bulk design upload (drag-drop a folder of 20 PNGs) — wife uploads one at a time. If this bites, add it as a small follow-up.

---

## 7. Verification

### 7.1 Schema + migration

- [ ] `pnpm migrate` (in api container) generates `add_product_designs` migration cleanly. Inspect SQL: two new tables, three new nullable columns on `OrderItem`, no breaking changes.
- [ ] `pnpm seed` succeeds. Existing products end up with `designs: []` (seed doesn't populate designs yet — optional follow-up to add 2–3 sample designs to the *sobres* seed entry).

### 7.2 Type / build gates

- [ ] `pnpm preflight` green.

### 7.3 Browser smoke

- [ ] **Create flow:** at `/admin/productos/nuevo`, build a sobres product with 2 variants ("Tinta normal", "Con foil") and 3 designs. For design 1: compatible with both variants. Design 2: only "Con foil". Design 3: only "Tinta normal". Submit → list shows the product.
- [ ] **Edit round-trip:** open the product. Confirm the three designs load with their compatibility checkboxes in the right state. Toggle one. Save. Reload. Persisted.
- [ ] **Variant-removal compat sweep:** add a 3rd variant, mark a design compatible with it, remove that 3rd variant from the form, save. Confirm the design's compat list no longer references the removed variant (no crash, no stale index).
- [ ] **Public payload:** `GET /api/products/<slug>` returns `designs[]` with `compatibleVariantIds` matching the variant IDs in the same response. Inactive designs absent.
- [ ] **Image pipeline:** design uploads land in R2 under `designs/<cuid>.jpg`. CDN URL works in a fresh tab.

### 7.4 Regression

- [ ] Slice 6 two-click delete still works on a product with designs (cascade deletes everything).
- [ ] Slice 7 variant editor unchanged. Variants reorder, options edit, SKU dup-warn, etc. all behave.
- [ ] Phase 2.6 image upload of *product hero shots* still works (this phase only added a `prefix` parameter; the existing flow is untouched).

---

## 8. Phase exit criteria

Phase 2.7 is done when:

1. `add_product_designs` migration applied to staging + prod.
2. Admin can create / edit / delete products with designs end-to-end on prod.
3. `GET /api/products/<slug>` exposes `designs[]` with `compatibleVariantIds` on prod.
4. `pnpm preflight:full` green.
5. `docs/tech-roadmap.md` §10 Phase 2.7 boxes ticked. `docs/phase-2.5-execution-plan.md` §10 Slice 9 reflects the design-picker flow. `CLAUDE.md` "Currently" paragraph mentions designs as a Product field.

Once all five are green, **Slice 9 (revised) is unblocked**, and Phase 2.5 resumes its remaining slices.

---

## 9. Knock-on effects on existing slices

- **Slice 8 (Public catalog):** unchanged. Catalog still lists products with category + hero image + price-from. It does **not** show design grids.
- **Slice 9 (Public product detail):** the original plan had `pick variant → fill personalization → CTA`. The revised plan has `pick design (visual grid) → pick variant (only compatible ones enabled) → fill options → CTA`. Detail in [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md) §10.
- **Phase 3 (Cart):** the cart line item must carry the chosen `designId`. Server-side `OrderItem` already has the snapshot columns from this phase; client `CartItem` type extends to include `designId` + `designName` + `designImageUrl`. Document in Phase 3's plan when it's drafted.

---

*This plan was added 2026-05-04 in response to Slice 7 review surfacing a design-style customer flow that didn't fit the existing variant/option model. Blocks on Phase 2.6. When every box in §§3–8 is ticked, Phase 2.7 is complete and Slice 9 (revised) starts.*
