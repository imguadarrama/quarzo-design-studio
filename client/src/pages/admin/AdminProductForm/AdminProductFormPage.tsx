import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import { PageError, PageLoading } from "@/components/PageState/PageState";
import { PageSection } from "@/components/PageSection/PageSection";
import { PhaseFlowHint } from "@/components/PhaseFlowHint/PhaseFlowHint";
import { Textarea } from "@/components/Textarea/Textarea";
import {
  createProduct,
  fetchAdminProduct,
  listCategories,
  updateProduct,
} from "@/services/api/admin";
import { ApiError } from "@/services/api/fetchJson";
import { deleteUploadedImages, uploadImage } from "@/services/api/uploadImage";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { applyServerFieldError } from "@/lib/serverFieldErrors";
import type { AdminCategory, AdminProduct } from "@/lib/types";
import { ProductDesignsSelector } from "./components/ProductDesignsSelector.js";
import { ProductImageEditor } from "./components/ProductImageEditor.js";
import { ProductVariantEditor } from "./components/ProductVariantEditor.js";
import {
  emptyVariantPrices,
  formValuesToPayload,
  productToFormValues,
} from "./mappers.js";
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
  const originalSlugRef = useRef<string | null>(null);
  const loadIdRef = useRef<string | null>(null);
  const pendingImages = usePendingImages();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(mode === "create");
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  const formMethods = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      categoryId: "",
      description: "",
      active: true,
      images: [],
      variants: emptyVariantPrices(),
      designIds: [],
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
      const product: AdminProduct = await fetchAdminProduct(requestedId);
      if (loadIdRef.current !== requestedId) return;
      originalSlugRef.current = product.slug;
      // Reset slug-dirty tracker on load so renaming the product in edit mode
      // auto-derives the slug (matching create-mode behavior). Admin can still
      // override the slug manually — first manual edit re-arms slugDirtyRef.
      slugDirtyRef.current = false;
      reset(productToFormValues(product));
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

  useEffect(() => {
    let cancelled = false;
    listCategories()
      .then((cats) => {
        if (cancelled) return;
        setCategories(cats);
      })
      .catch((err) => {
        if (cancelled) return;
        setCategoriesError(
          err instanceof Error ? err.message : "Error al cargar categorías",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const slugRegistration = register("slug");
  const name = watch("name");
  const currentSlug = watch("slug");
  const currentCategoryId = watch("categoryId");

  useEffect(() => {
    if (!slugDirtyRef.current) {
      setValue("slug", slugify(name), { shouldValidate: false });
    }
  }, [name, setValue]);

  const { submit, submitError } = useFormSubmit<ProductFormValues>(
    async (values) => {
      const imageUploads = await Promise.allSettled(
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

      const resolvedImages: ProductFormImage[] = [];
      const failures: string[] = [];
      const newlyUploadedUrls: string[] = [];

      imageUploads.forEach((result, i) => {
        const original = values.images[i]!;
        if (result.status === "fulfilled") {
          resolvedImages.push(result.value);
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

      const payload = formValuesToPayload({
        ...values,
        images: resolvedImages,
      });
      try {
        if (editId) {
          await updateProduct(editId, payload);
        } else {
          await createProduct(payload);
        }
      } catch (err) {
        if (newlyUploadedUrls.length > 0) {
          void deleteUploadedImages(newlyUploadedUrls);
        }
        const handled = applyServerFieldError<ProductFormValues>(
          err,
          {
            SLUG_CONFLICT: { field: "slug" },
            SLUG_ALIAS_CONFLICT: { field: "slug" },
          },
          { setError, setFocus },
        );
        if (handled) return;
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

  const heading = mode === "edit" ? "Editar producto" : "Nuevo producto";
  const lede =
    mode === "edit"
      ? "Actualiza los datos, imágenes, precios y diseños del producto."
      : "Crea el producto con sus imágenes, precios por variante y diseños disponibles.";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear producto";
  const submittingLabel = mode === "edit" ? "Guardando…" : "Creando…";

  if (mode === "edit" && loadError) {
    return (
      <PageSection
        title={heading}
        width="narrow"
        prefix={<PhaseFlowHint current="productos" />}
      >
        <PageError message={loadError} onRetry={load} />
      </PageSection>
    );
  }

  if (mode === "edit" && !loaded) {
    return (
      <PageSection
        title={heading}
        width="narrow"
        prefix={<PhaseFlowHint current="productos" />}
      >
        <PageLoading />
      </PageSection>
    );
  }

  const variantsRootError =
    typeof errors.variants?.message === "string"
      ? errors.variants.message
      : undefined;
  const imagesRootError =
    typeof errors.images?.message === "string"
      ? errors.images.message
      : undefined;

  const slugChanged =
    mode === "edit" &&
    originalSlugRef.current !== null &&
    currentSlug !== originalSlugRef.current;

  const slugHint = slugChanged
    ? "El slug cambió. Los enlaces antiguos al producto seguirán funcionando vía redirección, pero la URL canónica será la nueva."
    : mode === "edit"
      ? "Cambiar el slug rompe enlaces antiguos al producto (se conservan vía redirección)."
      : "Se genera automáticamente desde el nombre. Edítalo si quieres otro.";

  return (
    <PageSection
      title={heading}
      subtitle={lede}
      width="narrow"
      prefix={<PhaseFlowHint current="productos" />}
    >
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

          <FormField label="Slug" error={errors.slug?.message} hint={slugHint}>
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

          <FormField
            label="Categoría"
            error={errors.categoryId?.message ?? categoriesError ?? undefined}
            hint={
              categories && categories.length === 0
                ? "Crea una categoría primero en /admin/categorias."
                : undefined
            }
          >
            <select
              className={styles.select}
              {...register("categoryId")}
              disabled={!categories || categories.length === 0}
            >
              <option value="">Selecciona una categoría…</option>
              {categories?.filter((c) => c.active).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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

          <ProductDesignsSelector categoryId={currentCategoryId || null} />

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
    </PageSection>
  );
}
