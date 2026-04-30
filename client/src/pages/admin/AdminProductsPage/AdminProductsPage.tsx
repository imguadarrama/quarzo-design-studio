import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ButtonLink } from "../../../components/Button/ButtonLink.js";
import {
  PageEmpty,
  PageError,
  PageLoading,
} from "../../../components/PageState/PageState";
import { Typography } from "../../../components/Typography/Typography";
import { fetchAdminProducts } from "../../../services/api/admin";
import type {
  AdminProduct,
  AdminProductImage,
  AdminProductVariant,
} from "../../../lib/types";
import styles from "./AdminProductsPage.module.scss";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
});

function pickPrimaryImage(
  images: AdminProductImage[],
): AdminProductImage | null {
  if (images.length === 0) return null;
  return images.reduce((a, b) => (b.position < a.position ? b : a));
}

function priceFrom(variants: AdminProductVariant[]): number | null {
  if (variants.length === 0) return null;
  return Math.min(...variants.map((v) => v.price));
}

export function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchAdminProducts();
      setProducts(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  let body: ReactNode;
  if (error) {
    body = <PageError message={error} onRetry={load} />;
  } else if (products == null) {
    body = <PageLoading />;
  } else if (products.length === 0) {
    body = (
      <PageEmpty
        title="Aún no hay productos"
        message="Cuando agregues productos aparecerán aquí."
      />
    );
  } else {
    body = (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" aria-label="Imagen" />
              <th scope="col">Producto</th>
              <th scope="col">Categoría</th>
              <th scope="col" className={styles.numeric}>
                Desde
              </th>
              <th scope="col" className={styles.numeric}>
                Variantes
              </th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const primary = pickPrimaryImage(product.images);
              const variantCount = product.variants.length;
              const minPrice = priceFrom(product.variants);
              const rowClass = product.active
                ? styles.row
                : `${styles.row} ${styles.inactive}`;

              return (
                <tr key={product.id} className={rowClass}>
                  <td className={styles.thumbCell} data-label="">
                    <div className={styles.thumb}>
                      {primary ? (
                        <img
                          src={primary.url}
                          alt={primary.alt ?? product.name}
                        />
                      ) : (
                        <div
                          className={styles.thumbFallback}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  </td>
                  <td className={styles.productCell} data-label="Producto">
                    <span className={styles.name}>{product.name}</span>
                    <span className={styles.slug}>/{product.slug}</span>
                  </td>
                  <td data-label="Categoría">{product.category}</td>
                  <td className={styles.numeric} data-label="Desde">
                    {minPrice == null
                      ? "—"
                      : currencyFormatter.format(minPrice)}
                  </td>
                  <td className={styles.numeric} data-label="Variantes">
                    {variantCount}
                  </td>
                  <td data-label="Estado">
                    {product.active ? "Activo" : "Inactivo"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const count = products?.length ?? 0;

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <Typography as="h1" size="xxl" className={styles.title}>
            Productos
          </Typography>
          <Typography as="p" className={styles.lede}>
            {count} {count === 1 ? "producto" : "productos"} en el catálogo.
          </Typography>
        </div>
        <ButtonLink
          to="/admin/productos/nuevo"
          size="sm"
          className={styles.newButton}
        >
          Nuevo producto
        </ButtonLink>
      </header>
      {body}
    </section>
  );
}
