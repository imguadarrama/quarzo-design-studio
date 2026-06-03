import { useEffect, useState } from "react";
import { listCategories } from "@/services/api/admin";
import type { AdminCategory } from "@/lib/types";

// Loads the full category list once on mount for the admin forms that filter
// designs/products by category. Returns the raw list (callers filter by
// `active` themselves and use the total length to detect "no categories yet").
export function useCategories(): {
  categories: AdminCategory[] | null;
  categoriesError: string | null;
} {
  const [categories, setCategories] = useState<AdminCategory[] | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCategories()
      .then((cats) => {
        if (!cancelled) setCategories(cats);
      })
      .catch((err) => {
        if (cancelled) return;
        setCategoriesError(
          err instanceof Error ? err.message : "Error al cargar categorías",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, categoriesError };
}
