import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { formatCategory } from "../lib/format";
import type { Product } from "../lib/types";
import { fetchProducts } from "../services/api/products";

export function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const nextProducts = await fetchProducts();
        setProducts(nextProducts);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "No se pudo cargar el catalogo");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => {
    const values = new Set(products.map((product) => product.category));
    return Array.from(values);
  }, [products]);

  if (loading) {
    return <div className="rounded-[2rem] border border-stone-200 bg-white p-10 text-stone-600">Cargando catalogo...</div>;
  }

  if (error) {
    return <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-10 text-rose-700">{error}</div>;
  }

  return (
    <div className="space-y-16">
      <section className="grid gap-10 rounded-[2.5rem] bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_35%),linear-gradient(135deg,_#faf7f2,_#f5efe4)] px-6 py-10 shadow-[0_30px_120px_rgba(28,25,23,0.08)] lg:grid-cols-[1.2fr_0.8fr] lg:px-12">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.45em] text-amber-700">Quarzo Design Studio</p>
          <h1 className="max-w-2xl font-serif text-5xl leading-tight text-stone-900 sm:text-6xl">
            Papeleria personalizada con mirada editorial.
          </h1>
          <p className="max-w-xl text-base leading-8 text-stone-600">
            Explora el catalogo, elige tu variante favorita y deja listo el texto que Quarzo convertira en una pieza especial para tu marca, evento o regalo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/login"
              className="rounded-full border border-stone-900 px-5 py-3 text-sm uppercase tracking-[0.2em] text-stone-900 transition hover:bg-stone-900 hover:text-white"
            >
              Admin
            </Link>
            {categories.map((category) => (
              <span
                key={category}
                className="rounded-full bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.25em] text-stone-600"
              >
                {formatCategory(category)}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-[2rem] bg-stone-900 p-6 text-stone-100">
            <p className="text-xs uppercase tracking-[0.35em] text-stone-400">Hecho para mobile</p>
            <p className="mt-4 font-serif text-3xl">Portafolio y venta en una misma experiencia.</p>
          </div>
          <div className="rounded-[2rem] bg-white/80 p-6 text-stone-700">
            <p className="text-xs uppercase tracking-[0.35em] text-stone-400">Fase 2</p>
            <p className="mt-4 text-sm leading-7">
              El catalogo publico, el detalle de producto y el panel inicial de admin ya viven en la misma base del proyecto.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">Catalogo</p>
            <h2 className="mt-2 font-serif text-4xl text-stone-900">Productos activos</h2>
          </div>
          <p className="text-sm text-stone-500">{products.length} productos publicados</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
