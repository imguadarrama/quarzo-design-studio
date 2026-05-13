import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import { PageError, PageLoading } from "@/components/PageState/PageState";
import { PhaseFlowHint } from "@/components/PhaseFlowHint/PhaseFlowHint";
import { Typography } from "@/components/Typography/Typography";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { slugify } from "@/lib/slug";
import type { AdminCategory } from "@/lib/types";
import {
  createCategory,
  getCategory,
  updateCategory,
} from "@/services/api/admin";
import { ApiError } from "@/services/api/fetchJson";
import { categoryFormSchema, type CategoryFormValues } from "./schema.js";
import styles from "./AdminCategoryFormPage.module.scss";

const SLUG_CONFLICT_MESSAGE = "Ese slug o nombre ya existe";

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
        if (err instanceof ApiError && err.code === "SLUG_CONFLICT") {
          setError("slug", { type: "server", message: SLUG_CONFLICT_MESSAGE });
          return;
        }
        throw err;
      }
      navigate("/admin/categorias");
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

  const heading = mode === "edit" ? "Editar categoría" : "Nueva categoría";
  const lede =
    mode === "edit"
      ? "Actualiza el nombre o slug de la categoría."
      : "Crea una categoría para agrupar productos y filtrar diseños.";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear categoría";
  const submittingLabel = mode === "edit" ? "Guardando…" : "Creando…";

  return (
    <section className={styles.wrapper}>
      <PhaseFlowHint current="categorias" />
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
    </section>
  );
}
