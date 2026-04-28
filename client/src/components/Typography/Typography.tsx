import { createElement } from "react";
import type { ReactNode } from "react";
import styles from "./Typography.module.scss";

export type TypographySize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

interface TypographyProps {
  as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p";
  size?: TypographySize;
  className?: string;
  children: ReactNode;
}

export function Typography({
  as,
  size,
  className,
  children,
}: TypographyProps) {
  const classes = [
    styles[as],
    size ? styles[`size-${size}`] : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return createElement(as, { className: classes }, children);
}
