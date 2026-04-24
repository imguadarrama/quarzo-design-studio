import { formatCurrency } from "../lib/format";
import type { ProductVariant } from "../lib/types";

type VariantSelectorProps = {
  basePrice: number;
  variants: ProductVariant[];
  selectedVariantId: string;
  onSelect: (variantId: string) => void;
};

export function VariantSelector({
  basePrice,
  variants,
  selectedVariantId,
  onSelect,
}: VariantSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm uppercase tracking-[0.25em] text-stone-500">Selecciona una variante</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {variants.map((variant) => {
          const isSelected = variant.id === selectedVariantId;
          const finalPrice = basePrice + variant.priceDelta;

          return (
            <button
              key={variant.id ?? variant.sku}
              type="button"
              onClick={() => onSelect(variant.id ?? "")}
              className={`rounded-3xl border px-4 py-4 text-left transition ${
                isSelected
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-200 bg-white text-stone-800 hover:border-stone-400"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{variant.name}</p>
                  <p className={`mt-1 text-xs ${isSelected ? "text-stone-300" : "text-stone-500"}`}>
                    SKU {variant.sku}
                  </p>
                </div>
                <p className="text-sm">{formatCurrency(finalPrice)}</p>
              </div>
              <p className={`mt-3 text-sm ${isSelected ? "text-stone-200" : "text-stone-600"}`}>
                {variant.stock > 0 ? `${variant.stock} disponibles` : "Agotado"}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
