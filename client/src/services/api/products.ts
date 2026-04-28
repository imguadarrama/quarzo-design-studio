import { apiFetch } from "./client";
import type { Product } from "../../lib/types";

export async function fetchProducts(): Promise<Product[]> {
  const response = await apiFetch("/api/products");

  if (!response.ok) {
    throw new Error("No se pudo cargar el catálogo");
  }

  const data = (await response.json()) as { products: Product[] };
  return data.products;
}

export async function fetchProductBySlug(slug: string): Promise<Product> {
  const response = await apiFetch(`/api/products/${slug}`);

  if (!response.ok) {
    throw new Error(response.status === 404 ? "Producto no encontrado" : "No se pudo cargar el producto");
  }

  const data = (await response.json()) as { product: Product };
  return data.product;
}
