import type { ReactNode } from "react";
import { PageError, PageLoading } from "@/components/PageState/PageState";
import { PageSection } from "@/components/PageSection/PageSection";

interface FormPageStateProps {
  mode: "create" | "edit";
  loaded: boolean;
  loadError: string | null;
  onRetry: () => void;
  title: string;
  prefix?: ReactNode;
  children: ReactNode;
}

// Renders the edit-mode load-error / loading shell for an admin form page, or
// the form `children` once the record has loaded (immediate in create mode).
export function FormPageState({
  mode,
  loaded,
  loadError,
  onRetry,
  title,
  prefix,
  children,
}: FormPageStateProps) {
  if (mode === "edit" && loadError) {
    return (
      <PageSection title={title} width="narrow" prefix={prefix}>
        <PageError message={loadError} onRetry={onRetry} />
      </PageSection>
    );
  }
  if (mode === "edit" && !loaded) {
    return (
      <PageSection title={title} width="narrow" prefix={prefix}>
        <PageLoading />
      </PageSection>
    );
  }
  return <>{children}</>;
}
