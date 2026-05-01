import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ButtonLink } from "../../../components/Button/ButtonLink.js";
import {
  PageEmpty,
  PageError,
  PageLoading,
} from "../../../components/PageState/PageState";
import { Typography } from "../../../components/Typography/Typography";
import {
  deleteProduct,
  fetchAdminProducts,
} from "../../../services/api/admin";
import type { AdminProduct } from "../../../lib/types";
import { AdminProductRow } from "./AdminProductRow.js";
import styles from "./AdminProductsPage.module.scss";

export function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(
    null,
  );

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

  const handleConfirmDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    setRowError(null);
    try {
      await deleteProduct(id);
      setProducts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
      setConfirmingId(null);
    } catch (err) {
      setRowError({
        id,
        message: err instanceof Error ? err.message : "No se pudo eliminar",
      });
    } finally {
      setDeletingId(null);
    }
  }, []);

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
                errorMessage={
                  rowError && rowError.id === product.id
                    ? rowError.message
                    : null
                }
                onStartConfirm={() => {
                  setConfirmingId(product.id);
                  setRowError(null);
                }}
                onCancelConfirm={() => {
                  setConfirmingId(null);
                  setRowError(null);
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
