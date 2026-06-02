import { fetchJson } from "./fetchJson";
import type { CreateOrderPayload, OrderPublic } from "@/lib/types";

export const createOrder = (payload: CreateOrderPayload) =>
  fetchJson<{ order: OrderPublic }>("/api/orders", {
    method: "POST",
    body: payload,
  }).then((d) => d.order);

export const getOrderByToken = (token: string) =>
  fetchJson<{ order: OrderPublic }>(
    `/api/orders/${encodeURIComponent(token)}`,
  ).then((d) => d.order);
