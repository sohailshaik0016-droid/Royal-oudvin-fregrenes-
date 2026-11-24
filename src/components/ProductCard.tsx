import React, { useState } from 'react';
import { Heart, ShoppingBag, Star } from 'lucide-react';
import type { BottleSize, Product } from '../types';
import { formatCollectionName, formatINR } from '../lib/format';

interface ProductCardProps {
  product: Product;
  onSelect: (product: Product) => void;
  onAddToCart: (product: Product, size: BottleSize) => void;
  onBuyNow: (product: Product, size: BottleSize) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
  variant?: 'ivory' | 'obsidian';
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onSelect,
  onAddToCart,
  onBuyNow,
  isWishlisted = false,
  onToggleWishlist,
  variant = 'ivory',
}) => {
  const [size, setSize] = useState<BottleSize>('50ML');
  const [imgFailed, setImgFailed] = useState(false);

  const activePrice = size === '100ML' ? product.price_100ml : product.price_50ml;
  const activeStock = size === '100ML' ? product.stock_100ml : product.stock_50ml;
  const outOfStock = activeStock <= 0;

  const isObsidian = variant === 'obsidian';

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-lg transition-transform duration-200 hover:-translate-y-0.5 ${
        isObsidian
          ? 'bg-[#171614] border border-[#C9A24A]/25 text-[#F3EBDD]'
          : 'bg-[#F3EBDD] border border-[#493323]/15 text-[#101010]'
      }`}
    >
      {/* Photorealistic Product Photography (70% visual lead) */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#1A1815]">
        <button
          type="button"
          onClick={() => onSelect(product)}
          className="block h-full w-full text-left focus-visible:outline-none"
          aria-label={`View details for ${product.name}`}
        >
          {!imgFailed ? (
            <img
              src={product.image_url}
              alt={`${product.name} — OUDVIN Fragrances luxury perfume bottle`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#1C1814] to-[#101010] p-6 text-center">
              <span className="font-display text-2xl tracking-[0.18em] text-[#C9A24A]">OUDVIN</span>
              <span className="mt-1 text-xs text-[#F3EBDD]/70">{product.name}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#101010]/45 to-transparent" />
        </button>

        {onToggleWishlist && (
          <button
            type="button"
            onClick={() => onToggleWishlist(product)}
            aria-pressed={isWishlisted}
            aria-label={
              isWishlisted
                ? `Remove ${product.name} from wishlist`
                : `Save ${product.name} to wishlist`
            }
            title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
            className={`absolute right-3 top-3 inline-flex h-10 items-center justify-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold backdrop-blur-sm transition-colors ${
              isWishlisted
                ? 'border-[#C9A24A] bg-[#101010]/85 text-[#C9A24A]'
                : 'border-[#F3EBDD]/25 bg-[#101010]/65 text-[#F3EBDD] hover:border-[#C9A24A] hover:text-[#C9A24A]'
            }`}
          >
            <Heart
              className={`h-4 w-4 shrink-0 ${
                isWishlisted ? 'fill-[#C9A24A] text-[#C9A24A]' : ''
              }`}
            />
            <span className="hidden sm:inline whitespace-nowrap">
              {isWishlisted ? 'Saved' : 'Wishlist'}
            </span>
          </button>
        )}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Clean unboxed metadata (zero pill badges) */}
        <div
          className={`flex items-center justify-between gap-2 text-xs ${
            isObsidian ? 'text-[#C9A24A]' : 'text-[#493323]/80'
          }`}
        >
          <span className="truncate">
            {formatCollectionName(product.collection)} · {product.fragrance_family}
          </span>
          {Number(product.review_count || 0) > 0 && (
            <span className="inline-flex items-center gap-1 shrink-0 tabular-nums">
              <Star className="h-3 w-3 fill-[#C9A24A] text-[#C9A24A]" />
              {Number(product.avg_rating).toFixed(1)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelect(product)}
          className="mt-1.5 text-left"
        >
          <h3
            className={`font-display text-2xl font-semibold leading-tight transition-colors ${
              isObsidian
                ? 'text-[#F3EBDD] group-hover:text-[#C9A24A]'
                : 'text-[#101010] group-hover:text-[#493323]'
            }`}
          >
            {product.name}
          </h3>
        </button>

        <p
          className={`mt-1.5 line-clamp-2 text-xs leading-relaxed ${
            isObsidian ? 'text-[#F3EBDD]/70' : 'text-[#493323]/85'
          }`}
        >
          {product.top_notes} · {product.base_notes}
        </p>

        {/* Size selector + authoritative price */}
        <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-current/10">
          <div
            className={`inline-flex rounded-md p-0.5 ${
              isObsidian ? 'bg-[#101010] border border-[#C9A24A]/20' : 'bg-[#E5DAC6]'
            }`}
            role="group"
            aria-label={`Bottle size for ${product.name}`}
          >
            {(['50ML', '100ML'] as BottleSize[]).map((opt) => {
              const active = size === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSize(opt)}
                  className={`min-h-[34px] px-2.5 text-xs font-semibold rounded transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? isObsidian
                        ? 'bg-[#C9A24A] text-[#101010]'
                        : 'bg-[#101010] text-[#F3EBDD]'
                      : isObsidian
                      ? 'text-[#F3EBDD]/70 hover:text-[#F3EBDD]'
                      : 'text-[#493323] hover:text-[#101010]'
                  }`}
                >
                  {opt === '50ML' ? '50 ml' : '100 ml'}
                </button>
              );
            })}
          </div>

          <div className="text-right">
            <div
              className={`text-base font-semibold tabular-nums ${
                isObsidian ? 'text-[#C9A24A]' : 'text-[#101010]'
              }`}
            >
              {formatINR(activePrice)}
            </div>
            <div
              className={`text-[11px] ${
                outOfStock
                  ? 'text-red-700 font-medium'
                  : isObsidian
                  ? 'text-[#F3EBDD]/55'
                  : 'text-[#493323]/70'
              }`}
            >
              {outOfStock ? 'Out of Stock' : 'In Stock'}
            </div>
          </div>
        </div>

        {/* Action Buttons — ≥ 44px touch height for Android mobile */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={outOfStock}
            onClick={() => onAddToCart(product, size)}
            className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
              isObsidian
                ? 'border border-[#C9A24A]/60 text-[#F3EBDD] hover:bg-[#C9A24A]/15'
                : 'border border-[#493323]/35 text-[#101010] hover:bg-[#493323]/10'
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
            Add to Bag
          </button>

          <button
            type="button"
            disabled={outOfStock}
            onClick={() => onBuyNow(product, size)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-[#C9A24A] px-3 py-2 text-xs font-semibold text-[#101010] transition-colors hover:bg-[#DFC076] whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Buy Now
          </button>
        </div>
      </div>
    </article>
  );
};
