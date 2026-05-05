# Phase 2.7 Execution Plan — Product designs (visual selection)

> **Purpose:** add a "design style" axis to the catalog so customers can browse 20+ visual designs per product (currently scoped to *sobres*) before picking a variant. Surfaced during Slice 7 review when the wife clarified that the real customer flow is **design → variant → options**, not **variant → options** as originally modeled.
>
> This phase also adds **global image palettes** (e.g. foil colors) so SELECT-type options can render visual swatches instead of flat text values. The full customer flow surfaced in Slice 7 review is **design → variant → swatch-picker → personalization**; this phase ships the data + admin layer for the swatch-picker step. Phase 2.7 therefore lands two related axes — `ProductDesign` *and* `OptionPalette` / `OptionSwatch`.
>
> **Mindset:** schema + admin UI now, customer-facing UX in Slice 9. This phase ships no public-facing UX — that is intentional. Slice 9 (revised) integrates the design picker into the product detail page once this phase lands.
>
> **Blocked on:** [`phase-2.6-execution-plan.md`](phase-2.6-execution-plan.md). Designs add 20+ image-bearing rows per product; doing them on the base64 pipeline would balloon the public payload and require a second migration.

---

## 0. How to use this doc

- One PR, single branch (`phase/2.7-designs-and-palettes`).
- Designs and palettes both land **after Phase 2.6**. Image storage is solved; this phase consumes it for both axes.
- `pnpm preflight` green at the end.

---

## 1. Where we are

- **What Phase 2.5 + 2.6 leave us with:** a working admin form that edits product metadata + hero images + variants + per-variant options. Image uploads go to R2 via the upload endpoint built in Phase 2.6.
- **What this phase fills in (two related axes):**
  - **Designs:** a third array on `Product` — `designs[]` — sibling of `images[]` and `variants[]`. Each design carries a name + image URL + position + active flag, and a many-to-many relation to `ProductVariant` capturing which variants a design is compatible with.
  - **Global palettes:** a generic `OptionPalette` + `OptionSwatch` pair. SELECT-type variant options gain a third type (`SWATCH`) that references a palette instead of a flat string list. v1 seeds one palette (*Colores de foil*, 10 swatches). The wife edits palettes globally; changes propagate to every product that references them.
- **What stays the same:** existing `Product`, `ProductImage`, `ProductVariant` columns. `ProductVariantOption` gains a nullable `paletteId` FK and a new enum value `SWATCH` — existing flat-string `SELECT` options are untouched and keep working. `OrderItem` gains three nullable snapshot columns (`designId`, `designName`, `designImageUrl`) for forward-compat with Phase 3 cart, and `OrderItem.selections` JSON shape evolves to allow object values for SWATCH options (see §3.1 + §5).
- **What does not ship in this phase:**
  - The customer-facing design picker UX. That is **Slice 9** of Phase 2.5, revised. Slice 9's plan is updated in [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md) §10 but not implemented here.
  - The customer-facing **swatch grid** UX. Same story — Slice 9 builds the visual picker; this phase only ships the schema, palette CRUD, and admin wiring.
  - A "default design" or "no-design" fallback on the product detail page. Slice 9 handles that branch.
  - **Per-variant swatch subsetting.** A `SWATCH` option always exposes the full active palette. If the wife later wants e.g. "Sobres con foil" to only offer 5 of 10 colors, that's a follow-up — not v1.
  - **Per-swatch pricing modifiers.** Foil price lives on the variant, not the swatch. All foil colors cost the same.

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
  │ Pick Color del foil  (SWATCH)  │   ← SWATCH option → renders the
  │   [img]  [img]  [img]  [img]   │     full active palette as a grid.
  │   Dorado Plata  Rosa  Negro    │     Skipped if the chosen variant
  │   ... 10 colors                │     has no SWATCH option.
  └────────────────────────────────┘
            │
            ▼
  ┌────────────────────────────────┐
  │ Fill Opciones                  │   ← remaining SELECT (flat) + TEXT
  │   • Texto personalizado (TEXT) │
  └────────────────────────────────┘
            │
            ▼
        Agregar al carrito
