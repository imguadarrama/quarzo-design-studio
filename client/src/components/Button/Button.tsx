import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.scss";

type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: ButtonSize;
};

export function Button({
  className,
  size = "md",
  type = "button",
  ...rest
}: ButtonProps) {
  const base = `${styles.button} ${styles[size]}`;
  const classes = className ? `${base} ${className}` : base;
  return <button type={type} className={classes} {...rest} />;
}
