import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "react-router-dom";
import { AsyncContent } from "@/components/AsyncContent/AsyncContent";
import { Button } from "@/components/Button/Button";
import { FormField } from "@/components/FormField/FormField";
import { Input } from "@/components/Input/Input";
import { PageSection } from "@/components/PageSection/PageSection";
import { fetchProductBySlug } from "@/services/api/products";
import type { Design, Product, VariantKind } from "@/lib/types";
import { formatMxn } from "@/lib/format";
import {
  VARIANT_KIND_LABELS,
  VARIANT_KIND_ORDER,
  isFoilKind,
  isSelectableVariant,
} from "@/lib/variant-kinds";
import { useCartStore } from "@/store/cart";
import { DesignPicker } from "./components/DesignPicker";
import { DesignPreview } from "./components/DesignPreview";
import { FoilSwatchPicker } from "./components/FoilSwatchPicker";
import { QuantityInput } from "./components/QuantityInput";
import { VariantKindSelector } from "./components/VariantKindSelector";
import { pickerSchema, type PickerValues } from "./schema";
import styles from "./ProductDetailPage.module.scss";

function firstCompatibleKind(
  product: Product,
  designId: string,
): VariantKind | null {
  const design = product.designs.find((d) => d.id === designId);
  if (!design) return null;
  const selectableByKind = new Map(
    product.variants
      .filter(isSelectableVariant)
      .map((v) => [v.kind, v] as const),
  );
  const compatSet = new Set(design.compatibleKinds);
  for (const kind of VARIANT_KIND_ORDER) {
    if (selectableByKind.has(kind) && compatSet.has(kind)) return kind;
  }
  return null;
}

function buildDefaults(product: Product): PickerValues {
  const firstDesign = product.designs[0];
  const designId = firstDesign?.id ?? "";
  const initialKind = designId
    ? firstCompatibleKind(product, designId)
    : (product.variants[0]?.kind ?? null);
  return {
    designId,
    variantKind: initialKind ?? "CON_TINTA_NORMAL",
    foilSwatchId: null,
    personalizationText: "",
    quantity: 1,
  };
}

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!slug) return;
    setError(null);
    setProduct(null);
    fetchProductBySlug(slug)
      .then(setProduct)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error desconocido");
      });
  }, [slug]);

  useEffect(() => {
    // Skip refetch when the slug changed because we just navigate-replaced
    // to the canonical slug — the product we already have is still correct.
    if (product && slug && product.slug === slug) return;
    load();
  }, [load, product, slug]);

  useEffect(() => {
    if (product && slug && product.slug !== slug) {
      navigate(`/producto/${product.slug}`, { replace: true });
    }
  }, [product, slug, navigate]);

  return (
    <AsyncContent data={product} error={error} onRetry={load}>
      {(p) => <ProductDetailBody product={p} />}
    </AsyncContent>
  );
}

interface ProductDetailBodyProps {
  product: Product;
}

