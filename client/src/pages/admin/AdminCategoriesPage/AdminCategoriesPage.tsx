import { useCallback } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/Button/Button";
import { ButtonLink } from "@/components/Button/ButtonLink";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import {
  PageEmpty,
  PageError,
  PageLoading,
} from "@/components/PageState/PageState";
import { PageSection } from "@/components/PageSection/PageSection";
import { PhaseFlowHint } from "@/components/PhaseFlowHint/PhaseFlowHint";
import { useAdminDeleteFlow } from "@/hooks/useAdminDeleteFlow";
import { useAdminListResource } from "@/hooks/useAdminListResource";
import { ApiError } from "@/services/api/fetchJson";
import { deleteCategory, listCategories } from "@/services/api/admin";
import type { AdminCategory } from "@/lib/types";
import styles from "./AdminCategoriesPage.module.scss";

async function deleteCategoryWithFriendlyError(id: string): Promise<void> {
  try {
    await deleteCategory(id);
  } catch (err) {
    if (err instanceof ApiError && err.code === "CATEGORY_IN_USE") {
      throw new Error(err.message);
    }
    throw err;
  }
}

export function AdminCategoriesPage() {
  const {
    data: categories,
    error,
    reload,
    setData: setCategories,
  } = useAdminListResource<AdminCategory>(listCategories);

  const handleDeleted = useCallback(
    (id: string) => {
      setCategories((prev) => (prev ? prev.filter((c) => c.id !== id) : prev));
    },
    [setCategories],
  );

  const {
    pendingItem: confirming,
    isConfirming,
    isDeleting,
    rowErrorById,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useAdminDeleteFlow<AdminCategory>({
    deleteFn: deleteCategoryWithFriendlyError,
    onDeleted: handleDeleted,
  });

  let body: ReactNode;
  if (error) {
    body = <PageError message={error} onRetry={reload} />;
  } else if (categories == null) {
    body = <PageLoading />;
  } else if (categories.length === 0) {
    body = (
      <PageEmpty
        title="Aún no hay categorías"
        message="Crea tu primera categoría (ej. Sobres, Tarjetas, Stickers) para empezar a agrupar tus diseños y productos."
      />
    );
  } else {
    body = (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Categoría</th>
              <th scope="col">Estado</th>
              <th scope="col" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const errorMessage = rowErrorById[category.id] ?? null;
              const rowClass = category.active
                ? styles.row
                : `${styles.row} ${styles.inactive}`;
              return (
                <tr key={category.id} className={rowClass}>
                  <td className={styles.nameCell} data-label="Categoría">
                    <span className={styles.name}>{category.name}</span>
                    <span className={styles.slug}>/{category.slug}</span>
                  </td>
                  <td data-label="Estado">
                    {category.active ? "Activa" : "Inactiva"}
                  </td>
                  <td className={styles.actionsCell} data-label="Acciones">
                    <div className={styles.actions}>
                      <ButtonLink
                        to={`/admin/categorias/${category.id}/editar`}
                        size="sm"
                      >
                        Editar
                      </ButtonLink>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => requestDelete(category)}
                        disabled={isDeleting && confirming?.id === category.id}
                      >
                        {isDeleting && confirming?.id === category.id
                          ? "Eliminando…"
                          : "Eliminar"}
                      </Button>
                      {errorMessage ? (
                        <span role="alert" className={styles.rowError}>
                          {errorMessage}
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const count = categories?.length ?? 0;

  return (
    <PageSection
      title="Categorías"
      subtitle={`${count} ${count === 1 ? "categoría" : "categorías"} disponibles. Una categoría agrupa productos y filtra los diseños del editor.`}
      prefix={<PhaseFlowHint current="categorias" />}
      actions={
        <ButtonLink to="/admin/categorias/nuevo" size="sm">
          Nueva categoría
        </ButtonLink>
      }
    >
      {body}
      <ConfirmDialog
        isOpen={isConfirming}
        title="Eliminar categoría"
        description={
          confirming ? (
            <>
              <p>
                Esto eliminará la categoría <strong>{confirming.name}</strong>.
                No podrás eliminarla si tiene productos asignados.
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
