import type { ProductView } from "@/lib/experiment/types";

export const formatPrice = (n: number) => `£${n.toFixed(2)}`;

export function describeProduct(p: ProductView): string {
  return [p.name, p.description, formatPrice(p.price), p.promotion, p.trustBadge]
    .filter(Boolean)
    .join(", ");
}

export function ProductCard({
  product,
  disabled,
  onChoose,
}: {
  product: ProductView;
  disabled: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={disabled}
      aria-label={`Choose ${describeProduct(product)}`}
      className="flex min-h-56 flex-1 flex-col items-stretch gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition hover:border-accent active:scale-[0.99] disabled:opacity-60"
    >
      <div
        aria-hidden
        className="flex h-20 items-center justify-center rounded-lg bg-surface-2 text-2xl font-semibold text-ink-3"
      >
        {product.name.slice(0, 1)}
      </div>
      <div>
        <p className="font-semibold">{product.name}</p>
        <p className="text-sm text-ink-2">{product.description}</p>
      </div>
      <p className="tabular text-2xl font-semibold">{formatPrice(product.price)}</p>
      <div className="mt-auto flex min-h-7 flex-wrap gap-2">
        {product.promotion && (
          <span className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium">
            {product.promotion}
          </span>
        )}
        {product.trustBadge && (
          <span className="rounded-md border border-line bg-surface-2 px-2 py-1 text-xs font-medium">
            ★ {product.trustBadge}
          </span>
        )}
      </div>
    </button>
  );
}
