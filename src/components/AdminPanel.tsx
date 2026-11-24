import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import type {
  CollectionType,
  CustomerEnquiry,
  CustomerSummary,
  CustomRequest,
  DashboardStats,
  Offer,
  Order,
  Product,
  Review,
  SiteSettings,
} from '../types';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import {
  ASSETS,
  buildWhatsAppLink,
  DEFAULT_COUNTRY,
  formatIndianDisplayPhone,
  formatINR,
  formatOrderStatusLabel,
  formatPaymentStatusLabel,
  formatWhatsAppPhone,
  UPI_ID,
  WHATSAPP_NUMBER,
} from '../lib/format';
import { BrandLogo } from './BrandLogo';

interface AdminPanelProps {
  onCatalogUpdated: () => void;
  onExitToStore: () => void;
}

type AdminTab =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'offers'
  | 'custom'
  | 'reviews'
  | 'customers'
  | 'content'
  | 'settings';

interface AuthStatus {
  isConfigured: boolean;
  needsFirstRunSetup: boolean;
  envOverrideActive: boolean;
  adminEmail: string | null;
}

const EMPTY_PRODUCT_FORM = {
  id: null as number | null,
  name: '',
  collection: 'signature' as CollectionType,
  fragrance_family: 'Woody Oud',
  description: '',
  top_notes: '',
  middle_notes: '',
  base_notes: '',
  price_50ml: 900,
  price_100ml: 1700,
  stock_50ml: 25,
  stock_100ml: 20,
  image_url: ASSETS.presets[0].url,
  is_bestseller: false,
  is_new_arrival: true,
  featured: false,
  is_published: true,
};

const EMPTY_OFFER_FORM = {
  id: null as number | null,
  title: '',
  code: '',
  description: '',
  offer_type: 'buy2get1' as 'buy2get1' | 'percentage' | 'flat',
  discount_value: 100,
  min_items: 3,
  expires_at: '2027-12-31',
  is_active: true,
};

