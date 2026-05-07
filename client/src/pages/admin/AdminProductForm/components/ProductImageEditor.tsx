import { useRef, useState } from "react";
import {
  useFieldArray,
  useFormContext,
  type FieldErrors,
} from "react-hook-form";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import { ApiError } from "@/services/api/fetchJson";
import { uploadImage } from "@/services/api/uploadImage";
import type { ProductFormValues } from "../schema.js";
import styles from "./ProductImageEditor.module.scss";

const MAX_IMAGES = 8;

type Props = {
  fieldErrors?: FieldErrors<ProductFormValues>["images"];
  rootError?: string;
};

function describeUploadError(file: File, err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "FILE_TOO_LARGE":
        return `${file.name}: demasiado grande (máx 10 MB)`;
      case "UNSUPPORTED_MEDIA_TYPE":
        return `${file.name}: no es una imagen válida`;
      case "INVALID_IMAGE":
        return `${file.name}: no se pudo procesar`;
      default:
        return `${file.name}: ${err.message}`;
    }
  }
  return `${file.name}: error de red`;
}

export function ProductImageEditor({ fieldErrors, rootError }: Props) {
  const { control, register } = useFormContext<ProductFormValues>();
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "images",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const atCap = fields.length >= MAX_IMAGES;

  const handlePick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPickerError(null);
    const remaining = MAX_IMAGES - fields.length;
    const accepted = Array.from(files).slice(0, remaining);
    const failures: string[] = [];
    setUploading(true);
    try {
      for (const file of accepted) {
        try {
          const { url } = await uploadImage(file);
          append({ url, alt: "" });
        } catch (err) {
          failures.push(describeUploadError(file, err));
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    if (failures.length > 0) {
      setPickerError(`No se pudieron agregar: ${failures.join("; ")}`);
    }
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
        onChange={(event) => {
          void handlePick(event.target.files);
        }}
      />
      <div className={styles.actions}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={atCap || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? "Subiendo…" : "Agregar imagen"}
        </Button>
      </div>

      {pickerError ? (
        <p role="alert" className={styles.error}>
          {pickerError}
        </p>
      ) : null}

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
                  src={field.url}
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
                    onClick={() => remove(index)}
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
