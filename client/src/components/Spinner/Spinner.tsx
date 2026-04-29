import styles from "./Spinner.module.scss";

export type SpinnerSize = "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

export function Spinner({
  size = "md",
  label = "Cargando…",
  className,
}: SpinnerProps) {
  const classes = [styles.spinner, styles[`size-${size}`], className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} role="status" aria-live="polite">
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.srOnly}>{label}</span>
    </span>
  );
}
