-- CreateEnum
CREATE TYPE "VariantKind" AS ENUM ('CON_FOIL', 'CON_TINTA_NORMAL', 'CON_FOIL_Y_TINTA', 'PAPEL_TEXTURIZADO');

-- DropForeignKey
ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_productId_fkey";

-- DropForeignKey
ALTER TABLE "ProductVariantOption" DROP CONSTRAINT "ProductVariantOption_variantId_fkey";

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "variantId",
ADD COLUMN     "designId" TEXT,
ADD COLUMN     "designImageUrl" TEXT,
ADD COLUMN     "designName" TEXT,
ADD COLUMN     "variantKind" "VariantKind" NOT NULL;

-- DropTable
DROP TABLE "ProductVariant";

-- DropTable
DROP TABLE "ProductVariantOption";

-- DropEnum
DROP TYPE "VariantOptionType";

-- CreateTable
CREATE TABLE "ProductVariantPrice" (
    "productId" TEXT NOT NULL,
    "kind" "VariantKind" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "sku" TEXT NOT NULL,

    CONSTRAINT "ProductVariantPrice_pkey" PRIMARY KEY ("productId","kind")
);

-- CreateTable
CREATE TABLE "Design" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Design_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignVariantCompat" (
    "designId" TEXT NOT NULL,
    "kind" "VariantKind" NOT NULL,

    CONSTRAINT "DesignVariantCompat_pkey" PRIMARY KEY ("designId","kind")
);

-- CreateTable
CREATE TABLE "ProductDesign" (
    "productId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,

    CONSTRAINT "ProductDesign_pkey" PRIMARY KEY ("productId","designId")
);

-- CreateTable
CREATE TABLE "OptionPalette" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OptionPalette_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionSwatch" (
    "id" TEXT NOT NULL,
    "paletteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OptionSwatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariantPrice_sku_key" ON "ProductVariantPrice"("sku");

-- CreateIndex
CREATE INDEX "ProductVariantPrice_productId_idx" ON "ProductVariantPrice"("productId");

-- CreateIndex
CREATE INDEX "Design_active_idx" ON "Design"("active");

-- CreateIndex
CREATE INDEX "ProductDesign_designId_idx" ON "ProductDesign"("designId");

-- CreateIndex
CREATE UNIQUE INDEX "OptionPalette_name_key" ON "OptionPalette"("name");

-- CreateIndex
CREATE UNIQUE INDEX "OptionPalette_slug_key" ON "OptionPalette"("slug");

-- CreateIndex
CREATE INDEX "OptionPalette_active_idx" ON "OptionPalette"("active");

-- CreateIndex
CREATE INDEX "OptionSwatch_paletteId_idx" ON "OptionSwatch"("paletteId");

-- CreateIndex
CREATE INDEX "OptionSwatch_active_idx" ON "OptionSwatch"("active");

-- CreateIndex
CREATE UNIQUE INDEX "OptionSwatch_paletteId_name_key" ON "OptionSwatch"("paletteId", "name");

-- AddForeignKey
ALTER TABLE "ProductVariantPrice" ADD CONSTRAINT "ProductVariantPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVariantCompat" ADD CONSTRAINT "DesignVariantCompat_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDesign" ADD CONSTRAINT "ProductDesign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDesign" ADD CONSTRAINT "ProductDesign_designId_fkey" FOREIGN KEY ("designId") REFERENCES "Design"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionSwatch" ADD CONSTRAINT "OptionSwatch_paletteId_fkey" FOREIGN KEY ("paletteId") REFERENCES "OptionPalette"("id") ON DELETE CASCADE ON UPDATE CASCADE;

