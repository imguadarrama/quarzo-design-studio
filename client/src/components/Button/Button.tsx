import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.scss";

type ButtonSize = "sm" | "md";
type ButtonVariant = "primary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function Button({
  className,
  size = "md",
  variant = "primary",
  type = "button",
  ...rest
}: ButtonProps) {
  const base = `${styles.button} ${styles[size]} ${styles[variant]}`;
  const classes = className ? `${base} ${className}` : base;
  return <button type={type} className={classes} {...rest} />;
}