```

Compatibility is **per-design** (some designs only render in foil, some only in tinta normal, most in both). The default in the admin UI is "compatible with every variant"; the wife unchecks the exceptions.

A variant can have zero, one, or multiple `SWATCH`-type options — Slice 9 renders one swatch grid per option, in `position` order. Variants with no `SWATCH` option skip that step and go straight to remaining SELECT/TEXT inputs. Palettes are global: every product that exposes "Color del foil" sees the same 10 swatches the wife maintains under `/admin/paletas`.

For products without designs (stickers, etiquetas, gift cards), the design step is skipped — the product detail page goes straight to variant selection. Slice 9 handles the "no designs" branch.

---

## 3. Server changes

### 3.1 Schema (`server/prisma/schema.prisma`)

Add four models (`ProductDesign`, `DesignVariantCompat`, `OptionPalette`, `OptionSwatch`). Extend `Product`, `ProductVariant`, `ProductVariantOption`, and `OrderItem`. Add a new value to `VariantOptionType`.

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
  // OrderItem.selections (Json) shape evolves: string values for SELECT/TEXT options
  // unchanged; SWATCH options now snapshot as
  //   { value: "Dorado", swatchId: "...", imageUrl: "https://..." }
  // Readers must branch on typeof === "string" vs object. See §5.
}

model OptionPalette {
  id       String                 @id @default(cuid())
  name     String                 @unique          // "Colores de foil"
  slug     String                 @unique          // "colores-foil"
  position Int                    @default(0)
  active   Boolean                @default(true)
  swatches OptionSwatch[]
  options  ProductVariantOption[]

  @@index([active])
}

model OptionSwatch {
  id        String        @id @default(cuid())
  paletteId String
  palette   OptionPalette @relation(fields: [paletteId], references: [id], onDelete: Cascade)
  name      String                                          // "Dorado"
  imageUrl  String                                          // R2 CDN URL (Phase 2.6, prefix "swatches")
  position  Int           @default(0)
  active    Boolean       @default(true)

  @@unique([paletteId, name])
  @@index([paletteId])
  @@index([active])
}

enum VariantOptionType {
  SELECT
  SWATCH      // NEW — references an OptionPalette instead of carrying its own values
  TEXT
}

model ProductVariantOption {
  // ... existing fields (name, type, values, required, position, variantId)
  paletteId String?
  palette   OptionPalette? @relation(fields: [paletteId], references: [id], onDelete: Restrict)
}
```

Migration name: `add_designs_and_palettes`. No data backfill needed — all existing rows default `null` / `[]` / `0` cleanly. Existing `SELECT` (flat-string) options keep `paletteId = null`; the new enum value `SWATCH` is purely additive.

Constraints worth calling out:

- `onDelete: Restrict` on `ProductVariantOption.palette` — the wife cannot delete a palette that's still referenced by a live product option. Admin UI surfaces this as a 409 with `code: "PALETTE_IN_USE"`. Soft-delete (toggle `active: false`) is the supported "remove from catalog without breaking history" path.
- `@@unique([paletteId, name])` on `OptionSwatch` — no two swatches in the same palette can share a name.
- Validation-layer invariant (not enforced by Postgres): `type === "SELECT"` requires non-empty `values`; `type === "SWATCH"` requires a `paletteId`; `type === "TEXT"` requires neither. Enforced in the zod schema (§3.2).

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

// variantOptionSchema gains a paletteId field and a branching superRefine that
// validates SELECT/SWATCH/TEXT shapes consistently with the schema enum.
export const variantOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    type: z.nativeEnum(VariantOptionType),
    values: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    paletteId: z.string().cuid().optional(),
    required: z.boolean().default(true),
  })
  .superRefine((opt, ctx) => {
    if (opt.type === "SELECT" && !opt.values?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["values"],
        message: "Las opciones SELECT requieren al menos un valor",
      });
    }
    if (opt.type === "SWATCH" && !opt.paletteId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paletteId"],
        message: "Las opciones de imagen requieren una paleta",
      });
    }
  });

// New schemas for the palette CRUD endpoints (§3.5b).
export const swatchSchema = z.object({
  name: z.string().trim().min(1).max(80),
  imageUrl: z.string().url("URL inválida"),
  active: z.boolean().default(true),
});

export const palettePayloadSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "slug inválido"),
  active: z.boolean().default(true),
  swatches: z.array(swatchSchema).max(50, "Máximo 50 muestras"),
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

`buildVariantsCreate` (from Slice 7) is split into `buildVariantWriteInput(variant, index)` returning a single-variant Prisma input — the wrapper that nested `options.create` stays. The nested option mapping branches on `type`:

