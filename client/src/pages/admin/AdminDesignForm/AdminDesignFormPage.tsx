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
import type { AdminDesign, VariantKind } from "@/lib/types";
import {
  createDesign,
  getDesign,
  updateDesign,
} from "@/services/api/admin";
import { ApiError } from "@/services/api/fetchJson";
import {
  deleteUploadedImages,
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

function describeUploadError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "FILE_TOO_LARGE":
        return "La imagen es demasiado grande (máx 10 MB)";
      case "UNSUPPORTED_MEDIA_TYPE":
        return "No es una imagen válida";
      case "INVALID_IMAGE":
        return "No se pudo procesar la imagen";
      default:
        return err.message;
    }
  }
  return "Error de red al subir la imagen";
}

export function AdminDesignFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const mode: "create" | "edit" = editId ? "edit" : "create";
  const navigate = useNavigate();
  const loadIdRef = useRef<string | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(mode === "create");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const formMethods = useForm<DesignFormValues>({
    resolver: zodResolver(designFormSchema),
    defaultValues: {
      name: "",
      imageUrl: "",
      active: true,
      compatibleKinds: [],
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

  const load = useCallback(async () => {
    if (!editId) return;
    const requestedId = editId;
    loadIdRef.current = requestedId;
    setLoadError(null);
    setLoaded(false);
    try {
      const design: AdminDesign = await getDesign(requestedId);
      if (loadIdRef.current !== requestedId) return;
      reset({
        name: design.name,
        imageUrl: design.imageUrl,
        active: design.active,
        compatibleKinds: design.compatibleKinds,
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const imageUrl = watch("imageUrl");
  const compatibleKinds = watch("compatibleKinds") ?? [];

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

  const heading = mode === "edit" ? "Editar diseño" : "Nuevo diseño";
  const lede =
    mode === "edit"
      ? "Actualiza la imagen, el nombre y las variantes compatibles del diseño."
      : "Crea un diseño global. Después podrás asignarlo a uno o más productos.";
  const submitLabel = mode === "edit" ? "Guardar cambios" : "Crear diseño";
  const submittingLabel = mode === "edit" ? "Guardando…" : "Creando…";

  const displayImage = previewUrl ?? (imageUrl && !imageUrl.startsWith(PENDING_URL_PREFIX) ? imageUrl : null);

  return (
    <section className={styles.wrapper}>
      <PhaseFlowHint current="disenos" />
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
            <label className={styles.activeRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                {...register("active")}
              />
              <span className={styles.activeText}>
                <span className={styles.activeLabel}>Diseño activo</span>
                <span className={styles.activeHint}>
                  Si está apagado, el diseño no aparece en el selector de los
                  productos.
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
            <Link to="/admin/disenos" className={styles.cancelLink}>
              Cancelar
            </Link>
          </div>
        </form>
      </FormProvider>
    </section>
  );
}
