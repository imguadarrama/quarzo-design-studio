import { Spinner } from "../Spinner/Spinner";
import styles from "./FullPageSpinner.module.scss";

export function FullPageSpinner() {
  return (
    <div className={styles.wrapper}>
      <Spinner size="lg" />
    </div>
  );
}
