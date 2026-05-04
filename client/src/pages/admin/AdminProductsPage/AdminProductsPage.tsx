import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/Button/ButtonLink";
import {
  PageEmpty,
  PageError,
  PageLoading,
} from "@/components/PageState/PageState";
import { Typography } from "@/components/Typography/Typography";
import { deleteProduct, fetchAdminProducts } from "@/services/api/admin";
import type { AdminProduct } from "@/lib/types";
import { AdminProductRow } from "./AdminProductRow.js";
import styles from "./AdminProductsPage.module.scss";

export function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

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

  const clearRowError = useCallback((id: string) => {
    setRowErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const handleConfirmDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      clearRowError(id);
      try {
        await deleteProduct(id);
        setProducts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
        setConfirmingId(null);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No se pudo eliminar";
        setRowErrors((prev) => ({ ...prev, [id]: message }));
      } finally {
        setDeletingId(null);
      }
    },
    [clearRowError],
  );

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
              <th scope="col" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <AdminProductRow
                key={product.id}
                product={product}
                isConfirming={confirmingId === product.id}
                isDeleting={deletingId === product.id}
                errorMessage={rowErrors[product.id] ?? null}
                onStartConfirm={() => {
                  setConfirmingId(product.id);
                  clearRowError(product.id);
                }}
                onCancelConfirm={() => {
                  setConfirmingId(null);
                  clearRowError(product.id);
                }}
                onConfirmDelete={() => {
                  void handleConfirmDelete(product.id);
                }}
              />
            ))}
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
