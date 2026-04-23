import { Link } from "react-router-dom";
import { formatCategory, formatCurrency } from "../lib/format";
import type { Product } from "../lib/types";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const image = product.images[0];

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_80px_rgba(28,25,23,0.08)] transition hover:-translate-y-1">
      <Link to={`/productos/${product.slug}`} className="block">
        <div className="aspect-[4/5] overflow-hidden bg-stone-100">
          {image ? (
            <img
              src={image.url}
              alt={image.alt ?? product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.35em] text-stone-400">
              Sin imagen
            </div>
          )}
        </div>
        <div className="space-y-3 px-5 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-700">
            {formatCategory(product.category)}
          </p>
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-serif text-2xl text-stone-900">{product.name}</h2>
            <span className="whitespace-nowrap text-sm text-stone-500">
              Desde {formatCurrency(product.startingPrice ?? product.basePrice)}
            </span>
          </div>
          <p className="line-clamp-3 text-sm leading-6 text-stone-600">{product.description}</p>
        </div>
      </Link>
    </article>
  );
}
