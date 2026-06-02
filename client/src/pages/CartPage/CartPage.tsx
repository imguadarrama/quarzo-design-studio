import { Button } from "@/components/Button/Button";
import { ButtonLink } from "@/components/ButtonLink/ButtonLink";
import { PageEmpty } from "@/components/PageState/PageState";
import { PageSection } from "@/components/PageSection/PageSection";
import { formatMxn } from "@/lib/format";
import type { CartLine } from "@/lib/types";
import { useCartStore, useCartSubtotal } from "@/store/cart";
import styles from "./CartPage.module.scss";

export function CartPage() {
  const lines = useCartStore((s) => s.lines);
  const subtotal = useCartSubtotal();

  if (lines.length === 0) {
    return (
      <PageEmpty
        title="Tu carrito está vacío"
        message="Explora el catálogo y personaliza tu primer pedido."
      >
        <ButtonLink to="/catalogo" size="sm">
          Ver el catálogo
        </ButtonLink>
      </PageEmpty>
    );
  }

  return (
    <PageSection title="Carrito" width="default">
      <div className={styles.layout}>
        <ul className={styles.items}>
          {lines.map((line) => (
            <li key={line.id}>
              <CartLineRow line={line} />
            </li>
          ))}
        </ul>

        <aside className={styles.summary}>
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>
              Subtotal (envío se calcula al pagar)
            </span>
            <span className={styles.summaryValue}>{formatMxn(subtotal)}</span>
          </div>
          <ButtonLink to="/checkout" variant="primary" size="md">
            Continuar a checkout
          </ButtonLink>
        </aside>
      </div>
    </PageSection>
  );
}

interface CartLineRowProps {
  line: CartLine;
}

function CartLineRow({ line }: CartLineRowProps) {
  const removeLine = useCartStore((s) => s.removeLine);
  const updateQuantity = useCartStore((s) => s.updateQuantity);

  const thumb = line.designImageUrl || line.productImageUrl;
  const lineTotal = line.unitPrice * line.quantity;

  return (
    <article className={styles.item}>
      {thumb ? (
        <img className={styles.thumb} src={thumb} alt={line.designName} />
      ) : null}

      <div className={styles.itemBody}>
        <p className={styles.itemTitle}>{line.productName}</p>
        <p className={styles.itemMeta}>
          {line.variantName} · {line.designName}
          {line.foilColorName ? ` · Foil: ${line.foilColorName}` : ""}
        </p>
        <p className={styles.personalization}>"{line.personalizationText}"</p>

        <div className={styles.itemFooter}>
          <div className={styles.qtyStepper}>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Reducir cantidad"
              disabled={line.quantity <= 1}
              onClick={() => updateQuantity(line.id, line.quantity - 1)}
            >
              −
            </Button>
            <span className={styles.qtyValue}>{line.quantity}</span>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Aumentar cantidad"
              disabled={line.quantity >= 999}
              onClick={() => updateQuantity(line.id, line.quantity + 1)}
            >
              +
            </Button>
          </div>

          <div className={styles.priceCol}>
            <span className={styles.lineTotal}>{formatMxn(lineTotal)}</span>
            <span className={styles.unitPrice}>
              {formatMxn(line.unitPrice)} c/u
            </span>
          </div>
        </div>

        <button
          type="button"
          className={styles.removeButton}
          onClick={() => removeLine(line.id)}
        >
          Quitar
        </button>
      </div>
    </article>
  );
}
