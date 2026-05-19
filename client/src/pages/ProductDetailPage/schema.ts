import { z } from "zod";
import { isFoilKind } from "@/lib/variant-kinds";

const variantKindSchema = z.enum([
  "CON_FOIL",
  "CON_TINTA_NORMAL",
  "CON_FOIL_Y_TINTA",
  "PAPEL_TEXTURIZADO",
]);

export const pickerSchema = z
  .object({
    designId: z.string().min(1, "Elige un diseño"),
    variantKind: variantKindSchema,
    foilSwatchId: z.string().nullable(),
    personalizationText: z
      .string()
      .trim()
      .min(1, "Escribe el nombre")
      .max(80, "Máximo 80 caracteres"),
    quantity: z.coerce
      .number({ invalid_type_error: "Cantidad inválida" })
      .int("Cantidad inválida")
      .min(1, "Mínimo 1")
      .max(999, "Máximo 999"),
  })
  .superRefine((v, ctx) => {
    if (isFoilKind(v.variantKind) && !v.foilSwatchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["foilSwatchId"],
        message: "Elige un color de foil",
      });
    }
  });

export type PickerValues = z.infer<typeof pickerSchema>;
