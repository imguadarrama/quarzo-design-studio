import type { ReactNode } from "react";
import { Typography } from "@/components/Typography/Typography";
import styles from "./PageSection.module.scss";

type PageSectionWidth = "default" | "narrow";

interface PageSectionProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  prefix?: ReactNode;
  width?: PageSectionWidth;
  children: ReactNode;
}

export function PageSection({
  title,
  subtitle,
  actions,
  prefix,
  width = "default",
  children,
}: PageSectionProps) {
  const wrapperClass = `${styles.wrapper} ${width === "narrow" ? styles.narrow : styles.default}`;

  return (
    <section className={wrapperClass}>
      {prefix}
      <header className={styles.header}>
        <div className={styles.headerText}>
          <Typography as="h1" size="xxl" className={styles.title}>
            {title}
          </Typography>
          {subtitle != null ? (
            <Typography as="p" className={styles.lede}>
              {subtitle}
            </Typography>
          ) : null}
        </div>
        {actions != null ? <div className={styles.actions}>{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
