import { useCallback, useState } from "react";

export type AdminDeleteFlow<T extends { id: string }> = {
  pendingItem: T | null;
  isConfirming: boolean;
  isDeleting: boolean;
  rowErrorById: Record<string, string>;
  requestDelete: (item: T) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
};

export function useAdminDeleteFlow<T extends { id: string }>(opts: {
  deleteFn: (id: string) => Promise<void>;
  onDeleted: (id: string) => void;
}): AdminDeleteFlow<T> {
  const { deleteFn, onDeleted } = opts;
  const [pendingItem, setPendingItem] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowErrorById, setRowErrorById] = useState<Record<string, string>>({});

  const clearRowError = useCallback((id: string) => {
    setRowErrorById((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const requestDelete = useCallback(
    (item: T) => {
      clearRowError(item.id);
      setPendingItem(item);
    },
    [clearRowError],
  );

  const cancelDelete = useCallback(() => {
    setPendingItem(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingItem) return;
    const id = pendingItem.id;
    setIsDeleting(true);
    clearRowError(id);
    try {
      await deleteFn(id);
      onDeleted(id);
      setPendingItem(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo eliminar";
      setRowErrorById((prev) => ({ ...prev, [id]: message }));
      setPendingItem(null);
    } finally {
      setIsDeleting(false);
    }
  }, [pendingItem, deleteFn, onDeleted, clearRowError]);

  return {
    pendingItem,
    isConfirming: pendingItem !== null,
    isDeleting,
    rowErrorById,
    requestDelete,
    cancelDelete,
    confirmDelete,
  };
}
