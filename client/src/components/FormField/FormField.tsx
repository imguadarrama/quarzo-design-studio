import { useId, useMemo, type ReactNode } from "react";
import { FormFieldContext, type FormFieldContextValue } from "./FormFieldContext.js";
import styles from "./FormField.module.scss";

type FormFieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
};

export function FormField({ label, error, hint, children }: FormFieldProps) {
  const baseId = useId();
  const controlId = `${baseId}-control`;
  const errorId = `${baseId}-error`;
  const hintId = `${baseId}-hint`;
  const hasError = Boolean(error);
  const ctx = useMemo<FormFieldContextValue>(
    () => ({ controlId, errorId, hintId: hint ? hintId : null, hasError }),
    [controlId, errorId, hintId, hint, hasError],
  );

  return (
    <FormFieldContext.Provider value={ctx}>
      <div className={styles.field}>
        <label htmlFor={controlId} className={styles.label}>
          {label}
        </label>
        {children}
        {hint ? (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        ) : null}
        <p id={errorId} className={styles.error} aria-live="polite">
          {error ?? ""}
        </p>
      </div>
    </FormFieldContext.Provider>
  );
}
