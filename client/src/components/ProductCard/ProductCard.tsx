import { Link } from "react-router-dom";
import { Typography } from "@/components/Typography/Typography";
import { formatMxn } from "@/lib/format";
import type { Product } from "@/lib/types";
import styles from "./ProductCard.module.scss";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const hero = product.images[0] ?? null;
  // Server already drops non-offered variants in the public serializer
  // (server/src/lib/serializers.ts:142), so every price here is sellable.
  const prices = product.variants.map((v) => v.price);
  const priceFrom = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <Link to={`/producto/${product.slug}`} className={styles.card}>
      <div className={styles.imageWrap}>
        {hero ? (
          <img
            src={hero.url}
            alt={hero.alt ?? product.name}
            className={styles.image}
            loading="lazy"
          />
        ) : (
          <div className={styles.imagePlaceholder} aria-hidden />
        )}
      </div>
      <div className={styles.body}>
        <Typography as="h3" size="md" className={styles.name}>
          {product.name}
        </Typography>
        {priceFrom != null ? (
          <p className={styles.priceFrom}>
            Desde {formatMxn(priceFrom)} MXN
          </p>
        ) : null}
      </div>
    </Link>
  );
}
