import { useEffect, useRef } from "react";
import { PENDING_URL_PREFIX } from "./schema.js";

export interface PendingImageEntry {
  file: File;
  previewUrl: string;
}

export type PendingImageMap = Map<string, PendingImageEntry>;

export function isPendingUrl(url: string): boolean {
  return url.startsWith(PENDING_URL_PREFIX);
}

export function pendingTempId(url: string): string {
  return url.slice(PENDING_URL_PREFIX.length);
}

export function pendingUrl(tempId: string): string {
  return `${PENDING_URL_PREFIX}${tempId}`;
}

// Owns a stable Map<tempId, { file, previewUrl }> for the lifetime of
// the form page. The map is intentionally a ref (not state): mutations
// happen during pick / remove handlers and we don't want every form
// re-render to walk it. The cleanup effect revokes any preview URL that
// outlived its row — defends against the operator navigating away
// mid-edit while pending entries are still around.
export function usePendingImages(): PendingImageMap {
  const ref = useRef<PendingImageMap>(new Map());
  useEffect(() => {
    const map = ref.current;
    return () => {
      map.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      map.clear();
    };
  }, []);
  return ref.current;
}
