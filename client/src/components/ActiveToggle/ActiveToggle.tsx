import { forwardRef, type InputHTMLAttributes } from "react";
import styles from "./ActiveToggle.module.scss";

type ActiveToggleProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint: string;
};

export const ActiveToggle = forwardRef<HTMLInputElement, ActiveToggleProps>(
  function ActiveToggle({ label, hint, ...rest }, ref) {
    return (
      <label className={styles.row}>
        <input type="checkbox" className={styles.checkbox} ref={ref} {...rest} />
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          <span className={styles.hint}>{hint}</span>
        </span>
      </label>
    );
  },
);
