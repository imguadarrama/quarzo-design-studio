import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.scss";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, type = "button", ...rest }: ButtonProps) {
  const classes = className ? `${styles.button} ${className}` : styles.button;
  return <button type={type} className={classes} {...rest} />;
}
