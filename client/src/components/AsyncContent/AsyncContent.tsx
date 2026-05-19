// Style-less wrapper: all visual states are delegated to PageState. No co-located .module.scss intentionally.
import type { ReactNode } from "react";
import {
  PageEmpty,
  PageError,
  PageLoading,
} from "@/components/PageState/PageState";

interface AsyncContentProps<T> {
  data: T | null | undefined;
  error: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyChildren?: ReactNode;
  loadingLabel?: string;
  children: ReactNode | ((data: NonNullable<T>) => ReactNode);
}

export function AsyncContent<T>({
  data,
  error,
  onRetry,
  emptyTitle = "No hay nada por aquí todavía",
  emptyMessage,
  emptyChildren,
  loadingLabel,
  children,
}: AsyncContentProps<T>) {
  if (error) return <PageError message={error} onRetry={onRetry} />;
  if (data == null) return <PageLoading label={loadingLabel} />;
  if (Array.isArray(data) && data.length === 0)
    return (
      <PageEmpty title={emptyTitle} message={emptyMessage}>
        {emptyChildren}
      </PageEmpty>
    );
  return (
    <>
      {typeof children === "function"
        ? children(data as NonNullable<T>)
        : children}
    </>
  );
}
