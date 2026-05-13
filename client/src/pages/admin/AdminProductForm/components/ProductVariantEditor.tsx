import { useFormContext, type FieldErrors } from "react-hook-form";
import { Card } from "@/components/Card/Card";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import type { VariantKind } from "@/lib/types";
import type { ProductFormValues } from "../schema.js";
import styles from "./ProductVariantEditor.module.scss";

type VariantErrors = FieldErrors<ProductFormValues>["variants"];

type Props = {
  fieldErrors?: VariantErrors;
  rootError?: string;
};

const VARIANT_LABELS: Record<VariantKind, string> = {
  CON_FOIL: "Con foil",
  CON_TINTA_NORMAL: "Con tinta normal",
  CON_FOIL_Y_TINTA: "Con foil y tinta normal",
  PAPEL_TEXTURIZADO: "Papel texturizado",
};

const VARIANT_HINTS: Record<VariantKind, string> = {
  CON_FOIL: "Solo foil. El cliente elegirá el color del foil.",
  CON_TINTA_NORMAL: "Tinta tradicional, sin foil.",
  CON_FOIL_Y_TINTA: "Combina foil con tinta normal. El cliente elegirá el color del foil.",
  PAPEL_TEXTURIZADO: "Papel especial con textura.",
};

export function ProductVariantEditor({ fieldErrors, rootError }: Props) {
  const { register, getValues } = useFormContext<ProductFormValues>();
  const variants = getValues("variants");

  return (
    <section className={styles.section} aria-labelledby="variants-heading">
      <header className={styles.heading}>
        <h2 id="variants-heading" className={styles.title}>
          Variantes y precios
        </h2>
      </header>

      <p className={styles.hint}>
        Las 4 variantes son fijas para todos los productos. Solo el precio y el
        SKU cambian. Si una variante no se ofrece, déjala con SKU
        descriptivo y precio 0.
      </p>

      {rootError ? (
        <p role="alert" className={styles.error}>
          {rootError}
        </p>
      ) : null}

      <ul className={styles.list}>
        {variants.map((variant, index) => {
          const errors = fieldErrors?.[index];
          return (
            <li key={variant.kind} className={styles.listItem}>
              <Card className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardLabel}>
                    {VARIANT_LABELS[variant.kind]}
                  </span>
                </div>
                <p className={styles.variantHint}>{VARIANT_HINTS[variant.kind]}</p>

                <input
                  type="hidden"
                  value={variant.kind}
                  {...register(`variants.${index}.kind`)}
                />

                <div className={styles.row}>
                  <FormField label="SKU" error={errors?.sku?.message}>
                    <Input
                      type="text"
                      autoComplete="off"
                      maxLength={80}
                      {...register(`variants.${index}.sku`)}
                    />
                  </FormField>

                  <FormField label="Precio (MXN)" error={errors?.price?.message}>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      {...register(`variants.${index}.price`, { valueAsNumber: true })}
                    />
                  </FormField>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
