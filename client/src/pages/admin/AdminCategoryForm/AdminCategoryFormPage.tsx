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
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { applyServerFieldError } from "@/lib/serverFieldErrors";
import { slugify } from "@/lib/slug";
import type { AdminCategory } from "@/lib/types";
import {
  createCategory,
  getCategory,
  updateCategory,
} from "@/services/api/admin";
import { categoryFormSchema, type CategoryFormValues } from "./schema.js";
import styles from "./AdminCategoryFormPage.module.scss";

export function AdminCategoryFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const mode: "create" | "edit" = editId ? "edit" : "create";
  const navigate = useNavigate();
  const slugDirtyRef = useRef(false);
  const loadIdRef = useRef<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(mode === "create");

  const formMethods = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "", slug: "", active: true },
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
      const category: AdminCategory = await getCategory(requestedId);
      if (loadIdRef.current !== requestedId) return;
      // Reset dirty tracker on load so renaming auto-derives the slug.
      slugDirtyRef.current = false;
      reset({
        name: category.name,
        slug: category.slug,
        active: category.active,
      });
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

  const { submit, submitError } = useFormSubmit<CategoryFormValues>(
    async (values) => {
      const payload = {
        name: values.name,
        slug: values.slug,
        active: values.active,
      };
      try {
        if (editId) {
          await updateCategory(editId, payload);
        } else {
          await createCategory(payload);
        }
      } catch (err) {
        const handled = applyServerFieldError<CategoryFormValues>(
          err,
          {
            SLUG_CONFLICT: { field: "slug" },
            NAME_CONFLICT: { field: "name" },
          },
          { setError, setFocus },
        );
        if (handled) return;
        throw err;
      }
      navigate("/admin/categorias");
    },
  );

  const onSubmit = handleSubmit(submit);

  const heading = mode === "edit" ? "Editar categoría" : "Nueva categoría";
  const lede =
    mode === "edit"
      ? "Actualiza el nombre o slug de la categoría."
      : "Crea una categoría para agrupar productos y filtrar diseños.";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear categoría";
  const submittingLabel = mode === "edit" ? "Guardando…" : "Creando…";

  if (mode === "edit" && loadError) {
    return (
      <PageSection
        title={heading}
        width="narrow"
        prefix={<PhaseFlowHint current="categorias" />}
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
        prefix={<PhaseFlowHint current="categorias" />}
      >
        <PageLoading />
      </PageSection>
    );
  }

  return (
    <PageSection
      title={heading}
      subtitle={lede}
      width="narrow"
      prefix={<PhaseFlowHint current="categorias" />}
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

          <FormField
            label="Slug"
            error={errors.slug?.message}
            hint={
              mode === "edit"
                ? "Cambiar el slug puede romper enlaces antiguos a la categoría."
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

          {mode === "edit" ? (
            <label className={styles.activeRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                {...register("active")}
              />
              <span className={styles.activeText}>
                <span className={styles.activeLabel}>Categoría activa</span>
                <span className={styles.activeHint}>
                  Si está apagada, la categoría no aparece en el selector del
                  formulario de productos.
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
            <Link to="/admin/categorias" className={styles.cancelLink}>
              Cancelar
            </Link>
          </div>
        </form>
      </FormProvider>
    </PageSection>
  );
}
