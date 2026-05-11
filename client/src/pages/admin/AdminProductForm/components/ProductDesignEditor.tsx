import { useEffect, useRef } from "react";
import {
  useFieldArray,
  useFormContext,
  useWatch,
  type FieldErrors,
} from "react-hook-form";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import { ReorderControls } from "@/components/ReorderControls/ReorderControls";
import {
  isPendingUrl,
  pendingTempId,
  pendingUrl,
  type PendingImageMap,
} from "../pending-images.js";
import type { ProductFormValues } from "../schema.js";
import styles from "./ProductDesignEditor.module.scss";

const MAX_DESIGNS = 50;

type Props = {
  pendingImages: PendingImageMap;
  fieldErrors?: FieldErrors<ProductFormValues>["designs"];
  rootError?: string;
};

function generateTempId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ProductDesignEditor({
  pendingImages,
  fieldErrors,
  rootError,
}: Props) {
  const { control, register, setValue, getValues } =
    useFormContext<ProductFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "designs",
  });
  const variants = useWatch({ control, name: "variants" }) ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atCap = fields.length >= MAX_DESIGNS;
  const variantCount = variants.length;

  // When a variant is removed, sweep every design's compatibleVariantIndices
  // to drop indices that no longer point at a real variant. Without this
  // sweep the form would carry stale indices through submit and the server
  // would silently drop them — but the form state would still display
  // checked boxes for ghost variants.
  useEffect(() => {
    const current = getValues("designs");
    let changed = false;
    const swept = current.map((d) => {
      const filtered = d.compatibleVariantIndices.filter(
        (idx) => idx < variantCount,
      );
      if (filtered.length !== d.compatibleVariantIndices.length) {
        changed = true;
        return { ...d, compatibleVariantIndices: filtered };
      }
      return d;
    });
    if (changed) {
      setValue("designs", swept, { shouldValidate: false });
    }
  }, [variantCount, getValues, setValue]);

  const handlePick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_DESIGNS - fields.length;
    const accepted = Array.from(files).slice(0, remaining);
    for (const file of accepted) {
      const tempId = generateTempId();
      const previewUrl = URL.createObjectURL(file);
      pendingImages.set(tempId, { file, previewUrl });
      append({
        name: "",
        imageUrl: pendingUrl(tempId),
        active: true,
        compatibleVariantIndices: variants.map((_, i) => i),
      });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const url = fields[index]?.imageUrl;
    if (typeof url === "string" && isPendingUrl(url)) {
      const tempId = pendingTempId(url);
      const entry = pendingImages.get(tempId);
      if (entry) {
        URL.revokeObjectURL(entry.previewUrl);
        pendingImages.delete(tempId);
      }
    }
    remove(index);
  };

  const previewSrc = (url: string): string => {
    if (isPendingUrl(url)) {
      return pendingImages.get(pendingTempId(url))?.previewUrl ?? "";
    }
    return url;
  };

  const toggleCompat = (designIndex: number, variantIndex: number) => {
    const current = getValues(`designs.${designIndex}.compatibleVariantIndices`);
    const has = current.includes(variantIndex);
    const next = has
      ? current.filter((i) => i !== variantIndex)
      : [...current, variantIndex].sort((a, b) => a - b);
    setValue(`designs.${designIndex}.compatibleVariantIndices`, next, {
      shouldValidate: false,
    });
  };

  return (
    <section className={styles.section} aria-labelledby="designs-heading">
      <header className={styles.heading}>
        <h2 id="designs-heading" className={styles.title}>
          Diseños
        </h2>
        <span className={styles.counter}>
          {fields.length} / {MAX_DESIGNS}
        </span>
      </header>

      <p className={styles.hint}>
        Los clientes eligen un diseño antes de la variante. Marca con qué
        variantes es compatible cada uno (por defecto todas).
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.fileInputHidden}
        onChange={(event) => handlePick(event.target.files)}
      />
      <div className={styles.actions}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={atCap}
          onClick={() => fileInputRef.current?.click()}
        >
          Agregar diseño
        </Button>
      </div>

      {rootError ? (
        <p role="alert" className={styles.error}>
          {rootError}
        </p>
      ) : null}

      {fields.length === 0 ? (
        <p className={styles.emptyState}>
          Aún no hay diseños. Productos sin diseños saltan el paso de
          selección y pasan directo a la variante.
        </p>
      ) : (
        <ul className={styles.list}>
          {fields.map((field, designIndex) => {
            const rowError = fieldErrors?.[designIndex];
            const nameError =
              typeof rowError?.name?.message === "string"
                ? rowError.name.message
                : undefined;
            const imageError =
              typeof rowError?.imageUrl?.message === "string"
                ? rowError.imageUrl.message
                : undefined;
            const isFirst = designIndex === 0;
            const isLast = designIndex === fields.length - 1;
            return (
              <li key={field.id} className={styles.row}>
                <img
                  src={previewSrc(field.imageUrl)}
                  alt=""
                  className={styles.thumb}
                  loading="lazy"
                />
                <div className={styles.rowBody}>
                  <FormField
                    label="Nombre del diseño"
                    error={nameError ?? imageError}
                  >
                    <Input
                      type="text"
                      autoComplete="off"
                      maxLength={120}
                      placeholder="p. ej. Floral primavera"
                      {...register(`designs.${designIndex}.name`)}
                    />
                  </FormField>

                  <CompatCheckboxList
                    designIndex={designIndex}
                    variantCount={variantCount}
                    onToggle={toggleCompat}
                  />

                  <label className={styles.activeRow}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      {...register(`designs.${designIndex}.active`)}
                    />
                    <span>Activo</span>
                  </label>
                </div>
                <ReorderControls
                  onMoveUp={
                    isFirst ? undefined : () => move(designIndex, designIndex - 1)
                  }
                  onMoveDown={
                    isLast ? undefined : () => move(designIndex, designIndex + 1)
                  }
                  onRemove={() => handleRemove(designIndex)}
                  removeLabel="Quitar diseño"
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type CompatProps = {
  designIndex: number;
  variantCount: number;
  onToggle: (designIndex: number, variantIndex: number) => void;
};

function CompatCheckboxList({ designIndex, variantCount, onToggle }: CompatProps) {
  const { control } = useFormContext<ProductFormValues>();
  const compat = useWatch({
    control,
    name: `designs.${designIndex}.compatibleVariantIndices`,
  }) ?? [];
  const variants = useWatch({ control, name: "variants" }) ?? [];

  if (variantCount === 0) {
    return (
      <p className={styles.compatEmpty}>
        Agrega variantes para poder elegir compatibilidades.
      </p>
    );
  }

  return (
    <fieldset className={styles.compatGroup}>
      <legend className={styles.compatLegend}>Compatible con:</legend>
      <div className={styles.compatList}>
        {variants.map((variant, idx) => {
          const checked = compat.includes(idx);
          const variantName = variant?.name?.trim() || `Variante ${idx + 1}`;
          return (
            <label key={idx} className={styles.compatItem}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(designIndex, idx)}
              />
              <span>{variantName}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
