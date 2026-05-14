import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import { PageError, PageLoading } from "@/components/PageState/PageState";
import { Typography } from "@/components/Typography/Typography";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { applyServerFieldError } from "@/lib/serverFieldErrors";
import { slugify } from "@/lib/slug";
import type { AdminOptionPalette } from "@/lib/types";
import {
  createPalette,
  getPalette,
  updatePalette,
} from "@/services/api/admin";
import { ApiError } from "@/services/api/fetchJson";
import {
  deleteUploadedImages,
  uploadImage,
} from "@/services/api/uploadImage";
import { PaletteSwatchEditor } from "./components/PaletteSwatchEditor.js";
import { formValuesToPayload, paletteToFormValues } from "./mappers.js";
import {
  isPendingUrl,
  pendingTempId,
  usePendingImages,
} from "../AdminProductForm/pending-images.js";
import {
  paletteFormSchema,
  type PaletteFormSwatch,
  type PaletteFormValues,
} from "./schema.js";
import styles from "./AdminPaletteFormPage.module.scss";

const SLUG_CONFLICT_MESSAGE = "Ese slug o nombre ya existe";

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

export function AdminPaletteFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const mode: "create" | "edit" = editId ? "edit" : "create";
  const navigate = useNavigate();
  const slugDirtyRef = useRef(false);
  const loadIdRef = useRef<string | null>(null);
  const pendingImages = usePendingImages();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(mode === "create");

  const formMethods = useForm<PaletteFormValues>({
    resolver: zodResolver(paletteFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      active: true,
      swatches: [],
    },
  });
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    setFocus,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = formMethods;

  const load = useCallback(async () => {
    if (!editId) return;
    const requestedId = editId;
    loadIdRef.current = requestedId;
    setLoadError(null);
    setLoaded(false);
    try {
      const palette: AdminOptionPalette = await getPalette(requestedId);
      if (loadIdRef.current !== requestedId) return;
      reset(paletteToFormValues(palette));
      slugDirtyRef.current = true;
      setLoaded(true);
    } catch (err) {
      if (loadIdRef.current !== requestedId) return;
      setLoadError(err instanceof Error ? err.message : "Error desconocido");
    }
  }, [editId, reset]);

  useEffect(() => {
    if (mode === "edit") {
      void load();
    }
  }, [mode, load]);

  const slugRegistration = register("slug");
  const name = watch("name");

  useEffect(() => {
    if (!slugDirtyRef.current) {
      setValue("slug", slugify(name), { shouldValidate: false });
    }
  }, [name, setValue]);

  const { submit, submitError } = useFormSubmit<PaletteFormValues>(
    async (values) => {
      const uploads = await Promise.allSettled(
        values.swatches.map(async (sw): Promise<PaletteFormSwatch> => {
          if (!isPendingUrl(sw.imageUrl)) return sw;
          const entry = pendingImages.get(pendingTempId(sw.imageUrl));
          if (!entry) {
            throw new Error("Pending swatch entry not found");
          }
          const { url } = await uploadImage(entry.file, { prefix: "swatches" });
          return { ...sw, imageUrl: url };
        }),
      );

      const resolved: PaletteFormSwatch[] = [];
      const failures: string[] = [];
      const newlyUploadedUrls: string[] = [];
      uploads.forEach((result, i) => {
        const original = values.swatches[i]!;
        if (result.status === "fulfilled") {
          resolved.push(result.value);
          if (isPendingUrl(original.imageUrl)) {
            newlyUploadedUrls.push(result.value.imageUrl);
          }
        } else {
          const entry = isPendingUrl(original.imageUrl)
            ? pendingImages.get(pendingTempId(original.imageUrl))
            : undefined;
          const fallbackName = entry?.file.name ?? "muestra";
          failures.push(
            describeUploadError(
              entry?.file ?? new File([], fallbackName),
              result.reason,
            ),
          );
        }
      });

      if (failures.length > 0) {
        if (newlyUploadedUrls.length > 0) {
          void deleteUploadedImages(newlyUploadedUrls);
        }
        throw new Error(
          `No pudimos subir algunas muestras: ${failures.join(", ")}`,
        );
      }

      const payload = formValuesToPayload({ ...values, swatches: resolved });
      try {
        if (editId) {
          await updatePalette(editId, payload);
        } else {
          await createPalette(payload);
        }
      } catch (err) {
        if (newlyUploadedUrls.length > 0) {
          void deleteUploadedImages(newlyUploadedUrls);
        }
        const handled = applyServerFieldError<PaletteFormValues>(
          err,
          { SLUG_CONFLICT: { field: "slug", message: SLUG_CONFLICT_MESSAGE } },
          { setError, setFocus },
        );
        if (handled) return;
        throw err;
      }

      pendingImages.forEach(({ previewUrl }) =>
        URL.revokeObjectURL(previewUrl),
      );
      pendingImages.clear();
      navigate("/admin/paletas");
    },
  );

  const onSubmit = handleSubmit(submit);

  if (mode === "edit" && loadError) {
    return (
      <section className={styles.wrapper}>
        <PageError message={loadError} onRetry={load} />
      </section>
    );
  }

  if (mode === "edit" && !loaded) {
    return (
      <section className={styles.wrapper}>
        <PageLoading />
      </section>
    );
  }

  const heading = mode === "edit" ? "Editar paleta" : "Nueva paleta";
  const lede =
    mode === "edit"
      ? "Actualiza el nombre, las muestras y la disponibilidad de la paleta."
      : "Crea una paleta global de imágenes para usar en opciones SWATCH.";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear paleta";
  const submittingLabel = mode === "edit" ? "Guardando…" : "Creando…";

  const swatchesRootError =
    typeof errors.swatches?.message === "string"
      ? errors.swatches.message
      : undefined;

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <Typography as="h1" size="xxl" className={styles.title}>
          {heading}
        </Typography>
        <Typography as="p" className={styles.lede}>
          {lede}
        </Typography>
      </header>

      <FormProvider {...formMethods}>
        <form onSubmit={onSubmit} noValidate className={styles.form}>
          <FormField label="Nombre" error={errors.name?.message}>
            <Input
              type="text"
              autoComplete="off"
              maxLength={120}
              {...register("name")}
            />
          </FormField>

          <FormField
            label="Slug"
            error={errors.slug?.message}
            hint={
              mode === "edit"
                ? "Cambiar el slug puede romper enlaces antiguos a la paleta."
                : "Se genera automáticamente desde el nombre. Edítalo si quieres otro."
            }
          >
            <Input
              type="text"
              autoComplete="off"
              maxLength={120}
              {...slugRegistration}
              onChange={(event) => {
                slugDirtyRef.current = true;
                void slugRegistration.onChange(event);
              }}
            />
          </FormField>

          <PaletteSwatchEditor
            pendingImages={pendingImages}
            fieldErrors={errors.swatches}
            rootError={swatchesRootError}
          />

          {mode === "edit" ? (
            <label className={styles.activeRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                {...register("active")}
              />
              <span className={styles.activeText}>
                <span className={styles.activeLabel}>Paleta activa</span>
                <span className={styles.activeHint}>
                  Si está apagada, la paleta no aparece en el selector de
                  opciones SWATCH de los productos.
                </span>
              </span>
            </label>
          ) : null}

          {submitError ? (
            <div role="alert" className={styles.formError}>
              {submitError}
            </div>
          ) : null}

          <div className={styles.actions}>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
            <Link to="/admin/paletas" className={styles.cancelLink}>
              Cancelar
            </Link>
          </div>
        </form>
      </FormProvider>
    </section>
  );
}
