import { apiFetch } from "./client";
import type { AdminProduct, AdminUser, ProductPayload } from "../../lib/types.js";

type ErrorResponse = {
  error?: string;
};

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ErrorResponse;
    return data.error ?? "Ocurrió un error inesperado";
  } catch {
    return "Ocurrió un error inesperado";
  }
}

export async function loginAdmin(email: string, password: string): Promise<AdminUser> {
  const response = await apiFetch("/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { admin: AdminUser };
  return data.admin;
}

export async function fetchAdminSession(): Promise<AdminUser | null> {
  const response = await apiFetch("/api/admin/auth/me");

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { admin: AdminUser };
  return data.admin;
}

export async function logoutAdmin(): Promise<void> {
  const response = await apiFetch("/api/admin/auth/logout", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}

export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  const response = await apiFetch("/api/admin/products");

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { products: AdminProduct[] };
  return data.products;
}

export async function createProduct(payload: ProductPayload): Promise<AdminProduct> {
  const response = await apiFetch("/api/admin/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { product: AdminProduct };
  return data.product;
}

export async function updateProduct(id: string, payload: ProductPayload): Promise<AdminProduct> {
  const response = await apiFetch(`/api/admin/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  const data = (await response.json()) as { product: AdminProduct };
  return data.product;
}

export async function deleteProduct(id: string): Promise<void> {
  const response = await apiFetch(`/api/admin/products/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }
}
