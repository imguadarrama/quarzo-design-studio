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
