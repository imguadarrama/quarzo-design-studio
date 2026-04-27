import { createElement } from "react";
import type { CSSProperties, ReactNode } from "react";
import styles from "./Typography.module.scss";

export type TypographySize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

interface TypographyProps {
  as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p";
  size?: TypographySize;
  margin?: string;
  weight?: number | "lighter" | "normal" | "bold";
  className?: string;
  children: ReactNode;
}

export function Typography({
  as,
  size,
  margin,
  weight,
  className,
  children,
}: TypographyProps) {
  const style: CSSProperties = {};
  if (margin !== undefined) style.margin = margin;
  if (weight !== undefined) style.fontWeight = weight;

  const classes = [
    styles[as],
    size ? styles[`size-${size}`] : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return createElement(
    as,
    {
      className: classes,
      style: Object.keys(style).length > 0 ? style : undefined,
    },
    children,
  );
}
