import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, MessageCircle, RefreshCw, Star } from 'lucide-react';
import type { BottleSize, Offer, Product, Review, SiteSettings } from '../types';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import {
  ASSETS,
  buildWhatsAppLink,
  formatIndianDisplayPhone,
  WHATSAPP_NUMBER,
} from '../lib/format';
import { BrandEmblem } from './BrandLogo';
import { CustomPerfumeSection } from './CustomPerfumeSection';
import { ProductCard } from './ProductCard';

interface HomeViewProps {
  products: Product[];
  offers: Offer[];
  siteSettings?: SiteSettings | null;
  loading: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  wishlistIds: number[];
  onToggleWishlist: (product: Product) => void;
  onNavigate: (path: string) => void;
  onAddToCart: (product: Product, size: BottleSize) => void;
  onBuyNow: (product: Product, size: BottleSize) => void;
}

type HomeTab = 'bestsellers' | 'new' | 'featured' | 'signature' | 'classic' | 'premium' | 'all';

export const HomeView: React.FC<HomeViewProps> = ({
  products,
  offers,
  siteSettings,
  loading,
  loadError,
  onRetry,
  wishlistIds,
  onToggleWishlist,
  onNavigate,
  onAddToCart,
  onBuyNow,
}) => {
  const [activeTab, setActiveTab] = useState<HomeTab>('bestsellers');
  const [showAllInTab, setShowAllInTab] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetchWithTimeout('/api/reviews', { signal: controller.signal }, 8000)
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((d) => setReviews((d.reviews || []).slice(0, 3)))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const displayedProducts = useMemo(() => {
    let list = products;
    if (activeTab === 'bestsellers') list = products.filter((p) => p.is_bestseller === 1);
    else if (activeTab === 'new') list = products.filter((p) => p.is_new_arrival === 1);
    else if (activeTab === 'featured') list = products.filter((p) => p.featured === 1);
    else if (activeTab === 'signature') list = products.filter((p) => p.collection === 'signature');
    else if (activeTab === 'classic') list = products.filter((p) => p.collection === 'classic');
    else if (activeTab === 'premium') list = products.filter((p) => p.collection === 'premium');
    return showAllInTab ? list : list.slice(0, 9);
  }, [products, activeTab, showAllInTab]);

  const totalTabCount = useMemo(() => {
    if (activeTab === 'bestsellers') return products.filter((p) => p.is_bestseller === 1).length;
    if (activeTab === 'new') return products.filter((p) => p.is_new_arrival === 1).length;
    if (activeTab === 'featured') return products.filter((p) => p.featured === 1).length;
    if (activeTab === 'signature') return products.filter((p) => p.collection === 'signature').length;
    if (activeTab === 'classic') return products.filter((p) => p.collection === 'classic').length;
    if (activeTab === 'premium') return products.filter((p) => p.collection === 'premium').length;
    return products.length;
  }, [products, activeTab]);

  const primaryOffer = offers[0] || null;
  const waNumber = siteSettings?.whatsapp_number || WHATSAPP_NUMBER;
  const waDisplay = formatIndianDisplayPhone(waNumber);
  const waOrderHref = buildWhatsAppLink(
    'Hello OUDVIN FRAGRANCES, I would like to place an order or enquire about your perfumes.',
    waNumber
  );

  const heroBanner = siteSettings?.hero_banner_url || ASSETS.hero;
  const heroTitle = siteSettings?.hero_title || 'Experience The Art Of Luxury.';
  const heroSubtitle =
    siteSettings?.hero_subtitle ||
    'Arabian haute parfumerie distilled from rare aged agarwood, crimson Damascus rose, pure white musk, and molten amber. Handcrafted in 50 ML and 100 ML flacons.';
  const sigBanner = siteSettings?.signature_banner_url || ASSETS.signatureBanner;
  const clsBanner = siteSettings?.classic_banner_url || ASSETS.classicBanner;
  const prmBanner = siteSettings?.premium_banner_url || ASSETS.presets[6].url;
  const promoText = siteSettings?.promo_banner_text || '';
  const seasonalSubtitle = siteSettings?.seasonal_subtitle || 'The Fragrance Vault';
  const seasonalTitle = siteSettings?.seasonal_title || 'Discover Our Perfumes';
  const aboutTitle = siteSettings?.about_title || 'About OUDVIN Fragrances';
  const aboutStory =
    siteSettings?.about_story_1 ||
    'OUDVIN FRAGRANCES is a luxury fragrance house inspired by the timeless elegance of Arabian perfumery and the art of fine fragrance creation. We believe every fragrance tells a story, creates memories and expresses individuality. Our mission is to bring an exceptional fragrance experience through carefully selected scents and luxurious collections.';

  return (
    <div className="bg-[#101010] text-[#F3EBDD]">
      {/* Optional Promotional Ribbon controlled from Admin CMS */}
      {promoText.trim() !== '' && (
        <div className="border-b border-[#C9A24A]/25 bg-[#1B1710] px-4 py-2 text-center text-xs font-medium text-[#C9A24A]">
          {promoText}
        </div>
      )}

      {/* 1. LUXURY HERO BANNER (Always renders immediately — never blocked by API requests) */}
      <section className="relative overflow-hidden border-b border-[#C9A24A]/20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch lg:grid-cols-12">
          <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:col-span-6 lg:py-20 lg:pr-10">
            <div className="flex items-center gap-3">
              {siteSettings?.logo_url ? (
                <img
                  src={siteSettings.logo_url}
                  alt="OUDVIN Fragrances"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded object-contain border border-[#C9A24A]/40"
                />
              ) : (
                <BrandEmblem size={42} />
              )}
              <span className="text-xs font-medium tracking-[0.26em] text-[#C9A24A] uppercase">
                OUDVIN Fragrances
              </span>
            </div>

            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.08] text-[#F3EBDD] sm:text-5xl lg:text-[3.65rem]">
              {heroTitle}
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#F3EBDD]/75 sm:text-base">
              {heroSubtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/shop')}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#C9A24A] px-7 py-3 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#DFC076] whitespace-nowrap"
              >
                Shop All Perfumes
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('/collection/signature')}
                className="inline-flex min-h-[48px] items-center justify-center rounded-md border border-[#C9A24A]/45 px-6 py-3 text-sm font-semibold text-[#F3EBDD] transition-colors hover:border-[#C9A24A] hover:text-[#C9A24A] whitespace-nowrap"
              >
                Signature Collection
              </button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#C9A24A]/15 pt-5 text-xs text-[#F3EBDD]/65">
              <span>50 ML from ₹900</span>
              <span aria-hidden="true">·</span>
              <span>100 ML from ₹1,700</span>
              <span aria-hidden="true">·</span>
              <span>UPI &amp; Cash on Delivery</span>
            </div>
          </div>

          <div className="relative min-h-[300px] sm:min-h-[400px] lg:col-span-6">
            <img
              src={heroBanner}
              alt="OUDVIN Fragrances luxury Arabian obsidian and royal gold oud perfume bottles"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#101010] via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#101010] lg:via-transparent lg:to-transparent" />
          </div>
        </div>
      </section>

      {/* 2. SPECIAL OFFER SPOTLIGHT (Live from DB, editable by Admin) */}
      {primaryOffer && (
        <section className="border-b border-[#C9A24A]/20 bg-[#171511]">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-medium tracking-[0.2em] text-[#C9A24A]">
                Special House Privilege {primaryOffer.expires_at ? `· Valid until ${primaryOffer.expires_at}` : ''}
              </p>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-[#F3EBDD]">
                {primaryOffer.title}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#F3EBDD]/75">{primaryOffer.description}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/offers')}
              className="min-h-[44px] shrink-0 rounded-md border border-[#C9A24A] px-5 py-2.5 text-xs font-semibold text-[#C9A24A] transition-colors hover:bg-[#C9A24A] hover:text-[#101010] whitespace-nowrap"
            >
              View Offers
            </button>
          </div>
        </section>
      )}

      {/* 3. THREE LUXURY COLLECTIONS SHOWCASE */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">Curated Houses</p>
            <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-semibold text-[#F3EBDD]">
              Three Distinct Fragrance Collections
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C9A24A] hover:underline whitespace-nowrap"
          >
            View All {products.length || 48} Perfumes
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Signature Collection (Black & Gold) */}
          <button
            type="button"
            onClick={() => onNavigate('/collection/signature')}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-[#C9A24A]/35 bg-[#151412] text-left transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="aspect-[16/10] w-full overflow-hidden">
              <img
                src={sigBanner}
                alt="OUDVIN Signature Collection — Black and Gold Arabian Luxury"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-1 flex-col justify-between p-6">
              <div>
                <p className="text-xs font-medium text-[#C9A24A]">Black &amp; Royal Gold</p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-[#F3EBDD]">
                  Signature Collection
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#F3EBDD]/70">
                  Premium Arabian luxury fragrances anchored by Ameer Oud, Rose Oud, With Oud, and Royal Amber.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#C9A24A]">
                Explore Signature <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>

          {/* Classic Collection (Ivory Cream & Oud Brown) */}
          <button
            type="button"
            onClick={() => onNavigate('/collection/classic')}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-[#493323]/30 bg-[#F3EBDD] text-left text-[#101010] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="aspect-[16/10] w-full overflow-hidden">
              <img
                src={clsBanner}
                alt="OUDVIN Classic Collection — Ivory Cream and Oud Brown Everyday Perfumes"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-1 flex-col justify-between p-6">
              <div>
                <p className="text-xs font-medium text-[#493323]">Ivory Cream &amp; Oud Brown</p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-[#101010]">
                  Classic Collection
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#493323]/85">
                  Elegant everyday fragrances including Shanaya, Mask E Tahara, Forest Frenzy, and Royal Sandal.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#493323]">
                Explore Classic <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>

          {/* Premium Collection (Exclusive Reserve) */}
          <button
            type="button"
            onClick={() => onNavigate('/collection/premium')}
            className="group relative flex flex-col overflow-hidden rounded-lg border border-[#C9A24A]/35 bg-[#181511] text-left transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div className="aspect-[16/10] w-full overflow-hidden">
              <img
                src={prmBanner}
                alt="OUDVIN Premium Collection — Exclusive Reserve Perfumes"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            </div>
            <div className="flex flex-1 flex-col justify-between p-6">
              <div>
                <p className="text-xs font-medium text-[#C9A24A]">Exclusive Reserve</p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-[#F3EBDD]">
                  Premium Collection
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#F3EBDD]/70">
                  High-end rare blends featuring Royal Oud, Sultan&apos;s Legacy, Oud Royale, and Royal Elixir.
                </p>
              </div>
              <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#C9A24A]">
                Explore Premium <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* 4. CURATED CATALOGUE (Best Sellers, New Arrivals, Featured, Collections, Shop All) */}
      <section className="border-t border-[#C9A24A]/15 bg-[#12110F] py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">
                {seasonalSubtitle}
              </p>
              <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-semibold text-[#F3EBDD]">
                {seasonalTitle}
              </h2>
            </div>

            {/* Interactive Filter Bar */}
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter perfume catalogue">
              {[
                { key: 'bestsellers', label: 'Best Sellers' },
                { key: 'featured', label: 'Featured' },
                { key: 'new', label: 'New Arrivals' },
                { key: 'signature', label: 'Signature' },
                { key: 'classic', label: 'Classic' },
                { key: 'premium', label: 'Premium' },
                { key: 'all', label: `Shop All (${products.length || 0})` },
              ].map((tab) => {
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveTab(tab.key as HomeTab);
                      setShowAllInTab(false);
                    }}
                    className={`min-h-[40px] rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#C9A24A] text-[#101010]'
                        : 'border border-[#C9A24A]/20 bg-[#181613] text-[#F3EBDD]/80 hover:border-[#C9A24A]/50 hover:text-[#F3EBDD]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[420px] animate-pulse rounded-lg bg-[#1A1815]" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="mt-8 rounded-lg border border-[#C9A24A]/25 bg-[#171614] p-8 text-center">
              <p className="font-display text-2xl font-semibold text-[#F3EBDD]">
                {loadError ? 'Catalogue Temporarily Unavailable' : 'No Perfumes Currently Listed'}
              </p>
              <p className="mt-2 mx-auto max-w-md text-sm text-[#F3EBDD]/70">
                {loadError ||
                  'Our fragrance collection is being updated. You can refresh or message our concierge on WhatsApp.'}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex min-h-[46px] items-center gap-2 rounded-md bg-[#C9A24A] px-6 py-2.5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry Loading Perfumes
                  </button>
                )}
                <a
                  href={waOrderHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-md border border-[#C9A24A]/45 px-5 py-2.5 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A]/10"
                >
                  <MessageCircle className="h-4 w-4" />
                  Order on WhatsApp ({waDisplay})
                </a>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {displayedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    variant={activeTab === 'signature' ? 'obsidian' : 'ivory'}
                    isWishlisted={wishlistIds.includes(product.id)}
                    onToggleWishlist={onToggleWishlist}
                    onSelect={(p) => onNavigate(`/product/${p.slug}`)}
                    onAddToCart={onAddToCart}
                    onBuyNow={onBuyNow}
                  />
                ))}
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                {!showAllInTab && totalTabCount > displayedProducts.length && (
                  <button
                    type="button"
                    onClick={() => setShowAllInTab(true)}
                    className="min-h-[46px] rounded-md border border-[#C9A24A]/50 px-6 py-2.5 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A] hover:text-[#101010]"
                  >
                    Show All {totalTabCount} in This Selection
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigate('/shop')}
                  className="min-h-[46px] rounded-md bg-[#C9A24A] px-6 py-2.5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076]"
                >
                  Open Full Catalogue &amp; Search
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 5. CUSTOM PERFUME CREATION */}
      <CustomPerfumeSection />

      {/* 6. ABOUT OUDVIN */}
      <section className="border-t border-[#C9A24A]/15 bg-[#101010] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
          <div className="lg:col-span-6">
            <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">The Fragrance House</p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-[#F3EBDD]">
              {aboutTitle}
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#F3EBDD]/80">
              {aboutStory}
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/about')}
              className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[#C9A24A]/45 px-5 py-2.5 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A] hover:text-[#101010]"
            >
              Read Our Story
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-lg border border-[#C9A24A]/20">
              <img
                src={clsBanner}
                alt="OUDVIN Fragrances perfumery craftsmanship"
                loading="lazy"
                referrerPolicy="no-referrer"
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 7. CUSTOMER REVIEWS (Authentic Moderated Reviews Only — No Fake Reviews) */}
      <section className="border-t border-[#C9A24A]/15 bg-[#151412] py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">Client Impressions</p>
              <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-semibold text-[#F3EBDD]">
                Customer Reviews
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/reviews')}
              className="min-h-[42px] rounded-md border border-[#C9A24A]/40 px-4 py-2 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A] hover:text-[#101010] whitespace-nowrap"
            >
              Write or Read Reviews
            </button>
          </div>

          {reviews.length === 0 ? (
            <div className="mt-6 rounded-lg border border-[#C9A24A]/20 bg-[#101010] p-7 text-sm text-[#F3EBDD]/75">
              We publish only genuine reviews submitted by our clients after moderation. Have you experienced an OUDVIN fragrance?{' '}
              <button
                type="button"
                onClick={() => onNavigate('/reviews')}
                className="font-semibold text-[#C9A24A] underline underline-offset-4"
              >
                Share your review
              </button>
              .
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {reviews.map((rev) => (
                <article key={rev.id} className="rounded-lg border border-[#C9A24A]/20 bg-[#101010] p-6">
                  <div className="flex items-center gap-0.5 text-[#C9A24A]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i < rev.rating ? 'fill-[#C9A24A]' : 'text-[#F3EBDD]/20'}`}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#F3EBDD]/85">&ldquo;{rev.comment}&rdquo;</p>
                  <p className="mt-4 text-xs font-semibold text-[#C9A24A]">
                    {rev.customer_name}
                    {rev.product_name ? ` · ${rev.product_name}` : ''}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 8. CONTACT US & DIRECT WHATSAPP ORDER CTA */}
      <section className="border-t border-[#C9A24A]/20 bg-[#F3EBDD] py-14 text-[#101010]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-[#493323]">Personal Fragrance Concierge · India</p>
            <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-semibold text-[#101010]">
              Order Directly on WhatsApp
            </h2>
            <p className="mt-2 max-w-xl text-sm text-[#493323]">
              Need help choosing between Ameer Oud, Rose Oud, or Mask E Tahara? Message our India perfumery desk directly on {waDisplay} for fast pan-India dispatch.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={waOrderHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-md bg-[#101010] px-6 py-3 text-sm font-semibold text-[#C9A24A] transition-colors hover:bg-[#231F1B] whitespace-nowrap"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Order ({waDisplay})
            </a>
            <button
              type="button"
              onClick={() => onNavigate('/contact')}
              className="inline-flex min-h-[48px] items-center rounded-md border border-[#493323]/35 px-5 py-3 text-sm font-semibold text-[#493323] hover:bg-[#493323]/10 whitespace-nowrap"
            >
              Contact Details
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
