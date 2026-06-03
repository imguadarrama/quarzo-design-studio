import { useRef } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ActiveToggle } from "@/components/ActiveToggle/ActiveToggle";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { FormPageState } from "@/components/FormPageState";
import { Input } from "@/components/Input/Input";
import { PageSection } from "@/components/PageSection/PageSection";
import { PhaseFlowHint } from "@/components/PhaseFlowHint/PhaseFlowHint";
import { Textarea } from "@/components/Textarea/Textarea";
import { useAdminEditResource } from "@/hooks/useAdminEditResource";
import { useCategories } from "@/hooks/useCategories";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { useSlugSync } from "@/hooks/useSlugSync";
import { applyServerFieldError } from "@/lib/serverFieldErrors";
import type { AdminProduct } from "@/lib/types";
import {
  createProduct,
  fetchAdminProduct,
  updateProduct,
} from "@/services/api/admin";
import { deleteUploadedImages } from "@/services/api/uploadImage";
import { ProductDesignsSelector } from "./components/ProductDesignsSelector.js";
import { ProductImageEditor } from "./components/ProductImageEditor.js";
import { ProductVariantEditor } from "./components/ProductVariantEditor.js";
import {
  emptyVariantPrices,
  formValuesToPayload,
  productToFormValues,
} from "./mappers.js";
import {
  resolvePendingUploads,
  usePendingImages,
} from "./pending-images.js";
import { productFormSchema, type ProductFormValues } from "./schema.js";
import styles from "./AdminProductFormPage.module.scss";

export function AdminProductFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const originalSlugRef = useRef<string | null>(null);
  const pendingImages = usePendingImages();
  const { categories, categoriesError } = useCategories();

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

  const slugDirtyRef = useSlugSync(watch("name"), (slug) =>
    setValue("slug", slug, { shouldValidate: false }),
  );

  const { mode, loaded, loadError, load } = useAdminEditResource<AdminProduct>(
    editId,
    fetchAdminProduct,
    (product) => {
      originalSlugRef.current = product.slug;
      // Re-arm auto-derivation so renaming the product re-derives the slug.
      // Admin can still override manually — first edit re-arms slugDirtyRef.
      slugDirtyRef.current = false;
      reset(productToFormValues(product));
    },
  );

  const slugRegistration = register("slug");
  const currentSlug = watch("slug");
  const currentCategoryId = watch("categoryId");

  const { submit, submitError } = useFormSubmit<ProductFormValues>(
    async (values) => {
      const { resolved, newlyUploadedUrls } = await resolvePendingUploads(
        values.images,
        {
          pendingImages,
          getUrl: (img) => img.url,
          withUrl: (img, url) => ({ url, alt: img.alt }),
          fallbackName: "imagen",
          failureLabel: "imágenes",
        },
      );

      const payload = formValuesToPayload({ ...values, images: resolved });
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
    <FormPageState
      mode={mode}
      loaded={loaded}
      loadError={loadError}
      onRetry={load}
      title={heading}
      prefix={<PhaseFlowHint current="productos" />}
    >
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
              <ActiveToggle
                label="Activo en el catálogo"
                hint="Si está apagado, el producto se oculta del catálogo público."
                {...register("active")}
              />
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
    </FormPageState>
  );
}
