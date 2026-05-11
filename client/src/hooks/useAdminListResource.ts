import { useCallback, useEffect, useState } from "react";
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

  const reload = useCallback(async () => {
    setError(null);
    try {
      const next = await loader();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }, [loader]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload, setData };
}
