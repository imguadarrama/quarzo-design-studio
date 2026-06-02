import { Link, type LinkProps } from "react-router-dom";
import type { ButtonSize, ButtonVariant } from "@/components/Button/Button";
import styles from "./ButtonLink.module.scss";

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
