import { forwardRef, useContext, type ComponentPropsWithoutRef } from "react";
import { FormFieldContext } from "../FormField/FormFieldContext.js";
import styles from "./Textarea.module.scss";

type TextareaProps = ComponentPropsWithoutRef<"textarea">;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    className,
    id,
    "aria-invalid": ariaInvalid,
    "aria-describedby": ariaDescribedBy,
    rows = 4,
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
  const classes = className ? `${styles.textarea} ${className}` : styles.textarea;

  return (
    <textarea
      ref={ref}
      id={resolvedId}
      rows={rows}
      className={classes}
      aria-invalid={resolvedInvalid}
      aria-describedby={resolvedDescribedBy}
      {...rest}
    />
  );
});
