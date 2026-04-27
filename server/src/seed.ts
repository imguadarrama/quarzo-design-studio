import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import bcrypt from "bcrypt";
import "dotenv/config";

const prisma = new PrismaClient();

type VariantSeed = { name: string; sku: string; priceDelta: string; stock: number };
type ProductSeed = {
  slug: string;
  name: string;
  description: string;
  category: string;
  basePrice: string;
  imageUrl: string;
  variants: VariantSeed[];
};

const products: ProductSeed[] = [
  {
    slug: "sobres-clasicos",
    name: "Sobres clásicos",
    description:
      "Sobres personalizados para invitaciones formales, con impresión en foil o color estándar.",
    category: "sobres",
    basePrice: "180.00",
    imageUrl: "https://picsum.photos/seed/sobres/800/600",
    variants: [
      { name: "Foil dorado", sku: "SOB-FOIL-DOR", priceDelta: "60.00", stock: 50 },
      { name: "Color estándar", sku: "SOB-COLOR-STD", priceDelta: "0.00", stock: 120 },
    ],
  },
  {
    slug: "stickers-redondos",
    name: "Stickers redondos",
    description:
      "Stickers circulares para branding, empaques o detalles. Corte profesional y acabado mate.",
    category: "stickers",
    basePrice: "90.00",
    imageUrl: "https://picsum.photos/seed/stickers/800/600",
    variants: [
      { name: "5 cm mate", sku: "STK-5CM-MATE", priceDelta: "0.00", stock: 200 },
      { name: "7 cm brillante", sku: "STK-7CM-BRI", priceDelta: "30.00", stock: 150 },
    ],
  },
  {
    slug: "etiquetas-vino-premium",
    name: "Etiquetas para vino premium",
    description:
      "Etiquetas personalizadas para botellas de vino, ideales para regalos y eventos especiales.",
    category: "etiquetas-vino",
    basePrice: "240.00",
    imageUrl: "https://picsum.photos/seed/vino/800/600",
    variants: [
      { name: "Papel texturizado", sku: "VIN-TEX-STD", priceDelta: "0.00", stock: 80 },
      { name: "Foil plata", sku: "VIN-FOIL-PLA", priceDelta: "80.00", stock: 40 },
    ],
  },
  {
    slug: "tarjetas-regalo-boutique",
    name: "Tarjetas de regalo boutique",
    description:
      "Tarjetas de regalo personalizadas con mensaje, acabado editorial y papel de alta calidad.",
    category: "tarjetas-regalo",
    basePrice: "150.00",
    imageUrl: "https://picsum.photos/seed/tarjetas/800/600",
    variants: [
      { name: "Tamaño chico", sku: "TAR-CHI-STD", priceDelta: "0.00", stock: 100 },
      { name: "Tamaño grande foil", sku: "TAR-GDE-FOIL", priceDelta: "70.00", stock: 60 },
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

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        category: p.category,
        basePrice: new Decimal(p.basePrice),
      },
    });

    for (const v of p.variants) {
      await prisma.productVariant.upsert({
        where: { sku: v.sku },
        update: {},
        create: {
          productId: product.id,
          name: v.name,
          sku: v.sku,
          priceDelta: new Decimal(v.priceDelta),
          stock: v.stock,
        },
      });
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
