import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.scss";

type ButtonSize = "sm" | "md";
type ButtonVariant = "primary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, size = "md", variant = "primary", type = "button", ...rest },
    ref,
  ) {
    const base = `${styles.button} ${styles[size]} ${styles[variant]}`;
    const classes = className ? `${base} ${className}` : base;
    return <button ref={ref} type={type} className={classes} {...rest} />;
  },
);
