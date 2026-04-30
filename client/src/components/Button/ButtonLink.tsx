import { Link, type LinkProps } from "react-router-dom";
import styles from "./Button.module.scss";

type ButtonSize = "sm" | "md";

type ButtonLinkProps = LinkProps & {
  size?: ButtonSize;
};

export function ButtonLink({
  className,
  size = "md",
  ...rest
}: ButtonLinkProps) {
  const base = `${styles.button} ${styles[size]}`;
  const classes = className ? `${base} ${className}` : base;
  return <Link className={classes} {...rest} />;
}
