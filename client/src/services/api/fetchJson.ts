import { apiFetch } from "./client";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type FetchJsonOptions = {
  method?: string;
  body?: unknown;
  allow401?: boolean;
};

async function readError(
  response: Response,
): Promise<{ error: string; code?: string }> {
  try {
    const data = (await response.json()) as { error?: string; code?: string };
    return {
      error: data.error ?? "Ocurrió un error inesperado",
      code: data.code,
    };
  } catch {
    return { error: "Ocurrió un error inesperado" };
  }
}

export async function fetchJson<T>(
  path: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const { method, body, allow401 } = options;
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const response = await apiFetch(path, init);

  if (allow401 && response.status === 401) {
    return null as T;
  }

  if (!response.ok) {
    const { error, code } = await readError(response);
    throw new ApiError(error, response.status, code);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}
