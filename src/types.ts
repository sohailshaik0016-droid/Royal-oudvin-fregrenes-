export type CollectionType = 'signature' | 'classic' | 'premium';

export type BottleSize = '50ML' | '100ML';

export interface Product {
  id: number;
  slug: string;
  name: string;
  collection: CollectionType;
  fragrance_family: string;
  description: string;
  top_notes: string;
  middle_notes: string;
  base_notes: string;
  price_50ml: number;
  price_100ml: number;
  stock_50ml: number;
  stock_100ml: number;
  image_url: string;
  is_bestseller: number;
  is_new_arrival: number;
  featured: number;
  is_published?: number;
  avg_rating?: number;
  review_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Offer {
  id: number;
  title: string;
  code: string;
  description: string;
  offer_type: 'buy2get1' | 'percentage' | 'flat';
  discount_value: number;
  min_items: number;
  expires_at: string | null;
  is_active: number;
  created_at?: string;
}

export interface CartItem {
  productId: number;
  slug: string;
  name: string;
  image_url: string;
  collection: CollectionType;
  size: BottleSize;
  unitPrice: number;
  quantity: number;
  maxStock: number;
}

export interface OrderItem {
  product_id: number;
  name: string;
  size: BottleSize;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export type PaymentMethod = 'UPI' | 'COD';
export type PaymentStatus = 'pending_verification' | 'cod_pending' | 'verified_paid' | 'payment_rejected';
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  city: string;
  pincode: string;
  items: OrderItem[];
  subtotal: number;
  discount_amount: number;
  delivery_charge?: number;
  applied_offer: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  upi_utr: string | null;
  order_status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: number;
  product_id: number | null;
  product_name?: string;
  customer_name: string;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface CustomRequest {
  id: number;
  customer_name: string;
  customer_phone: string;
  perfume_name: string;
  reference_brand: string;
  preferred_notes: string;
  fragrance_style: string;
  status: 'new' | 'contacted' | 'completed';
  created_at: string;
}

export interface CustomerEnquiry {
  id: number;
  customer_name: string;
  customer_phone: string;
  message: string;
  status: 'new' | 'replied' | 'resolved';
  created_at: string;
}

export interface SiteSettings {
  hero_banner_url: string;
  hero_title: string;
  hero_subtitle: string;
  logo_url: string;
  signature_banner_url: string;
  classic_banner_url: string;
  premium_banner_url: string;
  promo_banner_text: string;
  seasonal_title: string;
  seasonal_subtitle: string;
  about_title: string;
  about_story_1: string;
  about_story_2: string;
  contact_hours: string;
  contact_dispatch: string;
  contact_email: string;
  whatsapp_number: string;
  upi_id: string;
  currency: string;
  delivery_charge: number;
  free_delivery_above: number;
  payment_instructions: string;
  store_available: boolean;
  maintenance_message: string;
}

export interface DashboardStats {
  total_sales: number;
  verified_sales: number;
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  total_products: number;
  low_stock_products: number;
  pending_reviews: number;
  custom_requests_count: number;
  new_enquiries_count?: number;
}

export interface CustomerSummary {
  customer_name: string;
  customer_phone: string;
  city: string;
  order_count: number;
  total_spent: number;
  last_order_at: string;
}

export interface CheckoutResponse {
  order: Order;
  upi: {
    upi_id: string;
    merchant_name: string;
    upi_uri: string;
    gpay_uri: string;
    phonepe_uri: string;
    qr_data_url: string;
  } | null;
  whatsapp_url: string;
  whatsapp_message: string;
}

export interface TrackedOrder {
  order_number: string;
  recipient_hint: string;
  destination_city: string;
  items: OrderItem[];
  subtotal: number;
  discount_amount: number;
  delivery_charge?: number;
  applied_offer: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  created_at: string;
  updated_at: string;
}
