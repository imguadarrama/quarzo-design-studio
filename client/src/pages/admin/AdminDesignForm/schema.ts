import { z } from "zod";
import { PENDING_URL_PREFIX } from "../AdminProductForm/schema.js";

const imageUrlSchema = z
  .string()
  .min(1, "Imagen obligatoria")
  .refine(
    (v) => v.startsWith(PENDING_URL_PREFIX) || /^https:\/\//.test(v),
    "URL inválida",
  );

export const designFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "Máximo 120 caracteres"),
  imageUrl: imageUrlSchema,
  active: z.boolean(),
  compatibleKinds: z
    .array(
      z.enum([
        "CON_FOIL",
        "CON_TINTA_NORMAL",
        "CON_FOIL_Y_TINTA",
        "PAPEL_TEXTURIZADO",
      ]),
    )
    .max(4),
});

export type DesignFormValues = z.infer<typeof designFormSchema>;
