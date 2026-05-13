import { Button } from "@/components/Button/Button";
import { ButtonLink } from "@/components/Button/ButtonLink";
import type {
  AdminProduct,
  AdminProductImage,
  AdminProductVariantPrice,
} from "@/lib/types";
import pageStyles from "./AdminProductsPage.module.scss";
import styles from "./AdminProductRow.module.scss";

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

function priceFrom(variants: AdminProductVariantPrice[]): number | null {
  const priced = variants.filter((v) => v.price > 0).map((v) => v.price);
  if (priced.length === 0) return null;
  return Math.min(...priced);
}

interface AdminProductRowProps {
  product: AdminProduct;
  isDeleting: boolean;
  errorMessage: string | null;
  onRequestDelete: () => void;
}

export function AdminProductRow({
  product,
  isDeleting,
  errorMessage,
  onRequestDelete,
}: AdminProductRowProps) {
  const primary = pickPrimaryImage(product.images);
  const variantCount = product.variants.length;
  const minPrice = priceFrom(product.variants);
  const rowClass = product.active
    ? pageStyles.row
    : `${pageStyles.row} ${pageStyles.inactive}`;

  return (
    <tr className={rowClass}>
      <td className={pageStyles.thumbCell} data-label="">
        <div className={pageStyles.thumb}>
          {primary ? (
            <img src={primary.url} alt={primary.alt ?? product.name} />
          ) : (
            <div className={pageStyles.thumbFallback} aria-hidden="true" />
          )}
        </div>
      </td>
      <td className={pageStyles.productCell} data-label="Producto">
        <span className={pageStyles.name}>{product.name}</span>
        <span className={pageStyles.slug}>/{product.slug}</span>
      </td>
      <td data-label="Categoría">{product.category}</td>
      <td className={pageStyles.numeric} data-label="Desde">
        {minPrice == null ? "—" : currencyFormatter.format(minPrice)}
      </td>
      <td className={pageStyles.numeric} data-label="Variantes">
        {variantCount}
      </td>
      <td data-label="Estado">{product.active ? "Activo" : "Inactivo"}</td>
      <td className={styles.actionsCell} data-label="Acciones">
        <div className={styles.actions} aria-live="polite">
          <ButtonLink to={`/admin/productos/${product.id}/editar`} size="sm">
            Editar
          </ButtonLink>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRequestDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Eliminando…" : "Eliminar"}
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
}
