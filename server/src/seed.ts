import { PrismaClient, VariantKind } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import bcrypt from "bcrypt";
import "dotenv/config";
import { buildSkuCandidate } from "./lib/sku-generator.js";

const prisma = new PrismaClient();

type VariantPriceSeed = {
  kind: VariantKind;
  price: string;
  offered?: boolean;
};

type ProductSeed = {
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  imageUrl: string;
  variantPrices: VariantPriceSeed[];
  designSlugs: string[];
};

type DesignSeed = {
  slug: string;
  name: string;
  imageUrl: string;
  compatibleKinds: VariantKind[];
  categorySlugs: string[];
};

type CategorySeed = {
  slug: string;
  name: string;
  position: number;
};

const categories: CategorySeed[] = [
  { slug: "sobres", name: "Sobres", position: 0 },
  { slug: "tarjetas", name: "Tarjetas", position: 1 },
  { slug: "etiquetas-vino", name: "Etiquetas de vino", position: 2 },
  { slug: "stickers", name: "Stickers", position: 3 },
];

const products: ProductSeed[] = [
  {
    slug: "sobres-clasicos",
    name: "Paquete de 10 sobres clásicos",
    description:
      "Sobres personalizados para invitaciones formales. Cuatro acabados disponibles según tu evento.",
    categorySlug: "sobres",
    imageUrl: "https://picsum.photos/seed/sobres/800/600",
    variantPrices: [
      { kind: VariantKind.CON_FOIL, price: "250.00" },
      { kind: VariantKind.CON_TINTA_NORMAL, price: "200.00" },
      { kind: VariantKind.CON_FOIL_Y_TINTA, price: "290.00" },
      { kind: VariantKind.PAPEL_TEXTURIZADO, price: "230.00" },
    ],
    designSlugs: ["floral", "minimalista"],
  },
  {
    slug: "tarjetas-4x4",
    name: "Tarjetas 4x4 cm (paquete de 50)",
    description:
      "Tarjetas pequeñas para regalos, agradecimientos o detalles. Acabado editorial.",
    categorySlug: "tarjetas",
    imageUrl: "https://picsum.photos/seed/tarjetas/800/600",
    variantPrices: [
      { kind: VariantKind.CON_FOIL, price: "150.00" },
      { kind: VariantKind.CON_TINTA_NORMAL, price: "100.00" },
      { kind: VariantKind.CON_FOIL_Y_TINTA, price: "180.00" },
      { kind: VariantKind.PAPEL_TEXTURIZADO, price: "130.00" },
    ],
    designSlugs: ["floral", "minimalista", "botanico"],
  },
  {
    slug: "etiquetas-vino",
    name: "Etiquetas para vino (paquete de 6)",
    description:
      "Etiquetas personalizadas para botellas de vino, ideales para regalos y eventos.",
    categorySlug: "etiquetas-vino",
    imageUrl: "https://picsum.photos/seed/vino/800/600",
    variantPrices: [
      { kind: VariantKind.CON_FOIL, price: "320.00" },
      { kind: VariantKind.CON_TINTA_NORMAL, price: "220.00" },
      { kind: VariantKind.CON_FOIL_Y_TINTA, price: "360.00" },
      { kind: VariantKind.PAPEL_TEXTURIZADO, price: "260.00" },
    ],
    designSlugs: ["minimalista", "botanico"],
  },
  {
    slug: "stickers-redondos",
    name: "Stickers redondos (paquete de 24)",
    description:
      "Stickers circulares para branding, empaques o detalles. Corte profesional.",
    categorySlug: "stickers",
    imageUrl: "https://picsum.photos/seed/stickers/800/600",
    variantPrices: [
      { kind: VariantKind.CON_FOIL, price: "140.00" },
      { kind: VariantKind.CON_TINTA_NORMAL, price: "90.00" },
      { kind: VariantKind.CON_FOIL_Y_TINTA, price: "160.00" },
      // Real-world example of the offered toggle: stickers don't support the
      // textured paper finish, so this variant is hidden from the storefront.
      { kind: VariantKind.PAPEL_TEXTURIZADO, price: "0.00", offered: false },
    ],
    designSlugs: ["floral"],
  },
];

