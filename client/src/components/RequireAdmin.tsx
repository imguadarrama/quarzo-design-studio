import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuthStore } from "../store/adminAuth.js";
import { FullPageSpinner } from "./FullPageSpinner/FullPageSpinner.js";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const status = useAdminAuthStore((s) => s.status);
  const hydrate = useAdminAuthStore((s) => s.hydrate);
  const location = useLocation();

  useEffect(() => {
    if (status === "idle") {
      void hydrate();
    }
  }, [status, hydrate]);

  if (status === "idle" || status === "loading") {
    return <FullPageSpinner />;
  }

  if (status === "guest") {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
