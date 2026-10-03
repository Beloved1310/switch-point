import type { ProductView } from "@/domain/experiment/types";
import Image from "next/image";

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
      className="product-choice flex min-h-56 flex-1 flex-col items-stretch text-left disabled:opacity-60"
    >
      <div className="product-choice-art" aria-hidden="true">
        <Image src={product.productId === "A" ? "/coffee-hearth.svg" : "/coffee-ridgeline.svg"} alt="" width={160} height={260} />
      </div>
      <span className="product-choice-details">
        <span className="product-choice-name">{product.name}</span>
        <span className="product-choice-description">{product.description}</span>
        <span className="product-choice-price tabular">{formatPrice(product.price)}</span>
      <span className="product-choice-badges">
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
      </span>
      </span>
    </button>
  );
}
