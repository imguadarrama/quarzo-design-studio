import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ActiveToggle } from "@/components/ActiveToggle/ActiveToggle";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { FormPageState } from "@/components/FormPageState";
import { Input } from "@/components/Input/Input";
import { PageSection } from "@/components/PageSection/PageSection";
import { useAdminEditResource } from "@/hooks/useAdminEditResource";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { useSlugSync } from "@/hooks/useSlugSync";
import { applyServerFieldError } from "@/lib/serverFieldErrors";
import type { AdminOptionPalette } from "@/lib/types";
import {
  createPalette,
  getPalette,
  updatePalette,
} from "@/services/api/admin";
import { deleteUploadedImages } from "@/services/api/uploadImage";
import { PaletteSwatchEditor } from "./components/PaletteSwatchEditor.js";
import { formValuesToPayload, paletteToFormValues } from "./mappers.js";
import {
  resolvePendingUploads,
  usePendingImages,
} from "../AdminProductForm/pending-images.js";
import { paletteFormSchema, type PaletteFormValues } from "./schema.js";
import styles from "./AdminPaletteFormPage.module.scss";

export function AdminPaletteFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pendingImages = usePendingImages();

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

  const slugDirtyRef = useSlugSync(watch("name"), (slug) =>
    setValue("slug", slug, { shouldValidate: false }),
  );

  const { mode, loaded, loadError, load } =
    useAdminEditResource<AdminOptionPalette>(editId, getPalette, (palette) => {
      reset(paletteToFormValues(palette));
      // Freeze the loaded slug — editing an existing palette should not
      // re-derive the slug from the name.
      slugDirtyRef.current = true;
    });

  const slugRegistration = register("slug");

  const { submit, submitError } = useFormSubmit<PaletteFormValues>(
    async (values) => {
      const { resolved, newlyUploadedUrls } = await resolvePendingUploads(
        values.swatches,
        {
          pendingImages,
          getUrl: (sw) => sw.imageUrl,
          withUrl: (sw, url) => ({ ...sw, imageUrl: url }),
          prefix: "swatches",
          fallbackName: "muestra",
          failureLabel: "muestras",
        },
      );

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
          {
            SLUG_CONFLICT: { field: "slug" },
            NAME_CONFLICT: { field: "name" },
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
      navigate("/admin/paletas");
    },
  );

  const onSubmit = handleSubmit(submit);

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
    <FormPageState
      mode={mode}
      loaded={loaded}
      loadError={loadError}
      onRetry={load}
      title={heading}
    >
      <PageSection title={heading} subtitle={lede} width="narrow">
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
              <ActiveToggle
                label="Paleta activa"
                hint="Si está apagada, la paleta no aparece en el selector de opciones SWATCH de los productos."
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
              <Link to="/admin/paletas" className={styles.cancelLink}>
                Cancelar
              </Link>
            </div>
          </form>
        </FormProvider>
      </PageSection>
    </FormPageState>
  );
}
