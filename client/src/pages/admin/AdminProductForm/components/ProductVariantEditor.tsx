import { useEffect, useMemo, useState } from "react";
import {
  useFieldArray,
  useFormContext,
  useWatch,
  type FieldError,
  type FieldErrors,
} from "react-hook-form";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import type { AdminOptionPalette } from "@/lib/types";
import type { ProductFormValues } from "../schema.js";
import styles from "./ProductVariantEditor.module.scss";

const MAX_VARIANTS = 12;
const MAX_OPTIONS = 8;

type VariantErrors = FieldErrors<ProductFormValues>["variants"];

type Props = {
  fieldErrors?: VariantErrors;
  rootError?: string;
  palettes: AdminOptionPalette[];
};

function emptyVariant() {
  return { name: "", sku: "", price: 0, options: [] };
}

function emptyOption() {
  return {
    name: "",
    type: "TEXT" as const,
    values: undefined as string[] | undefined,
    paletteId: undefined as string | undefined,
    required: true,
  };
}

export function ProductVariantEditor({ fieldErrors, rootError, palettes }: Props) {
  const { control } = useFormContext<ProductFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "variants",
  });

  const watchedVariants = useWatch({ control, name: "variants" }) ?? [];
  const duplicateSkuIndices = useMemo(() => {
    const counts = new Map<string, number>();
    watchedVariants.forEach((variant) => {
      const sku = variant?.sku?.trim().toLowerCase();
      if (!sku) return;
      counts.set(sku, (counts.get(sku) ?? 0) + 1);
    });
    return new Set(
      watchedVariants
        .map((variant, idx) => {
          const sku = variant?.sku?.trim().toLowerCase();
          return sku && (counts.get(sku) ?? 0) > 1 ? idx : -1;
        })
        .filter((i) => i >= 0),
    );
  }, [watchedVariants]);

  const atCap = fields.length >= MAX_VARIANTS;

  return (
    <section className={styles.section} aria-labelledby="variants-heading">
      <header className={styles.heading}>
        <h2 id="variants-heading" className={styles.title}>
          Variantes
        </h2>
        <span className={styles.counter}>
          {fields.length} / {MAX_VARIANTS}
        </span>
      </header>

      <p className={styles.hint}>
        Cada variante es una configuración con su propio precio (p. ej. "Tinta
        normal" o "Con foil"). Agrega opciones dentro de la variante para que el
        cliente personalice el pedido.
      </p>

      {rootError ? (
        <p role="alert" className={styles.error}>
          {rootError}
        </p>
      ) : null}

      {fields.length === 0 ? (
        <p className={styles.emptyState}>
          Aún no hay variantes. Agrega al menos una para publicar el producto.
        </p>
      ) : (
        <ul className={styles.list}>
          {fields.map((field, index) => (
            <li key={field.id} className={styles.listItem}>
              <VariantCard
                index={index}
                isFirst={index === 0}
                isLast={index === fields.length - 1}
                duplicate={duplicateSkuIndices.has(index)}
                errors={fieldErrors?.[index]}
                palettes={palettes}
                onMoveUp={() => move(index, index - 1)}
                onMoveDown={() => move(index, index + 1)}
                onRemove={() => remove(index)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className={styles.actions}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={atCap}
          onClick={() => append(emptyVariant())}
        >
          Agregar variante
        </Button>
      </div>
    </section>
  );
}

type VariantCardProps = {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  duplicate: boolean;
  errors: NonNullable<VariantErrors>[number] | undefined;
  palettes: AdminOptionPalette[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function VariantCard({
  index,
  isFirst,
  isLast,
  duplicate,
  errors,
  palettes,
  onMoveUp,
  onMoveDown,
  onRemove,
}: VariantCardProps) {
  const { control, register } = useFormContext<ProductFormValues>();
  const optionsArray = useFieldArray({
    control,
    name: `variants.${index}.options`,
  });

  const skuInlineError = errors?.sku?.message
    ? errors.sku.message
    : duplicate
      ? "SKU duplicado en este formulario"
      : undefined;

  const optionsRootError =
    typeof errors?.options?.message === "string"
      ? errors.options.message
      : undefined;

  const optionsAtCap = optionsArray.fields.length >= MAX_OPTIONS;

  return (
    <Card className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardLabel}>Variante {index + 1}</span>
        <div className={styles.cardControls}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Mover arriba"
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Mover abajo"
          >
            ↓
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
            onClick={onRemove}
            aria-label="Quitar variante"
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.row}>
        <FormField label="Nombre" error={errors?.name?.message}>
          <Input
            type="text"
            autoComplete="off"
            maxLength={80}
            {...register(`variants.${index}.name`)}
          />
        </FormField>

        <FormField label="SKU" error={skuInlineError}>
          <Input
            type="text"
            autoComplete="off"
            maxLength={80}
            {...register(`variants.${index}.sku`)}
          />
        </FormField>

        <FormField label="Precio" error={errors?.price?.message}>
          <Input
            type="number"
            step="0.01"
            min={0}
            {...register(`variants.${index}.price`, { valueAsNumber: true })}
          />
        </FormField>
      </div>

      <div className={styles.optionsBlock}>
        <div className={styles.optionsHeader}>
          <h3 className={styles.optionsTitle}>Opciones</h3>
          <span className={styles.counter}>
            {optionsArray.fields.length} / {MAX_OPTIONS}
          </span>
        </div>

        {optionsRootError ? (
          <p role="alert" className={styles.error}>
            {optionsRootError}
          </p>
        ) : null}

        {optionsArray.fields.length === 0 ? (
          <p className={styles.emptyOptions}>
            Sin opciones. Agrega "Texto personalizado" para que el cliente
            escriba un mensaje, o "Color" para que elija de una lista.
          </p>
        ) : (
          <ul className={styles.optionsList}>
            {optionsArray.fields.map((optionField, optionIndex) => (
              <li key={optionField.id} className={styles.optionItem}>
                <OptionRow
                  variantIndex={index}
                  index={optionIndex}
                  isFirst={optionIndex === 0}
                  isLast={optionIndex === optionsArray.fields.length - 1}
                  errors={
                    errors?.options?.[optionIndex] as
                      | OptionRowErrors
                      | undefined
                  }
                  palettes={palettes}
                  onMoveUp={() =>
                    optionsArray.move(optionIndex, optionIndex - 1)
                  }
                  onMoveDown={() =>
                    optionsArray.move(optionIndex, optionIndex + 1)
                  }
                  onRemove={() => optionsArray.remove(optionIndex)}
                />
              </li>
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={optionsAtCap}
          onClick={() => optionsArray.append(emptyOption())}
        >
          Agregar opción
        </Button>
      </div>
    </Card>
  );
}

type OptionRowErrors = {
  name?: FieldError;
  type?: FieldError;
  values?: FieldError;
  paletteId?: FieldError;
  required?: FieldError;
};

type OptionRowProps = {
  variantIndex: number;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  errors: OptionRowErrors | undefined;
  palettes: AdminOptionPalette[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

function OptionRow({
  variantIndex,
  index,
  isFirst,
  isLast,
  errors,
  palettes,
  onMoveUp,
  onMoveDown,
  onRemove,
}: OptionRowProps) {
  const { control, register, setValue } = useFormContext<ProductFormValues>();
  const type = useWatch({
    control,
    name: `variants.${variantIndex}.options.${index}.type`,
  });
  const values = useWatch({
    control,
    name: `variants.${variantIndex}.options.${index}.values`,
  });
  const [valuesText, setValuesText] = useState<string>(() =>
    Array.isArray(values) ? values.join(", ") : "",
  );
  const activePalettes = useMemo(
    () => palettes.filter((p) => p.active),
    [palettes],
  );

  useEffect(() => {
    if (type === "TEXT") {
      setValue(
        `variants.${variantIndex}.options.${index}.values`,
        undefined,
        { shouldValidate: false },
      );
      setValue(
        `variants.${variantIndex}.options.${index}.paletteId`,
        undefined,
        { shouldValidate: false },
      );
      setValuesText("");
    } else if (type === "SELECT") {
      if (!Array.isArray(values)) {
        setValue(
          `variants.${variantIndex}.options.${index}.values`,
          [],
          { shouldValidate: false },
        );
      }
      setValue(
        `variants.${variantIndex}.options.${index}.paletteId`,
        undefined,
        { shouldValidate: false },
      );
    } else if (type === "SWATCH") {
      setValue(
        `variants.${variantIndex}.options.${index}.values`,
        undefined,
        { shouldValidate: false },
      );
      setValuesText("");
    }
  }, [type, variantIndex, index, setValue, values]);

  const valuesError =
    typeof errors?.values?.message === "string"
      ? errors.values.message
      : undefined;
  const paletteError =
    typeof errors?.paletteId?.message === "string"
      ? errors.paletteId.message
      : undefined;

  return (
    <div className={styles.optionRow}>
      <div className={styles.optionGrid}>
        <FormField label="Nombre" error={errors?.name?.message}>
          <Input
            type="text"
            autoComplete="off"
            maxLength={80}
            placeholder="p. ej. Color del foil"
            {...register(
              `variants.${variantIndex}.options.${index}.name`,
            )}
          />
        </FormField>

        <FormField label="Tipo">
          <select
            className={styles.select}
            {...register(`variants.${variantIndex}.options.${index}.type`)}
          >
            <option value="TEXT">Texto libre</option>
            <option value="SELECT">Lista de opciones</option>
            <option value="SWATCH">Paleta de imágenes</option>
          </select>
        </FormField>

        {type === "SELECT" ? (
          <FormField
            label="Valores"
            error={valuesError}
            hint="Separa los valores con comas. Ej: Dorado, Plata, Rosa."
          >
            <Input
              type="text"
              autoComplete="off"
              value={valuesText}
              onChange={(event) => {
                const next = event.target.value;
                setValuesText(next);
                const parsed = next
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                setValue(
                  `variants.${variantIndex}.options.${index}.values`,
                  parsed,
                  { shouldValidate: false },
                );
              }}
            />
          </FormField>
        ) : null}

        {type === "SWATCH" ? (
          <FormField
            label="Paleta"
            error={paletteError}
            hint={
              activePalettes.length === 0
                ? "Crea una paleta en /admin/paletas antes de usar este tipo."
                : "El cliente verá una cuadrícula con las muestras activas de esta paleta."
            }
          >
            <select
              className={styles.select}
              disabled={activePalettes.length === 0}
              {...register(
                `variants.${variantIndex}.options.${index}.paletteId`,
              )}
            >
              <option value="">Selecciona una paleta…</option>
              {activePalettes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </FormField>
        ) : null}
      </div>

      <div className={styles.optionFooter}>
        <label className={styles.requiredLabel}>
          <input
            type="checkbox"
            {...register(
              `variants.${variantIndex}.options.${index}.required`,
            )}
          />
          <span>Obligatorio</span>
        </label>
        <div className={styles.optionControls}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label="Mover arriba"
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveDown}
            disabled={isLast}
            aria-label="Mover abajo"
          >
            ↓
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.iconButtonDanger}`}
            onClick={onRemove}
            aria-label="Quitar opción"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
