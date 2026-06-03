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
import { useAdminEditResource } from "@/hooks/useAdminEditResource";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { useSlugSync } from "@/hooks/useSlugSync";
import { applyServerFieldError } from "@/lib/serverFieldErrors";
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
  const navigate = useNavigate();

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

  const slugDirtyRef = useSlugSync(watch("name"), (slug) =>
    setValue("slug", slug, { shouldValidate: false }),
  );

  const { mode, loaded, loadError, load } = useAdminEditResource<AdminCategory>(
    editId,
    getCategory,
    (category) => {
      // Re-arm auto-derivation so renaming the category re-derives the slug.
      slugDirtyRef.current = false;
      reset({
        name: category.name,
        slug: category.slug,
        active: category.active,
      });
    },
  );

  const slugRegistration = register("slug");

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

  return (
    <FormPageState
      mode={mode}
      loaded={loaded}
      loadError={loadError}
      onRetry={load}
      title={heading}
      prefix={<PhaseFlowHint current="categorias" />}
    >
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
              <ActiveToggle
                label="Categoría activa"
                hint="Si está apagada, la categoría no aparece en el selector del formulario de productos."
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
              <Link to="/admin/categorias" className={styles.cancelLink}>
                Cancelar
              </Link>
            </div>
          </form>
        </FormProvider>
      </PageSection>
    </FormPageState>
  );
}
