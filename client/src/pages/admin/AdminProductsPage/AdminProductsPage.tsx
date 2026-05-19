import { useCallback } from "react";
import { AsyncContent } from "@/components/AsyncContent/AsyncContent";
import { ButtonLink } from "@/components/Button/ButtonLink";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import { PageSection } from "@/components/PageSection/PageSection";
import { PhaseFlowHint } from "@/components/PhaseFlowHint/PhaseFlowHint";
import { useAdminDeleteFlow } from "@/hooks/useAdminDeleteFlow";
import { useAdminListResource } from "@/hooks/useAdminListResource";
import { deleteProduct, fetchAdminProducts } from "@/services/api/admin";
import type { AdminProduct } from "@/lib/types";
import { AdminProductRow } from "./AdminProductRow.js";
import styles from "./AdminProductsPage.module.scss";

export function AdminProductsPage() {
  const {
    data: products,
    error,
    reload,
    setData: setProducts,
  } = useAdminListResource<AdminProduct>(fetchAdminProducts);

  const handleDeleted = useCallback(
    (id: string) => {
      setProducts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    },
    [setProducts],
  );

  const {
    pendingItem: confirming,
    isConfirming,
    isDeleting,
    rowErrorById,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useAdminDeleteFlow<AdminProduct>({
    deleteFn: deleteProduct,
    onDeleted: handleDeleted,
  });

  const count = products?.length ?? 0;
  const imageCount = confirming?.images.length ?? 0;
  const hasImages = imageCount > 0;
  const imageText = imageCount === 1 ? "imagen" : "imágenes";
  const connectorText = imageCount === 1 ? "y" : "y sus";

  return (
    <PageSection
      title="Productos"
      subtitle={`${count} ${count === 1 ? "producto" : "productos"} en el catálogo.`}
      prefix={<PhaseFlowHint current="productos" />}
      actions={
        <ButtonLink to="/admin/productos/nuevo" size="sm">
          Nuevo producto
        </ButtonLink>
      }
    >
      <AsyncContent
        data={products}
        error={error}
        onRetry={reload}
        emptyTitle="Aún no hay productos"
        emptyMessage="Cuando agregues productos aparecerán aquí."
      >
        {(items) => (
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
                {items.map((product) => (
                  <AdminProductRow
                    key={product.id}
                    product={product}
                    isDeleting={isDeleting && confirming?.id === product.id}
                    errorMessage={rowErrorById[product.id] ?? null}
                    onRequestDelete={() => requestDelete(product)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AsyncContent>
      <ConfirmDialog
        isOpen={isConfirming}
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
        isConfirming={isDeleting}
        onConfirm={() => {
          void confirmDelete();
        }}
        onCancel={cancelDelete}
      />
    </PageSection>
  );
}
