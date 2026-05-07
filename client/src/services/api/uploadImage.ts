import { apiFetch } from "./client";
import { ApiError } from "./fetchJson";

export interface UploadImageResponse {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

export async function uploadImage(file: File): Promise<UploadImageResponse> {
  const form = new FormData();
  form.append("image", file);

  const response = await apiFetch("/api/admin/images", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    let message = "No se pudo subir la imagen";
    let code: string | undefined;
    try {
      const data = (await response.json()) as { error?: string; code?: string };
      if (data.error) message = data.error;
      if (data.code) code = data.code;
    } catch {
      /* response had no JSON body */
    }
    throw new ApiError(message, response.status, code);
  }

  return (await response.json()) as UploadImageResponse;
}

// Best-effort cleanup of objects that landed in R2 during a submit that
// later failed. Fire-and-forget from the caller's perspective: we never
// throw, because the caller is already in a failure path and an extra
// error here just confuses the operator. Server-side
// `extractKeyFromUrl` filters URLs that aren't ours, so a buggy caller
// can't instruct R2 to delete keys we don't own.
export async function deleteUploadedImages(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  try {
    await apiFetch("/api/admin/images", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls }),
    });
  } catch {
    /* logged on the server; nothing actionable client-side */
  }
}
