import { Controller, type Control } from "react-hook-form";
import { VARIANT_KIND_LABELS_SHORT } from "@/lib/variant-kinds";
import type { ProductVariantPrice, VariantKind } from "@/lib/types";
import type { PickerValues } from "../schema";
import styles from "./VariantKindSelector.module.scss";

interface VariantKindSelectorProps {
  variants: ProductVariantPrice[];
  compatibleKinds: VariantKind[];
  control: Control<PickerValues>;
}

const priceFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function VariantKindSelector({
  variants,
  compatibleKinds,
  control,
}: VariantKindSelectorProps) {
  const compatSet = new Set(compatibleKinds);

  return (
    <Controller
      control={control}
      name="variantKind"
      render={({ field, fieldState }) => (
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Tipo de impresión</legend>
          <ul className={styles.grid}>
            {variants.map((variant) => {
              const isCompatible = compatSet.has(variant.kind);
              const isSelected = field.value === variant.kind;
              return (
                <li key={variant.kind} className={styles.item}>
                  <label
                    className={
                      isCompatible
                        ? styles.label
                        : `${styles.label} ${styles.labelDisabled}`
                    }
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={variant.kind}
                      checked={isSelected}
                      disabled={!isCompatible}
                      onChange={() => field.onChange(variant.kind)}
                      onBlur={field.onBlur}
                      className={styles.input}
                    />
                    <span
                      className={
                        isSelected
                          ? `${styles.tile} ${styles.tileSelected}`
                          : styles.tile
                      }
                    >
                      <span className={styles.kindName}>
                        {VARIANT_KIND_LABELS_SHORT[variant.kind]}
                      </span>
                      <span className={styles.price}>
                        {priceFormatter.format(variant.price)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {fieldState.error?.message ? (
            <p role="alert" className={styles.error}>
              {fieldState.error.message}
            </p>
          ) : null}
        </fieldset>
      )}
    />
  );
}
