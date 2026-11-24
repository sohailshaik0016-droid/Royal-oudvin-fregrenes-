import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import type { BottleSize, CollectionType, Product, SiteSettings } from '../types';
import { ASSETS } from '../lib/format';
import { ProductCard } from './ProductCard';

interface CatalogViewProps {
  products: Product[];
  siteSettings?: SiteSettings | null;
  loading: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  wishlistIds: number[];
  onToggleWishlist: (product: Product) => void;
  collectionFilter?: CollectionType | 'all';
  initialTag?: 'all' | 'bestsellers' | 'new';
  initialSearchQuery?: string;
  onNavigate: (path: string) => void;
  onAddToCart: (product: Product, size: BottleSize) => void;
  onBuyNow: (product: Product, size: BottleSize) => void;
}

const COLLECTION_META: Record<
  'all' | CollectionType,
  {
    title: string;
    subtitle: string;
    description: string;
    banner: string;
    theme: 'dark' | 'classic';
  }
> = {
  all: {
    title: 'All Fragrances',
    subtitle: 'Complete OUDVIN Catalogue',
    description:
      'Explore all 48+ handcrafted luxury fragrances across our Signature, Classic, and Premium collections. Starting at ₹900 for 50 ML and ₹1,700 for 100 ML.',
    banner: ASSETS.hero,
    theme: 'dark',
  },
  signature: {
    title: 'Signature Collection',
    subtitle: 'Premium Arabian Luxury',
    description:
      'Bold black-and-gold Arabian oud masterpieces steeped in rare agarwood, saffron, Damascus rose, and deep nocturnal amber.',
    banner: ASSETS.signatureBanner,
    theme: 'dark',
  },
  classic: {
    title: 'Classic Collection',
    subtitle: 'Timeless Everyday Elegance',
    description:
      'Refined ivory-and-oud-brown compositions crafted for serene daily wear—featuring pure Mask E Tahara white musk, royal sandalwood, and sunlit florals.',
    banner: ASSETS.classicBanner,
    theme: 'classic',
  },
  premium: {
    title: 'Premium Collection',
    subtitle: 'Exclusive Haute Parfumerie Reserve',
    description:
      'Our rarest high-concentration reserve extraits blending aged Assam oud, Taif rose, royal ambergris, and imperial resins.',
    banner: ASSETS.hero,
    theme: 'dark',
  },
};

