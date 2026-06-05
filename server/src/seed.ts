import { PrismaClient } from "@prisma/client";
import "dotenv/config";
import { seedAdmin } from "./seed-admin.js";

// Production seed: admin bootstrap only. There is no public admin-registration
// endpoint, so the login user must be seeded. Everything else (categories,
// designs, products, the colores-foil palette) is user-managed via the admin.
// Demo content lives in seed-demo.ts and is for local dev + staging only.
const prisma = new PrismaClient();

async function main() {
  await seedAdmin(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
