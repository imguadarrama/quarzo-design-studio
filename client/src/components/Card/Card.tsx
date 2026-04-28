import type { ReactNode } from "react";
import styles from "./Card.module.scss";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  const classes = className ? `${styles.card} ${className}` : styles.card;
  return <div className={classes}>{children}</div>;
}
