import { useRef } from "react";
import {
  useFieldArray,
  useFormContext,
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
} from "../../AdminProductForm/pending-images.js";
import type { PaletteFormValues } from "../schema.js";
import styles from "./PaletteSwatchEditor.module.scss";

const MAX_SWATCHES = 50;

type Props = {
  pendingImages: PendingImageMap;
  fieldErrors?: FieldErrors<PaletteFormValues>["swatches"];
  rootError?: string;
};

function generateTempId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function PaletteSwatchEditor({
  pendingImages,
  fieldErrors,
  rootError,
}: Props) {
  const { control, register } = useFormContext<PaletteFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "swatches",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atCap = fields.length >= MAX_SWATCHES;

  const handlePick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_SWATCHES - fields.length;
    const accepted = Array.from(files).slice(0, remaining);
    for (const file of accepted) {
      const tempId = generateTempId();
      const previewUrl = URL.createObjectURL(file);
      pendingImages.set(tempId, { file, previewUrl });
      append({ name: "", imageUrl: pendingUrl(tempId), active: true });
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

  return (
    <section className={styles.section} aria-labelledby="swatches-heading">
      <header className={styles.heading}>
        <h2 id="swatches-heading" className={styles.title}>
          Muestras
        </h2>
        <span className={styles.counter}>
          {fields.length} / {MAX_SWATCHES}
        </span>
      </header>

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
          Agregar muestra
        </Button>
      </div>

      {rootError ? (
        <p role="alert" className={styles.error}>
          {rootError}
        </p>
      ) : null}

      {fields.length === 0 ? (
        <p className={styles.emptyState}>
          Aún no hay muestras. Agrega al menos una para que la paleta sea útil.
        </p>
      ) : (
        <ul className={styles.list}>
          {fields.map((field, index) => {
            const rowError = fieldErrors?.[index];
            const nameError =
              typeof rowError?.name?.message === "string"
                ? rowError.name.message
                : undefined;
            const imageError =
              typeof rowError?.imageUrl?.message === "string"
                ? rowError.imageUrl.message
                : undefined;
            const isFirst = index === 0;
            const isLast = index === fields.length - 1;
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
                    label="Nombre"
                    error={nameError ?? imageError}
                    hint="Por ejemplo: Dorado, Plata, Rosa…"
                  >
                    <Input
                      type="text"
                      autoComplete="off"
                      maxLength={80}
                      {...register(`swatches.${index}.name`)}
                    />
                  </FormField>
                  <label className={styles.activeRow}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      {...register(`swatches.${index}.active`)}
                    />
                    <span>Activa</span>
                  </label>
                </div>
                <ReorderControls
                  onMoveUp={isFirst ? undefined : () => move(index, index - 1)}
                  onMoveDown={isLast ? undefined : () => move(index, index + 1)}
                  onRemove={() => handleRemove(index)}
                  removeLabel="Quitar muestra"
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
