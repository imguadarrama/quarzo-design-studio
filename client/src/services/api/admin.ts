import { fetchJson } from "./fetchJson";
import type {
  AdminOptionPalette,
  AdminProduct,
  AdminUser,
  PalettePayload,
  ProductPayload,
} from "@/lib/types";

type AdminEnvelope = { admin: AdminUser };
type ProductEnvelope = { product: AdminProduct };
type ProductsEnvelope = { products: AdminProduct[] };
type PaletteEnvelope = { palette: AdminOptionPalette };
type PalettesEnvelope = { palettes: AdminOptionPalette[] };

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

export const listPalettes = () =>
  fetchJson<PalettesEnvelope>("/api/admin/palettes").then((d) => d.palettes);

export const getPalette = (id: string) =>
  fetchJson<PaletteEnvelope>(`/api/admin/palettes/${id}`).then((d) => d.palette);

export const createPalette = (payload: PalettePayload) =>
  fetchJson<PaletteEnvelope>("/api/admin/palettes", {
    method: "POST",
    body: payload,
  }).then((d) => d.palette);

export const updatePalette = (id: string, payload: PalettePayload) =>
  fetchJson<PaletteEnvelope>(`/api/admin/palettes/${id}`, {
    method: "PATCH",
    body: payload,
  }).then((d) => d.palette);

export const deletePalette = (id: string) =>
  fetchJson<void>(`/api/admin/palettes/${id}`, { method: "DELETE" });
