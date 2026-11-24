import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Heart, Menu, Search, ShoppingBag, X } from 'lucide-react';
import type { Product } from '../types';
import { formatCollectionName, formatINR } from '../lib/format';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  currentPath: string;
  cartCount: number;
  wishlistCount: number;
  products: Product[];
  logoUrl?: string;
  onNavigate: (path: string) => void;
  onSearchCatalog: (query: string) => void;
  onOpenCart: () => void;
}

const NAV_LINKS = [
  { label: 'Shop All', path: '/shop' },
  { label: 'Collections', path: '/collection/signature' },
  { label: 'Offers', path: '/offers' },
  { label: 'Custom', path: '/custom-perfume' },
  { label: 'Track Order', path: '/track-order' },
];

function matchProduct(product: Product, rawQuery: string): { matched: boolean; matchedNote: string | null } {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { matched: false, matchedNote: null };
  const tokens = q.split(/\s+/).filter(Boolean);

  const searchable = `${product.name} ${product.fragrance_family} ${product.collection} ${product.top_notes} ${product.middle_notes} ${product.base_notes}`.toLowerCase();
  const matched = tokens.every((tok) => searchable.includes(tok));
  if (!matched) return { matched: false, matchedNote: null };

  // Highlight which note layer matched when query isn't strictly the product name
  if (product.top_notes.toLowerCase().includes(q)) return { matched: true, matchedNote: `Top: ${product.top_notes}` };
  if (product.middle_notes.toLowerCase().includes(q)) return { matched: true, matchedNote: `Heart: ${product.middle_notes}` };
  if (product.base_notes.toLowerCase().includes(q)) return { matched: true, matchedNote: `Base: ${product.base_notes}` };
  return { matched: true, matchedNote: `${formatCollectionName(product.collection)} · ${product.fragrance_family}` };
}

