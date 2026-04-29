import { forwardRef, useContext, type ComponentPropsWithoutRef } from "react";
import { FormFieldContext } from "../FormField/FormFieldContext.js";
import styles from "./Input.module.scss";

type InputProps = ComponentPropsWithoutRef<"input">;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    id,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const ctx = useContext(FormFieldContext);
  const resolvedId = id ?? ctx?.controlId;
  const resolvedDescribedBy =
    ariaDescribedBy ??
    (ctx?.hasError ? ctx.errorId : ctx?.hintId ?? undefined);
  const resolvedInvalid = ariaInvalid ?? (ctx?.hasError || undefined);
  const classes = className ? `${styles.input} ${className}` : styles.input;

  return (
    <input
      ref={ref}
      id={resolvedId}
      className={classes}
      aria-invalid={resolvedInvalid}
      aria-describedby={resolvedDescribedBy}
      {...rest}
    />
  );
});
