import { useEffect, useRef } from "react";
import {
  deleteUploadedImages,
  describeUploadError,
  uploadImage,
  type UploadImagePrefix,
} from "@/services/api/uploadImage";
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
// re-render to walk it. Per-row blob URLs are revoked inline by the
// editor's remove handler; this effect's cleanup runs on page unmount
// and revokes any preview URLs still in the map — defends against the
// operator navigating away mid-edit with pending entries left over.
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

interface ResolvePendingUploadsOptions<T> {
  pendingImages: PendingImageMap;
  getUrl: (item: T) => string;
  withUrl: (item: T, url: string) => T;
  prefix?: UploadImagePrefix;
  fallbackName: string;
  failureLabel: string;
}

// Uploads every pending item to R2 in parallel and returns the resolved items
// with their final URLs. On any failure it rolls back the uploads that did
// succeed (so a half-finished submit doesn't orphan R2 objects) and throws an
// aggregated Spanish message. Shared by the product and palette forms.
export async function resolvePendingUploads<T>(
  items: T[],
  opts: ResolvePendingUploadsOptions<T>,
): Promise<{ resolved: T[]; newlyUploadedUrls: string[] }> {
  const { pendingImages, getUrl, withUrl, prefix, fallbackName, failureLabel } =
    opts;

  const settled = await Promise.allSettled(
    items.map(async (item): Promise<T> => {
      const url = getUrl(item);
      if (!isPendingUrl(url)) return item;
      const entry = pendingImages.get(pendingTempId(url));
      if (!entry) throw new Error("Pending image entry not found");
      const uploaded = await uploadImage(
        entry.file,
        prefix ? { prefix } : undefined,
      );
      return withUrl(item, uploaded.url);
    }),
  );

  const resolved: T[] = [];
  const failures: string[] = [];
  const newlyUploadedUrls: string[] = [];

  settled.forEach((result, i) => {
    const original = items[i]!;
    if (result.status === "fulfilled") {
      resolved.push(result.value);
      if (isPendingUrl(getUrl(original))) {
        newlyUploadedUrls.push(getUrl(result.value));
      }
    } else {
      const entry = isPendingUrl(getUrl(original))
        ? pendingImages.get(pendingTempId(getUrl(original)))
        : undefined;
      failures.push(
        describeUploadError(result.reason, entry?.file.name ?? fallbackName),
      );
    }
  });

  if (failures.length > 0) {
    if (newlyUploadedUrls.length > 0) {
      void deleteUploadedImages(newlyUploadedUrls);
    }
    throw new Error(
      `No pudimos subir algunas ${failureLabel}: ${failures.join(", ")}`,
    );
  }

  return { resolved, newlyUploadedUrls };
}
