import { useEffect, useState } from "react";
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
import { useCategories } from "@/hooks/useCategories";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import type { AdminDesign, VariantKind } from "@/lib/types";
import { createDesign, getDesign, updateDesign } from "@/services/api/admin";
import {
  deleteUploadedImages,
  describeUploadError,
  uploadImage,
} from "@/services/api/uploadImage";
import { PENDING_URL_PREFIX } from "../AdminProductForm/schema.js";
import { designFormSchema, type DesignFormValues } from "./schema.js";
import styles from "./AdminDesignFormPage.module.scss";

const KIND_OPTIONS: { value: VariantKind; label: string; hint: string }[] = [
  { value: "CON_FOIL", label: "Con foil", hint: "Solo foil." },
  { value: "CON_TINTA_NORMAL", label: "Con tinta normal", hint: "Tinta tradicional." },
  { value: "CON_FOIL_Y_TINTA", label: "Con foil y tinta normal", hint: "Combina foil con tinta." },
  { value: "PAPEL_TEXTURIZADO", label: "Papel texturizado", hint: "Papel con textura especial." },
];

export function AdminDesignFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { categories, categoriesError } = useCategories();

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const formMethods = useForm<DesignFormValues>({
    resolver: zodResolver(designFormSchema),
    defaultValues: {
      name: "",
      imageUrl: "",
      active: true,
      compatibleKinds: [],
      categoryIds: [],
    },
  });
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = formMethods;

  const { mode, loaded, loadError, load } = useAdminEditResource<AdminDesign>(
    editId,
    getDesign,
    (design) => {
      reset({
        name: design.name,
        imageUrl: design.imageUrl,
        active: design.active,
        compatibleKinds: design.compatibleKinds,
        categoryIds: design.categoryIds,
      });
    },
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const imageUrl = watch("imageUrl");
  const compatibleKinds = watch("compatibleKinds") ?? [];
  const categoryIds = watch("categoryIds") ?? [];

  const handleFilePick = (file: File | null) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const preview = URL.createObjectURL(file);
    setPendingFile(file);
    setPreviewUrl(preview);
    setValue("imageUrl", `${PENDING_URL_PREFIX}local`, { shouldValidate: true });
  };

  const toggleKind = (kind: VariantKind) => {
    const next = compatibleKinds.includes(kind)
      ? compatibleKinds.filter((k) => k !== kind)
      : [...compatibleKinds, kind];
    setValue("compatibleKinds", next, { shouldDirty: true, shouldValidate: true });
  };

  const toggleCategory = (id: string) => {
    const next = categoryIds.includes(id)
      ? categoryIds.filter((x) => x !== id)
      : [...categoryIds, id];
    setValue("categoryIds", next, { shouldDirty: true, shouldValidate: true });
  };

  const { submit, submitError } = useFormSubmit<DesignFormValues>(
    async (values) => {
      let finalUrl = values.imageUrl;
      let uploadedUrl: string | null = null;

      if (values.imageUrl.startsWith(PENDING_URL_PREFIX)) {
        if (!pendingFile) {
          throw new Error("Selecciona una imagen para el diseño");
        }
        try {
          const { url } = await uploadImage(pendingFile, { prefix: "designs" });
          finalUrl = url;
          uploadedUrl = url;
        } catch (err) {
          throw new Error(describeUploadError(err));
        }
      }

      try {
        const payload = {
          name: values.name,
          imageUrl: finalUrl,
          active: values.active,
          compatibleKinds: values.compatibleKinds,
          categoryIds: values.categoryIds,
        };
        if (editId) {
          await updateDesign(editId, payload);
        } else {
          await createDesign(payload);
        }
      } catch (err) {
        if (uploadedUrl) {
          void deleteUploadedImages([uploadedUrl]);
        }
        throw err;
      }

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      navigate("/admin/disenos");
    },
  );

  const onSubmit = handleSubmit(submit);

  const heading = mode === "edit" ? "Editar diseño" : "Nuevo diseño";
  const lede =
    mode === "edit"
      ? "Actualiza la imagen, el nombre y las variantes compatibles del diseño."
      : "Crea un diseño global. Después podrás asignarlo a uno o más productos.";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear diseño";
  const submittingLabel = mode === "edit" ? "Guardando…" : "Creando…";

  const displayImage =
    previewUrl ??
    (imageUrl && !imageUrl.startsWith(PENDING_URL_PREFIX) ? imageUrl : null);

  return (
    <FormPageState
      mode={mode}
      loaded={loaded}
      loadError={loadError}
      onRetry={load}
      title={heading}
      prefix={<PhaseFlowHint current="disenos" />}
    >
      <PageSection
        title={heading}
        subtitle={lede}
        width="narrow"
        prefix={<PhaseFlowHint current="disenos" />}
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

            <FormField label="Imagen del diseño" error={errors.imageUrl?.message}>
              <div className={styles.imageRow}>
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt="Vista previa del diseño"
                    className={styles.preview}
                  />
                ) : (
                  <div className={styles.previewEmpty}>Sin imagen</div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className={styles.fileInput}
                  onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                />
              </div>
            </FormField>

            <fieldset className={styles.kindsFieldset}>
              <legend className={styles.kindsLegend}>Categorías</legend>
              <p className={styles.kindsHint}>
                {categoriesError
                  ? `No pudimos cargar las categorías (${categoriesError}).`
                  : "Marca las categorías de productos donde aplica este diseño. Solo se mostrará en productos cuya categoría coincida."}
              </p>
              {!categories ? (
                <p className={styles.kindsHint}>Cargando categorías…</p>
              ) : categories.length === 0 ? (
                <p className={styles.kindsHint}>
                  Aún no hay categorías. Crea una en{" "}
                  <Link to="/admin/categorias" className={styles.cancelLink}>
                    /admin/categorías
                  </Link>
                  .
                </p>
              ) : (
                <ul className={styles.kindsList}>
                  {categories
                    .filter((c) => c.active)
                    .map((c) => {
                      const checked = categoryIds.includes(c.id);
                      return (
                        <li key={c.id} className={styles.kindItem}>
                          <label className={styles.kindLabel}>
                            <input
                              type="checkbox"
                              className={styles.checkbox}
                              checked={checked}
                              onChange={() => toggleCategory(c.id)}
                            />
                            <span>
                              <span className={styles.kindName}>{c.name}</span>
                              <span className={styles.kindHintInline}>/{c.slug}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                </ul>
              )}
            </fieldset>

            <fieldset className={styles.kindsFieldset}>
              <legend className={styles.kindsLegend}>Variantes compatibles</legend>
              <p className={styles.kindsHint}>
                Marca las variantes en las que se puede usar este diseño. Si no
                marcas ninguna, no aparecerá en ningún producto.
              </p>
              <ul className={styles.kindsList}>
                {KIND_OPTIONS.map((opt) => {
                  const checked = compatibleKinds.includes(opt.value);
                  return (
                    <li key={opt.value} className={styles.kindItem}>
                      <label className={styles.kindLabel}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={checked}
                          onChange={() => toggleKind(opt.value)}
                        />
                        <span>
                          <span className={styles.kindName}>{opt.label}</span>
                          <span className={styles.kindHintInline}>{opt.hint}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            {mode === "edit" ? (
              <ActiveToggle
                label="Diseño activo"
                hint="Si está apagado, el diseño no aparece en el selector de los productos."
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
              <Link to="/admin/disenos" className={styles.cancelLink}>
                Cancelar
              </Link>
            </div>
          </form>
        </FormProvider>
      </PageSection>
    </FormPageState>
  );
}
