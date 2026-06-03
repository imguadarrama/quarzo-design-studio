import { useCallback } from "react";
import { Link } from "react-router-dom";
import { AsyncContent } from "@/components/AsyncContent/AsyncContent";
import { Button } from "@/components/Button/Button";
import { ButtonLink } from "@/components/ButtonLink/ButtonLink";
import { ConfirmDialog } from "@/components/ConfirmDialog/ConfirmDialog";
import { PageSection } from "@/components/PageSection/PageSection";
import { PhaseFlowHint } from "@/components/PhaseFlowHint/PhaseFlowHint";
import { useAdminDeleteFlow } from "@/hooks/useAdminDeleteFlow";
import { useAdminListResource } from "@/hooks/useAdminListResource";
import { deleteDesign, listDesigns } from "@/services/api/admin";
import { ApiError } from "@/services/api/fetchJson";
import type { AdminDesign, VariantKind } from "@/lib/types";
import styles from "./AdminDesignsPage.module.scss";

const KIND_LABELS: Record<VariantKind, string> = {
  CON_FOIL: "Foil",
  CON_TINTA_NORMAL: "Tinta",
  CON_FOIL_Y_TINTA: "Foil + Tinta",
  PAPEL_TEXTURIZADO: "Texturizado",
};

async function deleteDesignWithFriendlyError(id: string): Promise<void> {
  try {
    await deleteDesign(id);
  } catch (err) {
    if (err instanceof ApiError && err.code === "DESIGN_IN_USE") {
      throw new Error(err.message);
    }
    throw err;
  }
}

export function AdminDesignsPage() {
  const {
    data: designs,
    error,
    reload,
    setData: setDesigns,
  } = useAdminListResource<AdminDesign>(listDesigns);

  const handleDeleted = useCallback(
    (id: string) => {
      setDesigns((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
    },
    [setDesigns],
  );

  const {
    pendingItem: confirming,
    isConfirming,
    isDeleting,
    rowErrorById,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useAdminDeleteFlow<AdminDesign>({
    deleteFn: deleteDesignWithFriendlyError,
    onDeleted: handleDeleted,
  });

  const count = designs?.length ?? 0;

  return (
    <PageSection
      title="Diseños"
      subtitle={`${count} ${count === 1 ? "diseño" : "diseños"} disponibles. Aplica a cualquier producto desde la pantalla del producto.`}
      prefix={<PhaseFlowHint current="disenos" />}
      actions={
        <ButtonLink to="/admin/disenos/nuevo" size="sm">
          Nuevo diseño
        </ButtonLink>
      }
    >
      <AsyncContent
        data={designs}
        error={error}
        onRetry={reload}
        emptyTitle="Aún no hay diseños"
        emptyMessage="Crea tu primer diseño global para asignarlo a productos."
        emptyChildren={
          <p className={styles.emptyHint}>
            ¿Aún no tienes una paleta?{" "}
            <Link className={styles.link} to="/admin/paletas">
              Crea una paleta primero →
            </Link>
          </p>
        }
      >
        {(items) => (
          <ul className={styles.grid}>
            {items.map((design) => {
              const errorMessage = rowErrorById[design.id] ?? null;
              const cardClass = design.active
                ? styles.card
                : `${styles.card} ${styles.inactive}`;
              return (
                <li key={design.id} className={styles.item}>
                  <div className={cardClass}>
                    <img
                      src={design.imageUrl}
                      alt={design.name}
                      className={styles.thumb}
                      loading="lazy"
                    />
                    <div className={styles.body}>
                      <div className={styles.titleRow}>
                        <span className={styles.name}>{design.name}</span>
                        <span className={styles.status}>
                          {design.active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div className={styles.kinds}>
                        {design.compatibleKinds.length === 0 ? (
                          <span className={styles.kindBadgeMuted}>
                            Sin variantes
                          </span>
                        ) : (
                          design.compatibleKinds.map((k) => (
                            <span key={k} className={styles.kindBadge}>
                              {KIND_LABELS[k]}
                            </span>
                          ))
                        )}
                      </div>
                      <div className={styles.actions}>
                        <ButtonLink
                          to={`/admin/disenos/${design.id}/editar`}
                          size="sm"
                        >
                          Editar
                        </ButtonLink>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => requestDelete(design)}
                          disabled={isDeleting && confirming?.id === design.id}
                        >
                          {isDeleting && confirming?.id === design.id
                            ? "Eliminando…"
                            : "Eliminar"}
                        </Button>
                      </div>
                      {errorMessage ? (
                        <span role="alert" className={styles.rowError}>
                          {errorMessage}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncContent>
      <ConfirmDialog
        isOpen={isConfirming}
        title="Eliminar diseño"
        description={
          confirming ? (
            <>
              <p>
                Esto eliminará el diseño <strong>{confirming.name}</strong> de
                forma permanente.
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