const DEFAULT_SETTINGS_FORM: SiteSettings = {
  hero_banner_url: ASSETS.hero,
  hero_title: 'Experience The Art Of Luxury.',
  hero_subtitle:
    'Arabian haute parfumerie distilled from rare aged agarwood, crimson Damascus rose, pure white musk, and molten amber. Handcrafted in 50 ML and 100 ML flacons.',
  logo_url: '',
  signature_banner_url: ASSETS.signatureBanner,
  classic_banner_url: ASSETS.classicBanner,
  premium_banner_url: ASSETS.presets[6].url,
  promo_banner_text: '',
  seasonal_title: 'Discover Our Perfumes',
  seasonal_subtitle: 'The Fragrance Vault',
  about_title: 'About OUDVIN Fragrances',
  about_story_1:
    'OUDVIN FRAGRANCES is a luxury fragrance house inspired by the timeless elegance of Arabian perfumery and the art of fine fragrance creation. We believe every fragrance tells a story, creates memories and expresses individuality. Our mission is to bring an exceptional fragrance experience through carefully selected scents and luxurious collections.',
  about_story_2:
    'From deep resinous agarwood harvested for our Signature Collection to clean white musk and sunlit floral blends in our Classic Collection, every flacon is composed for remarkable longevity and poise.',
  contact_hours: 'Monday – Sunday, 10:00 AM – 9:00 PM IST',
  contact_dispatch: 'All confirmed orders dispatch within 24–48 business hours across India.',
  contact_email: 'sohailshaik0016@gmail.com',
  whatsapp_number: WHATSAPP_NUMBER,
  upi_id: UPI_ID,
  currency: 'INR',
  delivery_charge: 0,
  free_delivery_above: 0,
  payment_instructions:
    'Pay the exact order total using Google Pay, PhonePe, or any UPI app and submit your 12-digit UTR reference number. All UPI payments are verified manually by our team before dispatch.',
  store_available: true,
  maintenance_message:
    'OUDVIN FRAGRANCES is briefly undergoing scheduled maintenance. Please message us on WhatsApp to place an order.',
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ onCatalogUpdated, onExitToStore }) => {
  // Token kept strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'reset'>('login');

  // Login / Setup / Reset form fields
  const [emailInput, setEmailInput] = useState('sohailshaik0016@gmail.com');
  const [passwordInput, setPasswordInput] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // Dashboard data
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [enquiries, setEnquiries] = useState<CustomerEnquiry[]>([]);
  const [settingsForm, setSettingsForm] = useState<SiteSettings>(DEFAULT_SETTINGS_FORM);
  const [expandedCustomerPhone, setExpandedCustomerPhone] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Product editor modal/drawer state
  const [productSearch, setProductSearch] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Offer editor state
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER_FORM);

  const checkAuthStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetchWithTimeout('/api/admin/auth/status', {}, 8000);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data: AuthStatus = await res.json();
      setAuthStatus(data);
      if (data.adminEmail) setEmailInput(data.adminEmail);
    } catch {
      setStatusError('Unable to reach the admin authentication server. Please check your connection and tap Retry.');
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!token) throw new Error('Not authenticated');
      const res = await fetchWithTimeout(
        url,
        {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`,
          },
        },
        8000
      );
      if (res.status === 401) {
        setToken(null);
        setAuthError('Your admin session expired. Please sign in again.');
        throw new Error('Unauthorized');
      }
      return res;
    },
    [token]
  );

  const loadAllAdminData = useCallback(async () => {
    if (!token) return;
    setDataLoading(true);
    try {
      const results = await Promise.allSettled([
        authFetch('/api/admin/dashboard').then((r) => (r.ok ? r.json() : null)),
        authFetch('/api/admin/products').then((r) => (r.ok ? r.json() : null)),
        authFetch('/api/admin/orders').then((r) => (r.ok ? r.json() : null)),
        authFetch('/api/admin/offers').then((r) => (r.ok ? r.json() : null)),
        authFetch('/api/admin/custom-requests').then((r) => (r.ok ? r.json() : null)),
        authFetch('/api/admin/reviews').then((r) => (r.ok ? r.json() : null)),
        authFetch('/api/admin/customers').then((r) => (r.ok ? r.json() : null)),
        authFetch('/api/admin/enquiries').then((r) => (r.ok ? r.json() : null)),
        authFetch('/api/admin/settings').then((r) => (r.ok ? r.json() : null)),
      ]);

      const [dash, prod, ord, off, custReq, rev, cust, enq, setRes] = results;

      if (dash.status === 'fulfilled' && dash.value?.stats) setStats(dash.value.stats);
      if (prod.status === 'fulfilled' && prod.value?.products) setProducts(prod.value.products);
      if (ord.status === 'fulfilled' && ord.value?.orders) setOrders(ord.value.orders);
      if (off.status === 'fulfilled' && off.value?.offers) setOffers(off.value.offers);
      if (custReq.status === 'fulfilled' && custReq.value?.requests) setCustomRequests(custReq.value.requests);
      if (rev.status === 'fulfilled' && rev.value?.reviews) setReviews(rev.value.reviews);
      if (cust.status === 'fulfilled' && cust.value?.customers) setCustomers(cust.value.customers);
      if (enq.status === 'fulfilled' && enq.value?.enquiries) setEnquiries(enq.value.enquiries);
      if (setRes.status === 'fulfilled' && setRes.value?.settings) {
        setSettingsForm({ ...DEFAULT_SETTINGS_FORM, ...setRes.value.settings });
      }
    } catch {
      // Handled inside authFetch
    } finally {
      setDataLoading(false);
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (token) {
      loadAllAdminData();
    }
  }, [token, loadAllAdminData]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  // ===================== AUTH HANDLERS =====================
  const handleFirstRunSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
          recovery_passphrase: recoveryInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Setup failed.');
      } else {
        setToken(data.token);
        setAdminEmail(data.email);
        setPasswordInput('');
        setRecoveryInput('');
      }
    } catch {
      setAuthError('Network error during admin setup.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Invalid credentials.');
      } else {
        setToken(data.token);
        setAdminEmail(data.email);
        setPasswordInput('');
      }
    } catch {
      setAuthError('Network error while signing in.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setAuthLoading(true);
    try {
      const res = await fetch('/api/admin/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.trim(),
          recovery_key: recoveryInput.trim(),
          new_password: newPasswordInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Could not reset password.');
      } else {
        setAuthNotice(data.message);
        setRecoveryInput('');
        setNewPasswordInput('');
        setAuthMode('login');
      }
    } catch {
      setAuthError('Network error while resetting password.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ===================== PRODUCT ACTIONS =====================
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('Please select an image smaller than 3 MB.');
      return;
    }
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await authFetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: reader.result }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Upload failed.');
        } else {
          setProductForm((prev) => ({ ...prev, image_url: data.image_url }));
          showToast('Product photograph uploaded.');
        }
      } catch {
        showToast('Error uploading image.');
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = productForm.id !== null;
    const url = isEdit ? `/api/admin/products/${productForm.id}` : '/api/admin/products';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not save perfume.');
        return;
      }
      setShowProductForm(false);
      setProductForm(EMPTY_PRODUCT_FORM);
      await loadAllAdminData();
      onCatalogUpdated();
      showToast(isEdit ? 'Perfume updated.' : 'New perfume added to catalogue.');
    } catch {
      showToast('Network error saving product.');
    }
  };

  const handleTogglePublishProduct = async (product: Product) => {
    const nextPublished = product.is_published === 0 ? 1 : 0;
    try {
      const res = await authFetch(`/api/admin/products/${product.id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: nextPublished }),
      });
      if (res.ok) {
        await loadAllAdminData();
        onCatalogUpdated();
        showToast(nextPublished ? `${product.name} published to store.` : `${product.name} hidden from store.`);
      }
    } catch {
      showToast('Could not update visibility.');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    try {
      const res = await authFetch(`/api/admin/products/${product.id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadAllAdminData();
        onCatalogUpdated();
        showToast(`Deleted ${product.name}.`);
      }
    } catch {
      showToast('Could not delete product.');
    }
  };

  // ===================== ENQUIRIES & SITE SETTINGS =====================
  const handleUpdateEnquiryStatus = async (id: number, status: 'new' | 'replied' | 'resolved') => {
    try {
      const res = await authFetch(`/api/admin/enquiries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await loadAllAdminData();
        showToast('Enquiry status updated.');
      }
    } catch {
      showToast('Could not update enquiry.');
    }
  };

  const handleUploadSettingImage = (
    field: 'hero_banner_url' | 'logo_url' | 'signature_banner_url' | 'classic_banner_url' | 'premium_banner_url',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      showToast('Please select an image smaller than 3 MB.');
      return;
    }
    setUploadingField(field);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await authFetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: reader.result }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Upload failed.');
        } else {
          setSettingsForm((prev) => ({ ...prev, [field]: data.image_url }));
          showToast('Image uploaded. Tap Save Changes to publish.');
        }
      } catch {
        showToast('Error uploading image.');
      } finally {
        setUploadingField(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not save settings.');
      } else {
        if (data.settings) {
          setSettingsForm({ ...DEFAULT_SETTINGS_FORM, ...data.settings });
        }
        onCatalogUpdated();
        showToast('Website content & store settings saved.');
      }
    } catch {
      showToast('Network error saving settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // ===================== ORDER ACTIONS =====================
  const handleUpdateOrder = async (
    orderId: number,
    patch: { payment_status?: string; order_status?: string }
  ) => {
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        await loadAllAdminData();
        showToast('Order updated.');
      }
    } catch {
      showToast('Could not update order.');
    }
  };

  // ===================== OFFER ACTIONS =====================
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const isEdit = offerForm.id !== null;
    const url = isEdit ? `/api/admin/offers/${offerForm.id}` : '/api/admin/offers';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(offerForm),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not save offer.');
        return;
      }
      setShowOfferForm(false);
      setOfferForm(EMPTY_OFFER_FORM);
      await loadAllAdminData();
      onCatalogUpdated();
      showToast(isEdit ? 'Offer updated.' : 'Offer created.');
    } catch {
      showToast('Network error saving offer.');
    }
  };

  const handleToggleOffer = async (offer: Offer) => {
    try {
      const res = await authFetch(`/api/admin/offers/${offer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: offer.is_active ? 0 : 1 }),
      });
      if (res.ok) {
        await loadAllAdminData();
        onCatalogUpdated();
        showToast(offer.is_active ? 'Offer disabled.' : 'Offer enabled.');
      }
    } catch {
      showToast('Could not update offer.');
    }
  };

  const handleDeleteOffer = async (offerId: number) => {
    try {
      const res = await authFetch(`/api/admin/offers/${offerId}`, { method: 'DELETE' });
      if (res.ok) {
        await loadAllAdminData();
        onCatalogUpdated();
        showToast('Offer deleted.');
      }
    } catch {
      showToast('Could not delete offer.');
    }
  };

  // ===================== CUSTOM REQUESTS & REVIEWS =====================
  const handleUpdateCustomStatus = async (id: number, status: string) => {
    const res = await authFetch(`/api/admin/custom-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await loadAllAdminData();
      showToast('Request status updated.');
    }
  };

  const handleModerateReview = async (id: number, status: 'approved' | 'rejected') => {
    const res = await authFetch(`/api/admin/reviews/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      await loadAllAdminData();
      showToast(`Review ${status}.`);
    }
  };

  const handleDeleteReview = async (id: number) => {
    const res = await authFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await loadAllAdminData();
      showToast('Review deleted.');
    }
  };

  // ===================== UNAUTHENTICATED SCREEN =====================
  if (!token) {
    return (
      <div className="min-h-screen bg-[#101010] px-4 py-12 text-[#F3EBDD]">
        <div className="mx-auto max-w-md">
          <div className="flex flex-col items-center text-center">
            <BrandLogo />
            <p className="mt-4 text-xs font-medium tracking-[0.22em] text-[#C9A24A]">
              Authorised Personnel Only
            </p>
          </div>

          <div className="mt-8 rounded-lg border border-[#C9A24A]/30 bg-[#171614] p-6 sm:p-8">
            {statusLoading ? (
              <p className="text-center text-sm text-[#F3EBDD]/70">Checking security status...</p>
            ) : !authStatus ? (
              <div className="space-y-4 text-center">
                <p className="text-sm font-medium text-red-400">
                  {statusError || 'Could not verify authentication status.'}
                </p>
                <button
                  type="button"
                  onClick={checkAuthStatus}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#C9A24A] px-5 py-2.5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Connection
                </button>
              </div>
            ) : authStatus.needsFirstRunSetup ? (
              <form onSubmit={handleFirstRunSetup} className="space-y-4">
                <div className="flex items-center gap-2 text-[#C9A24A]">
                  <Shield className="h-5 w-5" />
                  <h1 className="font-display text-2xl font-semibold text-[#F3EBDD]">
                    First-Time Admin Setup
                  </h1>
                </div>
                <p className="text-xs leading-relaxed text-[#F3EBDD]/70">
                  Claim your OUDVIN Admin Control Panel now. Your password and recovery passphrase are salted and hashed securely on the server.
                </p>

                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="setup-email">
                    Admin Email
                  </label>
                  <input
                    id="setup-email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm text-[#F3EBDD]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="setup-pass">
                    Create Strong Password (8+ characters)
                  </label>
                  <input
                    id="setup-pass"
                    type="password"
                    required
                    minLength={8}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm text-[#F3EBDD]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="setup-recovery">
                    Personal Recovery Passphrase (for password resets)
                  </label>
                  <input
                    id="setup-recovery"
                    type="text"
                    required
                    minLength={6}
                    value={recoveryInput}
                    onChange={(e) => setRecoveryInput(e.target.value)}
                    placeholder="Save this securely in a private note"
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm text-[#F3EBDD]"
                  />
                </div>

                {authError && <p className="text-xs text-red-400">{authError}</p>}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full min-h-[48px] rounded-md bg-[#C9A24A] px-5 py-3 text-sm font-semibold text-[#101010] hover:bg-[#DFC076] disabled:opacity-50"
                >
                  {authLoading ? 'Securing Account...' : 'Activate Admin Control Panel'}
                </button>
              </form>
            ) : authMode === 'reset' ? (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="flex items-center gap-2 text-[#C9A24A]">
                  <KeyRound className="h-5 w-5" />
                  <h1 className="font-display text-2xl font-semibold text-[#F3EBDD]">
                    Reset Admin Password
                  </h1>
                </div>

                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="reset-email">
                    Admin Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm text-[#F3EBDD]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="reset-recovery">
                    Recovery Passphrase / Key
                  </label>
                  <input
                    id="reset-recovery"
                    type="password"
                    required
                    value={recoveryInput}
                    onChange={(e) => setRecoveryInput(e.target.value)}
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm text-[#F3EBDD]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="reset-new-pass">
                    New Password (8+ characters)
                  </label>
                  <input
                    id="reset-new-pass"
                    type="password"
                    required
                    minLength={8}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm text-[#F3EBDD]"
                  />
                </div>

                {authError && <p className="text-xs text-red-400">{authError}</p>}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full min-h-[48px] rounded-md bg-[#C9A24A] px-5 py-3 text-sm font-semibold text-[#101010] hover:bg-[#DFC076] disabled:opacity-50"
                >
                  {authLoading ? 'Updating...' : 'Update Password'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className="w-full text-center text-xs text-[#C9A24A] hover:underline"
                >
                  Back to Admin Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="flex items-center gap-2 text-[#C9A24A]">
                  <Shield className="h-5 w-5" />
                  <h1 className="font-display text-2xl font-semibold text-[#F3EBDD]">
                    Admin Sign In
                  </h1>
                </div>

                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="login-email">
                    Admin Email
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm text-[#F3EBDD]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1.5" htmlFor="login-pass">
                    Password
                  </label>
                  <input
                    id="login-pass"
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm text-[#F3EBDD]"
                  />
                </div>

                {authError && <p className="text-xs text-red-400">{authError}</p>}
                {authNotice && <p className="text-xs text-[#C9A24A]">{authNotice}</p>}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full min-h-[48px] rounded-md bg-[#C9A24A] px-5 py-3 text-sm font-semibold text-[#101010] hover:bg-[#DFC076] disabled:opacity-50"
                >
                  {authLoading ? 'Verifying...' : 'Sign In to Dashboard'}
                </button>

                {!authStatus.envOverrideActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('reset');
                      setAuthError(null);
                    }}
                    className="w-full text-center text-xs text-[#F3EBDD]/70 hover:text-[#C9A24A]"
                  >
                    Forgot Password? Reset with Recovery Passphrase
                  </button>
                )}
              </form>
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onExitToStore}
              className="text-xs text-[#F3EBDD]/60 hover:text-[#C9A24A]"
            >
              Return to OUDVIN Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===================== AUTHENTICATED ADMIN DASHBOARD =====================
  const filteredProducts = products.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return `${p.name} ${p.collection} ${p.fragrance_family}`.toLowerCase().includes(q);
  });

  const TABS: Array<{ key: AdminTab; label: string; icon: React.ReactNode }> = [
    { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'products', label: `Products (${products.length})`, icon: <Package className="h-4 w-4" /> },
    { key: 'orders', label: `Orders (${orders.length})`, icon: <ShoppingCart className="h-4 w-4" /> },
    { key: 'offers', label: 'Offers', icon: <Tag className="h-4 w-4" /> },
    { key: 'custom', label: `Custom (${customRequests.length})`, icon: <Sparkles className="h-4 w-4" /> },
    { key: 'reviews', label: `Reviews (${reviews.length})`, icon: <Star className="h-4 w-4" /> },
    { key: 'customers', label: `Customers (${customers.length})`, icon: <Users className="h-4 w-4" /> },
    { key: 'content', label: 'Content (CMS)', icon: <FileText className="h-4 w-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  const activeWaDisplay = formatIndianDisplayPhone(settingsForm.whatsapp_number || WHATSAPP_NUMBER);
  const activeUpiId = settingsForm.upi_id || UPI_ID;

  return (
    <div className="min-h-screen bg-[#101010] text-[#F3EBDD]">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 border-b border-[#C9A24A]/25 bg-[#101010]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo compact logoUrl={settingsForm.logo_url} />
            <span className="hidden sm:inline text-xs text-[#F3EBDD]/60 truncate">
              Admin Control Panel · {adminEmail}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={loadAllAdminData}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#C9A24A]/25 text-[#F3EBDD] hover:text-[#C9A24A]"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={`h-4 w-4 ${dataLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onExitToStore}
              className="min-h-[40px] rounded-md border border-[#C9A24A]/35 px-3 text-xs font-medium text-[#F3EBDD] hover:text-[#C9A24A] whitespace-nowrap"
            >
              View Store
            </button>
            <button
              type="button"
              onClick={() => setToken(null)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-[#C9A24A] px-3 text-xs font-semibold text-[#101010] hover:bg-[#DFC076] whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Android-Friendly Scrollable Horizontal Tab Strip */}
        <div className="border-t border-[#C9A24A]/15 bg-[#151412]">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#C9A24A] text-[#101010]'
                      : 'text-[#F3EBDD]/75 hover:bg-white/5 hover:text-[#F3EBDD]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md border border-[#C9A24A] bg-[#171614] px-4 py-3 text-xs font-semibold text-[#C9A24A] shadow-xl">
          {feedback}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {/* 1. DASHBOARD KPI TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="font-display text-3xl font-semibold text-[#F3EBDD]">Store Overview</h1>
              <p className="text-xs text-[#F3EBDD]/70 font-mono">
                {DEFAULT_COUNTRY} · {settingsForm.currency || 'INR'} (₹) · WhatsApp {activeWaDisplay} · UPI {activeUpiId}
              </p>
            </div>
            {!stats ? (
              <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-8 text-center">
                <p className="text-sm text-[#F3EBDD]/75">
                  {dataLoading ? 'Loading live store metrics...' : 'Unable to load store statistics.'}
                </p>
                {!dataLoading && (
                  <button
                    type="button"
                    onClick={loadAllAdminData}
                    className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-md bg-[#C9A24A] px-5 text-xs font-semibold text-[#101010]"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry Loading Dashboard
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {[
                    { label: 'Total Order Volume', value: formatINR(stats.total_sales) },
                    { label: 'Verified Paid Sales', value: formatINR(stats.verified_sales) },
                    { label: 'Total Orders', value: String(stats.total_orders) },
                    { label: 'Pending Orders', value: String(stats.pending_orders) },
                    { label: 'Completed Orders', value: String(stats.completed_orders) },
                    { label: 'Total Perfumes', value: String(stats.total_products) },
                    { label: 'Low-Stock Items (≤5)', value: String(stats.low_stock_products) },
                    { label: 'Custom Perfume Requests', value: String(stats.custom_requests_count) },
                    { label: 'New Customer Enquiries', value: String(stats.new_enquiries_count || 0) },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5"
                    >
                      <p className="text-xs text-[#F3EBDD]/65">{kpi.label}</p>
                      <p className="mt-2 font-mono text-2xl font-semibold text-[#C9A24A] tabular-nums">
                        {kpi.value}
                      </p>
                    </div>
                  ))}
                </div>

                {stats.pending_reviews > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#C9A24A]/30 bg-[#1B1814] p-4 text-sm">
                    <span>
                      You have <strong className="text-[#C9A24A]">{stats.pending_reviews}</strong> customer review(s) awaiting moderation.
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('reviews')}
                      className="min-h-[40px] rounded-md bg-[#C9A24A] px-4 text-xs font-semibold text-[#101010]"
                    >
                      Review Queue
                    </button>
                  </div>
                )}

                {Number(stats.new_enquiries_count || 0) > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#C9A24A]/30 bg-[#1B1814] p-4 text-sm">
                    <span>
                      You have <strong className="text-[#C9A24A]">{stats.new_enquiries_count}</strong> new customer enquir{stats.new_enquiries_count === 1 ? 'y' : 'ies'}.
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('customers')}
                      className="min-h-[40px] rounded-md bg-[#C9A24A] px-4 text-xs font-semibold text-[#101010]"
                    >
                      View Enquiries
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 2. PRODUCT MANAGEMENT TAB */}
        {activeTab === 'products' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="font-display text-3xl font-semibold text-[#F3EBDD]">
                Perfume Catalogue ({products.length})
              </h1>
              <button
                type="button"
                onClick={() => {
                  setProductForm(EMPTY_PRODUCT_FORM);
                  setShowProductForm(true);
                }}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#C9A24A] px-4 py-2 text-xs font-semibold text-[#101010] hover:bg-[#DFC076]"
              >
                <Plus className="h-4 w-4" />
                Add New Perfume
              </button>
            </div>

            <input
              type="search"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search perfumes by name, collection, or family..."
              className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#171614] px-3.5 text-sm text-[#F3EBDD]"
            />

            {/* Product Editor Modal */}
            {showProductForm && (
              <div className="rounded-lg border border-[#C9A24A]/40 bg-[#171614] p-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-[#C9A24A]/20 pb-3">
                  <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">
                    {productForm.id ? 'Edit Perfume' : 'Add New Perfume'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowProductForm(false)}
                    className="h-9 w-9 inline-flex items-center justify-center rounded hover:bg-white/10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveProduct} className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">Perfume Name *</label>
                      <input
                        type="text"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">Collection *</label>
                      <select
                        value={productForm.collection}
                        onChange={(e) =>
                          setProductForm({ ...productForm, collection: e.target.value as CollectionType })
                        }
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                      >
                        <option value="signature">Signature Collection</option>
                        <option value="classic">Classic Collection</option>
                        <option value="premium">Premium Collection</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">Fragrance Family *</label>
                      <input
                        type="text"
                        required
                        value={productForm.fragrance_family}
                        onChange={(e) =>
                          setProductForm({ ...productForm, fragrance_family: e.target.value })
                        }
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#F3EBDD]/75 mb-1">Description *</label>
                    <textarea
                      required
                      rows={3}
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      className="w-full rounded-md border border-[#C9A24A]/25 bg-[#101010] p-3 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">Top Notes</label>
                      <input
                        type="text"
                        value={productForm.top_notes}
                        onChange={(e) => setProductForm({ ...productForm, top_notes: e.target.value })}
                        placeholder="e.g., Saffron, Bergamot"
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">Middle Notes</label>
                      <input
                        type="text"
                        value={productForm.middle_notes}
                        onChange={(e) => setProductForm({ ...productForm, middle_notes: e.target.value })}
                        placeholder="e.g., Damascus Rose, Oud"
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">Base Notes</label>
                      <input
                        type="text"
                        value={productForm.base_notes}
                        onChange={(e) => setProductForm({ ...productForm, base_notes: e.target.value })}
                        placeholder="e.g., Amber, Sandalwood"
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">50 ML Price (₹)</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={productForm.price_50ml}
                        onChange={(e) =>
                          setProductForm({ ...productForm, price_50ml: Number(e.target.value) })
                        }
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">100 ML Price (₹)</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={productForm.price_100ml}
                        onChange={(e) =>
                          setProductForm({ ...productForm, price_100ml: Number(e.target.value) })
                        }
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">50 ML Stock</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={productForm.stock_50ml}
                        onChange={(e) =>
                          setProductForm({ ...productForm, stock_50ml: Number(e.target.value) })
                        }
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#F3EBDD]/75 mb-1">100 ML Stock</label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={productForm.stock_100ml}
                        onChange={(e) =>
                          setProductForm({ ...productForm, stock_100ml: Number(e.target.value) })
                        }
                        className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Image Upload from Phone / Studio Preset Selector */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 items-center border-t border-[#C9A24A]/15 pt-4">
                    <div className="sm:col-span-3">
                      <img
                        src={productForm.image_url}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        className="aspect-[4/3] w-full rounded-md object-cover border border-[#C9A24A]/25"
                      />
                    </div>
                    <div className="sm:col-span-9 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-md border border-[#C9A24A]/45 px-4 py-2 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A] hover:text-[#101010]">
                          <Upload className="h-4 w-4" />
                          {uploadingImage ? 'Uploading...' : 'Upload Photo from Device'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleImageFileUpload}
                            className="sr-only"
                          />
                        </label>
                        <select
                          aria-label="Choose studio bottle preset"
                          value={
                            ASSETS.presets.some((p) => p.url === productForm.image_url)
                              ? productForm.image_url
                              : ''
                          }
                          onChange={(e) => {
                            if (e.target.value) {
                              setProductForm({ ...productForm, image_url: e.target.value });
                            }
                          }}
                          className="min-h-[42px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-xs"
                        >
                          <option value="">Or Select Studio Bottle Photo</option>
                          {ASSETS.presets.map((preset) => (
                            <option key={preset.url} value={preset.url}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={productForm.is_bestseller}
                            onChange={(e) =>
                              setProductForm({ ...productForm, is_bestseller: e.target.checked })
                            }
                          />
                          Best Seller
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={productForm.is_new_arrival}
                            onChange={(e) =>
                              setProductForm({ ...productForm, is_new_arrival: e.target.checked })
                            }
                          />
                          New Arrival
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={productForm.featured}
                            onChange={(e) =>
                              setProductForm({ ...productForm, featured: e.target.checked })
                            }
                          />
                          Featured
                        </label>
                        <label className="inline-flex items-center gap-2 text-[#C9A24A]">
                          <input
                            type="checkbox"
                            checked={productForm.is_published}
                            onChange={(e) =>
                              setProductForm({ ...productForm, is_published: e.target.checked })
                            }
                          />
                          Published on Website
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      className="min-h-[44px] rounded-md bg-[#C9A24A] px-6 py-2 text-xs font-semibold text-[#101010] hover:bg-[#DFC076]"
                    >
                      {productForm.id ? 'Save Changes' : 'Create Perfume'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowProductForm(false)}
                      className="min-h-[44px] rounded-md border border-[#C9A24A]/25 px-5 py-2 text-xs text-[#F3EBDD]/75"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Mobile-Friendly Product List */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredProducts.map((p) => {
                const isHidden = p.is_published === 0;
                return (
                  <div
                    key={p.id}
                    className={`flex gap-3 rounded-lg border p-3.5 ${
                      isHidden
                        ? 'border-amber-500/35 bg-[#191612] opacity-80'
                        : 'border-[#C9A24A]/20 bg-[#171614]'
                    }`}
                  >
                    <img
                      src={p.image_url}
                      alt={p.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-20 w-20 shrink-0 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-xl font-semibold text-[#F3EBDD]">
                            {p.name}
                          </h3>
                          <p className="text-xs text-[#C9A24A]">
                            {p.collection} · {p.fragrance_family}
                            {isHidden ? ' · Hidden from Store' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleTogglePublishProduct(p)}
                            title={isHidden ? 'Publish to website' : 'Hide from website'}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded border ${
                              isHidden
                                ? 'border-amber-400/50 text-amber-300 hover:bg-amber-500/15'
                                : 'border-[#C9A24A]/30 text-[#F3EBDD]/80 hover:bg-[#C9A24A]/15'
                            }`}
                            aria-label={isHidden ? `Publish ${p.name}` : `Hide ${p.name}`}
                          >
                            {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProductForm({
                                id: p.id,
                                name: p.name,
                                collection: p.collection,
                                fragrance_family: p.fragrance_family,
                                description: p.description,
                                top_notes: p.top_notes,
                                middle_notes: p.middle_notes,
                                base_notes: p.base_notes,
                                price_50ml: p.price_50ml,
                                price_100ml: p.price_100ml,
                                stock_50ml: p.stock_50ml,
                                stock_100ml: p.stock_100ml,
                                image_url: p.image_url,
                                is_bestseller: Boolean(p.is_bestseller),
                                is_new_arrival: Boolean(p.is_new_arrival),
                                featured: Boolean(p.featured),
                                is_published: p.is_published !== 0,
                              });
                              setShowProductForm(true);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded border border-[#C9A24A]/30 text-[#C9A24A] hover:bg-[#C9A24A]/15"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded border border-red-500/30 text-red-400 hover:bg-red-500/15"
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#F3EBDD]/75 tabular-nums">
                        <span>50ml: {formatINR(p.price_50ml)} (Stock {p.stock_50ml})</span>
                        <span>100ml: {formatINR(p.price_100ml)} (Stock {p.stock_100ml})</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. ORDER MANAGEMENT & MANUAL PAYMENT VERIFICATION */}
        {activeTab === 'orders' && (
          <div className="space-y-5">
            <h1 className="font-display text-3xl font-semibold text-[#F3EBDD]">
              Orders &amp; Payment Verification
            </h1>

            {orders.length === 0 ? (
              <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-10 text-center text-sm text-[#F3EBDD]/70">
                No customer orders recorded yet. New checkout orders appear here immediately.
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((ord) => {
                  const custWa = buildWhatsAppLink(
                    `Hello ${ord.customer_name}, regarding your OUDVIN FRAGRANCES order *${ord.order_number}* (${formatINR(ord.total_amount)}) — current status: ${formatOrderStatusLabel(ord.order_status)}.`,
                    formatWhatsAppPhone(ord.customer_phone)
                  );

                  return (
                    <div
                      key={ord.id}
                      className="rounded-lg border border-[#C9A24A]/25 bg-[#171614] p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#C9A24A]/15 pb-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-[#C9A24A]">
                              {ord.order_number}
                            </span>
                            <span className="text-xs text-[#F3EBDD]/55">
                              {ord.created_at}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-semibold text-[#F3EBDD]">
                            {ord.customer_name} · <span className="font-mono">{formatIndianDisplayPhone(ord.customer_phone)}</span>
                          </p>
                          <p className="text-xs text-[#F3EBDD]/70">
                            {ord.delivery_address}, {ord.city}, {DEFAULT_COUNTRY} — {ord.pincode}
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <div className="font-mono text-lg font-semibold text-[#C9A24A] tabular-nums">
                            {formatINR(ord.total_amount)}
                          </div>
                          <div className="text-xs text-[#F3EBDD]/75">
                            {ord.payment_method} · {formatPaymentStatusLabel(ord.payment_status)}
                          </div>
                          {ord.upi_utr && (
                            <div className="mt-0.5 font-mono text-xs text-[#C9A24A]">
                              UTR: {ord.upi_utr}
                            </div>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-1 text-xs text-[#F3EBDD]/80">
                        {ord.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span>
                              {item.name} ({item.size}) × {item.quantity}
                            </span>
                            <span className="tabular-nums">{formatINR(item.line_total)}</span>
                          </li>
                        ))}
                        {ord.discount_amount > 0 && (
                          <li className="flex justify-between text-[#C9A24A]">
                            <span>Offer ({ord.applied_offer})</span>
                            <span className="tabular-nums">−{formatINR(ord.discount_amount)}</span>
                          </li>
                        )}
                      </ul>

                      {/* Admin Verification & Status Controls */}
                      <div className="flex flex-wrap items-center gap-2 border-t border-[#C9A24A]/15 pt-3">
                        <button
                          type="button"
                          onClick={() => handleUpdateOrder(ord.id, { payment_status: 'verified_paid' })}
                          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3.5 text-xs font-semibold ${
                            ord.payment_status === 'verified_paid'
                              ? 'bg-emerald-700 text-white'
                              : 'border border-emerald-500/45 text-emerald-300 hover:bg-emerald-900/40'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Confirm Payment
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateOrder(ord.id, { payment_status: 'payment_rejected' })}
                          className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-3.5 text-xs font-semibold ${
                            ord.payment_status === 'payment_rejected'
                              ? 'bg-red-800 text-white'
                              : 'border border-red-500/40 text-red-300 hover:bg-red-900/30'
                          }`}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject Payment
                        </button>

                        <select
                          aria-label={`Update order status for ${ord.order_number}`}
                          value={ord.order_status}
                          onChange={(e) => handleUpdateOrder(ord.id, { order_status: e.target.value })}
                          className="min-h-[40px] rounded-md border border-[#C9A24A]/35 bg-[#101010] px-3 text-xs font-semibold text-[#F3EBDD]"
                        >
                          <option value="pending">Status: Pending</option>
                          <option value="processing">Status: Processing</option>
                          <option value="shipped">Status: Shipped</option>
                          <option value="delivered">Status: Delivered</option>
                          <option value="cancelled">Status: Cancelled</option>
                        </select>

                        <a
                          href={custWa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-[#C9A24A] px-3.5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076] ml-auto"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp Customer
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. OFFER MANAGEMENT */}
        {activeTab === 'offers' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-3xl font-semibold text-[#F3EBDD]">
                Special Offers Management
              </h1>
              <button
                type="button"
                onClick={() => {
                  setOfferForm(EMPTY_OFFER_FORM);
                  setShowOfferForm(true);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#C9A24A] px-4 text-xs font-semibold text-[#101010]"
              >
                <Plus className="h-4 w-4" />
                Add Offer
              </button>
            </div>

            {showOfferForm && (
              <form
                onSubmit={handleSaveOffer}
                className="rounded-lg border border-[#C9A24A]/40 bg-[#171614] p-5 space-y-4"
              >
                <h2 className="font-display text-2xl text-[#C9A24A]">
                  {offerForm.id ? 'Edit Offer' : 'Create Offer'}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-[#F3EBDD]/75 mb-1">Title *</label>
                    <input
                      type="text"
                      required
                      value={offerForm.title}
                      onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                      placeholder="e.g., BUY 2 GET 1 FREE"
                      className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#F3EBDD]/75 mb-1">Offer Code *</label>
                    <input
                      type="text"
                      required
                      value={offerForm.code}
                      onChange={(e) =>
                        setOfferForm({ ...offerForm, code: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g., OUDVINB2G1"
                      className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#F3EBDD]/75 mb-1">Offer Type</label>
                    <select
                      value={offerForm.offer_type}
                      onChange={(e) =>
                        setOfferForm({
                          ...offerForm,
                          offer_type: e.target.value as 'buy2get1' | 'percentage' | 'flat',
                        })
                      }
                      className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                    >
                      <option value="buy2get1">Buy 2 Get 1 Free</option>
                      <option value="percentage">Percentage Discount (%)</option>
                      <option value="flat">Flat Discount (₹)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={offerForm.description}
                    onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                    className="w-full rounded-md border border-[#C9A24A]/25 bg-[#101010] p-3 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-[#F3EBDD]/75 mb-1">
                      Discount Value (% or ₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={offerForm.discount_value}
                      onChange={(e) =>
                        setOfferForm({ ...offerForm, discount_value: Number(e.target.value) })
                      }
                      className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#F3EBDD]/75 mb-1">Min Bottles</label>
                    <input
                      type="number"
                      min={1}
                      value={offerForm.min_items}
                      onChange={(e) =>
                        setOfferForm({ ...offerForm, min_items: Number(e.target.value) })
                      }
                      className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#F3EBDD]/75 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={offerForm.expires_at}
                      onChange={(e) => setOfferForm({ ...offerForm, expires_at: e.target.value })}
                      className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={offerForm.is_active}
                    onChange={(e) => setOfferForm({ ...offerForm, is_active: e.target.checked })}
                  />
                  Offer Enabled
                </label>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-md bg-[#C9A24A] px-5 text-xs font-semibold text-[#101010]"
                  >
                    Save Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowOfferForm(false)}
                    className="min-h-[44px] rounded-md border border-[#C9A24A]/25 px-5 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="flex flex-col gap-3 rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-[#C9A24A]">{offer.code}</span>
                      <span>·</span>
                      <span>{offer.is_active ? 'Active' : 'Disabled'}</span>
                      {offer.expires_at && <span>· Expires {offer.expires_at}</span>}
                    </div>
                    <h3 className="mt-1 font-display text-2xl font-semibold text-[#F3EBDD]">
                      {offer.title}
                    </h3>
                    <p className="mt-1 text-xs text-[#F3EBDD]/70">{offer.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleOffer(offer)}
                      className="min-h-[40px] rounded-md border border-[#C9A24A]/35 px-3 text-xs font-semibold text-[#C9A24A]"
                    >
                      {offer.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOfferForm({
                          id: offer.id,
                          title: offer.title,
                          code: offer.code,
                          description: offer.description,
                          offer_type: offer.offer_type,
                          discount_value: offer.discount_value,
                          min_items: offer.min_items,
                          expires_at: offer.expires_at || '',
                          is_active: Boolean(offer.is_active),
                        });
                        setShowOfferForm(true);
                      }}
                      className="min-h-[40px] rounded-md border border-[#C9A24A]/25 px-3 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOffer(offer.id)}
                      className="min-h-[40px] rounded-md border border-red-500/35 px-3 text-xs text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. CUSTOM PERFUME REQUESTS */}
        {activeTab === 'custom' && (
          <div className="space-y-5">
            <h1 className="font-display text-3xl font-semibold text-[#F3EBDD]">
              Custom Perfume Requests
            </h1>
            {customRequests.length === 0 ? (
              <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-10 text-center text-sm text-[#F3EBDD]/70">
                No bespoke perfume requests submitted yet.
              </div>
            ) : (
              <div className="space-y-4">
                {customRequests.map((req) => {
                  const targetPhone = req.customer_phone
                    ? formatWhatsAppPhone(req.customer_phone)
                    : undefined;
                  const waHref = buildWhatsAppLink(
                    `Hello ${req.customer_name || 'there'}, thank you for your bespoke perfume request for "${req.perfume_name}" at OUDVIN FRAGRANCES. Let us craft your signature blend!`,
                    targetPhone
                  );
                  return (
                    <div
                      key={req.id}
                      className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display text-2xl font-semibold text-[#C9A24A]">
                            {req.perfume_name}
                          </h3>
                          <p className="text-xs text-[#F3EBDD]/70">
                            Style: {req.fragrance_style}
                            {req.reference_brand ? ` · Reference: ${req.reference_brand}` : ''}
                          </p>
                        </div>
                        <select
                          value={req.status}
                          onChange={(e) => handleUpdateCustomStatus(req.id, e.target.value)}
                          className="min-h-[38px] rounded-md border border-[#C9A24A]/30 bg-[#101010] px-3 text-xs"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      {req.preferred_notes && (
                        <p className="text-sm text-[#F3EBDD]/85">Notes: {req.preferred_notes}</p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#C9A24A]/15 pt-3 text-xs text-[#F3EBDD]/70">
                        <span>
                          {req.customer_name || 'Guest'} {req.customer_phone ? `· ${req.customer_phone}` : ''} · {req.created_at}
                        </span>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md bg-[#C9A24A] px-3.5 font-semibold text-[#101010]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Open WhatsApp
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 6. REVIEW MODERATION */}
        {activeTab === 'reviews' && (
          <div className="space-y-5">
            <h1 className="font-display text-3xl font-semibold text-[#F3EBDD]">
              Review Moderation
            </h1>
            {reviews.length === 0 ? (
              <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-10 text-center text-sm text-[#F3EBDD]/70">
                No customer reviews submitted yet.
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold text-[#F3EBDD]">{rev.customer_name}</span>
                        <span className="ml-2 text-xs text-[#C9A24A]">
                          {rev.product_name || 'General Store'} · {rev.rating}/5 ★ · Status: {rev.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleModerateReview(rev.id, 'approved')}
                          className="min-h-[36px] rounded-md border border-emerald-500/40 px-3 text-xs text-emerald-300"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleModerateReview(rev.id, 'rejected')}
                          className="min-h-[36px] rounded-md border border-amber-500/40 px-3 text-xs text-amber-300"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReview(rev.id)}
                          className="min-h-[36px] rounded-md border border-red-500/40 px-3 text-xs text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-[#F3EBDD]/80">{rev.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 7. CUSTOMERS DIRECTORY, ORDER HISTORY & ENQUIRIES */}
        {activeTab === 'customers' && (
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="font-display text-3xl font-semibold text-[#F3EBDD]">
                Customer Directory &amp; Order History ({customers.length})
              </h1>
              {customers.length === 0 ? (
                <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-10 text-center text-sm text-[#F3EBDD]/70">
                  Customer records will populate automatically as orders are placed.
                </div>
              ) : (
                <div className="space-y-3">
                  {customers.map((c) => {
                    const isExpanded = expandedCustomerPhone === c.customer_phone;
                    const custOrders = orders.filter((o) => o.customer_phone === c.customer_phone);
                    const waHref = buildWhatsAppLink(
                      `Hello ${c.customer_name}, greetings from OUDVIN FRAGRANCES!`,
                      formatWhatsAppPhone(c.customer_phone)
                    );
                    return (
                      <div
                        key={c.customer_phone}
                        className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-4 sm:p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#F3EBDD]">{c.customer_name}</p>
                            <p className="mt-0.5 text-xs text-[#F3EBDD]/70">
                              <span className="font-mono">{formatIndianDisplayPhone(c.customer_phone)}</span> · {c.city}, {DEFAULT_COUNTRY}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span className="font-mono tabular-nums text-[#F3EBDD]/80">
                              {c.order_count} order{c.order_count === 1 ? '' : 's'}
                            </span>
                            <span className="font-mono font-semibold tabular-nums text-[#C9A24A]">
                              {formatINR(c.total_spent)}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCustomerPhone(isExpanded ? null : c.customer_phone)
                              }
                              className="inline-flex min-h-[38px] items-center gap-1 rounded-md border border-[#C9A24A]/35 px-3 text-xs font-semibold text-[#C9A24A]"
                            >
                              Order History
                              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                            <a
                              href={waHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md bg-[#C9A24A] px-3 text-xs font-semibold text-[#101010]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 border-t border-[#C9A24A]/15 pt-4 space-y-2.5">
                            {custOrders.length === 0 ? (
                              <p className="text-xs text-[#F3EBDD]/60">No orders matched.</p>
                            ) : (
                              custOrders.map((ord) => (
                                <div
                                  key={ord.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#C9A24A]/15 bg-[#101010] px-3.5 py-2.5 text-xs"
                                >
                                  <div>
                                    <span className="font-mono font-semibold text-[#C9A24A]">
                                      {ord.order_number}
                                    </span>
                                    <span className="ml-2 text-[#F3EBDD]/65">{ord.created_at}</span>
                                    <p className="mt-0.5 text-[#F3EBDD]/80">
                                      {ord.items.map((i) => `${i.name} (${i.size}) × ${i.quantity}`).join(', ')}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-mono font-semibold text-[#C9A24A]">
                                      {formatINR(ord.total_amount)}
                                    </div>
                                    <div className="text-[#F3EBDD]/65">
                                      {formatOrderStatusLabel(ord.order_status)} · {formatPaymentStatusLabel(ord.payment_status)}
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Customer Enquiries Section */}
            <div className="space-y-4 border-t border-[#C9A24A]/20 pt-8">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-[#C9A24A]" />
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F3EBDD]">
                  Customer Enquiries ({enquiries.length})
                </h2>
              </div>

              {enquiries.length === 0 ? (
                <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-8 text-center text-sm text-[#F3EBDD]/70">
                  Contact page enquiries submitted by customers will appear here.
                </div>
              ) : (
                <div className="space-y-3">
                  {enquiries.map((enq) => {
                    const waHref = enq.customer_phone
                      ? buildWhatsAppLink(
                          `Hello ${enq.customer_name}, thank you for contacting OUDVIN FRAGRANCES regarding: "${enq.message.slice(0, 80)}"`,
                          formatWhatsAppPhone(enq.customer_phone)
                        )
                      : null;
                    return (
                      <div
                        key={enq.id}
                        className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-[#F3EBDD]">{enq.customer_name}</p>
                            <p className="text-xs text-[#F3EBDD]/65">
                              {enq.customer_phone ? `${formatIndianDisplayPhone(enq.customer_phone)} · ` : ''}
                              {enq.created_at}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Enquiry status for ${enq.customer_name}`}
                              value={enq.status}
                              onChange={(e) =>
                                handleUpdateEnquiryStatus(
                                  enq.id,
                                  e.target.value as 'new' | 'replied' | 'resolved'
                                )
                              }
                              className="min-h-[38px] rounded-md border border-[#C9A24A]/30 bg-[#101010] px-3 text-xs"
                            >
                              <option value="new">New</option>
                              <option value="replied">Replied</option>
                              <option value="resolved">Resolved</option>
                            </select>
                            {waHref && (
                              <a
                                href={waHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md bg-[#C9A24A] px-3.5 text-xs font-semibold text-[#101010]"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Reply
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="text-sm leading-relaxed text-[#F3EBDD]/85">{enq.message}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 8. WEBSITE CONTENT MANAGEMENT (CMS — NO CODING REQUIRED) */}
        {activeTab === 'content' && (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-semibold text-[#F3EBDD]">
                  Website Content Management
                </h1>
                <p className="mt-1 text-xs text-[#F3EBDD]/65">
                  Update homepage banners, logo, seasonal collections, About Us, and contact details live.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#C9A24A] px-5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingSettings ? 'Saving...' : 'Publish Content Changes'}
              </button>
            </div>

            {/* Brand Logo & Promotional Banner */}
            <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">
                Website Logo &amp; Promotional Banner
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:items-center">
                <div className="sm:col-span-4 flex items-center gap-3">
                  <BrandLogo logoUrl={settingsForm.logo_url} />
                </div>
                <div className="sm:col-span-8 flex flex-wrap items-center gap-3">
                  <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-md border border-[#C9A24A]/45 px-4 py-2 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A] hover:text-[#101010]">
                    <Upload className="h-4 w-4" />
                    {uploadingField === 'logo_url' ? 'Uploading...' : 'Upload Custom Logo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleUploadSettingImage('logo_url', e)}
                      className="sr-only"
                    />
                  </label>
                  {settingsForm.logo_url && (
                    <button
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, logo_url: '' })}
                      className="min-h-[42px] rounded-md border border-red-500/35 px-3 text-xs text-red-400"
                    >
                      Reset to Default Emblem
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#F3EBDD]/75 mb-1.5">
                  Top Promotional Banner Text (leave blank to hide)
                </label>
                <input
                  type="text"
                  maxLength={220}
                  value={settingsForm.promo_banner_text}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, promo_banner_text: e.target.value })
                  }
                  placeholder="e.g., Festive Luxury Offer: BUY 2 GET 1 FREE + Fast Pan-India Delivery"
                  className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 text-sm"
                />
              </div>
            </div>

            {/* Homepage Hero Banner */}
            <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">
                Homepage Hero Banner &amp; Seasonal Heading
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 items-center">
                <div className="sm:col-span-4">
                  <img
                    src={settingsForm.hero_banner_url || ASSETS.hero}
                    alt="Hero banner preview"
                    referrerPolicy="no-referrer"
                    className="aspect-[16/10] w-full rounded-md object-cover border border-[#C9A24A]/25"
                  />
                </div>
                <div className="sm:col-span-8 space-y-3">
                  <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-md border border-[#C9A24A]/45 px-4 py-2 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A] hover:text-[#101010]">
                    <Upload className="h-4 w-4" />
                    {uploadingField === 'hero_banner_url' ? 'Uploading...' : 'Upload Hero Banner'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleUploadSettingImage('hero_banner_url', e)}
                      className="sr-only"
                    />
                  </label>
                  <div>
                    <label className="block text-xs text-[#F3EBDD]/75 mb-1">Hero Headline</label>
                    <input
                      type="text"
                      value={settingsForm.hero_title}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, hero_title: e.target.value })
                      }
                      className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#F3EBDD]/75 mb-1">Hero Description</label>
                    <textarea
                      rows={2}
                      value={settingsForm.hero_subtitle}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, hero_subtitle: e.target.value })
                      }
                      className="w-full rounded-md border border-[#C9A24A]/25 bg-[#101010] p-3 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-[#C9A24A]/15 pt-4">
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">
                    Seasonal / Vault Eyebrow Label
                  </label>
                  <input
                    type="text"
                    value={settingsForm.seasonal_subtitle}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, seasonal_subtitle: e.target.value })
                    }
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">
                    Seasonal / Vault Section Title
                  </label>
                  <input
                    type="text"
                    value={settingsForm.seasonal_title}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, seasonal_title: e.target.value })
                    }
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Collection Banners */}
            <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">
                Collection Banners
              </h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {(
                  [
                    { field: 'signature_banner_url', label: 'Signature Collection' },
                    { field: 'classic_banner_url', label: 'Classic Collection' },
                    { field: 'premium_banner_url', label: 'Premium Collection' },
                  ] as const
                ).map(({ field, label }) => (
                  <div key={field} className="space-y-2.5">
                    <p className="text-xs font-semibold text-[#F3EBDD]">{label}</p>
                    <img
                      src={settingsForm[field]}
                      alt={label}
                      referrerPolicy="no-referrer"
                      className="aspect-[16/10] w-full rounded-md object-cover border border-[#C9A24A]/25"
                    />
                    <label className="inline-flex min-h-[40px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#C9A24A]/40 px-3 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A] hover:text-[#101010]">
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingField === field ? 'Uploading...' : 'Change Banner'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => handleUploadSettingImage(field, e)}
                        className="sr-only"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* About Us & Contact Details */}
            <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">
                About Us &amp; Contact Page Information
              </h2>
              <div>
                <label className="block text-xs text-[#F3EBDD]/75 mb-1">About Us Heading</label>
                <input
                  type="text"
                  value={settingsForm.about_title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, about_title: e.target.value })}
                  className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[#F3EBDD]/75 mb-1">About Us Paragraph 1</label>
                <textarea
                  rows={3}
                  value={settingsForm.about_story_1}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, about_story_1: e.target.value })
                  }
                  className="w-full rounded-md border border-[#C9A24A]/25 bg-[#101010] p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-[#F3EBDD]/75 mb-1">About Us Paragraph 2</label>
                <textarea
                  rows={2}
                  value={settingsForm.about_story_2}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, about_story_2: e.target.value })
                  }
                  className="w-full rounded-md border border-[#C9A24A]/25 bg-[#101010] p-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">Support Hours</label>
                  <input
                    type="text"
                    value={settingsForm.contact_hours}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, contact_hours: e.target.value })
                    }
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">Dispatch Timeline</label>
                  <input
                    type="text"
                    value={settingsForm.contact_dispatch}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, contact_dispatch: e.target.value })
                    }
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">Support Email</label>
                  <input
                    type="email"
                    value={settingsForm.contact_email}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, contact_email: e.target.value })
                    }
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 text-sm"
                  />
                </div>
              </div>
            </div>
          </form>
        )}

        {/* 9. PROTECTED STORE & PAYMENT SETTINGS */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-3xl font-semibold text-[#F3EBDD]">
                  Store, Payment &amp; Delivery Settings
                </h1>
                <p className="mt-1 text-xs text-[#F3EBDD]/65">
                  Configure India WhatsApp ordering, UPI ID, delivery charges, and store availability.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#C9A24A] px-5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076] disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {savingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>

            <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">
                India Contact &amp; UPI Payment Details
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">
                    WhatsApp Business Number (India +91)
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.whatsapp_number}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, whatsapp_number: e.target.value })
                    }
                    placeholder="918074469549"
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 font-mono text-sm"
                  />
                  <p className="mt-1 text-[11px] text-[#F3EBDD]/55">
                    Formatted for WhatsApp: {activeWaDisplay}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">Merchant UPI ID</label>
                  <input
                    type="text"
                    required
                    value={settingsForm.upi_id}
                    onChange={(e) => setSettingsForm({ ...settingsForm, upi_id: e.target.value })}
                    placeholder="sohailshaik0016@okhdfcbank"
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">Currency</label>
                  <input
                    type="text"
                    readOnly
                    value="INR (₹) — India"
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/15 bg-[#101010]/60 px-3 text-sm text-[#F3EBDD]/75"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[#F3EBDD]/75 mb-1">
                  Checkout UPI Payment Instructions
                </label>
                <textarea
                  rows={2}
                  value={settingsForm.payment_instructions}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, payment_instructions: e.target.value })
                  }
                  className="w-full rounded-md border border-[#C9A24A]/25 bg-[#101010] p-3 text-sm"
                />
              </div>
            </div>

            <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">
                Pan-India Delivery Charges
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">
                    Standard Delivery Charge (₹) — set 0 for Free Delivery
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    value={settingsForm.delivery_charge}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        delivery_charge: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#F3EBDD]/75 mb-1">
                    Free Delivery Above Order Value (₹) — 0 disables threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100000}
                    value={settingsForm.free_delivery_above}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        free_delivery_above: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full min-h-[44px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3 font-mono text-sm tabular-nums"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-5 sm:p-6 space-y-4">
              <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">
                Website Availability
              </h2>
              <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={settingsForm.store_available}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, store_available: e.target.checked })
                  }
                  className="h-4 w-4 accent-[#C9A24A]"
                />
                <span>
                  Storefront Live &amp; Accepting Orders (uncheck to enable Maintenance Mode)
                </span>
              </label>

              <div>
                <label className="block text-xs text-[#F3EBDD]/75 mb-1">
                  Maintenance Mode Message
                </label>
                <textarea
                  rows={2}
                  value={settingsForm.maintenance_message}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, maintenance_message: e.target.value })
                  }
                  className="w-full rounded-md border border-[#C9A24A]/25 bg-[#101010] p-3 text-sm"
                />
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
