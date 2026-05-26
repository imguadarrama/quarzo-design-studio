import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";
import { ConflictError, NotFoundError } from "./errors.js";
import type { CreateOrderItemInput } from "./validation-schemas.js";
import { VARIANT_KIND_NAMES } from "./variant-kinds.js";
import { VARIANT_PALETTE_SLUG } from "./variant-palettes.js";

type BuildOrderItemsResult = {
  create: Prisma.OrderItemCreateWithoutOrderInput[];
  subtotal: Decimal;
};

export const buildOrderItemsForCreate = async (
  tx: Prisma.TransactionClient,
  items: CreateOrderItemInput[],
): Promise<BuildOrderItemsResult> => {
  const create: Prisma.OrderItemCreateWithoutOrderInput[] = [];
  let subtotal = new Decimal(0);

  for (const item of items) {
    const product = await tx.product.findFirst({
      where: { id: item.productId, active: true },
      include: {
        variants: true,
        designs: { include: { design: { include: { compat: true } } } },
      },
    });
    if (!product) {
      throw new NotFoundError("Producto no encontrado");
    }

    const variant = product.variants.find((v) => v.kind === item.variantKind);
    if (!variant || !variant.offered) {
      throw new ConflictError(
        "VARIANT_NOT_OFFERED",
        `La variante "${VARIANT_KIND_NAMES[item.variantKind]}" ya no está disponible para "${product.name}".`,
      );
    }

    const productDesign = product.designs.find(
      (pd) => pd.designId === item.designId,
    );
    if (!productDesign || !productDesign.design.active) {
      throw new ConflictError(
        "DESIGN_INCOMPATIBLE",
        "El diseño seleccionado ya no está disponible para este producto.",
      );
    }
    const designSupportsKind = productDesign.design.compat.some(
      (c) => c.kind === item.variantKind,
    );
    if (!designSupportsKind) {
      throw new ConflictError(
        "DESIGN_INCOMPATIBLE",
        `El diseño "${productDesign.design.name}" no es compatible con "${VARIANT_KIND_NAMES[item.variantKind]}".`,
      );
    }

    const paletteSlug = VARIANT_PALETTE_SLUG[item.variantKind];
    let selections: Prisma.InputJsonValue = {};

    if (paletteSlug) {
      if (!item.foilSwatchId) {
        throw new ConflictError(
          "FOIL_SWATCH_REQUIRED",
          "Selecciona un color de foil para esta variante.",
        );
      }
      const swatch = await tx.optionSwatch.findUnique({
        where: { id: item.foilSwatchId },
        include: { palette: true },
      });
      if (!swatch || !swatch.active || swatch.palette.slug !== paletteSlug) {
        throw new ConflictError(
          "FOIL_SWATCH_INVALID",
          "El color de foil seleccionado ya no es válido.",
        );
      }
      selections = {
        foilColor: swatch.name,
        foilSwatchId: swatch.id,
        foilImageUrl: swatch.imageUrl,
      };
    } else if (item.foilSwatchId !== null) {
      throw new ConflictError(
        "FOIL_SWATCH_NOT_ALLOWED",
        "Esta variante no permite seleccionar color de foil.",
      );
    }

    subtotal = subtotal.plus(variant.price.mul(item.quantity));

    create.push({
      productId: product.id,
      variantKind: item.variantKind,
      sku: variant.sku,
      productName: product.name,
      variantName: VARIANT_KIND_NAMES[item.variantKind],
      unitPrice: variant.price,
      quantity: item.quantity,
      personalizationText: item.personalizationText,
      selections,
      designId: productDesign.design.id,
      designName: productDesign.design.name,
      designImageUrl: productDesign.design.imageUrl,
    });
  }

  return { create, subtotal };
};
