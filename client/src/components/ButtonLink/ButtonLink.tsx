import { Link, type LinkProps } from "react-router-dom";
import type { ButtonSize, ButtonVariant } from "@/components/Button/Button";
import buttonStyles from "@/components/Button/Button.module.scss";
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
  const base = `${buttonStyles.button} ${buttonStyles[size]} ${buttonStyles[variant]} ${styles.link}`;
  const classes = className ? `${base} ${className}` : base;
  return <Link className={classes} {...rest} />;
}
