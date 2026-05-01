import { fetchJson } from "./fetchJson";
import type { Product } from "../../lib/types";

export const fetchProducts = () =>
  fetchJson<{ products: Product[] }>("/api/products").then((d) => d.products);

export const fetchProductBySlug = (slug: string) =>
  fetchJson<{ product: Product }>(`/api/products/${slug}`).then((d) => d.product);
