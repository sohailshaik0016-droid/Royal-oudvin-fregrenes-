import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { BottleSize, CartItem, CollectionType, Offer, Product, SiteSettings } from './types';
import { fetchWithTimeout } from './lib/fetchWithTimeout';
import { buildWhatsAppLink, formatIndianDisplayPhone, WHATSAPP_NUMBER } from './lib/format';
import { AdminPanel } from './components/AdminPanel';
import { BrandLogo } from './components/BrandLogo';
import { CartDrawer } from './components/CartDrawer';
import { CatalogView } from './components/CatalogView';
import { CheckoutView } from './components/CheckoutView';
import { CustomPerfumeSection } from './components/CustomPerfumeSection';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import {
  AboutPage,
  ContactPage,
  OffersPage,
  PolicyPage,
  ReviewsPage,
} from './components/InfoPages';
import { OrderTrackingView } from './components/OrderTrackingView';
import { ProductDetailView } from './components/ProductDetailView';
import { WishlistView } from './components/WishlistView';

const CART_STORAGE_KEY = 'oudvin_shopping_bag_v1';
const WISHLIST_STORAGE_KEY = 'oudvin_wishlist_v1';

function loadInitialCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadInitialWishlist(): number[] {
  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [path, setPath] = useState<string>(() => window.location.pathname || '/');
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>(loadInitialCart);
  const [wishlistIds, setWishlistIds] = useState<number[]>(loadInitialWishlist);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const fetchingRef = useRef(false);

  const fetchStoreData = useCallback(async (showSpinner = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    if (showSpinner) {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const [prodResult, offResult, settingsResult] = await Promise.allSettled([
        fetchWithTimeout('/api/products', {}, 8000).then(async (res) => {
          if (!res.ok) throw new Error(`Catalogue unavailable (${res.status})`);
          return res.json();
        }),
        fetchWithTimeout('/api/offers', {}, 8000).then(async (res) => {
          if (!res.ok) throw new Error(`Offers unavailable (${res.status})`);
          return res.json();
        }),
        fetchWithTimeout('/api/site-settings', {}, 8000).then(async (res) => {
          if (!res.ok) throw new Error(`Settings unavailable (${res.status})`);
          return res.json();
        }),
      ]);

      if (prodResult.status === 'fulfilled') {
        setProducts(Array.isArray(prodResult.value?.products) ? prodResult.value.products : []);
      } else {
        setLoadError('Unable to load the perfume catalogue right now. Please check your connection and tap Retry.');
      }

      if (offResult.status === 'fulfilled') {
        setOffers(Array.isArray(offResult.value?.offers) ? offResult.value.offers : []);
      }

      if (settingsResult.status === 'fulfilled' && settingsResult.value?.settings) {
        setSiteSettings(settingsResult.value.settings);
      }
    } catch {
      setLoadError('Temporary connection issue while loading the store. Please tap Retry.');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchStoreData(false);
  }, [fetchStoreData]);

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname || '/');
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
    } catch {
      // Ignore storage quota errors
    }
  }, [wishlistIds]);

  const navigate = useCallback((nextPath: string) => {
    const normalized = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
    const [pathnameOnly] = normalized.split('?');
    if (pathnameOnly !== '/shop') {
      setCatalogSearch('');
    }
    if (`${window.location.pathname}${window.location.search}` !== normalized) {
      window.history.pushState({}, '', normalized);
    }
    setPath(pathnameOnly);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleHeaderSearchSubmit = useCallback(
    (query: string) => {
      setCatalogSearch(query);
      if (window.location.pathname !== '/shop') {
        window.history.pushState({}, '', '/shop');
      }
      setPath('/shop');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const addToCart = useCallback((product: Product, size: BottleSize, openDrawer = true) => {
    const unitPrice = size === '100ML' ? product.price_100ml : product.price_50ml;
    const maxStock = size === '100ML' ? product.stock_100ml : product.stock_50ml;
    if (maxStock <= 0) return;

    setCart((prev) => {
      const idx = prev.findIndex((item) => item.productId === product.id && item.size === size);
      if (idx >= 0) {
        const next = [...prev];
        const nextQty = Math.min(next[idx].quantity + 1, maxStock);
        next[idx] = { ...next[idx], quantity: nextQty, unitPrice, maxStock };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image_url: product.image_url,
          collection: product.collection,
          size,
          unitPrice,
          quantity: 1,
          maxStock,
        },
      ];
    });

    if (openDrawer) {
      setCartOpen(true);
    } else {
      showToast(`Added ${product.name} (${size === '50ML' ? '50 ML' : '100 ML'}) to your bag.`);
    }
  }, []);

  const handleBuyNow = useCallback(
    (product: Product, size: BottleSize) => {
      addToCart(product, size, false);
      setCartOpen(false);
      navigate('/checkout');
    },
    [addToCart, navigate]
  );

  const updateCartQty = useCallback((productId: number, size: BottleSize, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId !== productId || item.size !== size) return item;
          const nextQty = Math.min(item.quantity + delta, item.maxStock);
          return { ...item, quantity: nextQty };
        })
        .filter((item) => item.quantity > 0)
    );
  }, []);

  const removeFromCart = useCallback((productId: number, size: BottleSize) => {
    setCart((prev) => prev.filter((item) => !(item.productId === productId && item.size === size)));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const toggleWishlist = useCallback((product: Product) => {
    setWishlistIds((prev) => {
      const exists = prev.includes(product.id);
      if (exists) {
        showToast(`Removed ${product.name} from Wishlist.`);
        return prev.filter((id) => id !== product.id);
      }
      showToast(`Saved ${product.name} to Wishlist.`);
      return [product.id, ...prev];
    });
  }, []);

  const clearWishlist = useCallback(() => {
    setWishlistIds([]);
    showToast('Wishlist cleared.');
  }, []);

  // Hidden Admin Route (/admin, /admin/login, /admin/*) — completely isolated from customer-facing header/footer
  if (path === '/admin' || path.startsWith('/admin/')) {
    return (
      <AdminPanel
        onCatalogUpdated={() => fetchStoreData(false)}
        onExitToStore={() => navigate('/')}
      />
    );
  }

  // Maintenance Mode Gate (controlled from Admin Settings; never blocks Admin Login)
  if (siteSettings && siteSettings.store_available === false) {
    const waNumber = siteSettings.whatsapp_number || WHATSAPP_NUMBER;
    const waDisplay = formatIndianDisplayPhone(waNumber);
    const waHref = buildWhatsAppLink(
      'Hello OUDVIN FRAGRANCES, I would like to place a perfume order while the website is undergoing maintenance.',
      waNumber
    );
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#101010] px-4 py-12 text-center text-[#F3EBDD]">
        <div className="w-full max-w-lg rounded-lg border border-[#C9A24A]/35 bg-[#171614] p-8">
          <div className="flex justify-center">
            <BrandLogo logoUrl={siteSettings.logo_url} />
          </div>
          <p className="mt-6 text-xs font-medium tracking-[0.24em] text-[#C9A24A] uppercase">
            Scheduled Maintenance
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-[#F3EBDD]">
            We Will Be Back Shortly
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-[#F3EBDD]/75">
            {siteSettings.maintenance_message ||
              'Our fragrance boutique is undergoing brief maintenance. You can still place orders directly with our team on WhatsApp.'}
          </p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md bg-[#C9A24A] px-6 py-3 text-sm font-semibold text-[#101010] hover:bg-[#DFC076]"
          >
            <MessageCircle className="h-4 w-4" />
            Order on WhatsApp ({waDisplay})
          </a>
        </div>
      </div>
    );
  }

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const handleRetryStore = () => fetchStoreData(true);

  const renderPage = () => {
    if (path === '/' || path === '') {
      return (
        <HomeView
          products={products}
          offers={offers}
          siteSettings={siteSettings}
          loading={loading}
          loadError={loadError}
          onRetry={handleRetryStore}
          wishlistIds={wishlistIds}
          onToggleWishlist={toggleWishlist}
          onNavigate={navigate}
          onAddToCart={(p, s) => addToCart(p, s, true)}
          onBuyNow={handleBuyNow}
        />
      );
    }

    if (path === '/shop') {
      return (
        <CatalogView
          products={products}
          siteSettings={siteSettings}
          loading={loading}
          loadError={loadError}
          onRetry={handleRetryStore}
          wishlistIds={wishlistIds}
          onToggleWishlist={toggleWishlist}
          collectionFilter="all"
          initialSearchQuery={catalogSearch}
          onNavigate={navigate}
          onAddToCart={(p, s) => addToCart(p, s, true)}
          onBuyNow={handleBuyNow}
        />
      );
    }

    if (path.startsWith('/collection/')) {
      const col = path.replace('/collection/', '').split('/')[0] as CollectionType;
      const validCol: CollectionType | 'all' = ['signature', 'classic', 'premium'].includes(col)
        ? col
        : 'all';
      return (
        <CatalogView
          products={products}
          siteSettings={siteSettings}
          loading={loading}
          loadError={loadError}
          onRetry={handleRetryStore}
          wishlistIds={wishlistIds}
          onToggleWishlist={toggleWishlist}
          collectionFilter={validCol}
          onNavigate={navigate}
          onAddToCart={(p, s) => addToCart(p, s, true)}
          onBuyNow={handleBuyNow}
        />
      );
    }

    if (path.startsWith('/product/')) {
      const slug = decodeURIComponent(path.replace('/product/', '').split('/')[0] || '');
      return (
        <ProductDetailView
          slug={slug}
          allProducts={products}
          siteSettings={siteSettings}
          wishlistIds={wishlistIds}
          onToggleWishlist={toggleWishlist}
          onNavigate={navigate}
          onAddToCart={(p, s) => addToCart(p, s, true)}
          onBuyNow={handleBuyNow}
        />
      );
    }

    if (path === '/wishlist') {
      return (
        <WishlistView
          products={products}
          wishlistIds={wishlistIds}
          onNavigate={navigate}
          onToggleWishlist={toggleWishlist}
          onClearWishlist={clearWishlist}
          onAddToCart={(p, s) => addToCart(p, s, true)}
          onBuyNow={handleBuyNow}
        />
      );
    }

    if (path === '/track-order') {
      const prefilled = new URLSearchParams(window.location.search).get('id') || '';
      return <OrderTrackingView initialOrderId={prefilled} onNavigate={navigate} />;
    }

    if (path === '/offers') {
      return <OffersPage offers={offers} onNavigate={navigate} />;
    }

    if (path === '/custom-perfume') {
      return <CustomPerfumeSection standalone />;
    }

    if (path === '/about') {
      return <AboutPage siteSettings={siteSettings} onNavigate={navigate} />;
    }

    if (path === '/reviews') {
      return <ReviewsPage products={products} />;
    }

    if (path === '/contact') {
      return <ContactPage siteSettings={siteSettings} />;
    }

    if (path === '/checkout') {
      return (
        <CheckoutView
          items={cart}
          offers={offers}
          siteSettings={siteSettings}
          onClearCart={clearCart}
          onNavigate={navigate}
        />
      );
    }

    if (path.startsWith('/policy/')) {
      const type = path.replace('/policy/', '').split('/')[0];
      return <PolicyPage type={type} />;
    }

    return (
      <HomeView
        products={products}
        offers={offers}
        siteSettings={siteSettings}
        loading={loading}
        loadError={loadError}
        onRetry={handleRetryStore}
        wishlistIds={wishlistIds}
        onToggleWishlist={toggleWishlist}
        onNavigate={navigate}
        onAddToCart={(p, s) => addToCart(p, s, true)}
        onBuyNow={handleBuyNow}
      />
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#101010] text-[#F3EBDD]">
      <Header
        currentPath={path}
        cartCount={cartCount}
        wishlistCount={wishlistIds.length}
        products={products}
        logoUrl={siteSettings?.logo_url}
        onNavigate={navigate}
        onSearchCatalog={handleHeaderSearchSubmit}
        onOpenCart={() => setCartOpen(true)}
      />

      <main className="flex-1">{renderPage()}</main>

      <Footer siteSettings={siteSettings} onNavigate={navigate} />

      <CartDrawer
        open={cartOpen}
        items={cart}
        offers={offers}
        siteSettings={siteSettings}
        onClose={() => setCartOpen(false)}
        onUpdateQty={updateCartQty}
        onRemove={removeFromCart}
        onCheckout={() => {
          setCartOpen(false);
          navigate('/checkout');
        }}
        onBrowse={() => navigate('/shop')}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-[#C9A24A] bg-[#171614] px-5 py-3 text-xs font-semibold text-[#C9A24A] shadow-xl"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
