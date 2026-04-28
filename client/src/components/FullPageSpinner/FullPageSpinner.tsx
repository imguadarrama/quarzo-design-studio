import styles from "./FullPageSpinner.module.scss";

export function FullPageSpinner() {
  return (
    <div className={styles.wrapper} role="status" aria-live="polite">
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.srOnly}>Cargando…</span>
    </div>
  );
}
