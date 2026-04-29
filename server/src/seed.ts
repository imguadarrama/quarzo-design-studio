import { PrismaClient, VariantOptionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import bcrypt from "bcrypt";
import "dotenv/config";

const prisma = new PrismaClient();

type OptionSeed = {
  name: string;
  type: VariantOptionType;
  values?: string[];
  required?: boolean;
};

type VariantSeed = {
  name: string;
  sku: string;
  price: string;
  options: OptionSeed[];
};

type ProductSeed = {
  slug: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  variants: VariantSeed[];
};

const FOIL_COLORS = [
  "Dorado",
  "Plata",
  "Rosa gold",
  "Negro",
  "Blanco",
  "Cobre",
  "Holográfico",
  "Champagne",
  "Verde",
  "Azul",
];

const products: ProductSeed[] = [
  {
    slug: "sobres-clasicos",
    name: "Paquete de 10 sobres clásicos",
    description:
      "Sobres personalizados para invitaciones formales, con impresión en foil o tinta normal.",
    category: "sobres",
    imageUrl: "https://picsum.photos/seed/sobres/800/600",
    variants: [
      {
        name: "Con foil",
        sku: "SOB-FOIL",
        price: "250.00",
        options: [
          { name: "Color del foil", type: VariantOptionType.SELECT, values: FOIL_COLORS },
          { name: "Texto", type: VariantOptionType.TEXT },
        ],
      },
      {
        name: "Con tinta normal",
        sku: "SOB-TINTA",
        price: "200.00",
        options: [{ name: "Texto", type: VariantOptionType.TEXT }],
      },
    ],
  },
  {
    slug: "stickers-redondos",
    name: "Stickers redondos (paquete de 24)",
    description:
      "Stickers circulares para branding, empaques o detalles. Corte profesional y acabado mate.",
    category: "stickers",
    imageUrl: "https://picsum.photos/seed/stickers/800/600",
    variants: [
      {
        name: "5 cm mate",
        sku: "STK-5CM-MATE",
        price: "90.00",
        options: [{ name: "Texto", type: VariantOptionType.TEXT }],
      },
      {
        name: "7 cm brillante",
        sku: "STK-7CM-BRI",
        price: "120.00",
        options: [{ name: "Texto", type: VariantOptionType.TEXT }],
      },
    ],
  },
  {
    slug: "etiquetas-vino-premium",
    name: "Etiquetas para vino premium (paquete de 6)",
    description:
      "Etiquetas personalizadas para botellas de vino, ideales para regalos y eventos especiales.",
    category: "etiquetas-vino",
    imageUrl: "https://picsum.photos/seed/vino/800/600",
    variants: [
      {
        name: "Papel texturizado",
        sku: "VIN-TEX-STD",
        price: "240.00",
        options: [{ name: "Texto", type: VariantOptionType.TEXT }],
      },
      {
        name: "Con foil",
        sku: "VIN-FOIL",
        price: "320.00",
        options: [
          { name: "Color del foil", type: VariantOptionType.SELECT, values: FOIL_COLORS },
          { name: "Texto", type: VariantOptionType.TEXT },
        ],
      },
    ],
  },
  {
    slug: "tarjetas-regalo-boutique",
    name: "Tarjetas de regalo boutique (paquete de 10)",
    description:
      "Tarjetas de regalo personalizadas con mensaje, acabado editorial y papel de alta calidad.",
    category: "tarjetas-regalo",
    imageUrl: "https://picsum.photos/seed/tarjetas/800/600",
    variants: [
      {
        name: "Tamaño chico",
        sku: "TAR-CHI-STD",
        price: "150.00",
        options: [{ name: "Texto", type: VariantOptionType.TEXT }],
      },
      {
        name: "Tamaño grande con foil",
        sku: "TAR-GDE-FOIL",
        price: "220.00",
        options: [
          { name: "Color del foil", type: VariantOptionType.SELECT, values: FOIL_COLORS },
          { name: "Texto", type: VariantOptionType.TEXT },
        ],
      },
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

  // Idempotency note: every upsert below uses `update: {}` and the option/image blocks
  // are guarded by count === 0. Re-running the seed will NOT propagate edits to existing
  // rows (price changes, new options, new images). To apply seed-file edits locally,
  // reset the dev DB (`pnpm migrate reset` inside the api container) before re-seeding.
  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        category: p.category,
      },
    });

    for (const v of p.variants) {
      const variant = await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: {
          productId: product.id,
          name: v.name,
          sku: v.sku,
          price: new Decimal(v.price),
        },
      });

      const optionCount = await prisma.productVariantOption.count({
        where: { variantId: variant.id },
      });
      if (optionCount === 0) {
        for (const [index, option] of v.options.entries()) {
          await prisma.productVariantOption.create({
            data: {
              variantId: variant.id,
              name: option.name,
              type: option.type,
              values: option.values,
              required: option.required ?? true,
              position: index,
            },
          });
        }
      }
    }

    const imageCount = await prisma.productImage.count({ where: { productId: product.id } });
    if (imageCount === 0) {
      await prisma.productImage.create({
        data: { productId: product.id, url: p.imageUrl, alt: p.name, position: 0 },
      });
    }

    console.log(`Seeded product: ${p.slug}`);
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
