import type { ReactNode } from "react";
import { Button } from "../Button/Button";
import { Spinner } from "../Spinner/Spinner";
import { Typography } from "../Typography/Typography";
import styles from "./PageState.module.scss";

interface PageLoadingProps {
  label?: string;
}

export function PageLoading({ label = "Cargando…" }: PageLoadingProps) {
  return (
    <div className={styles.state}>
      <Spinner size="md" label={label} />
    </div>
  );
}

interface PageErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function PageError({
  title = "Algo salió mal",
  message,
  onRetry,
}: PageErrorProps) {
  return (
    <div className={styles.state} role="alert">
      <Typography as="h2" size="lg">
        {title}
      </Typography>
      <p className={styles.message}>{message}</p>
      {onRetry ? <Button onClick={onRetry}>Reintentar</Button> : null}
    </div>
  );
}

interface PageEmptyProps {
  title: string;
  message?: string;
  children?: ReactNode;
}

export function PageEmpty({ title, message, children }: PageEmptyProps) {
  return (
    <div className={styles.state}>
      <Typography as="h2" size="lg">
        {title}
      </Typography>
      {message ? <p className={styles.message}>{message}</p> : null}
      {children}
    </div>
  );
}