export const Header: React.FC<HeaderProps> = ({
  currentPath,
  cartCount,
  wishlistCount,
  products,
  logoUrl,
  onNavigate,
  onSearchCatalog,
  onOpenCart,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const results: Array<{ product: Product; subtitle: string }> = [];
    for (const p of products) {
      const check = matchProduct(p, trimmed);
      if (check.matched) {
        results.push({
          product: p,
          subtitle: check.matchedNote || p.fragrance_family,
        });
      }
    }
    return results;
  }, [products, query]);

  const visibleMatches = matches.slice(0, 6);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 40);
    }
  }, [mobileSearchOpen]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const closeAllOverlays = () => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    setDropdownOpen(false);
  };

  const handleLinkClick = (path: string) => {
    closeAllOverlays();
    onNavigate(path);
  };

  const handleSelectProduct = (slug: string) => {
    setQuery('');
    closeAllOverlays();
    onNavigate(`/product/${slug}`);
  };

  const handleSubmitSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    if (activeIndex >= 0 && activeIndex < visibleMatches.length) {
      handleSelectProduct(visibleMatches[activeIndex].product.slug);
      return;
    }
    closeAllOverlays();
    onSearchCatalog(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      setMobileSearchOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleMatches.length > 0) {
        setDropdownOpen(true);
        setActiveIndex((prev) => (prev + 1) % visibleMatches.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visibleMatches.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? visibleMatches.length - 1 : prev - 1));
      }
    }
  };

  const renderResultsList = () => {
    const trimmed = query.trim();
    if (!trimmed) return null;

    if (matches.length === 0) {
      return (
        <div className="p-4 text-center">
          <p className="text-sm text-[#F3EBDD]">No perfumes matched &ldquo;{trimmed}&rdquo;</p>
          <p className="mt-1 text-xs text-[#F3EBDD]/60">
            Try searching by name (Ameer Oud, Shanaya) or notes (rose, musk, saffron, amber).
          </p>
        </div>
      );
    }

    return (
      <div>
        <ul className="divide-y divide-[#C9A24A]/12 max-h-80 overflow-y-auto" role="listbox">
          {visibleMatches.map(({ product, subtitle }, idx) => {
            const isHighlighted = idx === activeIndex;
            return (
              <li key={product.id} role="option" aria-selected={isHighlighted}>
                <button
                  type="button"
                  onClick={() => handleSelectProduct(product.slug)}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                    isHighlighted ? 'bg-[#C9A24A]/15' : 'hover:bg-white/5'
                  }`}
                >
                  <img
                    src={product.image_url}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="h-11 w-11 shrink-0 rounded object-cover bg-[#101010]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold leading-tight text-[#F3EBDD]">
                      {product.name}
                    </p>
                    <p className="truncate text-[11px] text-[#F3EBDD]/65">{subtitle}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="block text-xs font-semibold text-[#C9A24A] tabular-nums">
                      {formatINR(product.price_50ml)}
                    </span>
                    <span className="text-[10px] text-[#F3EBDD]/50">50 ml</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => handleSubmitSearch()}
          className="flex w-full items-center justify-between border-t border-[#C9A24A]/20 bg-[#12110F] px-3.5 py-2.5 text-xs font-semibold text-[#C9A24A] hover:bg-[#1C1A16]"
        >
          <span>
            View all {matches.length} matching perfume{matches.length === 1 ? '' : 's'}
          </span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#C9A24A]/20 bg-[#101010]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 lg:gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('/')}
          className="text-left focus-visible:outline-none"
          aria-label="OUDVIN Fragrances Home"
        >
          <BrandLogo compact logoUrl={logoUrl} />
        </button>

        {/* Zone 2: 5 concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-5 lg:gap-7 text-sm font-medium text-[#F3EBDD]/80" aria-label="Primary">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.path === '/collection/signature'
                ? currentPath.startsWith('/collection')
                : currentPath === link.path;
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => handleLinkClick(link.path)}
                className={`relative py-1 transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-[#C9A24A]'
                    : 'text-[#F3EBDD]/80 hover:text-[#F3EBDD]'
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-0.5 h-px bg-[#C9A24A]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Real-time Search + Shopping Bag + Mobile Menu */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Desktop Real-Time Search Bar */}
          <div ref={searchContainerRef} className="relative hidden lg:block w-60 xl:w-72">
            <form onSubmit={handleSubmitSearch} role="search">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A24A]/75"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onFocus={() => setDropdownOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDropdownOpen(true);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search perfumes or notes..."
                aria-label="Search perfumes by name or fragrance notes"
                className="h-10 w-full rounded-md border border-[#C9A24A]/30 bg-[#171614] pl-9 pr-8 text-xs text-[#F3EBDD] placeholder:text-[#F3EBDD]/45 transition-colors focus:border-[#C9A24A] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setDropdownOpen(false);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#F3EBDD]/55 hover:text-[#F3EBDD]"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </form>

            {dropdownOpen && query.trim().length > 0 && (
              <div className="absolute right-0 top-full mt-2 w-80 xl:w-96 overflow-hidden rounded-lg border border-[#C9A24A]/35 bg-[#161512] shadow-2xl">
                {renderResultsList()}
              </div>
            )}
          </div>

          {/* Mobile / Tablet Search Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setMobileSearchOpen((v) => !v);
            }}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors lg:hidden ${
              mobileSearchOpen
                ? 'border-[#C9A24A] bg-[#C9A24A]/15 text-[#C9A24A]'
                : 'border-[#C9A24A]/30 text-[#F3EBDD] hover:text-[#C9A24A]'
            }`}
            aria-label={mobileSearchOpen ? 'Close search' : 'Search perfumes'}
          >
            {mobileSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => handleLinkClick('/wishlist')}
            className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              currentPath === '/wishlist'
                ? 'border-[#C9A24A] bg-[#C9A24A]/15 text-[#C9A24A]'
                : 'border-[#C9A24A]/30 text-[#F3EBDD] hover:border-[#C9A24A] hover:text-[#C9A24A]'
            }`}
            aria-label={`My Wishlist (${wishlistCount} saved)`}
            title="My Wishlist"
          >
            <Heart
              className={`h-4 w-4 shrink-0 ${
                wishlistCount > 0 ? 'fill-[#C9A24A] text-[#C9A24A]' : ''
              }`}
            />
            {wishlistCount > 0 && <span className="tabular-nums">{wishlistCount}</span>}
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-[#C9A24A]/50 bg-[#C9A24A] px-3.5 py-2 text-xs font-semibold text-[#101010] transition-colors hover:bg-[#DFC076] whitespace-nowrap shrink-0"
            aria-label={`Open shopping bag with ${cartCount} items`}
          >
            <ShoppingBag className="h-4 w-4 shrink-0" />
            <span className="tabular-nums">Bag ({cartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileSearchOpen(false);
              setMobileMenuOpen((v) => !v);
            }}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#C9A24A]/30 text-[#F3EBDD] md:hidden"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Real-Time Search Panel */}
      {mobileSearchOpen && (
        <div className="border-t border-[#C9A24A]/20 bg-[#141311] px-4 py-3 lg:hidden">
          <form onSubmit={handleSubmitSearch} role="search" className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A24A]"
              aria-hidden="true"
            />
            <input
              ref={mobileInputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by perfume name or note (oud, rose, musk)..."
              aria-label="Search perfumes by name or fragrance notes"
              className="min-h-[44px] w-full rounded-md border border-[#C9A24A]/35 bg-[#101010] pl-10 pr-10 text-sm text-[#F3EBDD] placeholder:text-[#F3EBDD]/45 focus:border-[#C9A24A] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#F3EBDD]/60 hover:text-[#F3EBDD]"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {query.trim().length > 0 && (
            <div className="mt-2.5 overflow-hidden rounded-lg border border-[#C9A24A]/25 bg-[#161512]">
              {renderResultsList()}
            </div>
          )}
        </div>
      )}

      {/* Mobile Navigation Sheet */}
      {mobileMenuOpen && (
        <div className="border-t border-[#C9A24A]/20 bg-[#101010] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {[
              { label: 'Home', path: '/' },
              { label: 'Shop All Perfumes', path: '/shop' },
              { label: 'Signature Collection', path: '/collection/signature' },
              { label: 'Classic Collection', path: '/collection/classic' },
              { label: 'Premium Collection', path: '/collection/premium' },
              { label: 'Special Offers', path: '/offers' },
              { label: `My Wishlist${wishlistCount > 0 ? ` (${wishlistCount})` : ''}`, path: '/wishlist' },
              { label: 'Track Order', path: '/track-order' },
              { label: 'Custom Perfume Creation', path: '/custom-perfume' },
              { label: 'About OUDVIN', path: '/about' },
              { label: 'Customer Reviews', path: '/reviews' },
              { label: 'Contact Us', path: '/contact' },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleLinkClick(item.path)}
                className={`min-h-[44px] rounded-md px-3 text-left text-sm font-medium transition-colors ${
                  currentPath === item.path
                    ? 'bg-[#C9A24A]/15 text-[#C9A24A]'
                    : 'text-[#F3EBDD]/85 hover:bg-white/5'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};
