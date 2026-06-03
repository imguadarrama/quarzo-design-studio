import { useEffect, useRef, type MutableRefObject } from "react";
import { slugify } from "@/lib/slug";

// Auto-derives a slug from `name` until the operator edits the slug field
// directly. Returns the dirty ref so the form's load handler can re-arm it:
// set it to `false` to resume auto-derivation after a rename (categories,
// products), or `true` to freeze the loaded slug (palettes).
export function useSlugSync(
  name: string,
  applySlug: (slug: string) => void,
): MutableRefObject<boolean> {
  const dirtyRef = useRef(false);
  const applyRef = useRef(applySlug);
  applyRef.current = applySlug;

  useEffect(() => {
    if (!dirtyRef.current) applyRef.current(slugify(name));
  }, [name]);

  return dirtyRef;
}
