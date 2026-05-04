import { fetchJson } from "./fetchJson";
import type { AdminProduct, AdminUser, ProductPayload } from "@/lib/types";

type AdminEnvelope = { admin: AdminUser };
type ProductEnvelope = { product: AdminProduct };
type ProductsEnvelope = { products: AdminProduct[] };

export const loginAdmin = (email: string, password: string) =>
  fetchJson<AdminEnvelope>("/api/admin/auth/login", {
    method: "POST",
    body: { email, password },
  }).then((d) => d.admin);

export const fetchAdminSession = () =>
  fetchJson<AdminEnvelope | null>("/api/admin/auth/me", {
    allow401: true,
  }).then((d) => (d ? d.admin : null));

export const logoutAdmin = () =>
  fetchJson<void>("/api/admin/auth/logout", { method: "POST" });

export const fetchAdminProducts = () =>
  fetchJson<ProductsEnvelope>("/api/admin/products").then((d) => d.products);

export const fetchAdminProduct = (id: string) =>
  fetchJson<ProductEnvelope>(`/api/admin/products/${id}`).then(
    (d) => d.product,
  );

export const createProduct = (payload: ProductPayload) =>
  fetchJson<ProductEnvelope>("/api/admin/products", {
    method: "POST",
    body: payload,
  }).then((d) => d.product);

export const updateProduct = (id: string, payload: ProductPayload) =>
  fetchJson<ProductEnvelope>(`/api/admin/products/${id}`, {
    method: "PATCH",
    body: payload,
  }).then((d) => d.product);

export const deleteProduct = (id: string) =>
  fetchJson<void>(`/api/admin/products/${id}`, { method: "DELETE" });