const designs: DesignSeed[] = [
  {
    slug: "floral",
    name: "Floral",
    imageUrl: "https://picsum.photos/seed/disenoFloral/600/600",
    compatibleKinds: [
      VariantKind.CON_FOIL,
      VariantKind.CON_TINTA_NORMAL,
      VariantKind.CON_FOIL_Y_TINTA,
    ],
    categorySlugs: ["sobres", "tarjetas", "stickers"],
  },
  {
    slug: "minimalista",
    name: "Minimalista",
    imageUrl: "https://picsum.photos/seed/disenoMinimal/600/600",
    compatibleKinds: [
      VariantKind.CON_TINTA_NORMAL,
      VariantKind.PAPEL_TEXTURIZADO,
    ],
    categorySlugs: ["sobres", "tarjetas", "etiquetas-vino"],
  },
  {
    slug: "botanico",
    name: "Botánico",
    imageUrl: "https://picsum.photos/seed/disenoBotanico/600/600",
    compatibleKinds: [
      VariantKind.CON_FOIL,
      VariantKind.CON_FOIL_Y_TINTA,
      VariantKind.PAPEL_TEXTURIZADO,
    ],
    categorySlugs: ["tarjetas", "etiquetas-vino"],
  },
];

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash },
    create: { email: adminEmail, passwordHash },
  });
  console.log(`Seeded admin: ${adminEmail}`);

  // Categories must exist before products and designs reference them.
  const categoryIdBySlug = new Map<string, string>();
  for (const c of categories) {
    const upserted = await prisma.category.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, position: c.position, active: true },
    });
    categoryIdBySlug.set(c.slug, upserted.id);
    console.log(`Seeded category: ${c.slug}`);
  }

  await prisma.optionPalette.upsert({
    where: { slug: "colores-foil" },
    update: {},
    create: {
      name: "Colores de foil",
      slug: "colores-foil",
      position: 0,
      active: true,
      swatches: {
        create: [
          { name: "Dorado", imageUrl: "https://picsum.photos/seed/foil-dorado/200", position: 0 },
          { name: "Plata", imageUrl: "https://picsum.photos/seed/foil-plata/200", position: 1 },
          { name: "Rosa", imageUrl: "https://picsum.photos/seed/foil-rosa/200", position: 2 },
          { name: "Negro", imageUrl: "https://picsum.photos/seed/foil-negro/200", position: 3 },
          { name: "Cobre", imageUrl: "https://picsum.photos/seed/foil-cobre/200", position: 4 },
        ],
      },
    },
  });
  console.log("Seeded palette: colores-foil");

  // Designs are global. Name is unique enough for the seed's idempotency key.
  const designIdBySlug = new Map<string, string>();
  for (const [index, d] of designs.entries()) {
    const existing = await prisma.design.findFirst({ where: { name: d.name } });
    if (existing) {
      designIdBySlug.set(d.slug, existing.id);
      continue;
    }
    const created = await prisma.design.create({
      data: {
        name: d.name,
        imageUrl: d.imageUrl,
        position: index,
        active: true,
        compat: { create: d.compatibleKinds.map((kind) => ({ kind })) },
        categories: {
          create: d.categorySlugs
            .map((slug) => categoryIdBySlug.get(slug))
            .filter((id): id is string => Boolean(id))
            .map((categoryId) => ({ categoryId })),
        },
      },
    });
    designIdBySlug.set(d.slug, created.id);
    console.log(`Seeded design: ${d.slug}`);
  }

  for (const p of products) {
    const categoryId = categoryIdBySlug.get(p.categorySlug);
    if (!categoryId) {
      throw new Error(`Seed: missing category ${p.categorySlug} for product ${p.slug}`);
    }
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        categoryId,
        variants: {
          create: p.variantPrices.map((vp) => ({
            kind: vp.kind,
            // Deterministic suffix keeps the seed reproducible across re-runs
            // and across local/staging/prod. Real products use random suffixes
            // via ensureUniqueSku.
            sku: buildSkuCandidate(p.slug, vp.kind, "seed"),
            price: new Decimal(vp.price),
            offered: vp.offered ?? true,
          })),
        },
        images: {
          create: [{ url: p.imageUrl, alt: p.name, position: 0 }],
        },
        designs: {
          create: p.designSlugs
            .map((slug) => designIdBySlug.get(slug))
            .filter((id): id is string => Boolean(id))
            .map((designId) => ({ designId })),
        },
      },
    });
    console.log(`Seeded product: ${product.slug}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
