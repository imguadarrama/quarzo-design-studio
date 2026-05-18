import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import CircularLogo from "@/assets/circular-logo.png";
import styles from "./NavBar.module.scss";
import { Typography } from "../Typography/Typography";

interface NavBarProps {
  ariaLabel: string;
  brandTo: string;
  wordmark: string;
  children: ReactNode;
  right?: ReactNode;
}

export function NavBar({
  ariaLabel,
  brandTo,
  wordmark,
  children,
  right,
}: NavBarProps) {
  return (
    <nav className={styles.nav} aria-label={ariaLabel}>
      <Link to={brandTo} className={styles.brand}>
        <img src={CircularLogo} className={styles.logo} alt="" loading="lazy" />
        <Typography
          as="span"
          size="md"
          weight="medium"
          className={styles.wordmark}
        >
          {wordmark}
        </Typography>
      </Link>
      {children}
      {right ? <div className={styles.right}>{right}</div> : null}
    </nav>
  );
}