export const CatalogView: React.FC<CatalogViewProps> = ({
  products,
  siteSettings,
  loading,
  loadError,
  onRetry,
  wishlistIds,
  onToggleWishlist,
  collectionFilter = 'all',
  initialTag = 'all',
  initialSearchQuery = '',
  onNavigate,
  onAddToCart,
  onBuyNow,
}) => {
  const [search, setSearch] = useState(initialSearchQuery);
  const [familyFilter, setFamilyFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState<'all' | 'bestsellers' | 'new'>(initialTag);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'name'>('featured');

  useEffect(() => {
    setSearch(initialSearchQuery);
  }, [initialSearchQuery]);

  const baseMeta = COLLECTION_META[collectionFilter] || COLLECTION_META.all;
  const resolvedBanner =
    collectionFilter === 'signature'
      ? siteSettings?.signature_banner_url || baseMeta.banner
      : collectionFilter === 'classic'
      ? siteSettings?.classic_banner_url || baseMeta.banner
      : collectionFilter === 'premium'
      ? siteSettings?.premium_banner_url || baseMeta.banner
      : siteSettings?.hero_banner_url || baseMeta.banner;
  const meta = { ...baseMeta, banner: resolvedBanner };
  const isClassicTheme = meta.theme === 'classic';

  const collectionScoped = useMemo(() => {
    if (collectionFilter === 'all') return products;
    return products.filter((p) => p.collection === collectionFilter);
  }, [products, collectionFilter]);

  const fragranceFamilies = useMemo(() => {
    const families = Array.from(new Set(collectionScoped.map((p) => p.fragrance_family))).sort();
    return families;
  }, [collectionScoped]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = collectionScoped.filter((p) => {
      if (tagFilter === 'bestsellers' && !p.is_bestseller) return false;
      if (tagFilter === 'new' && !p.is_new_arrival) return false;
      if (familyFilter !== 'all' && p.fragrance_family !== familyFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.fragrance_family} ${p.top_notes} ${p.middle_notes} ${p.base_notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => a.price_50ml - b.price_50ml);
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => b.price_50ml - a.price_50ml);
    } else if (sortBy === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [collectionScoped, search, familyFilter, tagFilter, sortBy]);

  return (
    <div className={isClassicTheme ? 'bg-[#F3EBDD] text-[#101010] min-h-screen' : 'bg-[#101010] text-[#F3EBDD] min-h-screen'}>
      {/* Collection Hero Banner */}
      <section className="relative overflow-hidden border-b border-[#C9A24A]/20">
        <div className="relative h-64 sm:h-80 w-full">
          <img
            src={meta.banner}
            alt={meta.title}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-[#101010]/65 to-[#101010]/25" />
          <div className="absolute inset-0 mx-auto flex max-w-7xl flex-col justify-end px-4 pb-8 sm:px-6 lg:px-8">
            <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">{meta.subtitle}</p>
            <h1 className="mt-1.5 font-display text-4xl sm:text-5xl font-semibold text-[#F3EBDD]">
              {meta.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#F3EBDD]/80">{meta.description}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Collection Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-5 border-current/15">
          {[
            { label: 'All Perfumes', path: '/shop', key: 'all' },
            { label: 'Signature Collection', path: '/collection/signature', key: 'signature' },
            { label: 'Classic Collection', path: '/collection/classic', key: 'classic' },
            { label: 'Premium Collection', path: '/collection/premium', key: 'premium' },
          ].map((tab) => {
            const active = collectionFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onNavigate(tab.path)}
                className={`min-h-[42px] rounded-md px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? isClassicTheme
                      ? 'bg-[#493323] text-[#F3EBDD]'
                      : 'bg-[#C9A24A] text-[#101010]'
                    : isClassicTheme
                    ? 'bg-[#E6DAC6] text-[#493323] hover:bg-[#DACBB1]'
                    : 'bg-[#1A1815] text-[#F3EBDD]/80 hover:text-[#C9A24A]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search + Filter Controls */}
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search
              className={`pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 ${
                isClassicTheme ? 'text-[#493323]/60' : 'text-[#C9A24A]/70'
              }`}
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by perfume name or note (oud, rose, musk, amber)..."
              className={`w-full min-h-[44px] rounded-md border pl-10 pr-9 text-sm ${
                isClassicTheme
                  ? 'border-[#493323]/25 bg-white text-[#101010] placeholder:text-[#493323]/50'
                  : 'border-[#C9A24A]/25 bg-[#171614] text-[#F3EBDD] placeholder:text-[#F3EBDD]/40'
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-current/60 hover:text-current"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 md:col-span-7 md:justify-end">
            <div className="inline-flex items-center gap-1 rounded-md border border-current/15 p-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'bestsellers', label: 'Best Sellers' },
                { key: 'new', label: 'New Arrivals' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTagFilter(t.key as 'all' | 'bestsellers' | 'new')}
                  className={`min-h-[34px] rounded px-3 text-xs font-medium whitespace-nowrap transition-colors ${
                    tagFilter === t.key
                      ? isClassicTheme
                        ? 'bg-[#493323] text-[#F3EBDD]'
                        : 'bg-[#C9A24A] text-[#101010]'
                      : 'text-current/70 hover:text-current'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Filter by fragrance family"
              value={familyFilter}
              onChange={(e) => setFamilyFilter(e.target.value)}
              className={`min-h-[44px] rounded-md border px-3 text-xs font-medium ${
                isClassicTheme
                  ? 'border-[#493323]/25 bg-white text-[#101010]'
                  : 'border-[#C9A24A]/25 bg-[#171614] text-[#F3EBDD]'
              }`}
            >
              <option value="all">All Scent Families</option>
              {fragranceFamilies.map((fam) => (
                <option key={fam} value={fam}>
                  {fam}
                </option>
              ))}
            </select>

            <div className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 opacity-65 hidden sm:inline" />
              <select
                aria-label="Sort perfumes"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className={`min-h-[44px] rounded-md border px-3 text-xs font-medium ${
                  isClassicTheme
                    ? 'border-[#493323]/25 bg-white text-[#101010]'
                    : 'border-[#C9A24A]/25 bg-[#171614] text-[#F3EBDD]'
                }`}
              >
                <option value="featured">Featured</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Count line */}
        <p className="mt-5 text-xs opacity-70 tabular-nums">
          Showing {filtered.length} of {collectionScoped.length} fragrances
        </p>

        {/* Product Grid */}
        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-[420px] animate-pulse rounded-lg bg-[#1C1A17]" />
            ))}
          </div>
        ) : products.length === 0 && loadError ? (
          <div className="mt-8 rounded-lg border border-current/20 p-10 text-center">
            <p className="font-display text-2xl">Unable to Load Perfumes</p>
            <p className="mt-2 text-sm opacity-75">{loadError}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#C9A24A] px-5 py-2 text-xs font-semibold text-[#101010]"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-lg border border-current/15 p-12 text-center">
            <p className="font-display text-2xl">No matching perfumes found</p>
            <p className="mt-2 text-sm opacity-70">
              Try clearing your search or choosing a different scent family.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFamilyFilter('all');
                setTagFilter('all');
              }}
              className="mt-5 min-h-[44px] rounded-md bg-[#C9A24A] px-5 py-2 text-xs font-semibold text-[#101010]"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                variant={collectionFilter === 'signature' ? 'obsidian' : 'ivory'}
                isWishlisted={wishlistIds.includes(product.id)}
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
