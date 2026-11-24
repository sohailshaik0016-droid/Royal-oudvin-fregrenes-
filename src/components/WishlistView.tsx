import React from 'react';
import { ArrowRight, Heart, ShoppingBag, Trash2 } from 'lucide-react';
import type { BottleSize, Product } from '../types';
import { ProductCard } from './ProductCard';

interface WishlistViewProps {
  products: Product[];
  wishlistIds: number[];
  onNavigate: (path: string) => void;
  onToggleWishlist: (product: Product) => void;
  onClearWishlist: () => void;
  onAddToCart: (product: Product, size: BottleSize) => void;
  onBuyNow: (product: Product, size: BottleSize) => void;
}

export const WishlistView: React.FC<WishlistViewProps> = ({
  products,
  wishlistIds,
  onNavigate,
  onToggleWishlist,
  onClearWishlist,
  onAddToCart,
  onBuyNow,
}) => {
  const savedProducts = products.filter((p) => wishlistIds.includes(p.id));

  const handleAddAllToBag = () => {
    for (const product of savedProducts) {
      if (product.stock_50ml > 0) {
        onAddToCart(product, '50ML');
      } else if (product.stock_100ml > 0) {
        onAddToCart(product, '100ML');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#101010] text-[#F3EBDD]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="flex flex-col gap-5 border-b border-[#C9A24A]/20 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">
              Saved Fragrances
            </p>
            <h1 className="mt-1.5 font-display text-4xl sm:text-5xl font-semibold text-[#F3EBDD]">
              My Wishlist
            </h1>
            <p className="mt-2 text-sm text-[#F3EBDD]/70 tabular-nums">
              {savedProducts.length === 0
                ? 'Save your favourite OUDVIN scents to compare notes and order anytime.'
                : `${savedProducts.length} saved fragrance${savedProducts.length === 1 ? '' : 's'} in your personal collection.`}
            </p>
          </div>

          {savedProducts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleAddAllToBag}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#C9A24A] px-4 py-2 text-xs font-semibold text-[#101010] transition-colors hover:bg-[#DFC076] whitespace-nowrap"
              >
                <ShoppingBag className="h-4 w-4" />
                Add All to Bag
              </button>
              <button
                type="button"
                onClick={onClearWishlist}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-[#C9A24A]/30 px-4 py-2 text-xs font-medium text-[#F3EBDD]/75 transition-colors hover:border-red-400/50 hover:text-red-300 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Wishlist
              </button>
            </div>
          )}
        </div>

        {savedProducts.length === 0 ? (
          <div className="mt-12 rounded-lg border border-[#C9A24A]/20 bg-[#171614] px-6 py-16 text-center">
            <Heart className="mx-auto h-10 w-10 text-[#C9A24A]/55" />
            <h2 className="mt-4 font-display text-3xl font-semibold text-[#F3EBDD]">
              Your Wishlist Is Empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#F3EBDD]/70">
              Tap the heart icon on any OUDVIN perfume card to keep track of your favourite Arabian oud, rose, musk, and amber fragrances.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/shop')}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-md bg-[#C9A24A] px-6 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#DFC076]"
              >
                Explore All Perfumes
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/collection/signature')}
                className="min-h-[46px] rounded-md border border-[#C9A24A]/40 px-6 py-2.5 text-sm font-semibold text-[#F3EBDD] hover:border-[#C9A24A] hover:text-[#C9A24A]"
              >
                Signature Collection
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={true}
                onToggleWishlist={onToggleWishlist}
                onSelect={(p) => onNavigate(`/product/${p.slug}`)}
                onAddToCart={onAddToCart}
                onBuyNow={onBuyNow}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
