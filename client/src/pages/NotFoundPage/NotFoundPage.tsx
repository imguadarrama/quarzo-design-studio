import { Link } from "react-router-dom";
import styles from "./NotFoundPage.module.scss";

export function NotFoundPage() {
  return (
    <div className={styles.wrapper}>
      <h1 className={styles.errorCode}>404</h1>
      <p className={styles.subtitle}>No encontramos esta página.</p>
      <Link to="/" className={styles.link}>
        Volver al inicio
      </Link>
    </div>
  );
}
