import { PrismaClient, VariantKind } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import bcrypt from "bcrypt";
import "dotenv/config";

const prisma = new PrismaClient();

type VariantPriceSeed = {
  kind: VariantKind;
  sku: string;
  price: string;
};

type ProductSeed = {
  slug: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  variantPrices: VariantPriceSeed[];
  designSlugs: string[];
};

type DesignSeed = {
  slug: string;
  name: string;
  imageUrl: string;
  compatibleKinds: VariantKind[];
};

const products: ProductSeed[] = [
  {
    slug: "sobres-clasicos",
    name: "Paquete de 10 sobres clásicos",
    description:
      "Sobres personalizados para invitaciones formales. Cuatro acabados disponibles según tu evento.",
    category: "sobres",
    imageUrl: "https://picsum.photos/seed/sobres/800/600",
    variantPrices: [
      { kind: VariantKind.CON_FOIL, sku: "SOB-FOIL", price: "250.00" },
      { kind: VariantKind.CON_TINTA_NORMAL, sku: "SOB-TINTA", price: "200.00" },
      { kind: VariantKind.CON_FOIL_Y_TINTA, sku: "SOB-FOIL-TINTA", price: "290.00" },
      { kind: VariantKind.PAPEL_TEXTURIZADO, sku: "SOB-TEX", price: "230.00" },
    ],
    designSlugs: ["floral", "minimalista"],
  },
  {
    slug: "tarjetas-4x4",
    name: "Tarjetas 4x4 cm (paquete de 50)",
    description:
      "Tarjetas pequeñas para regalos, agradecimientos o detalles. Acabado editorial.",
    category: "tarjetas",
    imageUrl: "https://picsum.photos/seed/tarjetas/800/600",
    variantPrices: [
      { kind: VariantKind.CON_FOIL, sku: "TAR4-FOIL", price: "150.00" },
      { kind: VariantKind.CON_TINTA_NORMAL, sku: "TAR4-TINTA", price: "100.00" },
      { kind: VariantKind.CON_FOIL_Y_TINTA, sku: "TAR4-FOIL-TINTA", price: "180.00" },
      { kind: VariantKind.PAPEL_TEXTURIZADO, sku: "TAR4-TEX", price: "130.00" },
    ],
    designSlugs: ["floral", "minimalista", "botanico"],
  },
  {
    slug: "etiquetas-vino",
    name: "Etiquetas para vino (paquete de 6)",
    description:
      "Etiquetas personalizadas para botellas de vino, ideales para regalos y eventos.",
    category: "etiquetas-vino",
    imageUrl: "https://picsum.photos/seed/vino/800/600",
    variantPrices: [
      { kind: VariantKind.CON_FOIL, sku: "VIN-FOIL", price: "320.00" },
      { kind: VariantKind.CON_TINTA_NORMAL, sku: "VIN-TINTA", price: "220.00" },
      { kind: VariantKind.CON_FOIL_Y_TINTA, sku: "VIN-FOIL-TINTA", price: "360.00" },
      { kind: VariantKind.PAPEL_TEXTURIZADO, sku: "VIN-TEX", price: "260.00" },
    ],
    designSlugs: ["minimalista", "botanico"],
  },
  {
    slug: "stickers-redondos",
    name: "Stickers redondos (paquete de 24)",
    description:
      "Stickers circulares para branding, empaques o detalles. Corte profesional.",
    category: "stickers",
    imageUrl: "https://picsum.photos/seed/stickers/800/600",
    variantPrices: [
      { kind: VariantKind.CON_FOIL, sku: "STK-FOIL", price: "140.00" },
      { kind: VariantKind.CON_TINTA_NORMAL, sku: "STK-TINTA", price: "90.00" },
      { kind: VariantKind.CON_FOIL_Y_TINTA, sku: "STK-FOIL-TINTA", price: "160.00" },
      { kind: VariantKind.PAPEL_TEXTURIZADO, sku: "STK-TEX", price: "110.00" },
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
  },
  {
    slug: "minimalista",
    name: "Minimalista",
    imageUrl: "https://picsum.photos/seed/disenoMinimal/600/600",
    compatibleKinds: [
      VariantKind.CON_TINTA_NORMAL,
      VariantKind.PAPEL_TEXTURIZADO,
    ],
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

  // Idempotency: upserts use `update: {}` so re-runs don't propagate edits.
  // To apply seed edits locally, drop the DB and re-migrate.

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

  // Designs are global. We use name as the natural key for upsert lookup
  // since slug isn't a column — name is unique by convention in this seed.
  const designsBySlug = new Map<string, string>();
  for (const [index, d] of designs.entries()) {
    const existing = await prisma.design.findFirst({ where: { name: d.name } });
    if (existing) {
      designsBySlug.set(d.slug, existing.id);
      continue;
    }
    const created = await prisma.design.create({
      data: {
        name: d.name,
        imageUrl: d.imageUrl,
        position: index,
        active: true,
        compat: { create: d.compatibleKinds.map((kind) => ({ kind })) },
      },
    });
    designsBySlug.set(d.slug, created.id);
    console.log(`Seeded design: ${d.slug}`);
  }

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        category: p.category,
        variants: {
          create: p.variantPrices.map((vp) => ({
            kind: vp.kind,
            sku: vp.sku,
            price: new Decimal(vp.price),
          })),
        },
        images: {
          create: [{ url: p.imageUrl, alt: p.name, position: 0 }],
        },
        designs: {
          create: p.designSlugs
            .map((slug) => designsBySlug.get(slug))
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