```ts
options: {
  create: variant.options.map((option, optionIndex) => ({
    name: option.name,
    type: option.type,
    values: option.type === "SELECT" ? (option.values ?? []) : undefined,
    paletteId: option.type === "SWATCH" ? option.paletteId : undefined,
    required: option.required,
    position: optionIndex,
  })),
},
```

Palettes are referenced by stable, pre-existing IDs (the wife creates them under `/admin/paletas` before assigning them to a product), so the option write needs no payload-index resolution dance — unlike the design ↔ variant link.

### 3.4 Serializers (`server/src/lib/serializers.ts`)

- `serializeProductPublic` and `serializeProductAdmin` both gain `designs`.
- Public design shape: `{ id, name, imageUrl, position, compatibleVariantIds: string[] }`. Position is exposed because the catalog renders in saved order.
- Admin design shape: same plus `active: boolean`.
- `productInclude` extends to `designs: { include: { variants: true } }` so `compatibleVariantIds` can be derived without a second query.
- `productInclude` also extends the nested option include to ship palettes inline, so the public product fetch is a single round-trip:

```ts
options: {
  include: {
    palette: { include: { swatches: { where: { active: true } } } },
  },
},
```

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

Variant options serialize differently per `type` — public payload branches:

```ts
const serializeOptionPublic = (opt: OptionRecord) => {
  const base = { id: opt.id, name: opt.name, type: opt.type, required: opt.required };
  if (opt.type === "SELECT") {
    return { ...base, values: (opt.values as string[] | null) ?? [] };
  }
  if (opt.type === "SWATCH" && opt.palette) {
    return {
      ...base,
      palette: {
        id: opt.palette.id,
        name: opt.palette.name,
        slug: opt.palette.slug,
        swatches: sortByPosition(opt.palette.swatches).map((s) => ({
          id: s.id,
          name: s.name,
          imageUrl: s.imageUrl,
          position: s.position,
        })),
      },
    };
  }
  return base; // TEXT
};
```

