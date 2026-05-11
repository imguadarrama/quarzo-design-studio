import { useRef } from "react";
import {
  useFieldArray,
  useFormContext,
  type FieldErrors,
} from "react-hook-form";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import {
  isPendingUrl,
  pendingTempId,
  pendingUrl,
  type PendingImageMap,
} from "../pending-images.js";
import type { ProductFormValues } from "../schema.js";
import styles from "./ProductImageEditor.module.scss";

const MAX_IMAGES = 8;

type Props = {
  pendingImages: PendingImageMap;
  fieldErrors?: FieldErrors<ProductFormValues>["images"];
  rootError?: string;
};

function generateTempId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ProductImageEditor({
  pendingImages,
  fieldErrors,
  rootError,
}: Props) {
  const { control, register } = useFormContext<ProductFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "images",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const atCap = fields.length >= MAX_IMAGES;

  const handlePick = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - fields.length;
    const accepted = Array.from(files).slice(0, remaining);
    for (const file of accepted) {
      const tempId = generateTempId();
      const previewUrl = URL.createObjectURL(file);
      pendingImages.set(tempId, { file, previewUrl });
      append({ url: pendingUrl(tempId), alt: "" });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const url = fields[index]?.url;
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
    <section className={styles.section} aria-labelledby="images-heading">
      <header className={styles.heading}>
        <h2 id="images-heading" className={styles.title}>
          Imágenes
        </h2>
        <span className={styles.counter}>
          {fields.length} / {MAX_IMAGES}
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
          Agregar imagen
        </Button>
      </div>

      {rootError ? (
        <p role="alert" className={styles.error}>
          {rootError}
        </p>
      ) : null}

      {fields.length === 0 ? (
        <p className={styles.emptyState}>
          Aún no hay imágenes. Agrega al menos una para mostrar el producto.
        </p>
      ) : (
        <ul className={styles.list}>
          {fields.map((field, index) => {
            const rowError = fieldErrors?.[index];
            const urlError =
              typeof rowError?.url?.message === "string"
                ? rowError.url.message
                : undefined;
            const altError =
              typeof rowError?.alt?.message === "string"
                ? rowError.alt.message
                : undefined;
            const isFirst = index === 0;
            const isLast = index === fields.length - 1;
            return (
              <li key={field.id} className={styles.row}>
                <img
                  src={previewSrc(field.url)}
                  alt=""
                  className={styles.thumb}
                  loading="lazy"
                />
                <div className={styles.rowBody}>
                  <FormField
                    label="Texto alternativo"
                    error={altError ?? urlError}
                    hint="Describe la imagen para accesibilidad y SEO."
                  >
                    <Input
                      type="text"
                      autoComplete="off"
                      maxLength={160}
                      {...register(`images.${index}.alt`)}
                    />
                  </FormField>
                </div>
                <div className={styles.rowControls}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => move(index, index - 1)}
                    disabled={isFirst}
                    aria-label="Mover arriba"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => move(index, index + 1)}
                    disabled={isLast}
                    aria-label="Mover abajo"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                    onClick={() => handleRemove(index)}
                    aria-label="Quitar imagen"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
