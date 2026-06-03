import { useCallback, useEffect, useRef, useState } from "react";

export interface AdminEditResource {
  mode: "create" | "edit";
  loaded: boolean;
  loadError: string | null;
  load: () => Promise<void>;
}

// Drives the edit-mode load lifecycle shared by every admin form page:
// derives create/edit mode from the route param, fetches the record on mount
// (edit only), guards against stale responses when the id changes mid-flight,
// and hands the loaded record to `onLoaded` (where the page resets its form).
// `fetchById` must be a stable reference (module-level service fn); `onLoaded`
// may change freely — it's read through a ref.
export function useAdminEditResource<T>(
  editId: string | undefined,
  fetchById: (id: string) => Promise<T>,
  onLoaded: (data: T) => void,
): AdminEditResource {
  const mode: "create" | "edit" = editId ? "edit" : "create";
  const loadIdRef = useRef<string | null>(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<boolean>(mode === "create");

  const load = useCallback(async () => {
    if (!editId) return;
    const requestedId = editId;
    loadIdRef.current = requestedId;
    setLoadError(null);
    setLoaded(false);
    try {
      const data = await fetchById(requestedId);
      if (loadIdRef.current !== requestedId) return;
      onLoadedRef.current(data);
      setLoaded(true);
    } catch (err) {
      if (loadIdRef.current !== requestedId) return;
      setLoadError(err instanceof Error ? err.message : "Error desconocido");
    }
  }, [editId, fetchById]);

  useEffect(() => {
    if (mode === "edit") void load();
  }, [mode, load]);

  return { mode, loaded, loadError, load };
}
