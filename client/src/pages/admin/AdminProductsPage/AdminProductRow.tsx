import { Button } from "../../../components/Button/Button.js";
import { ButtonLink } from "../../../components/Button/ButtonLink.js";
import type {
  AdminProduct,
  AdminProductImage,
  AdminProductVariant,
} from "../../../lib/types.js";
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

interface AdminProductRowProps {
  product: AdminProduct;
  isConfirming: boolean;
  isDeleting: boolean;
  errorMessage: string | null;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirmDelete: () => void;
}

export function AdminProductRow({
  product,
  isConfirming,
  isDeleting,
  errorMessage,
  onStartConfirm,
  onCancelConfirm,
  onConfirmDelete,
}: AdminProductRowProps) {
  const primary = pickPrimaryImage(product.images);
  const variantCount = product.variants.length;
  const minPrice = priceFrom(product.variants);
  const rowClass = product.active
    ? styles.row
    : `${styles.row} ${styles.inactive}`;

  return (
    <tr className={rowClass}>
      <td className={styles.thumbCell} data-label="">
        <div className={styles.thumb}>
          {primary ? (
            <img src={primary.url} alt={primary.alt ?? product.name} />
          ) : (
            <div className={styles.thumbFallback} aria-hidden="true" />
          )}
        </div>
      </td>
      <td className={styles.productCell} data-label="Producto">
        <span className={styles.name}>{product.name}</span>
        <span className={styles.slug}>/{product.slug}</span>
      </td>
      <td data-label="Categoría">{product.category}</td>
      <td className={styles.numeric} data-label="Desde">
        {minPrice == null ? "—" : currencyFormatter.format(minPrice)}
      </td>
      <td className={styles.numeric} data-label="Variantes">
        {variantCount}
      </td>
      <td data-label="Estado">{product.active ? "Activo" : "Inactivo"}</td>
      <td className={styles.actionsCell} data-label="Acciones">
        <div className={styles.actions}>
          {isConfirming ? (
            <>
              <Button
                size="sm"
                className={styles.dangerButton}
                disabled={isDeleting}
                onClick={onConfirmDelete}
              >
                {isDeleting ? "Eliminando…" : "¿Confirmar?"}
              </Button>
              <Button
                size="sm"
                className={styles.ghostButton}
                disabled={isDeleting}
                onClick={onCancelConfirm}
              >
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <ButtonLink
                to={`/admin/productos/${product.id}/editar`}
                size="sm"
              >
                Editar
              </ButtonLink>
              <Button
                size="sm"
                className={styles.ghostButton}
                onClick={onStartConfirm}
              >
                Eliminar
              </Button>
            </>
          )}
          {errorMessage ? (
            <span role="alert" className={styles.rowError}>
              {errorMessage}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
