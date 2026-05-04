import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../components/Button/Button.js";
import { FormField } from "../../../components/FormField/FormField.js";
import { Input } from "../../../components/Input/Input.js";
import {
  PageError,
  PageLoading,
} from "../../../components/PageState/PageState.js";
import { Textarea } from "../../../components/Textarea/Textarea.js";
import { Typography } from "../../../components/Typography/Typography.js";
import {
  createProduct,
  fetchAdminProduct,
  updateProduct,
} from "../../../services/api/admin.js";
import { ApiError } from "../../../services/api/fetchJson.js";
import { useFormSubmit } from "../../../hooks/useFormSubmit.js";
import type {
  AdminProduct,
  AdminProductImage,
  AdminProductVariant,
} from "../../../lib/types.js";
import { imageToPayload, variantToPayload } from "./mappers.js";
import {
  productFormSchema,
  slugify,
  type ProductFormValues,
} from "./schema.js";
import styles from "./AdminProductFormPage.module.scss";

const SLUG_CONFLICT_MESSAGE = "Ese slug ya existe";

export function AdminProductFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const mode: "create" | "edit" = editId ? "edit" : "create";
  const navigate = useNavigate();
  const slugDirtyRef = useRef(false);
  const nestedRef = useRef<{
    images: AdminProductImage[];
    variants: AdminProductVariant[];
  }>({ images: [], variants: [] });
  const loadIdRef = useRef<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(mode === "create");

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      category: "",
      description: "",
      active: true,
    },
  });

  const load = useCallback(async () => {
    if (!editId) return;
    const requestedId = editId;
    loadIdRef.current = requestedId;
    setLoadError(null);
    setLoaded(false);
    try {
      const product: AdminProduct = await fetchAdminProduct(requestedId);
      if (loadIdRef.current !== requestedId) return;
      nestedRef.current = {
        images: product.images,
        variants: product.variants,
      };
      reset({
        name: product.name,
        slug: product.slug,
        category: product.category,
        description: product.description,
        active: product.active,
      });
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
      const payload = {
        slug: values.slug,
        name: values.name,
        description: values.description,
        category: values.category,
        active: values.active,
        images: nestedRef.current.images.map(imageToPayload),
        variants: nestedRef.current.variants.map(variantToPayload),
      };
      try {
        if (editId) {
          await updateProduct(editId, payload);
        } else {
          await createProduct(payload);
        }
        navigate("/admin/productos");
      } catch (err) {
        if (err instanceof ApiError && err.code === "SLUG_CONFLICT") {
          setError("slug", { type: "server", message: SLUG_CONFLICT_MESSAGE });
          return;
        }
        throw err;
      }
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
      ? "Actualiza los datos del producto. Las imágenes y variantes se editan en otra sección."
      : "Crea el producto con la información básica. Las imágenes y variantes se agregan después.";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear producto";
  const submittingLabel = mode === "edit" ? "Guardando…" : "Creando…";

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

        {mode === "edit" ? (
          <label className={styles.activeRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              {...register("active")}
            />
            <span className={styles.activeText}>
              <span className={styles.activeLabel}>Activo en el catálogo</span>
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
    </section>
  );
}
