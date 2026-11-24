import React, { useEffect, useState } from 'react';
import { ArrowLeft, Heart, MessageCircle, RefreshCw, ShoppingBag, Star } from 'lucide-react';
import type { BottleSize, Product, Review, SiteSettings } from '../types';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import {
  buildWhatsAppLink,
  formatCollectionName,
  formatINR,
  WHATSAPP_NUMBER,
} from '../lib/format';
import { ProductCard } from './ProductCard';

interface ProductDetailViewProps {
  slug: string;
  allProducts: Product[];
  siteSettings?: SiteSettings | null;
  wishlistIds: number[];
  onToggleWishlist: (product: Product) => void;
  onNavigate: (path: string) => void;
  onAddToCart: (product: Product, size: BottleSize) => void;
  onBuyNow: (product: Product, size: BottleSize) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  slug,
  allProducts,
  siteSettings,
  wishlistIds,
  onToggleWishlist,
  onNavigate,
  onAddToCart,
  onBuyNow,
}) => {
  const [product, setProduct] = useState<Product | null>(
    () => allProducts.find((p) => p.slug === slug) || null
  );
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(!product);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const [size, setSize] = useState<BottleSize>('50ML');
  const [imgError, setImgError] = useState(false);

  // Review submission state
  const [reviewerName, setReviewerName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setImgError(false);
    setLoadError(null);
    setReviewMessage(null);
    setReviewError(null);

    const cached = allProducts.find((p) => p.slug === slug) || null;
    if (cached) setProduct(cached);
    setLoading(!cached);

    fetchWithTimeout(`/api/products/${encodeURIComponent(slug)}`, { signal: controller.signal }, 8000)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('Unable to load fragrance details.');
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        if (data === null) {
          setProduct(null);
        } else {
          setProduct(data.product);
          setReviews(data.reviews || []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        if (!cached) {
          setLoadError('Connection timed out while loading this fragrance. Please try again.');
        }
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [slug, allProducts, retryTick]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSubmitting(true);
    setReviewError(null);
    setReviewMessage(null);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: product.id,
          customer_name: reviewerName,
          rating,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data.error || 'Could not submit your review.');
      } else {
        setReviewMessage(data.message);
        setReviewerName('');
        setRating(5);
        setComment('');
      }
    } catch {
      setReviewError('Network error while submitting your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="aspect-[4/3] animate-pulse rounded-lg bg-[#1C1A17]" />
          <div className="space-y-4">
            <div className="h-4 w-40 animate-pulse rounded bg-[#1C1A17]" />
            <div className="h-12 w-3/4 animate-pulse rounded bg-[#1C1A17]" />
            <div className="h-24 w-full animate-pulse rounded bg-[#1C1A17]" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl text-[#F3EBDD]">
          {loadError ? 'Unable to Load Fragrance' : 'Fragrance Not Found'}
        </h1>
        <p className="mt-3 text-sm text-[#F3EBDD]/70">
          {loadError || 'This fragrance may have been moved or retired from the catalogue.'}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {loadError && (
            <button
              type="button"
              onClick={() => setRetryTick((n) => n + 1)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#C9A24A] px-6 py-2.5 text-sm font-semibold text-[#101010]"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className="min-h-[44px] rounded-md border border-[#C9A24A]/45 px-6 py-2.5 text-sm font-semibold text-[#C9A24A] hover:bg-[#C9A24A] hover:text-[#101010]"
          >
            Browse All Perfumes
          </button>
        </div>
      </div>
    );
  }

  const price = size === '100ML' ? product.price_100ml : product.price_50ml;
  const stock = size === '100ML' ? product.stock_100ml : product.stock_50ml;
  const outOfStock = stock <= 0;

  const related = allProducts
    .filter((p) => p.id !== product.id && p.collection === product.collection)
    .slice(0, 3);

  const waNumber = siteSettings?.whatsapp_number || WHATSAPP_NUMBER;
  const waQuickOrder = buildWhatsAppLink(
    `Hello OUDVIN FRAGRANCES, I would like to order *${product.name}* (${size === '50ML' ? '50 ML' : '100 ML'} — ${formatINR(price)}).`,
    waNumber
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <button
        type="button"
        onClick={() => onNavigate('/shop')}
        className="mb-6 inline-flex min-h-[40px] items-center gap-2 text-xs font-medium text-[#F3EBDD]/75 hover:text-[#C9A24A] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Perfumes
      </button>

      {/* Main PDP Split: Sticky Gallery Left + Contiguous Purchase Module Right */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-6 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-lg border border-[#C9A24A]/20 bg-[#171614]">
            {!imgError ? (
              <img
                src={product.image_url}
                alt={`${product.name} — OUDVIN Fragrances`}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] flex-col items-center justify-center bg-[#181613] p-8 text-center">
                <span className="font-display text-3xl tracking-[0.2em] text-[#C9A24A]">OUDVIN</span>
                <span className="mt-2 text-sm text-[#F3EBDD]/70">{product.name}</span>
              </div>
            )}
          </div>

          {/* Olfactory Pyramid */}
          <div className="mt-6 rounded-lg border border-[#C9A24A]/20 bg-[#161512] p-5 sm:p-6">
            <h2 className="font-display text-xl font-semibold text-[#C9A24A]">
              Olfactory Composition
            </h2>
            <dl className="mt-4 divide-y divide-[#C9A24A]/15 text-sm">
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-[#F3EBDD]/60">Top Notes</dt>
                <dd className="col-span-2 text-[#F3EBDD]">{product.top_notes}</dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-[#F3EBDD]/60">Middle Notes</dt>
                <dd className="col-span-2 text-[#F3EBDD]">{product.middle_notes}</dd>
              </div>
              <div className="py-3 grid grid-cols-3 gap-3">
                <dt className="text-[#F3EBDD]/60">Base Notes</dt>
                <dd className="col-span-2 text-[#F3EBDD]">{product.base_notes}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Contiguous Purchase Module */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-lg border border-[#C9A24A]/20 bg-[#F3EBDD] p-6 sm:p-8 text-[#101010]">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#493323]">
              <button
                type="button"
                onClick={() => onNavigate(`/collection/${product.collection}`)}
                className="font-medium hover:underline"
              >
                {formatCollectionName(product.collection)}
              </button>
              <span aria-hidden="true">·</span>
              <span>{product.fragrance_family}</span>
              {Number(product.review_count || 0) > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 font-medium tabular-nums">
                    <Star className="h-3.5 w-3.5 fill-[#C9A24A] text-[#C9A24A]" />
                    {Number(product.avg_rating).toFixed(1)} ({product.review_count})
                  </span>
                </>
              )}
            </div>

            <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold text-[#101010]">
              {product.name}
            </h1>

            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#493323]">
              {product.description}
            </p>

            {/* Bottle Size Selector */}
            <div className="mt-6 pt-6 border-t border-[#493323]/15">
              <div className="flex items-center justify-between text-xs font-semibold text-[#493323]">
                <span>Select Bottle Size</span>
                <span>{outOfStock ? 'Currently Out of Stock' : `${stock} bottles available`}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {(['50ML', '100ML'] as BottleSize[]).map((opt) => {
                  const optPrice = opt === '100ML' ? product.price_100ml : product.price_50ml;
                  const optStock = opt === '100ML' ? product.stock_100ml : product.stock_50ml;
                  const selected = size === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSize(opt)}
                      className={`min-h-[64px] rounded-md border p-3 text-left transition-colors ${
                        selected
                          ? 'border-[#101010] bg-[#101010] text-[#F3EBDD]'
                          : 'border-[#493323]/25 bg-[#EAE0CE]/60 text-[#101010] hover:border-[#493323]'
                      }`}
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-semibold">{opt === '50ML' ? '50 ML' : '100 ML'}</span>
                        <span className={`text-base font-semibold tabular-nums ${selected ? 'text-[#C9A24A]' : 'text-[#101010]'}`}>
                          {formatINR(optPrice)}
                        </span>
                      </div>
                      <div className={`mt-1 text-[11px] ${selected ? 'text-[#F3EBDD]/70' : 'text-[#493323]/75'}`}>
                        {optStock > 0 ? 'Eau de Parfum · In Stock' : 'Out of Stock'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Price & Primary Actions */}
            <div className="mt-6 flex items-baseline justify-between">
              <span className="text-xs text-[#493323]">Selected Price (incl. taxes)</span>
              <span className="font-display text-3xl font-bold text-[#101010] tabular-nums">
                {formatINR(price)}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={outOfStock}
                onClick={() => onAddToCart(product, size)}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-[#101010] bg-transparent px-5 py-3 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#101010] hover:text-[#F3EBDD] disabled:opacity-40"
              >
                <ShoppingBag className="h-4 w-4" />
                Add to Bag
              </button>
              <button
                type="button"
                disabled={outOfStock}
                onClick={() => onBuyNow(product, size)}
                className="inline-flex min-h-[48px] items-center justify-center rounded-md bg-[#C9A24A] px-5 py-3 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#DFC076] disabled:opacity-40"
              >
                Buy Now
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onToggleWishlist(product)}
                aria-pressed={wishlistIds.includes(product.id)}
                className={`inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-xs font-semibold transition-colors ${
                  wishlistIds.includes(product.id)
                    ? 'border-[#101010] bg-[#101010] text-[#C9A24A]'
                    : 'border-[#493323]/30 bg-white text-[#493323] hover:border-[#101010] hover:text-[#101010]'
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${
                    wishlistIds.includes(product.id) ? 'fill-[#C9A24A] text-[#C9A24A]' : ''
                  }`}
                />
                {wishlistIds.includes(product.id) ? 'Saved in Wishlist' : 'Save to Wishlist'}
              </button>

              <a
                href={waQuickOrder}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md border border-[#493323]/30 bg-[#EAE0CE] px-4 py-2.5 text-xs font-semibold text-[#493323] transition-colors hover:bg-[#493323] hover:text-[#F3EBDD]"
              >
                <MessageCircle className="h-4 w-4" />
                Order on WhatsApp
              </a>
            </div>

            <div className="mt-5 border-t border-[#493323]/15 pt-4 text-xs text-[#493323]/85 space-y-1">
              <p>Eligible for BUY 2 GET 1 FREE when combined with any 3 bottles in your bag.</p>
              <p>Payment Options: UPI Payment (Scan &amp; Pay) and Cash on Delivery across India.</p>
            </div>
          </div>

          {/* Customer Reviews for this Perfume */}
          <div className="rounded-lg border border-[#C9A24A]/20 bg-[#161512] p-6">
            <h2 className="font-display text-2xl font-semibold text-[#F3EBDD]">
              Customer Reviews
            </h2>

            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-[#F3EBDD]/65">
                No published reviews for {product.name} yet. Be the first to share your impression below.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[#C9A24A]/15">
                {reviews.map((rev) => (
                  <li key={rev.id} className="py-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#F3EBDD]">{rev.customer_name}</span>
                      <div className="flex items-center gap-0.5 text-[#C9A24A]" aria-label={`${rev.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${i < rev.rating ? 'fill-[#C9A24A]' : 'text-[#F3EBDD]/20'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#F3EBDD]/80">{rev.comment}</p>
                  </li>
                ))}
              </ul>
            )}

            {/* Review Form */}
            <form onSubmit={handleReviewSubmit} className="mt-6 border-t border-[#C9A24A]/15 pt-5 space-y-4">
              <h3 className="text-sm font-semibold text-[#C9A24A]">Write a Review</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="pdp-reviewer-name">
                    Your Name
                  </label>
                  <input
                    id="pdp-reviewer-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm text-[#F3EBDD] placeholder:text-[#F3EBDD]/35"
                  />
                </div>
                <div>
                  <span className="block text-xs text-[#F3EBDD]/75 mb-1.5">Rating</span>
                  <div className="flex items-center gap-1.5 h-[44px]">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="p-1"
                        aria-label={`Rate ${star} stars`}
                      >
                        <Star
                          className={`h-5 w-5 ${
                            star <= rating ? 'fill-[#C9A24A] text-[#C9A24A]' : 'text-[#F3EBDD]/30'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="pdp-review-comment">
                  Your Experience
                </label>
                <textarea
                  id="pdp-review-comment"
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share notes on longevity, sillage, and fragrance impression..."
                  className="w-full rounded-md border border-[#C9A24A]/25 bg-[#101010] p-3.5 text-sm text-[#F3EBDD] placeholder:text-[#F3EBDD]/35"
                />
              </div>

              {reviewError && <p className="text-xs text-red-400">{reviewError}</p>}
              {reviewMessage && <p className="text-xs text-[#C9A24A]">{reviewMessage}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="min-h-[44px] rounded-md bg-[#C9A24A] px-5 py-2.5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076] disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Related Fragrances */}
      {related.length > 0 && (
        <section className="mt-16 border-t border-[#C9A24A]/15 pt-12">
          <h2 className="font-display text-3xl font-semibold text-[#F3EBDD]">
            More from {formatCollectionName(product.collection)}
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                isWishlisted={wishlistIds.includes(item.id)}
                onToggleWishlist={onToggleWishlist}
                onSelect={(p) => onNavigate(`/product/${p.slug}`)}
                onAddToCart={onAddToCart}
                onBuyNow={onBuyNow}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
