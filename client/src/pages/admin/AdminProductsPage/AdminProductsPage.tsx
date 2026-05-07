import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/Button/ButtonLink";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
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

  const confirming = useMemo(
    () => products?.find((p) => p.id === confirmingId) ?? null,
    [products, confirmingId],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmingId) return;
    const id = confirmingId;
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
      setConfirmingId(null);
    } finally {
      setDeletingId(null);
    }
  }, [confirmingId, clearRowError]);

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
                isDeleting={deletingId === product.id}
                errorMessage={rowErrors[product.id] ?? null}
                onRequestDelete={() => {
                  clearRowError(product.id);
                  setConfirmingId(product.id);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const count = products?.length ?? 0;
  const imageCount = confirming?.images.length ?? 0;
  const hasImages = imageCount > 0;
  const imageText = imageCount === 1 ? "imagen" : "imágenes";
  const connectorText = imageCount === 1 ? "y" : "y sus";

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
      <ConfirmDialog
        isOpen={confirming !== null}
        title="Eliminar producto"
        description={
          confirming ? (
            <>
              <p>
                Esto eliminará el producto <strong>{confirming.name}</strong>
                {hasImages ? (
                  <>
                    {" "}
                    {connectorText}{" "}
                    <strong>
                      {imageCount} {imageText}
                    </strong>{" "}
                    del almacenamiento.
                  </>
                ) : (
                  "."
                )}
              </p>

              <p>Esta acción no se puede deshacer.</p>
            </>
          ) : null
        }
        confirmLabel="Eliminar definitivamente"
        isConfirming={deletingId !== null}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        onCancel={() => setConfirmingId(null)}
      />
    </section>
  );
}
