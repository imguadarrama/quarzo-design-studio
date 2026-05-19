import type { Design } from "@/lib/types";
import styles from "./DesignPreview.module.scss";

interface DesignPreviewProps {
  design: Design | null;
  productName: string;
}

export function DesignPreview({ design, productName }: DesignPreviewProps) {
  if (!design) {
    return (
      <figure className={styles.figure}>
        <div className={styles.placeholder} aria-hidden />
        <figcaption className={styles.caption}>{productName}</figcaption>
      </figure>
    );
  }

  return (
    <figure className={styles.figure}>
      <div className={styles.imageWrap}>
        <img
          src={design.imageUrl}
          alt={`Diseño "${design.name}" para ${productName}`}
          className={styles.image}
          loading="lazy"
        />
      </div>
      <figcaption className={styles.caption}>
        <span className={styles.captionLabel}>Diseño</span>
        <span className={styles.captionName}>{design.name}</span>
      </figcaption>
    </figure>
  );
}
