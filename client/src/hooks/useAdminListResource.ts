import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export type AdminListResource<T> = {
  data: T[] | null;
  error: string | null;
  reload: () => Promise<void>;
  setData: Dispatch<SetStateAction<T[] | null>>;
};

export function useAdminListResource<T>(
  loader: () => Promise<T[]>,
): AdminListResource<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pin loader in a ref so reload identity stays stable even if callers pass
  // an inline function — otherwise the effect below would re-fire every render.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setError(null);
    try {
      const next = await loaderRef.current();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload, setData };
}
