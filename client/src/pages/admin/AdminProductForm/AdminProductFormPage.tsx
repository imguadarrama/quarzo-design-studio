import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/Button/Button.js";
import { FormField } from "../../../components/FormField/FormField.js";
import { Input } from "../../../components/Input/Input.js";
import { Textarea } from "../../../components/Textarea/Textarea.js";
import { Typography } from "../../../components/Typography/Typography.js";
import { createProduct } from "../../../services/api/admin.js";
import {
  productFormSchema,
  slugify,
  type ProductFormValues,
} from "./schema.js";
import styles from "./AdminProductFormPage.module.scss";

export function AdminProductFormPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const slugDirtyRef = useRef(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      category: "",
      description: "",
      active: false,
    },
  });

  const slugRegistration = register("slug");
  const name = watch("name");

  useEffect(() => {
    if (!slugDirtyRef.current) {
      setValue("slug", slugify(name), { shouldValidate: false });
    }
  }, [name, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await createProduct({
        slug: values.slug,
        name: values.name,
        description: values.description,
        category: values.category,
        active: values.active,
        images: [],
        variants: [],
      });
      navigate("/admin/productos");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ocurrió un error inesperado";
      setSubmitError(message);
    }
  });

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <Typography as="h1" size="xxl" className={styles.title}>
          Nuevo producto
        </Typography>
        <Typography as="p" className={styles.lede}>
          Crea un borrador con la información básica. Las imágenes y variantes
          se agregan después.
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
          hint="Se genera automáticamente desde el nombre. Edítalo si quieres otro."
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

        <label className={styles.activeRow}>
          <input
            type="checkbox"
            className={styles.checkbox}
            {...register("active")}
          />
          <span className={styles.activeText}>
            <span className={styles.activeLabel}>Publicar al guardar</span>
            <span className={styles.activeHint}>
              Si está apagado, el producto queda como borrador (oculto del
              catálogo).
            </span>
            {errors.active?.message ? (
              <span className={styles.activeError} role="alert">
                {errors.active.message}
              </span>
            ) : null}
          </span>
        </label>

        {submitError ? (
          <div role="alert" className={styles.formError}>
            {submitError}
          </div>
        ) : null}

        <div className={styles.actions}>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando…" : "Crear producto"}
          </Button>
          <Link to="/admin/productos" className={styles.cancelLink}>
            Cancelar
          </Link>
        </div>
      </form>
    </section>
  );
}
