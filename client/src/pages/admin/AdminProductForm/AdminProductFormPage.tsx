import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import { PageError, PageLoading } from "@/components/PageState/PageState";
import { Textarea } from "@/components/Textarea/Textarea";
import { Typography } from "@/components/Typography/Typography";
import {
  createProduct,
  fetchAdminProduct,
  updateProduct,
} from "@/services/api/admin";
import { ApiError } from "@/services/api/fetchJson";
import { deleteUploadedImages, uploadImage } from "@/services/api/uploadImage";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import type { AdminProduct } from "@/lib/types";
import { ProductImageEditor } from "./components/ProductImageEditor.js";
import { ProductVariantEditor } from "./components/ProductVariantEditor.js";
import { formValuesToPayload, productToFormValues } from "./mappers.js";
import {
  isPendingUrl,
  pendingTempId,
  usePendingImages,
} from "./pending-images.js";
import {
  productFormSchema,
  slugify,
  type ProductFormImage,
  type ProductFormValues,
} from "./schema.js";
import styles from "./AdminProductFormPage.module.scss";

const SLUG_CONFLICT_MESSAGE = "Ese slug ya existe";

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

export function AdminProductFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const mode: "create" | "edit" = editId ? "edit" : "create";
  const navigate = useNavigate();
  const slugDirtyRef = useRef(false);
  const loadIdRef = useRef<string | null>(null);
  const pendingImages = usePendingImages();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(mode === "create");

  const formMethods = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      category: "",
      description: "",
      active: true,
      images: [],
      variants: [],
    },
  });
  const {
    register,
    handleSubmit,
    setValue,
    setError,
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
      const product: AdminProduct = await fetchAdminProduct(requestedId);
      if (loadIdRef.current !== requestedId) return;
      reset(productToFormValues(product));
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

  const { submit, submitError } = useFormSubmit<ProductFormValues>(
    async (values) => {
      const uploads = await Promise.allSettled(
        values.images.map(async (img): Promise<ProductFormImage> => {
          if (!isPendingUrl(img.url)) return img;
          const entry = pendingImages.get(pendingTempId(img.url));
          if (!entry) {
            throw new Error("Pending image entry not found");
          }
          const { url } = await uploadImage(entry.file);
          return { url, alt: img.alt };
        }),
      );

      const resolved: ProductFormImage[] = [];
      const failures: string[] = [];
      const newlyUploadedUrls: string[] = [];
      uploads.forEach((result, i) => {
        const original = values.images[i]!;
        if (result.status === "fulfilled") {
          resolved.push(result.value);
          if (isPendingUrl(original.url)) {
            newlyUploadedUrls.push(result.value.url);
          }
        } else {
          const entry = isPendingUrl(original.url)
            ? pendingImages.get(pendingTempId(original.url))
            : undefined;
          const fallbackName = entry?.file.name ?? "imagen";
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
          `No pudimos subir algunas imágenes: ${failures.join(", ")}`,
        );
      }

      const payload = formValuesToPayload({ ...values, images: resolved });
      try {
        if (editId) {
          await updateProduct(editId, payload);
        } else {
          await createProduct(payload);
        }
      } catch (err) {
        if (err instanceof ApiError && err.code === "SLUG_CONFLICT") {
          if (newlyUploadedUrls.length > 0) {
            void deleteUploadedImages(newlyUploadedUrls);
          }
          setError("slug", { type: "server", message: SLUG_CONFLICT_MESSAGE });
          return;
        }
        if (newlyUploadedUrls.length > 0) {
          void deleteUploadedImages(newlyUploadedUrls);
        }
        throw err;
      }

      pendingImages.forEach(({ previewUrl }) =>
        URL.revokeObjectURL(previewUrl),
      );
      pendingImages.clear();
      navigate("/admin/productos");
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

  const heading = mode === "edit" ? "Editar producto" : "Nuevo producto";
  const lede =
    mode === "edit"
      ? "Actualiza los datos, imágenes y variantes del producto."
      : "Crea el producto con sus imágenes y variantes en una sola pantalla.";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear producto";
  const submittingLabel = mode === "edit" ? "Guardando…" : "Creando…";

  const variantsRootError =
    typeof errors.variants?.message === "string"
      ? errors.variants.message
      : undefined;
  const imagesRootError =
    typeof errors.images?.message === "string"
      ? errors.images.message
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
                ? "Cambiar el slug rompe enlaces antiguos al producto."
                : "Se genera automáticamente desde el nombre. Edítalo si quieres otro."
            }
          >
            <Input
              type="text"
              autoComplete="off"
              maxLength={80}
              {...slugRegistration}
              onChange={(event) => {
                slugDirtyRef.current = true;
                void slugRegistration.onChange(event);
              }}
            />
          </FormField>

          <FormField label="Categoría" error={errors.category?.message}>
            <Input
              type="text"
              autoComplete="off"
              maxLength={80}
              {...register("category")}
            />
          </FormField>

          <FormField label="Descripción" error={errors.description?.message}>
            <Textarea rows={5} maxLength={2000} {...register("description")} />
          </FormField>

          <ProductImageEditor
            pendingImages={pendingImages}
            fieldErrors={errors.images}
            rootError={imagesRootError}
          />

          <ProductVariantEditor
            fieldErrors={errors.variants}
            rootError={variantsRootError}
          />

          {mode === "edit" ? (
            <label className={styles.activeRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                {...register("active")}
              />
              <span className={styles.activeText}>
                <span className={styles.activeLabel}>
                  Activo en el catálogo
                </span>
                <span className={styles.activeHint}>
                  Si está apagado, el producto se oculta del catálogo público.
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
            <Link to="/admin/productos" className={styles.cancelLink}>
              Cancelar
            </Link>
          </div>
        </form>
      </FormProvider>
    </section>
  );
}
