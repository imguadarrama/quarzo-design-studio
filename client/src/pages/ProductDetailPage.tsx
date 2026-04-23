import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PersonalizationInput } from "../components/PersonalizationInput";
import { VariantSelector } from "../components/VariantSelector";
import { formatCategory, formatCurrency } from "../lib/format";
import type { Product } from "../lib/types";
import { fetchProductBySlug } from "../services/api/products";

export function ProductDetailPage() {
  const { slug = "" } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [personalization, setPersonalization] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    void (async () => {
      try {
        const nextProduct = await fetchProductBySlug(slug);
        setProduct(nextProduct);
        setSelectedVariantId(nextProduct.variants[0]?.id ?? "");
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "No se pudo cargar el producto");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const selectedVariant = useMemo(
    () => product?.variants.find((variant) => variant.id === selectedVariantId) ?? product?.variants[0] ?? null,
    [product, selectedVariantId],
  );

  if (loading) {
    return <div className="rounded-[2rem] border border-stone-200 bg-white p-10 text-stone-600">Cargando producto...</div>;
  }

  if (error || !product) {
    return (
      <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-10 text-rose-700">
        {error ?? "Producto no encontrado"}
      </div>
    );
  }

  const heroImage = product.images[0];
  const finalPrice = product.basePrice + (selectedVariant?.priceDelta ?? 0);

  return (
    <div className="space-y-10">
      <Link to="/" className="inline-flex items-center text-sm uppercase tracking-[0.25em] text-stone-500">
        Volver al catalogo
      </Link>

      <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[2.5rem] bg-white shadow-[0_28px_90px_rgba(28,25,23,0.08)]">
            {heroImage ? (
              <img
                src={heroImage.url}
                alt={heroImage.alt ?? product.name}
                className="aspect-[4/5] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center bg-stone-100 text-sm uppercase tracking-[0.3em] text-stone-400">
                Sin imagen
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {product.images.slice(1).map((image) => (
              <img
                key={image.id ?? image.url}
                src={image.url}
                alt={image.alt ?? product.name}
                className="aspect-square rounded-[1.5rem] border border-stone-200 object-cover"
              />
            ))}
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:p-8">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-700">
            {formatCategory(product.category)}
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-tight text-stone-900">{product.name}</h1>
          <p className="mt-4 text-base leading-8 text-stone-600">{product.description}</p>
          <div className="mt-8 flex items-end justify-between gap-4 border-y border-stone-200 py-6">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Precio estimado</p>
              <p className="mt-2 font-serif text-4xl text-stone-900">{formatCurrency(finalPrice)}</p>
            </div>
            <p className="max-w-40 text-right text-sm text-stone-500">El precio final se confirma en la siguiente fase del checkout.</p>
          </div>

          <div className="mt-8 space-y-8">
            <VariantSelector
              basePrice={product.basePrice}
              variants={product.variants}
              selectedVariantId={selectedVariant?.id ?? ""}
              onSelect={setSelectedVariantId}
            />

            <PersonalizationInput value={personalization} onChange={setPersonalization} />

            <div className="space-y-3">
              <label htmlFor="quantity" className="text-sm uppercase tracking-[0.25em] text-stone-500">
                Cantidad
              </label>
              <input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="w-full rounded-3xl border border-stone-200 px-4 py-4 text-stone-800 outline-none transition focus:border-stone-900"
              />
            </div>

            <div className="rounded-[2rem] bg-stone-900 px-5 py-5 text-stone-100">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-400">Preparado para la siguiente fase</p>
              <p className="mt-3 text-sm leading-7">
                Variante seleccionada: {selectedVariant?.name ?? "Sin variante"}.
                {" "}
                Texto listo: {personalization.trim() ? `"${personalization.trim()}"` : "todavia vacio"}.
                {" "}
                Cantidad: {quantity}.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