function ProductDetailBody({ product }: ProductDetailBodyProps) {
  const isUnavailable =
    product.variants.length === 0 || product.designs.length === 0;

  const navigate = useNavigate();
  const addLine = useCartStore((s) => s.addLine);

  const defaults = useMemo(() => buildDefaults(product), [product]);

  const {
    control,
    register,
    watch,
    setValue,
    formState: { errors },
    trigger,
    handleSubmit,
    reset,
  } = useForm<PickerValues>({
    resolver: zodResolver(pickerSchema),
    defaultValues: defaults,
    mode: "onChange",
  });

  const handleAddToCart = (values: PickerValues) => {
    const variant = product.variants.find((v) => v.kind === values.variantKind);
    const design = product.designs.find((d) => d.id === values.designId);
    // The form's isValid gate guarantees both exist; bail loudly rather than
    // letting a $0 / blank line slip into the cart if that invariant breaks.
    if (!variant || !design) return;

    const foilColorName =
      values.foilSwatchId !== null
        ? (variant.palette?.swatches.find((s) => s.id === values.foilSwatchId)
            ?.name ?? null)
        : null;

    addLine({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      productImageUrl: product.images[0]?.url ?? "",
      variantKind: values.variantKind,
      variantName: VARIANT_KIND_LABELS[values.variantKind],
      unitPrice: variant.price,
      quantity: values.quantity,
      designId: values.designId,
      designName: design.name,
      designImageUrl: design.imageUrl ?? "",
      foilSwatchId: values.foilSwatchId,
      foilColorName,
      personalizationText: values.personalizationText.trim(),
    });

    reset(buildDefaults(product));
    navigate("/carrito");
  };

  useEffect(() => {
    void trigger();
  }, [trigger]);

  const selectedDesignId = watch("designId");
  const selectedVariantKind = watch("variantKind");

  const selectedDesign: Design | null = useMemo(
    () => product.designs.find((d) => d.id === selectedDesignId) ?? null,
    [product, selectedDesignId],
  );

  const selectedDesignKinds = useMemo<VariantKind[]>(() => {
    if (!selectedDesign) return [];
    const selectableKinds = new Set(
      product.variants.filter(isSelectableVariant).map((v) => v.kind),
    );
    return selectedDesign.compatibleKinds.filter((k) =>
      selectableKinds.has(k),
    );
  }, [product, selectedDesign]);

  const currentVariant = useMemo(
    () => product.variants.find((v) => v.kind === selectedVariantKind) ?? null,
    [product, selectedVariantKind],
  );

  const noCompatibleKinds =
    selectedDesign !== null && selectedDesignKinds.length === 0;

  const isFoilSelected = currentVariant
    ? isFoilKind(currentVariant.kind)
    : false;

  useEffect(() => {
    if (selectedDesignKinds.length === 0) return;
    if (!selectedDesignKinds.includes(selectedVariantKind)) {
      const fallback = selectedDesignKinds[0]!;
      setValue("variantKind", fallback, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [selectedDesignKinds, selectedVariantKind, setValue]);

  useEffect(() => {
    if (!isFoilSelected) {
      setValue("foilSwatchId", null, { shouldValidate: true });
    }
  }, [isFoilSelected, setValue]);

  const headerPrice = currentVariant
    ? `${formatMxn(currentVariant.price)} MXN`
    : null;

  const personalizationText = watch("personalizationText");
  const foilSwatchId = watch("foilSwatchId");
  const quantity = watch("quantity");

  const missingFields = useMemo(() => {
    const items: string[] = [];
    if (!selectedDesignId) items.push("diseño");
    if (noCompatibleKinds) return items;
    if (isFoilSelected && !foilSwatchId) items.push("color de foil");
    if (!personalizationText || personalizationText.trim().length === 0) {
      items.push("nombre");
    }
    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity < 1 ||
      quantity > 999
    ) {
      items.push("cantidad");
    }
    return items;
  }, [
    selectedDesignId,
    noCompatibleKinds,
    isFoilSelected,
    foilSwatchId,
    personalizationText,
    quantity,
  ]);

  return (
    <PageSection
      title={product.name}
      subtitle={headerPrice ?? undefined}
      width="default"
    >
      <article className={styles.layout}>
        <aside className={styles.previewColumn}>
          <DesignPreview
            design={selectedDesign}
            productName={product.name}
          />
        </aside>

        <div className={styles.pickerColumn}>
          {product.description ? (
            <p className={styles.description}>{product.description}</p>
          ) : null}

          {isUnavailable ? (
            <p role="alert" className={styles.unavailable}>
              Este producto no está disponible por ahora.
            </p>
          ) : (
            <form
              className={styles.form}
              noValidate
              onSubmit={handleSubmit(handleAddToCart)}
            >
              <DesignPicker designs={product.designs} control={control} />

              {noCompatibleKinds ? (
                <p role="alert" className={styles.unavailable}>
                  Este diseño no está disponible para este producto.
                </p>
              ) : (
                <>
                  <VariantKindSelector
                    variants={product.variants}
                    compatibleKinds={selectedDesignKinds}
                    control={control}
                  />

                  {isFoilSelected ? (
                    <FoilSwatchPicker
                      swatches={currentVariant?.palette?.swatches ?? []}
                      control={control}
                    />
                  ) : null}

                  <div className={styles.inlineRow}>
                    <div className={styles.nameField}>
                      <FormField
                        label="Nombre y apellido"
                        error={errors.personalizationText?.message}
                      >
                        <Input
                          type="text"
                          autoComplete="off"
                          maxLength={80}
                          {...register("personalizationText")}
                        />
                      </FormField>
                    </div>
                    <div className={styles.qtyField}>
                      <QuantityInput control={control} />
                    </div>
                  </div>

                  <div className={styles.cta}>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={missingFields.length > 0}
                    >
                      Agregar al carrito
                    </Button>
                    {missingFields.length > 0 ? (
                      <p className={styles.ctaMissing} role="status">
                        Para agregar al carrito, falta:{" "}
                        {missingFields.join(", ")}
                      </p>
                    ) : null}
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </article>
    </PageSection>
  );
}
