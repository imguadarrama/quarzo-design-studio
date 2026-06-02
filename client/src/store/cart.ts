import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartLine } from "@/lib/types";

const MIN_QTY = 1;
const MAX_QTY = 999;

const clampQty = (n: number): number =>
  Math.max(MIN_QTY, Math.min(MAX_QTY, Math.trunc(n)));

type CartState = {
  lines: CartLine[];
  addLine: (line: Omit<CartLine, "id">) => void;
  removeLine: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      addLine: (line) =>
        set((state) => ({
          lines: [...state.lines, { ...line, id: crypto.randomUUID() }],
        })),
      removeLine: (id) =>
        set((state) => ({ lines: state.lines.filter((l) => l.id !== id) })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.id === id ? { ...l, quantity: clampQty(quantity) } : l,
          ),
        })),
      clear: () => set({ lines: [] }),
    }),
    { name: "quarzo-cart-v1" },
  ),
);

export const useCartLineCount = (): number =>
  useCartStore((state) => state.lines.reduce((sum, l) => sum + l.quantity, 0));

export const useCartSubtotal = (): number =>
  useCartStore((state) =>
    state.lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
  );
