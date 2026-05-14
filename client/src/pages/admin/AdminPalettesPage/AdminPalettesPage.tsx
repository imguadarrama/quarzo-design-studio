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
import { PhaseFlowHint } from "@/components/PhaseFlowHint/PhaseFlowHint";
import { Typography } from "@/components/Typography/Typography";
import { useAdminDeleteFlow } from "@/hooks/useAdminDeleteFlow";
import { useAdminListResource } from "@/hooks/useAdminListResource";
import { ApiError } from "@/services/api/fetchJson";
import { deletePalette, listPalettes } from "@/services/api/admin";
import type { AdminOptionPalette } from "@/lib/types";
import styles from "./AdminPalettesPage.module.scss";

const PALETTE_PROTECTED_MESSAGE =
  "Esta paleta está vinculada a un tipo de variante (foil) y no se puede eliminar.";

async function deletePaletteWithFriendlyError(id: string): Promise<void> {
  try {
    await deletePalette(id);
  } catch (err) {
    if (err instanceof ApiError && err.code === "PALETTE_PROTECTED") {
      throw new Error(PALETTE_PROTECTED_MESSAGE);
    }
    throw err;
  }
}

export function AdminPalettesPage() {
  const {
    data: palettes,
    error,
    reload,
    setData: setPalettes,
  } = useAdminListResource<AdminOptionPalette>(listPalettes);

  const handleDeleted = useCallback(
    (id: string) => {
      setPalettes((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    },
    [setPalettes],
  );

  const {
    pendingItem: confirming,
    isConfirming,
    isDeleting,
    rowErrorById,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useAdminDeleteFlow<AdminOptionPalette>({
    deleteFn: deletePaletteWithFriendlyError,
    onDeleted: handleDeleted,
  });

  let body: ReactNode;
  if (error) {
    body = <PageError message={error} onRetry={reload} />;
  } else if (palettes == null) {
    body = <PageLoading />;
  } else if (palettes.length === 0) {
    body = (
      <PageEmpty
        title="Aún no hay paletas"
        message="Crea tu primera paleta para usarla en opciones tipo SWATCH."
      />
    );
  } else {
    body = (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Paleta</th>
              <th scope="col" className={styles.numeric}>
                Muestras
              </th>
              <th scope="col">Estado</th>
              <th scope="col" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {palettes.map((palette) => {
              const errorMessage = rowErrorById[palette.id] ?? null;
              const rowClass = palette.active
                ? styles.row
                : `${styles.row} ${styles.inactive}`;
              return (
                <tr key={palette.id} className={rowClass}>
                  <td className={styles.nameCell} data-label="Paleta">
                    <span className={styles.name}>{palette.name}</span>
                    <span className={styles.slug}>/{palette.slug}</span>
                  </td>
                  <td className={styles.numeric} data-label="Muestras">
                    {palette.swatches.length}
                  </td>
                  <td data-label="Estado">
                    {palette.active ? "Activa" : "Inactiva"}
                  </td>
                  <td className={styles.actionsCell} data-label="Acciones">
                    <div className={styles.actions}>
                      <ButtonLink
                        to={`/admin/paletas/${palette.id}/editar`}
                        size="sm"
                      >
                        Editar
                      </ButtonLink>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => requestDelete(palette)}
                        disabled={isDeleting && confirming?.id === palette.id}
                      >
                        {isDeleting && confirming?.id === palette.id
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

  const count = palettes?.length ?? 0;
  const swatchCount = confirming?.swatches.length ?? 0;
  const swatchText = swatchCount === 1 ? "muestra" : "muestras";

  return (
    <section className={styles.wrapper}>
      <PhaseFlowHint current="paletas" />
      <header className={styles.header}>
        <div className={styles.headerText}>
          <Typography as="h1" size="xxl" className={styles.title}>
            Paletas
          </Typography>
          <Typography as="p" className={styles.lede}>
            {count} {count === 1 ? "paleta" : "paletas"} de imágenes globales,
            vinculadas a tipos de variante.
          </Typography>
        </div>
        <ButtonLink
          to="/admin/paletas/nuevo"
          size="sm"
          className={styles.newButton}
        >
          Nueva paleta
        </ButtonLink>
      </header>
      {body}
      <ConfirmDialog
        isOpen={isConfirming}
        title="Eliminar paleta"
        description={
          confirming ? (
            <>
              {/* TODO: Whenever only 1 pallette exists, i get a wierd spanish sentence `y sus 1 muestra` when it should be like `y 1 muestra (imagen)` add this UX, also this logic is repeated in AdminProductsPage.tsx. We can create a reusable component and adapt it to each view */}
              <p>
                Esto eliminará la paleta <strong>{confirming.name}</strong>
                {swatchCount > 0 ? (
                  <>
                    {" "}
                    y sus{" "}
                    <strong>
                      {swatchCount} {swatchText}
                    </strong>
                    .
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
    </section>
  );
}
