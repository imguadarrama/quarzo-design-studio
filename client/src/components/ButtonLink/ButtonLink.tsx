import { Link, type LinkProps } from "react-router-dom";
import styles from "./ButtonLink.module.scss";

type ButtonSize = "sm" | "md";
type ButtonVariant = "primary" | "ghost" | "danger";

type ButtonLinkProps = LinkProps & {
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export function ButtonLink({
  className,
  size = "md",
  variant = "primary",
  ...rest
}: ButtonLinkProps) {
  const base = `${styles.link} ${styles[size]} ${styles[variant]}`;
  const classes = className ? `${base} ${className}` : base;
  return <Link className={classes} {...rest} />;
}
