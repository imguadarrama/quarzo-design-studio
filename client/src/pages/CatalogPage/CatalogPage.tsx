import { useCallback, useEffect, useState } from "react";
import { AsyncContent } from "@/components/AsyncContent/AsyncContent";
import { PageEmpty } from "@/components/PageState/PageState";
import { PageSection } from "@/components/PageSection/PageSection";
import { ProductCard } from "@/components/ProductCard/ProductCard";
import type { Category, Product } from "@/lib/types";
import { fetchProducts } from "@/services/api/products";
import styles from "./CatalogPage.module.scss";

const ALL_CATEGORIES = "__all__";

function deriveCategories(products: Product[]): Category[] {
  const seen = new Map<string, Category>();
  for (const p of products) {
    if (!seen.has(p.category.id)) {
      seen.set(p.category.id, p.category);
    }
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
}

export function CatalogPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(ALL_CATEGORIES);

  const load = useCallback(() => {
    setError(null);
    setProducts(null);
    fetchProducts()
      .then(setProducts)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error desconocido");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageSection
      title="Catálogo"
      subtitle="Papelería personalizada hecha en Saltillo."
    >
      <AsyncContent
        data={products}
        error={error}
        onRetry={load}
        emptyTitle="Aún no hay productos en el catálogo"
        emptyMessage="Vuelve pronto — estamos preparando nuevas piezas."
      >
        {(items) => {
          const categories = deriveCategories(items);
          const visible =
            selected === ALL_CATEGORIES
              ? items
              : items.filter((p) => p.category.id === selected);

          return (
            <>
              <div
                className={styles.chips}
                role="tablist"
                aria-label="Categorías"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected === ALL_CATEGORIES}
                  className={`${styles.chip} ${selected === ALL_CATEGORIES ? styles.chipActive : ""}`}
                  onClick={() => setSelected(ALL_CATEGORIES)}
                >
                  Todos
                </button>
                {categories.map((c) => {
                  const isActive = selected === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                      onClick={() => setSelected(c.id)}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>

              {visible.length === 0 ? (
                <PageEmpty
                  title="Sin productos en esta categoría"
                  message="Prueba con otra categoría."
                />
              ) : (
                <ul className={styles.grid}>
                  {visible.map((p) => (
                    <li key={p.id} className={styles.gridItem}>
                      <ProductCard product={p} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </AsyncContent>
    </PageSection>
  );
}