Public payload only includes **active** swatches (the include's `where: { active: true }` filter does the heavy lifting). Admin variant of the option serializer adds `position` plus the raw `paletteId` FK (no nested palette) so the editor's palette dropdown can preselect without a second fetch.

### 3.5 Routes (`server/src/routes/admin-products.ts`)

No new routes — existing POST/PATCH/DELETE/GET on `/admin/products` extend to handle `designs` and the new option `paletteId` field automatically through the serializer + write builder. Confirm 409 on `P2002` still surfaces (no new unique constraints added on the product side — `DesignVariantCompat` is `@@id([designId, variantId])` which can't conflict because both sides are fresh per write).

### 3.5b Palette routes (`server/src/routes/admin-palettes.ts`) — new

```
GET    /api/admin/palettes              → list palettes + active swatches (admin shape)
POST   /api/admin/palettes              → create palette (name, slug, swatches[])
GET    /api/admin/palettes/:id          → single palette (admin shape, includes inactive swatches)
PATCH  /api/admin/palettes/:id          → update palette + full-replace swatches in a transaction
DELETE /api/admin/palettes/:id          → 409 (code: "PALETTE_IN_USE") if any
                                          ProductVariantOption.paletteId === id;
                                          otherwise hard-delete (cascades swatches)
```

Pattern mirrors `admin-products.ts`:

- All routes mounted under `authenticateAdmin` + `requireAdmin`.
- Validation via `palettePayloadSchema` from §3.2.
- Write builder lives in `server/src/lib/palette-write.ts` (`buildPaletteWriteInput` + `buildSwatchesCreate`). PATCH deletes existing swatches via `tx.optionSwatch.deleteMany({ where: { paletteId } })` then re-creates from payload — same full-replace pattern as variants/options.
- Serializer in `server/src/lib/serializers.ts`: `serializePaletteAdmin` returns `{ id, name, slug, position, active, swatches: [...] }` with all swatches (active flag exposed). `serializePalettePublic` is unused in this phase — palettes only ship inline via product fetches.
- DELETE checks `prisma.productVariantOption.count({ where: { paletteId: id } })` first and returns 409 with `code: "PALETTE_IN_USE"` if non-zero. Soft-delete (toggle `active: false`) is the supported "remove from view but preserve order history" path and goes through PATCH.
- Unique-name conflicts (palette name or slug) surface as `P2002` → existing global error handler maps to 409.

### 3.6 Public route (`server/src/routes/products.ts`)

`GET /api/products` and `GET /api/products/:slug` automatically pick up the new `designs` field and the per-option `palette` payload through `serializeProductPublic`. Verify the slug-fetch returns:

- Full design list with `compatibleVariantIds` populated.
- Each variant option with the right shape: `SELECT` → `values[]`; `SWATCH` → `palette: { id, name, slug, swatches: [...] }` (active-only); `TEXT` → no extra fields.

No standalone public palette endpoint — palettes ship inline so the customer's product page only makes one fetch.

### 3.7 Image upload prefix

Phase 2.6's `/api/admin/images` accepts an optional `prefix` body field. Three prefixes total in v1:

- `products/` — hero shots (Phase 2.6 default).
- `designs/` — product designs added by this phase. Admin design editor passes `prefix: "designs"` so design uploads land at `<R2_PUBLIC_BASE_URL>/designs/<cuid>.jpg`.
- `swatches/` — palette swatches added by this phase. Admin swatch editor passes `prefix: "swatches"` so swatches land at `<R2_PUBLIC_BASE_URL>/swatches/<cuid>.jpg`.

Three prefixes total keeps the bucket browsable by purpose when the wife (or future ops) needs to scan it.

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

// Global palette + swatch types — used both inline on product fetches and
// standalone on the /admin/paletas pages.
export type OptionSwatch = {
  id: string;
  name: string;
  imageUrl: string;
  position: number;
};

export type OptionPalette = {
  id: string;
  name: string;
  slug: string;
  swatches: OptionSwatch[];
};

export type AdminOptionSwatch = OptionSwatch & { active: boolean };
export type AdminOptionPalette = Omit<OptionPalette, "swatches"> & {
  active: boolean;
  swatches: AdminOptionSwatch[];
};

// Variant option becomes a discriminated union — Slice 9 branches on `type`.
export type ProductVariantOption =
  | { id: string; name: string; required: boolean; type: "TEXT" }
  | { id: string; name: string; required: boolean; type: "SELECT"; values: string[] }
  | { id: string; name: string; required: boolean; type: "SWATCH"; palette: OptionPalette };

export type AdminProductVariantOption =
  | { id: string; name: string; required: boolean; position: number; type: "TEXT" }
  | { id: string; name: string; required: boolean; position: number; type: "SELECT"; values: string[] }
  | { id: string; name: string; required: boolean; position: number; type: "SWATCH"; paletteId: string };

export type ProductVariantOptionPayload =
  | { name: string; required: boolean; type: "TEXT" }
  | { name: string; required: boolean; type: "SELECT"; values: string[] }
  | { name: string; required: boolean; type: "SWATCH"; paletteId: string };

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

### 4.4b `ProductVariantEditor` updates (existing component)

The variant option editor (`OptionRow.tsx` inside `client/src/pages/admin/AdminProductForm/components/ProductVariantEditor.tsx`) already renders `SELECT` and `TEXT` rows. Add `SWATCH`:

- Type `<select>` gains a third option **"Paleta de imágenes"** mapped to `SWATCH`.
- When `type === "SWATCH"`, hide the comma-separated values input and render a palette `<select>` instead, populated from a single `services/api/admin.ts → listPalettes()` call cached at form-mount time. Show only `active` palettes; preselect by stored `paletteId`.
- Form schema (`client/src/pages/admin/AdminProductForm/schema.ts`) extends `optionSchema` with `paletteId: z.string().cuid().optional()` and a superRefine that mirrors the server's branching (SELECT requires non-empty values, SWATCH requires paletteId, TEXT requires neither).
- Mappers (`client/src/pages/admin/AdminProductForm/mappers.ts`): `productToFormValues` carries `paletteId` straight through for SWATCH options; `formValuesToPayload` likewise. No index resolution needed — palette IDs are stable.

### 4.5 New admin palette pages

`client/src/pages/admin/AdminPalettesPage/` (new). Mirrors the product CRUD pattern from Slices 4–6:

- **List page** at `/admin/paletas` — table of palettes with name, slug, swatch count, active toggle, edit link, two-click delete (delete returns 409 if in use, surface message). Uses the existing `PageState` helpers.
- **Form page** at `/admin/paletas/nuevo` and `/admin/paletas/:id/editar` — `react-hook-form` + zod (matches `palettePayloadSchema`). Fields: name, slug (auto-derived from name on first input, editable thereafter), active toggle, plus a swatch editor.
- **Swatch editor** (sibling of `ProductDesignEditor`): `useFieldArray({ control, name: "swatches" })`, "Agregar muestra" file picker → `uploadImage(file, { prefix: "swatches" })` → `append({ name: "", imageUrl: url, active: true })`. Per-row card: thumbnail + name input + active toggle + reorder arrows + remove. Counter "X / 50".
- **Nav:** add a "Paletas" link to `NavBarAdmin` alongside "Productos".
- **Service layer:** `services/api/admin.ts` gains `listPalettes`, `getPalette`, `createPalette`, `updatePalette`, `deletePalette` — one-liners over `fetchJson`.

The reorder/remove/active patterns are intentionally identical to `ProductDesignEditor` so there's one mental model for "library-of-images" admin screens.

### 4.6 No catalog / detail-page changes here

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
| Per-product vs. global palettes | **Global named palettes (`OptionPalette` + `OptionSwatch`)** | Wife's mental model: foil colors are the same everywhere. Editing one product to add an 11th color and forgetting the others would be a daily-operations bug. De-dup is real at 20+ products. |
| Palette/option binding | **`type: SWATCH` with `paletteId` FK; always full active palette** | Per-variant subset adds admin friction the wife didn't ask for. If a single product ever needs to hide a color, follow up — don't pre-pay for it. |
| Palette deletion | **Restrict if referenced; soft-delete via `active: false` otherwise** | `OrderItem.selections` references swatches by ID. Hard cascade would orphan order data. The 409 nudges the wife toward soft-delete, which preserves history. |
| Order snapshot shape | **Extend `OrderItem.selections` JSON to allow object values for SWATCH options** | One canonical record of what the customer chose. Survives swatch rename, deactivation, and image rotation. Cost is a 4-line `typeof === "string"` guard at render time. Cheaper than a parallel snapshot column. |

---

## 6. Out of scope (intentional)

- Customer-facing product detail page UX — Slice 9 of Phase 2.5 (revised).
- "Default design" auto-pick — Slice 9 problem (likely first-design-in-list, but it's a UX call for that slice).
- Search across designs — catalog is small; YAGNI.
- Per-design pricing — see Decision in §5.
- Re-using designs across products — global design library was rejected in §5; revisit if/when sticker designs get reused across SKUs.
- Order-side `designSelections` for designs that themselves have configurable parts — designs are visual-only in v1. The future invitation builder (PRD §6 v2 deferred) is where this would live.
- Bulk design upload (drag-drop a folder of 20 PNGs) — wife uploads one at a time. If this bites, add it as a small follow-up.
- Per-variant swatch subsets — a `SWATCH` option always exposes the full active palette in v1.
- Per-swatch pricing modifiers — foil price is on the variant (`con foil $250`), not on the individual color. All swatches in a palette cost the same.
- Bulk swatch upload — single-file flow only. If the wife ever uploads 20 swatches at once, follow up.
- Customer-facing swatch grid UX — Slice 9 builds the visual picker; this phase only ships data + admin.

---

## 7. Verification

### 7.1 Schema + migration

- [ ] `pnpm migrate` (in api container) generates `add_designs_and_palettes` migration cleanly. Inspect SQL: four new tables (`ProductDesign`, `DesignVariantCompat`, `OptionPalette`, `OptionSwatch`); three new nullable columns on `OrderItem`; new `paletteId` column on `ProductVariantOption`; new `SWATCH` enum value on `VariantOptionType`. No breaking changes.
- [ ] `pnpm seed` succeeds. Existing products end up with `designs: []` (seed doesn't populate designs yet — optional follow-up to add 2–3 sample designs to the *sobres* seed entry). Seed creates one palette `Colores de foil` with a handful of starter swatches so dev work doesn't need manual setup.

### 7.2 Type / build gates

- [ ] `pnpm preflight` green.

### 7.3 Browser smoke

- [ ] **Create flow:** at `/admin/productos/nuevo`, build a sobres product with 2 variants ("Tinta normal", "Con foil") and 3 designs. For design 1: compatible with both variants. Design 2: only "Con foil". Design 3: only "Tinta normal". Submit → list shows the product.
- [ ] **Edit round-trip:** open the product. Confirm the three designs load with their compatibility checkboxes in the right state. Toggle one. Save. Reload. Persisted.
- [ ] **Variant-removal compat sweep:** add a 3rd variant, mark a design compatible with it, remove that 3rd variant from the form, save. Confirm the design's compat list no longer references the removed variant (no crash, no stale index).
- [ ] **Public payload:** `GET /api/products/<slug>` returns `designs[]` with `compatibleVariantIds` matching the variant IDs in the same response. Inactive designs absent.
- [ ] **Image pipeline:** design uploads land in R2 under `designs/<cuid>.jpg`. CDN URL works in a fresh tab.
- [ ] **Palette CRUD:** at `/admin/paletas`, create palette "Colores de foil" with 3 swatches (`Dorado`, `Plata`, `Rosa`). Image uploads land at `swatches/<cuid>.jpg`. Reload, persisted.
- [ ] **Palette edit round-trip:** rename a swatch, toggle one inactive, reorder, save, reload. All persisted; inactive swatch hidden from public payload.
- [ ] **SWATCH option wiring:** on a *Sobres con foil* product, add an option `Color del foil` with `type: SWATCH` pointing at the palette. Save. Reload the product form — option round-trips with `paletteId` preselected.
- [ ] **Public payload for SWATCH:** `GET /api/products/<sobres-slug>` returns the variant option with `type: "SWATCH"` and `palette.swatches[]` populated (active only — inactive swatch absent). `palette.id` matches the palette created above.
- [ ] **Palette delete guard:** while the palette is referenced by an option, attempt DELETE → 409 with `code: "PALETTE_IN_USE"`. Detach the option (switch its type back to SELECT or remove it), retry → 204.

### 7.4 Regression

- [ ] Slice 6 two-click delete still works on a product with designs (cascade deletes everything).
- [ ] Slice 7 variant editor unchanged for **existing SELECT** options — flat-string values still parse, validate, and round-trip. Palette logic is purely additive.
- [ ] Variants reorder, options edit, SKU dup-warn, etc. all behave.
- [ ] Phase 2.6 image upload of *product hero shots* still works (this phase only added a new `prefix` value; the existing flow is untouched).

---

## 8. Phase exit criteria

Phase 2.7 is done when:

1. `add_designs_and_palettes` migration applied to staging + prod.
2. Admin can create / edit / delete products with designs end-to-end on prod.
3. Admin can create / edit / delete palettes + swatches end-to-end on prod via `/admin/paletas`.
4. `GET /api/products/<slug>` exposes `designs[]` with `compatibleVariantIds` and SWATCH options carry `palette.swatches[]` (active-only) on prod.
5. `pnpm preflight:full` green.
6. `docs/tech-roadmap.md` §10 Phase 2.7 boxes ticked (covering both designs and palettes). `docs/phase-2.5-execution-plan.md` §10 Slice 9 reflects the design → variant → SWATCH → SELECT/TEXT picker flow. `CLAUDE.md` "Currently" paragraph mentions designs and palettes.
7. Production palette `Colores de foil` exists with the wife's 10 base swatches uploaded to R2.

Once all seven are green, **Slice 9 (revised) is unblocked**, and Phase 2.5 resumes its remaining slices.

---

## 9. Knock-on effects on existing slices

- **Slice 8 (Public catalog):** unchanged. Catalog still lists products with category + hero image + price-from. It does **not** show design grids or swatch grids.
- **Slice 9 (Public product detail):** the original plan had `pick variant → fill personalization → CTA`. The revised plan has `pick design (visual grid) → pick variant (only compatible ones enabled) → pick SWATCH option(s) (one image grid per option) → fill remaining SELECT/TEXT → CTA`. Detail in [`phase-2.5-execution-plan.md`](phase-2.5-execution-plan.md) §10.
- **Phase 3 (Cart):** the cart line item must carry the chosen `designId` plus the chosen swatch per SWATCH option. Server-side `OrderItem` already has the design snapshot columns from this phase, and `OrderItem.selections` JSON now allows object values shaped `{ value, swatchId, imageUrl }` for SWATCH options. Client `CartItem` type extends to mirror this — receipts and admin order views render the swatch image inline so fulfillment knows which color was chosen. Document in Phase 3's plan when it's drafted.

---

*This plan was added 2026-05-04 in response to Slice 7 review surfacing a design-style customer flow that didn't fit the existing variant/option model, and extended 2026-05-05 after the wife clarified that SELECT options like "Color del foil" must render image swatches drawn from a global palette shared across products. Phase 2.7 now ships two related axes — `ProductDesign` and `OptionPalette` / `OptionSwatch`. Blocks on Phase 2.6. When every box in §§3–8 is ticked, Phase 2.7 is complete and Slice 9 (revised) starts.*
