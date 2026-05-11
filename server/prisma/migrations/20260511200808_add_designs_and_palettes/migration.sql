-- AlterEnum
ALTER TYPE "VariantOptionType" ADD VALUE 'SWATCH';

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "designId" TEXT,
ADD COLUMN     "designImageUrl" TEXT,
ADD COLUMN     "designName" TEXT;

-- AlterTable
ALTER TABLE "ProductVariantOption" ADD COLUMN     "paletteId" TEXT;

-- CreateTable
CREATE TABLE "ProductDesign" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesignVariantCompat" (
    "designId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,

    CONSTRAINT "DesignVariantCompat_pkey" PRIMARY KEY ("designId","variantId")
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
CREATE INDEX "ProductDesign_productId_idx" ON "ProductDesign"("productId");

-- CreateIndex
CREATE INDEX "ProductDesign_active_idx" ON "ProductDesign"("active");

-- CreateIndex
CREATE INDEX "DesignVariantCompat_variantId_idx" ON "DesignVariantCompat"("variantId");

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

-- CreateIndex
CREATE INDEX "ProductVariantOption_paletteId_idx" ON "ProductVariantOption"("paletteId");

-- AddForeignKey
ALTER TABLE "ProductVariantOption" ADD CONSTRAINT "ProductVariantOption_paletteId_fkey" FOREIGN KEY ("paletteId") REFERENCES "OptionPalette"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDesign" ADD CONSTRAINT "ProductDesign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVariantCompat" ADD CONSTRAINT "DesignVariantCompat_designId_fkey" FOREIGN KEY ("designId") REFERENCES "ProductDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesignVariantCompat" ADD CONSTRAINT "DesignVariantCompat_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionSwatch" ADD CONSTRAINT "OptionSwatch_paletteId_fkey" FOREIGN KEY ("paletteId") REFERENCES "OptionPalette"("id") ON DELETE CASCADE ON UPDATE CASCADE;
