-- Custom: Prisma's auto-generated DROP COLUMN/ADD COLUMN NOT NULL would lose
-- the `Product.category` text values. Replaced with a three-step migration that
-- (1) creates the Category table, (2) seeds it from distinct existing category
-- values, (3) adds Product.categoryId as a nullable FK, backfills it from the
-- old column, then drops the old column and tightens to NOT NULL.

-- DropIndex
DROP INDEX "Product_category_idx";

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "sku" TEXT;

-- AlterTable
ALTER TABLE "ProductVariantPrice" ADD COLUMN     "offered" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignCategory" (
    "designId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "DesignCategory_pkey" PRIMARY KEY ("designId","categoryId")
);

-- CreateTable
CREATE TABLE "ProductSlugAlias" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductSlugAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_active_idx" ON "Category"("active");

-- CreateIndex
CREATE INDEX "DesignCategory_categoryId_idx" ON "DesignCategory"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSlugAlias_slug_key" ON "ProductSlugAlias"("slug");

-- CreateIndex
CREATE INDEX "ProductSlugAlias_productId_idx" ON "ProductSlugAlias"("productId");

-- Custom backfill: create a Category row per distinct existing Product.category
-- value (uses gen_random_uuid() — built into Postgres 13+), add Product.categoryId
-- as nullable, populate it by joining on slug, drop the old column, then enforce
-- NOT NULL. Net result matches Prisma's auto-generated intent without losing data.
INSERT INTO "Category" ("id", "name", "slug", "position", "active", "createdAt")
SELECT gen_random_uuid()::text, "category", "category", 0, true, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "category" FROM "Product" WHERE "category" IS NOT NULL) AS d;

ALTER TABLE "Product" ADD COLUMN "categoryId" TEXT;

UPDATE "Product"
SET "categoryId" = c."id"
FROM "Category" c
WHERE c."slug" = "Product"."category";

ALTER TABLE "Product" DROP COLUMN "category";
ALTER TABLE "Product" ALTER COLUMN "categoryId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignCategory" ADD CONSTRAINT "DesignCategory_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignCategory" ADD CONSTRAINT "DesignCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSlugAlias" ADD CONSTRAINT "ProductSlugAlias_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
