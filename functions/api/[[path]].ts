import QRCode from 'qrcode';
import { SEED_PRODUCTS } from '../../server/seedData.ts';

// Minimal Cloudflare Pages Functions + D1 type declarations (zero external type package required)
interface D1Meta {
  changes?: number;
  last_row_id?: number;
}

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta?: D1Meta;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface PagesEnv {
  DB?: D1Database;
  ADMIN_PASSWORD?: string;
  ADMIN_RECOVERY_KEY?: string;
  SESSION_SECRET?: string;
  UPI_ID?: string;
  WHATSAPP_NUMBER?: string;
}

export interface PagesContext {
  request: Request;
  env: PagesEnv;
  params: { path?: string | string[] };
}

const PRIMARY_HOST = 'oudvinfragrances.pages.dev';
const MERCHANT_NAME = 'OUDVIN FRAGRANCES';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const DEFAULT_SITE_SETTINGS_RAW: Record<string, string> = {
  hero_banner_url: '/src/assets/images/hero_oudvin_luxury_1795431188233.jpg',
  hero_title: 'Experience The Art Of Luxury.',
  hero_subtitle:
    'Arabian haute parfumerie distilled from rare aged agarwood, crimson Damascus rose, pure white musk, and molten amber. Handcrafted in 50 ML and 100 ML flacons.',
  logo_url: '',
  signature_banner_url: '/src/assets/images/collection_signature_banner_1795431190538.jpg',
  classic_banner_url: '/src/assets/images/collection_classic_banner_1795431188161.jpg',
  premium_banner_url: '/src/assets/images/bottle_sultan_heritage_1795431188998.jpg',
  promo_banner_text: '',
  seasonal_title: 'Three Distinct Fragrance Collections',
  seasonal_subtitle: 'Curated Houses',
  about_title: 'Experience The Art Of Luxury.',
  about_story_1:
    'OUDVIN FRAGRANCES was founded with a singular devotion: to bring authentic, long-lasting Arabian haute parfumerie into refined modern flacons without compromising oil concentration or ingredient provenance.',
  about_story_2:
    'From deep smoky agarwood and saffron in our Signature Collection, to luminous everyday white musk and sandalwood in our Classic Collection, to rare aged extraits in our Premium Collection, every bottle is compounded for unforgettable sillage.',
  contact_hours: 'Monday – Sunday, 10:00 AM – 9:00 PM IST',
  contact_dispatch: 'All confirmed orders dispatch within 24–48 business hours across India.',
  contact_email: 'sohailshaik0016@gmail.com',
  whatsapp_number: '918074469549',
  upi_id: 'sohailshaik0016@okhdfcbank',
  currency: 'INR',
  delivery_charge: '0',
  free_delivery_above: '0',
  payment_instructions:
    'Pay exact order total via UPI Scan & Pay (Google Pay, PhonePe, Paytm) and submit your 12-digit UTR number for manual Admin verification, or select Cash on Delivery across India.',
  store_available: '1',
  maintenance_message:
    'OUDVIN FRAGRANCES is currently curating new releases. Place an order anytime via our WhatsApp Concierge at +91 8074469549.',
};

interface RawProductRow {
  id: number;
  slug: string;
  name: string;
  collection: 'signature' | 'classic' | 'premium';
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
  is_published: number;
  created_at: string;
  updated_at: string;
}

interface OfferRow {
  id: number;
  title: string;
  code: string;
  description: string;
  offer_type: 'buy2get1' | 'percentage' | 'flat';
  discount_value: number;
  min_items: number;
  expires_at: string | null;
  is_active: number;
  created_at: string;
}

interface OrderRow {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  city: string;
  pincode: string;
  items_json: string;
  subtotal: number;
  discount_amount: number;
  delivery_charge?: number;
  applied_offer: string | null;
  total_amount: number;
  payment_method: 'UPI' | 'COD';
  payment_status: 'pending_verification' | 'cod_pending' | 'verified_paid' | 'payment_rejected';
  upi_utr: string | null;
  order_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
}

interface AdminRow {
  id: number;
  admin_email: string;
  password_hash: string;
  password_salt: string;
  recovery_hash: string;
  recovery_salt: string;
  token_version: number;
  updated_at: string;
}

interface AdminTokenPayload {
  email: string;
  v: number;
  exp: number;
}

// Per-isolate memoized DB initialization & rate-limit buckets
let dbInitPromise: Promise<void> | null = null;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count += 1;
  return true;
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      ...extraHeaders,
    },
  });
}

function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function normalizeBusinessWhatsAppNumber(raw?: string): string {
  let digits = (raw?.trim() || '918074469549').replace(/[^0-9]/g, '');
  if (digits.startsWith('0091') && digits.length >= 14) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = `91${digits.slice(1)}`;
  } else if (digits.length === 10) {
    digits = `91${digits}`;
  }
  return digits || '918074469549';
}

function normalizePhone(raw: unknown): string {
  let digits = sanitizeText(raw, 28).replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0091') && digits.length >= 14) {
    digits = digits.slice(4);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (/^[0-9]{10}$/.test(digits)) {
    return `+91${digits}`;
  }
  return '';
}

function phoneDigits(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 500) return false;
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/api/uploads/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToString(b64url: string): string {
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4);
  return new TextDecoder().decode(base64ToBytes(padded));
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function randomInt(min: number, max: number): number {
  const range = max - min;
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return min + (arr[0] % range);
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function safeCompareStrings(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  return timingSafeEqualBytes(new Uint8Array(hashA), new Uint8Array(hashB));
}

async function hashSecret(plain: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const actualSalt = salt || randomHex(16);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(plain), { name: 'PBKDF2' }, false, ['deriveBits']);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(actualSalt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return { hash: bytesToHex(new Uint8Array(derivedBits)), salt: actualSalt };
}

async function verifySecret(plain: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const { hash } = await hashSecret(plain, storedSalt);
  const derivedBytes = hexToBytes(hash);
  const storedBytes = hexToBytes(storedHash);
  return timingSafeEqualBytes(derivedBytes, storedBytes);
}

async function getOrCreateSigningSecret(db: D1Database, env: PagesEnv): Promise<string> {
  if (env.SESSION_SECRET?.trim()) {
    return env.SESSION_SECRET.trim();
  }
  const existing = await db
    .prepare('SELECT value FROM internal_secrets WHERE key = ?')
    .bind('jwt_signing_key')
    .first<{ value: string }>();
  if (existing?.value) {
    return existing.value;
  }
  const generated = randomHex(32);
  await db
    .prepare('INSERT OR IGNORE INTO internal_secrets (key, value) VALUES (?, ?)')
    .bind('jwt_signing_key', generated)
    .run();
  const persisted = await db
    .prepare('SELECT value FROM internal_secrets WHERE key = ?')
    .bind('jwt_signing_key')
    .first<{ value: string }>();
  return persisted?.value || generated;
}

async function signAdminToken(db: D1Database, env: PagesEnv, email: string, tokenVersion: number): Promise<string> {
  const secret = await getOrCreateSigningSecret(db, env);
  const payload: AdminTokenPayload = {
    email,
    v: tokenVersion,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const enc = new TextEncoder();
  const encoded = bytesToBase64Url(enc.encode(JSON.stringify(payload)));
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(encoded));
  const signature = bytesToBase64Url(new Uint8Array(sigBuf));
  return `${encoded}.${signature}`;
}

async function verifyAdminToken(db: D1Database, env: PagesEnv, token: string): Promise<AdminTokenPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const secret = await getOrCreateSigningSecret(db, env);
  const enc = new TextEncoder();
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const expectedBuf = await crypto.subtle.sign('HMAC', hmacKey, enc.encode(encoded));
  const expectedSig = bytesToBase64Url(new Uint8Array(expectedBuf));

  if (!(await safeCompareStrings(signature, expectedSig))) return null;

  try {
    const parsed = JSON.parse(base64UrlToString(encoded)) as AdminTokenPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    const record = await db.prepare('SELECT token_version FROM admin_auth WHERE id = 1').first<{ token_version: number }>();
    if (record && parsed.v !== record.token_version) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function requireAdmin(
  request: Request,
  db: D1Database,
  env: PagesEnv
): Promise<{ ok: true; admin: AdminTokenPayload } | { ok: false; response: Response }> {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, response: jsonResponse({ error: 'Unauthorized. Admin sign-in required.' }, 401) };
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = await verifyAdminToken(db, env, token);
  if (!payload) {
    return {
      ok: false,
      response: jsonResponse({ error: 'Session expired or invalid. Please sign in again.' }, 401),
    };
  }
  return { ok: true, admin: payload };
}

async function ensureDatabaseReady(db: D1Database): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const schemaStatements = [
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          collection TEXT NOT NULL CHECK(collection IN ('signature', 'classic', 'premium')),
          fragrance_family TEXT NOT NULL,
          description TEXT NOT NULL,
          top_notes TEXT NOT NULL,
          middle_notes TEXT NOT NULL,
          base_notes TEXT NOT NULL,
          price_50ml INTEGER NOT NULL CHECK(price_50ml >= 0),
          price_100ml INTEGER NOT NULL CHECK(price_100ml >= 0),
          stock_50ml INTEGER NOT NULL DEFAULT 25 CHECK(stock_50ml >= 0),
          stock_100ml INTEGER NOT NULL DEFAULT 20 CHECK(stock_100ml >= 0),
          image_url TEXT NOT NULL,
          is_bestseller INTEGER NOT NULL DEFAULT 0,
          is_new_arrival INTEGER NOT NULL DEFAULT 0,
          featured INTEGER NOT NULL DEFAULT 0,
          is_published INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS offers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          description TEXT NOT NULL,
          offer_type TEXT NOT NULL CHECK(offer_type IN ('buy2get1', 'percentage', 'flat')),
          discount_value INTEGER NOT NULL DEFAULT 0,
          min_items INTEGER NOT NULL DEFAULT 1,
          expires_at TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_number TEXT UNIQUE NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT NOT NULL,
          delivery_address TEXT NOT NULL,
          city TEXT NOT NULL,
          pincode TEXT NOT NULL,
          items_json TEXT NOT NULL,
          subtotal INTEGER NOT NULL,
          discount_amount INTEGER NOT NULL DEFAULT 0,
          delivery_charge INTEGER NOT NULL DEFAULT 0,
          applied_offer TEXT,
          total_amount INTEGER NOT NULL,
          payment_method TEXT NOT NULL CHECK(payment_method IN ('UPI', 'COD')),
          payment_status TEXT NOT NULL CHECK(payment_status IN ('pending_verification', 'cod_pending', 'verified_paid', 'payment_rejected')),
          upi_utr TEXT,
          order_status TEXT NOT NULL DEFAULT 'pending' CHECK(order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS reviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER,
          customer_name TEXT NOT NULL,
          rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
          comment TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        )`,
        `CREATE TABLE IF NOT EXISTS custom_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_name TEXT NOT NULL DEFAULT '',
          customer_phone TEXT NOT NULL DEFAULT '',
          perfume_name TEXT NOT NULL,
          reference_brand TEXT NOT NULL DEFAULT '',
          preferred_notes TEXT NOT NULL DEFAULT '',
          fragrance_style TEXT NOT NULL DEFAULT 'Arabian',
          status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'completed')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS admin_auth (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          admin_email TEXT NOT NULL,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          recovery_hash TEXT NOT NULL,
          recovery_salt TEXT NOT NULL,
          token_version INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS customer_enquiries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_name TEXT NOT NULL DEFAULT '',
          customer_phone TEXT NOT NULL DEFAULT '',
          message TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'replied', 'resolved')),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS site_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS internal_secrets (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE TABLE IF NOT EXISTS media_uploads (
          filename TEXT PRIMARY KEY,
          content_type TEXT NOT NULL,
          data_base64 TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection)`,
        `CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)`,
        `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status)`,
        `CREATE INDEX IF NOT EXISTS idx_enquiries_created ON customer_enquiries(created_at DESC)`,
      ];

      await db.batch(schemaStatements.map((sql) => db.prepare(sql)));

      const productCount = await db.prepare('SELECT COUNT(*) as count FROM products').first<{ count: number }>();
      if (!productCount || Number(productCount.count) === 0) {
        const insertStmts = SEED_PRODUCTS.map((item) =>
          db
            .prepare(`
              INSERT OR IGNORE INTO products (
                slug, name, collection, fragrance_family, description,
                top_notes, middle_notes, base_notes,
                price_50ml, price_100ml, stock_50ml, stock_100ml,
                image_url, is_bestseller, is_new_arrival, featured, is_published
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `)
            .bind(
              item.slug,
              item.name,
              item.collection,
              item.fragrance_family,
              item.description,
              item.top_notes,
              item.middle_notes,
              item.base_notes,
              item.price_50ml,
              item.price_100ml,
              item.stock_50ml,
              item.stock_100ml,
              item.image_url,
              item.is_bestseller,
              item.is_new_arrival,
              item.featured
            )
        );
        await db.batch(insertStmts);
      }

      const offerCount = await db.prepare('SELECT COUNT(*) as count FROM offers').first<{ count: number }>();
      if (!offerCount || Number(offerCount.count) === 0) {
        await db
          .prepare(`
            INSERT OR IGNORE INTO offers (title, code, description, offer_type, discount_value, min_items, expires_at, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            'BUY 2 GET 1 FREE',
            'OUDVINB2G1',
            'Select any 3 luxury bottles across our collections and receive the lowest-priced bottle complimentary at checkout.',
            'buy2get1',
            100,
            3,
            '2027-12-31',
            1
          )
          .run();
      }

      const settingStmts = Object.entries(DEFAULT_SITE_SETTINGS_RAW).map(([key, value]) =>
        db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)').bind(key, value)
      );
      await db.batch(settingStmts);
    })().catch((err) => {
      dbInitPromise = null;
      throw err;
    });
  }
  await dbInitPromise;
}

async function getSiteSettings(db: D1Database): Promise<Record<string, string>> {
  const { results } = await db.prepare('SELECT key, value FROM site_settings').all<{ key: string; value: string }>();
  const merged: Record<string, string> = { ...DEFAULT_SITE_SETTINGS_RAW };
  for (const row of results || []) {
    merged[row.key] = row.value;
  }
  return merged;
}

function formatSiteSettingsResponse(raw: Record<string, string>, fallbackUpiId: string) {
  const waDigits = normalizeBusinessWhatsAppNumber(raw.whatsapp_number);
  return {
    hero_banner_url: raw.hero_banner_url || DEFAULT_SITE_SETTINGS_RAW.hero_banner_url,
    hero_title: raw.hero_title || DEFAULT_SITE_SETTINGS_RAW.hero_title,
    hero_subtitle: raw.hero_subtitle || DEFAULT_SITE_SETTINGS_RAW.hero_subtitle,
    logo_url: raw.logo_url || '',
    signature_banner_url: raw.signature_banner_url || DEFAULT_SITE_SETTINGS_RAW.signature_banner_url,
    classic_banner_url: raw.classic_banner_url || DEFAULT_SITE_SETTINGS_RAW.classic_banner_url,
    premium_banner_url: raw.premium_banner_url || DEFAULT_SITE_SETTINGS_RAW.premium_banner_url,
    promo_banner_text: raw.promo_banner_text || '',
    seasonal_title: raw.seasonal_title || DEFAULT_SITE_SETTINGS_RAW.seasonal_title,
    seasonal_subtitle: raw.seasonal_subtitle || DEFAULT_SITE_SETTINGS_RAW.seasonal_subtitle,
    about_title: raw.about_title || DEFAULT_SITE_SETTINGS_RAW.about_title,
    about_story_1: raw.about_story_1 || DEFAULT_SITE_SETTINGS_RAW.about_story_1,
    about_story_2: raw.about_story_2 || DEFAULT_SITE_SETTINGS_RAW.about_story_2,
    contact_hours: raw.contact_hours || DEFAULT_SITE_SETTINGS_RAW.contact_hours,
    contact_dispatch: raw.contact_dispatch || DEFAULT_SITE_SETTINGS_RAW.contact_dispatch,
    contact_email: raw.contact_email || DEFAULT_SITE_SETTINGS_RAW.contact_email,
    whatsapp_number: waDigits,
    upi_id: raw.upi_id?.trim() || fallbackUpiId,
    currency: raw.currency || 'INR',
    delivery_charge: Math.max(0, Math.round(Number(raw.delivery_charge) || 0)),
    free_delivery_above: Math.max(0, Math.round(Number(raw.free_delivery_above) || 0)),
    payment_instructions: raw.payment_instructions || DEFAULT_SITE_SETTINGS_RAW.payment_instructions,
    store_available: raw.store_available !== '0',
    maintenance_message: raw.maintenance_message || DEFAULT_SITE_SETTINGS_RAW.maintenance_message,
  };
}

function formatOrderRow(row: OrderRow) {
  let items = [];
  try {
    items = JSON.parse(row.items_json);
  } catch {
    items = [];
  }
  return {
    id: row.id,
    order_number: row.order_number,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    delivery_address: row.delivery_address,
    city: row.city,
    pincode: row.pincode,
    items,
    subtotal: row.subtotal,
    discount_amount: row.discount_amount,
    delivery_charge: row.delivery_charge || 0,
    applied_offer: row.applied_offer,
    total_amount: row.total_amount,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    upi_utr: row.upi_utr,
    order_status: row.order_status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isOfferValidNow(offer: OfferRow): boolean {
  if (!offer.is_active) return false;
  if (!offer.expires_at) return true;
  const expiry = new Date(`${offer.expires_at}T23:59:59Z`).getTime();
  return !Number.isNaN(expiry) && expiry >= Date.now();
}

function calculateDiscount(
  unitPricesExpanded: number[],
  subtotal: number,
  activeOffers: OfferRow[],
  requestedCode?: string
): { discountAmount: number; appliedOffer: string | null } {
  const validOffers = activeOffers.filter(isOfferValidNow);
  if (validOffers.length === 0 || unitPricesExpanded.length === 0) {
    return { discountAmount: 0, appliedOffer: null };
  }

  let bestDiscount = 0;
  let bestTitle: string | null = null;

  const candidates = requestedCode
    ? validOffers.filter((o) => o.code.toLowerCase() === requestedCode.toLowerCase() || o.offer_type === 'buy2get1')
    : validOffers;
  const listToEvaluate = candidates.length > 0 ? candidates : validOffers;

  for (const offer of listToEvaluate) {
    if (unitPricesExpanded.length < offer.min_items) continue;
    let discount = 0;

    if (offer.offer_type === 'buy2get1') {
      const sorted = [...unitPricesExpanded].sort((a, b) => a - b);
      const freeCount = Math.floor(sorted.length / 3);
      for (let i = 0; i < freeCount; i++) {
        discount += sorted[i];
      }
    } else if (offer.offer_type === 'percentage') {
      const pct = Math.min(Math.max(offer.discount_value, 0), 90);
      discount = Math.round((subtotal * pct) / 100);
    } else if (offer.offer_type === 'flat') {
      discount = Math.min(Math.max(offer.discount_value, 0), subtotal);
    }

    if (discount > bestDiscount) {
      bestDiscount = discount;
      bestTitle = offer.title;
    }
  }

  return { discountAmount: bestDiscount, appliedOffer: bestDiscount > 0 ? bestTitle : null };
}

function buildOrderWhatsAppMessage(order: ReturnType<typeof formatOrderRow>): string {
  const lines = [
    `*NEW ORDER — OUDVIN FRAGRANCES*`,
    `Order ID: *${order.order_number}*`,
    ``,
    `*Customer Details*`,
    `Name: ${order.customer_name}`,
    `Phone: ${order.customer_phone}`,
    `Address: ${order.delivery_address}, ${order.city}, India - ${order.pincode}`,
    ``,
    `*Ordered Perfumes*`,
    ...order.items.map(
      (item: { name: string; size: string; quantity: number; line_total: number }, idx: number) =>
        `${idx + 1}. ${item.name} (${item.size}) × ${item.quantity} — ₹${item.line_total.toLocaleString('en-IN')}`
    ),
    ``,
    `Subtotal: ₹${order.subtotal.toLocaleString('en-IN')}`,
    ...(order.discount_amount > 0
      ? [`Offer (${order.applied_offer}): -₹${order.discount_amount.toLocaleString('en-IN')}`]
      : []),
    `*Total Payable: ₹${order.total_amount.toLocaleString('en-IN')}*`,
    `Payment Method: ${order.payment_method === 'UPI' ? 'UPI Payment (Pending Verification)' : 'Cash on Delivery'}`,
  ];
  return lines.join('\n');
}

function buildCustomRequestWhatsAppMessage(reqData: {
  customer_name: string;
  customer_phone: string;
  perfume_name: string;
  reference_brand: string;
  preferred_notes: string;
  fragrance_style: string;
}): string {
  const lines = [
    `*BESPOKE PERFUME REQUEST — OUDVIN FRAGRANCES*`,
    ``,
    `Requested Perfume: *${reqData.perfume_name}*`,
    ...(reqData.reference_brand ? [`Reference Brand / Scent: ${reqData.reference_brand}`] : []),
    ...(reqData.fragrance_style ? [`Fragrance Style: ${reqData.fragrance_style}`] : []),
    ...(reqData.preferred_notes ? [`Preferred Notes: ${reqData.preferred_notes}`] : []),
    ``,
    ...(reqData.customer_name ? [`Customer Name: ${reqData.customer_name}`] : []),
    ...(reqData.customer_phone ? [`Phone Number: ${reqData.customer_phone}`] : []),
  ];
  return lines.join('\n');
}

async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const data = await request.json();
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return jsonResponse(
      {
        ok: false,
        error:
          'Cloudflare D1 database binding "DB" is not connected yet. Open Cloudflare Dashboard -> Pages -> Settings -> Bindings -> Add D1 database named DB.',
      },
      503
    );
  }

  try {
    await ensureDatabaseReady(db);
  } catch (err) {
    console.error('D1 init error:', err);
    return jsonResponse({ ok: false, error: 'Database temporarily unavailable. Please retry.' }, 503);
  }

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const clientIp =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  const fallbackUpiId = env.UPI_ID?.trim() || 'sohailshaik0016@okhdfcbank';

  const getWhatsAppNumber = async () => {
    const settings = await getSiteSettings(db);
    return normalizeBusinessWhatsAppNumber(settings.whatsapp_number || env.WHATSAPP_NUMBER);
  };

  const getUpiId = async () => {
    const settings = await getSiteSettings(db);
    return settings.upi_id?.trim() || fallbackUpiId;
  };

  const buildWhatsAppUrl = async (message: string) => {
    const num = await getWhatsAppNumber();
    return `https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(message)}`;
  };

  try {
    // ===================== PUBLIC ENDPOINTS =====================

    if (method === 'GET' && pathname === '/api/health') {
      await db.prepare('SELECT 1 as ok').first();
      return jsonResponse({ ok: true, domain: PRIMARY_HOST, runtime: 'cloudflare-pages-d1' });
    }

    // Serve uploaded product & CMS images stored in D1
    const uploadMatch = /^\/api\/uploads\/([a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp))$/.exec(pathname);
    if (method === 'GET' && uploadMatch) {
      const filename = uploadMatch[1];
      const row = await db
        .prepare('SELECT content_type, data_base64 FROM media_uploads WHERE filename = ?')
        .bind(filename)
        .first<{ content_type: string; data_base64: string }>();
      if (!row) {
        return jsonResponse({ error: 'Image not found.' }, 404);
      }
      const bytes = base64ToBytes(row.data_base64);
      return new Response(bytes.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': row.content_type,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    if (method === 'GET' && pathname === '/api/store-config') {
      const waNum = await getWhatsAppNumber();
      const waDisplay = waNum.length === 12 && waNum.startsWith('91') ? `+91 ${waNum.slice(2)}` : `+${waNum}`;
      return jsonResponse({
        brandName: MERCHANT_NAME,
        tagline: 'Experience The Art Of Luxury.',
        primaryDomain: PRIMARY_HOST,
        country: 'India',
        countryCode: '+91',
        currency: 'INR',
        whatsappNumber: waNum,
        whatsappDisplay: waDisplay,
        upiId: await getUpiId(),
      });
    }

    if (method === 'GET' && pathname === '/api/site-settings') {
      const raw = await getSiteSettings(db);
      return jsonResponse({ settings: formatSiteSettingsResponse(raw, fallbackUpiId) });
    }

    if (method === 'POST' && pathname === '/api/enquiries') {
      if (!checkRateLimit(`enquiry:${clientIp}`, 15, 10 * 60 * 1000)) {
        return jsonResponse({ error: 'Too many enquiries. Please try again shortly.' }, 429);
      }
      const body = await parseJsonBody(request);
      const customerName = sanitizeText(body.customer_name, 80);
      const rawPhone = sanitizeText(body.customer_phone, 24);
      const customerPhone = rawPhone ? normalizePhone(rawPhone) || rawPhone : '';
      const message = sanitizeText(body.message, 1000);

      if (message.length < 3) {
        return jsonResponse({ error: 'Please enter your message or enquiry.' }, 400);
      }

      const result = await db
        .prepare('INSERT INTO customer_enquiries (customer_name, customer_phone, message) VALUES (?, ?, ?)')
        .bind(customerName, customerPhone, message)
        .run();

      const waMessage = [
        '*CUSTOMER ENQUIRY — OUDVIN FRAGRANCES (INDIA)*',
        customerName ? `Name: ${customerName}` : '',
        customerPhone ? `Mobile: ${customerPhone}` : '',
        'Country: India',
        `Message: ${message}`,
      ]
        .filter(Boolean)
        .join('\n');

      return jsonResponse(
        {
          id: result.meta?.last_row_id ?? 0,
          whatsapp_url: await buildWhatsAppUrl(waMessage),
          whatsapp_message: waMessage,
        },
        201
      );
    }

    if (method === 'GET' && pathname === '/api/products') {
      const collection = sanitizeText(url.searchParams.get('collection'), 20).toLowerCase();
      const search = sanitizeText(url.searchParams.get('search'), 80).toLowerCase();

      let sql = `
        SELECT p.*,
          COALESCE(r.avg_rating, 0) as avg_rating,
          COALESCE(r.review_count, 0) as review_count
        FROM products p
        LEFT JOIN (
          SELECT product_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as review_count
          FROM reviews
          WHERE status = 'approved'
          GROUP BY product_id
        ) r ON p.id = r.product_id
        WHERE p.is_published = 1
      `;
      const params: unknown[] = [];

      if (collection && ['signature', 'classic', 'premium'].includes(collection)) {
        sql += ' AND p.collection = ?';
        params.push(collection);
      }
      if (search) {
        sql +=
          ' AND (LOWER(p.name) LIKE ? OR LOWER(p.fragrance_family) LIKE ? OR LOWER(p.top_notes) LIKE ? OR LOWER(p.middle_notes) LIKE ? OR LOWER(p.base_notes) LIKE ?)';
        const like = `%${search}%`;
        params.push(like, like, like, like, like);
      }
      sql += ' ORDER BY p.featured DESC, p.is_bestseller DESC, p.id ASC';

      const { results } = await db.prepare(sql).bind(...params).all();
      return jsonResponse({ products: results || [] });
    }

    const productSlugMatch = /^\/api\/products\/([^/]+)$/.exec(pathname);
    if (method === 'GET' && productSlugMatch) {
      const slug = sanitizeText(decodeURIComponent(productSlugMatch[1]), 100);
      const product = await db
        .prepare(`
          SELECT p.*,
            COALESCE(r.avg_rating, 0) as avg_rating,
            COALESCE(r.review_count, 0) as review_count
          FROM products p
          LEFT JOIN (
            SELECT product_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as review_count
            FROM reviews
            WHERE status = 'approved'
            GROUP BY product_id
          ) r ON p.id = r.product_id
          WHERE p.slug = ? AND p.is_published = 1
        `)
        .bind(slug)
        .first<RawProductRow>();

      if (!product) {
        return jsonResponse({ error: 'Perfume not found.' }, 404);
      }

      const { results: reviews } = await db
        .prepare(`
          SELECT id, product_id, customer_name, rating, comment, status, created_at
          FROM reviews
          WHERE product_id = ? AND status = 'approved'
          ORDER BY created_at DESC
        `)
        .bind(product.id)
        .all();

      return jsonResponse({ product, reviews: reviews || [] });
    }

    if (method === 'GET' && pathname === '/api/offers') {
      const { results } = await db.prepare('SELECT * FROM offers ORDER BY is_active DESC, id ASC').all<OfferRow>();
      const active = (results || []).filter(isOfferValidNow);
      return jsonResponse({ offers: active });
    }

    if (method === 'GET' && pathname === '/api/reviews') {
      const productIdParam = url.searchParams.get('productId');
      const productId = productIdParam ? Number(productIdParam) : null;
      if (productId && Number.isInteger(productId)) {
        const { results } = await db
          .prepare(`
            SELECT r.*, p.name as product_name
            FROM reviews r
            LEFT JOIN products p ON r.product_id = p.id
            WHERE r.status = 'approved' AND r.product_id = ?
            ORDER BY r.created_at DESC
          `)
          .bind(productId)
          .all();
        return jsonResponse({ reviews: results || [] });
      }
      const { results } = await db
        .prepare(`
          SELECT r.*, p.name as product_name
          FROM reviews r
          LEFT JOIN products p ON r.product_id = p.id
          WHERE r.status = 'approved'
          ORDER BY r.created_at DESC
          LIMIT 50
        `)
        .all();
      return jsonResponse({ reviews: results || [] });
    }

    if (method === 'POST' && pathname === '/api/reviews') {
      if (!checkRateLimit(`review:${clientIp}`, 10, 10 * 60 * 1000)) {
        return jsonResponse({ error: 'Too many review submissions. Please try again shortly.' }, 429);
      }
      const body = await parseJsonBody(request);
      const customerName = sanitizeText(body.customer_name, 80);
      const comment = sanitizeText(body.comment, 1000);
      const rating = Number(body.rating);
      const productId = body.product_id ? Number(body.product_id) : null;

      if (customerName.length < 2) {
        return jsonResponse({ error: 'Please enter your name.' }, 400);
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return jsonResponse({ error: 'Please select a star rating between 1 and 5.' }, 400);
      }
      if (comment.length < 5) {
        return jsonResponse({ error: 'Please write at least a brief review (5+ characters).' }, 400);
      }
      if (productId !== null) {
        const exists = await db.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first();
        if (!exists) {
          return jsonResponse({ error: 'Selected perfume does not exist.' }, 400);
        }
      }

      const result = await db
        .prepare(`INSERT INTO reviews (product_id, customer_name, rating, comment, status) VALUES (?, ?, ?, ?, 'pending')`)
        .bind(productId, customerName, rating, comment)
        .run();

      return jsonResponse(
        {
          id: result.meta?.last_row_id ?? 0,
          message: 'Thank you for your review. It has been submitted for moderation and will appear once approved.',
        },
        201
      );
    }

    if (method === 'POST' && pathname === '/api/custom-requests') {
      if (!checkRateLimit(`custom:${clientIp}`, 15, 10 * 60 * 1000)) {
        return jsonResponse({ error: 'Too many requests. Please try again shortly.' }, 429);
      }
      const body = await parseJsonBody(request);
      const perfumeName = sanitizeText(body.perfume_name, 140);
      const customerName = sanitizeText(body.customer_name, 80);
      const rawCustomPhone = sanitizeText(body.customer_phone, 24);
      const customerPhone = rawCustomPhone ? normalizePhone(rawCustomPhone) || rawCustomPhone : '';
      const referenceBrand = sanitizeText(body.reference_brand, 140);
      const preferredNotes = sanitizeText(body.preferred_notes, 600);
      const fragranceStyle = sanitizeText(body.fragrance_style, 60) || 'Arabian';

      if (perfumeName.length < 2) {
        return jsonResponse({ error: 'Please enter a perfume name or fragrance idea.' }, 400);
      }

      const result = await db
        .prepare(`
          INSERT INTO custom_requests (
            customer_name, customer_phone, perfume_name, reference_brand, preferred_notes, fragrance_style
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(customerName, customerPhone, perfumeName, referenceBrand, preferredNotes, fragranceStyle)
        .run();

      const whatsappMessage = buildCustomRequestWhatsAppMessage({
        customer_name: customerName,
        customer_phone: customerPhone,
        perfume_name: perfumeName,
        reference_brand: referenceBrand,
        preferred_notes: preferredNotes,
        fragrance_style: fragranceStyle,
      });

      return jsonResponse(
        {
          id: result.meta?.last_row_id ?? 0,
          whatsapp_url: await buildWhatsAppUrl(whatsappMessage),
          whatsapp_message: whatsappMessage,
        },
        201
      );
    }

    if (method === 'POST' && pathname === '/api/orders') {
      if (!checkRateLimit(`order:${clientIp}`, 20, 15 * 60 * 1000)) {
        return jsonResponse({ error: 'Too many checkout attempts. Please try again in a few minutes.' }, 429);
      }
      const body = await parseJsonBody(request);
      const customerName = sanitizeText(body.customer_name, 100);
      const customerPhone = normalizePhone(body.customer_phone);
      const deliveryAddress = sanitizeText(body.delivery_address, 300);
      const city = sanitizeText(body.city, 80);
      const pincode = sanitizeText(body.pincode, 12).replace(/\s+/g, '');
      const paymentMethod = body.payment_method === 'COD' ? 'COD' : body.payment_method === 'UPI' ? 'UPI' : null;
      const offerCode = sanitizeText(body.offer_code, 40);
      const rawItems = Array.isArray(body.items) ? body.items : [];

      if (customerName.length < 2) {
        return jsonResponse({ error: 'Please enter the recipient full name.' }, 400);
      }
      if (!/^\+91[0-9]{10}$/.test(customerPhone)) {
        return jsonResponse({ error: 'Please enter a valid 10-digit Indian mobile number (+91).' }, 400);
      }
      if (deliveryAddress.length < 4) {
        return jsonResponse({ error: 'Please enter your delivery address.' }, 400);
      }
      if (city.length < 2) {
        return jsonResponse({ error: 'Please enter your city.' }, 400);
      }
      if (!/^[0-9]{5,8}$/.test(pincode)) {
        return jsonResponse({ error: 'Please enter a valid 6-digit PIN code.' }, 400);
      }
      if (!paymentMethod) {
        return jsonResponse({ error: 'Please select UPI Payment or Cash on Delivery.' }, 400);
      }
      if (rawItems.length === 0 || rawItems.length > 30) {
        return jsonResponse({ error: 'Your shopping bag is empty.' }, 400);
      }

      const verifiedItems: Array<{
        product_id: number;
        name: string;
        size: '50ML' | '100ML';
        quantity: number;
        unit_price: number;
        line_total: number;
      }> = [];
      const expandedUnitPrices: number[] = [];
      let subtotal = 0;

      for (const rawItem of rawItems) {
        const item = rawItem as Record<string, unknown>;
        const productId = Number(item?.productId ?? item?.product_id);
        const size = item?.size === '100ML' ? '100ML' : item?.size === '50ML' ? '50ML' : null;
        const qty = Number(item?.quantity);

        if (!Number.isInteger(productId) || !size || !Number.isInteger(qty) || qty < 1 || qty > 20) {
          return jsonResponse({ error: 'Invalid item or quantity in shopping bag.' }, 400);
        }

        const product = await db
          .prepare('SELECT * FROM products WHERE id = ?')
          .bind(productId)
          .first<RawProductRow>();
        if (!product) {
          return jsonResponse({ error: 'One or more perfumes in your bag are no longer available.' }, 400);
        }

        const availableStock = size === '100ML' ? product.stock_100ml : product.stock_50ml;
        if (availableStock < qty) {
          return jsonResponse(
            { error: `Only ${availableStock} bottle(s) of ${product.name} (${size}) left in stock.` },
            400
          );
        }

        const unitPrice = size === '100ML' ? product.price_100ml : product.price_50ml;
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;
        for (let i = 0; i < qty; i++) {
          expandedUnitPrices.push(unitPrice);
        }

        verifiedItems.push({
          product_id: product.id,
          name: product.name,
          size,
          quantity: qty,
          unit_price: unitPrice,
          line_total: lineTotal,
        });
      }

      const { results: activeOffers } = await db
        .prepare('SELECT * FROM offers WHERE is_active = 1')
        .all<OfferRow>();
      const { discountAmount, appliedOffer } = calculateDiscount(
        expandedUnitPrices,
        subtotal,
        activeOffers || [],
        offerCode
      );

      const liveSettings = formatSiteSettingsResponse(await getSiteSettings(db), fallbackUpiId);
      const afterDiscount = Math.max(0, subtotal - discountAmount);
      const deliveryCharge =
        liveSettings.delivery_charge > 0 &&
        (liveSettings.free_delivery_above <= 0 || afterDiscount < liveSettings.free_delivery_above)
          ? liveSettings.delivery_charge
          : 0;
      const totalAmount = afterDiscount + deliveryCharge;

      const orderNumber = `OUD-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;
      const initialPaymentStatus = paymentMethod === 'UPI' ? 'pending_verification' : 'cod_pending';

      const batchStmts: D1PreparedStatement[] = verifiedItems.map((item) =>
        item.size === '100ML'
          ? db
              .prepare(`UPDATE products SET stock_100ml = stock_100ml - ?, updated_at = datetime('now') WHERE id = ? AND stock_100ml >= ?`)
              .bind(item.quantity, item.product_id, item.quantity)
          : db
              .prepare(`UPDATE products SET stock_50ml = stock_50ml - ?, updated_at = datetime('now') WHERE id = ? AND stock_50ml >= ?`)
              .bind(item.quantity, item.product_id, item.quantity)
      );

      batchStmts.push(
        db
          .prepare(`
            INSERT INTO orders (
              order_number, customer_name, customer_phone, delivery_address, city, pincode,
              items_json, subtotal, discount_amount, delivery_charge, applied_offer, total_amount,
              payment_method, payment_status, order_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
          `)
          .bind(
            orderNumber,
            customerName,
            customerPhone,
            deliveryAddress,
            city,
            pincode,
            JSON.stringify(verifiedItems),
            subtotal,
            discountAmount,
            deliveryCharge,
            appliedOffer,
            totalAmount,
            paymentMethod,
            initialPaymentStatus
          )
      );

      await db.batch(batchStmts);
      const savedRow = await db
        .prepare('SELECT * FROM orders WHERE order_number = ?')
        .bind(orderNumber)
        .first<OrderRow>();
      if (!savedRow) {
        return jsonResponse({ error: 'Unable to save order. Please try again.' }, 500);
      }

      const order = formatOrderRow(savedRow);
      let upiPayload = null;
      if (paymentMethod === 'UPI') {
        const activeUpiId = await getUpiId();
        const amountFormatted = totalAmount.toFixed(2);
        const query = new URLSearchParams({
          pa: activeUpiId,
          pn: MERCHANT_NAME,
          am: amountFormatted,
          cu: 'INR',
          tn: `OUDVIN Order ${order.order_number}`,
          tr: order.order_number,
        }).toString();

        const upiUri = `upi://pay?${query}`;
        const gpayUri = `tez://upi/pay?${query}`;
        const phonepeUri = `phonepe://pay?${query}`;
        const svgQr = await QRCode.toString(upiUri, {
          type: 'svg',
          width: 320,
          margin: 2,
          color: {
            dark: '#101010',
            light: '#F3EBDD',
          },
        });
        const qrDataUrl = `data:image/svg+xml;base64,${bytesToBase64(new TextEncoder().encode(svgQr))}`;

        upiPayload = {
          upi_id: activeUpiId,
          merchant_name: MERCHANT_NAME,
          upi_uri: upiUri,
          gpay_uri: gpayUri,
          phonepe_uri: phonepeUri,
          qr_data_url: qrDataUrl,
        };
      }

      const whatsappMessage = buildOrderWhatsAppMessage(order);
      const whatsappUrl = await buildWhatsAppUrl(whatsappMessage);

      return jsonResponse(
        {
          order,
          upi: upiPayload,
          whatsapp_url: whatsappUrl,
          whatsapp_message: whatsappMessage,
        },
        201
      );
    }

    const utrMatch = /^\/api\/orders\/([^/]+)\/utr$/.exec(pathname);
    if (method === 'POST' && utrMatch) {
      const orderNumber = sanitizeText(decodeURIComponent(utrMatch[1]), 40);
      const body = await parseJsonBody(request);
      const phone = normalizePhone(body.customer_phone);
      const utr = sanitizeText(body.upi_utr, 40);

      if (!/^[a-zA-Z0-9]{6,35}$/.test(utr)) {
        return jsonResponse(
          { error: 'Please enter a valid UPI Transaction ID / UTR (6–35 letters or digits).' },
          400
        );
      }

      const existing = await db
        .prepare('SELECT * FROM orders WHERE order_number = ?')
        .bind(orderNumber)
        .first<OrderRow>();
      if (!existing || phoneDigits(existing.customer_phone) !== phoneDigits(phone)) {
        return jsonResponse({ error: 'Order not found for this mobile number.' }, 404);
      }
      if (existing.payment_method !== 'UPI') {
        return jsonResponse({ error: 'UTR submission applies only to UPI orders.' }, 400);
      }

      await db
        .prepare(`
          UPDATE orders
          SET upi_utr = ?, payment_status = 'pending_verification', updated_at = datetime('now')
          WHERE id = ?
        `)
        .bind(utr, existing.id)
        .run();

      const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(existing.id).first<OrderRow>();
      return jsonResponse({
        order: updated ? formatOrderRow(updated) : formatOrderRow(existing),
        message: 'UPI reference received. Our team will verify your payment manually and confirm your order shortly.',
      });
    }

    const trackMatch = /^\/api\/orders\/track\/([^/]+)$/.exec(pathname);
    if (method === 'GET' && trackMatch) {
      if (!checkRateLimit(`track:${clientIp}`, 25, 10 * 60 * 1000)) {
        return jsonResponse({ error: 'Too many tracking lookups. Please try again in a few minutes.' }, 429);
      }
      const orderNumber = sanitizeText(decodeURIComponent(trackMatch[1]), 40).toUpperCase();
      if (!/^[A-Z0-9-]{6,32}$/.test(orderNumber)) {
        return jsonResponse({ error: 'Please enter a valid Order ID (e.g., OUD-2026-123456).' }, 400);
      }

      const row = await db
        .prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?')
        .bind(orderNumber)
        .first<OrderRow>();
      if (!row) {
        return jsonResponse(
          { error: `No order found with ID "${orderNumber}". Please verify your Order ID and try again.` },
          404
        );
      }

      const formatted = formatOrderRow(row);
      const firstName = formatted.customer_name.split(/\s+/)[0] || 'Client';
      const maskedName =
        firstName.length > 2 ? `${firstName[0]}${'*'.repeat(Math.min(firstName.length - 1, 5))}` : firstName;

      return jsonResponse({
        tracking: {
          order_number: formatted.order_number,
          recipient_hint: maskedName,
          destination_city: formatted.city,
          items: formatted.items,
          subtotal: formatted.subtotal,
          discount_amount: formatted.discount_amount,
          applied_offer: formatted.applied_offer,
          total_amount: formatted.total_amount,
          payment_method: formatted.payment_method,
          payment_status: formatted.payment_status,
          order_status: formatted.order_status,
          created_at: formatted.created_at,
          updated_at: formatted.updated_at,
        },
      });
    }

    // ===================== ADMIN AUTH ENDPOINTS =====================

    if (method === 'GET' && pathname === '/api/admin/auth/status') {
      const record = await db.prepare('SELECT admin_email FROM admin_auth WHERE id = 1').first<{ admin_email: string }>();
      const envConfigured = Boolean(env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.trim().length > 0);
      return jsonResponse({
        isConfigured: envConfigured || Boolean(record),
        needsFirstRunSetup: !envConfigured && !record,
        envOverrideActive: envConfigured,
        adminEmail: record?.admin_email || null,
      });
    }

    if (method === 'POST' && pathname === '/api/admin/auth/setup') {
      if (!checkRateLimit(`admin-setup:${clientIp}`, 10, 15 * 60 * 1000)) {
        return jsonResponse({ error: 'Too many attempts. Please wait a few minutes.' }, 429);
      }
      if (env.ADMIN_PASSWORD?.trim()) {
        return jsonResponse({ error: 'Admin password is already managed by server environment configuration.' }, 400);
      }

      const body = await parseJsonBody(request);
      const email = sanitizeText(body.email, 120).toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      const recoveryPassphrase = typeof body.recovery_passphrase === 'string' ? body.recovery_passphrase.trim() : '';

      if (!email || !email.includes('@')) {
        return jsonResponse({ error: 'Please enter a valid admin email address.' }, 400);
      }
      if (password.length < 8) {
        return jsonResponse({ error: 'Password must be at least 8 characters long.' }, 400);
      }
      if (recoveryPassphrase.length < 6) {
        return jsonResponse(
          { error: 'Please set a recovery passphrase (at least 6 characters) for future password resets.' },
          400
        );
      }

      const existing = await db.prepare('SELECT id FROM admin_auth WHERE id = 1').first();
      if (existing) {
        return jsonResponse({ error: 'Admin account has already been claimed. Please sign in or use password reset.' }, 400);
      }

      const pwd = await hashSecret(password);
      const rec = await hashSecret(recoveryPassphrase);

      try {
        await db
          .prepare(`
            INSERT INTO admin_auth (id, admin_email, password_hash, password_salt, recovery_hash, recovery_salt, token_version)
            VALUES (1, ?, ?, ?, ?, ?, 1)
          `)
          .bind(email, pwd.hash, pwd.salt, rec.hash, rec.salt)
          .run();
      } catch {
        return jsonResponse({ error: 'Admin account has already been claimed.' }, 400);
      }

      const token = await signAdminToken(db, env, email, 1);
      return jsonResponse({ token, email }, 201);
    }

    if (method === 'POST' && pathname === '/api/admin/auth/login') {
      if (!checkRateLimit(`admin-login:${clientIp}`, 15, 15 * 60 * 1000)) {
        return jsonResponse({ error: 'Too many sign-in attempts. Please wait 15 minutes.' }, 429);
      }
      const body = await parseJsonBody(request);
      const email = sanitizeText(body.email, 120).toLowerCase();
      const password = typeof body.password === 'string' ? body.password : '';
      if (!password) {
        return jsonResponse({ error: 'Password is required.' }, 400);
      }

      const record = await db.prepare('SELECT * FROM admin_auth WHERE id = 1').first<AdminRow>();
      const envPassword = env.ADMIN_PASSWORD?.trim();

      if (envPassword) {
        if (!(await safeCompareStrings(password, envPassword))) {
          return jsonResponse({ error: 'Invalid admin credentials.' }, 401);
        }
        const tokenVersion = record?.token_version ?? 1;
        const resolvedEmail = email || record?.admin_email || 'admin@oudvin.com';
        const token = await signAdminToken(db, env, resolvedEmail, tokenVersion);
        return jsonResponse({ token, email: resolvedEmail });
      }

      if (!record) {
        return jsonResponse({ error: 'Invalid admin credentials.' }, 401);
      }
      if (email && email !== record.admin_email.toLowerCase()) {
        return jsonResponse({ error: 'Invalid admin credentials.' }, 401);
      }
      if (!(await verifySecret(password, record.password_hash, record.password_salt))) {
        return jsonResponse({ error: 'Invalid admin credentials.' }, 401);
      }

      const token = await signAdminToken(db, env, record.admin_email, record.token_version);
      return jsonResponse({ token, email: record.admin_email });
    }

    if (method === 'POST' && pathname === '/api/admin/auth/reset-password') {
      if (!checkRateLimit(`admin-reset:${clientIp}`, 10, 15 * 60 * 1000)) {
        return jsonResponse({ error: 'Too many reset attempts. Please try again later.' }, 429);
      }
      if (env.ADMIN_PASSWORD?.trim()) {
        return jsonResponse(
          {
            error:
              'Admin password is set via server Secrets (ADMIN_PASSWORD). Update ADMIN_PASSWORD in your Cloudflare Pages Environment Variables to change it.',
          },
          400
        );
      }

      const body = await parseJsonBody(request);
      const email = sanitizeText(body.email, 120).toLowerCase();
      const recoveryKey = typeof body.recovery_key === 'string' ? body.recovery_key.trim() : '';
      const newPassword = typeof body.new_password === 'string' ? body.new_password : '';

      if (!recoveryKey) {
        return jsonResponse({ error: 'Recovery passphrase or recovery key is required.' }, 400);
      }
      if (newPassword.length < 8) {
        return jsonResponse({ error: 'New password must be at least 8 characters long.' }, 400);
      }

      const record = await db.prepare('SELECT * FROM admin_auth WHERE id = 1').first<AdminRow>();
      if (!record) {
        return jsonResponse({ error: 'Admin account has not been set up yet.' }, 400);
      }

      const envRecovery = env.ADMIN_RECOVERY_KEY?.trim();
      const matchesEnv = Boolean(envRecovery && (await safeCompareStrings(recoveryKey, envRecovery)));
      const matchesStored = await verifySecret(recoveryKey, record.recovery_hash, record.recovery_salt);
      if (!matchesEnv && !matchesStored) {
        return jsonResponse({ error: 'Invalid recovery passphrase or key.' }, 400);
      }
      if (email && email !== record.admin_email.toLowerCase()) {
        return jsonResponse({ error: 'Email does not match the registered admin email.' }, 400);
      }

      const nextPwd = await hashSecret(newPassword);
      await db
        .prepare(`
          UPDATE admin_auth
          SET password_hash = ?, password_salt = ?, token_version = token_version + 1, updated_at = datetime('now')
          WHERE id = 1
        `)
        .bind(nextPwd.hash, nextPwd.salt)
        .run();

      return jsonResponse({
        message: 'Admin password updated successfully. Please sign in with your new password.',
      });
    }

    // ===================== PROTECTED ADMIN ROUTES =====================
    if (pathname.startsWith('/api/admin/')) {
      const auth = await requireAdmin(request, db, env);
      if (!auth.ok) return auth.response;

      if (method === 'GET' && pathname === '/api/admin/dashboard') {
        const salesRow =
          (await db
            .prepare(`
              SELECT
                COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) as total_sales,
                COALESCE(SUM(CASE WHEN payment_status = 'verified_paid' THEN total_amount ELSE 0 END), 0) as verified_sales,
                COUNT(*) as total_orders,
                SUM(CASE WHEN order_status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending_orders,
                SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as completed_orders
              FROM orders
            `)
            .first<Record<string, number>>()) || {};

        const prodRow =
          (await db
            .prepare(`
              SELECT
                COUNT(*) as total_products,
                SUM(CASE WHEN stock_50ml <= 5 OR stock_100ml <= 5 THEN 1 ELSE 0 END) as low_stock_products
              FROM products
            `)
            .first<Record<string, number>>()) || {};

        const reviewRow =
          (await db
            .prepare(`SELECT COUNT(*) as pending_reviews FROM reviews WHERE status = 'pending'`)
            .first<{ pending_reviews: number }>()) || { pending_reviews: 0 };

        const customRow =
          (await db
            .prepare(`SELECT COUNT(*) as custom_requests_count FROM custom_requests`)
            .first<{ custom_requests_count: number }>()) || { custom_requests_count: 0 };

        const enquiryRow =
          (await db
            .prepare(`SELECT COUNT(*) as new_enquiries_count FROM customer_enquiries WHERE status = 'new'`)
            .first<{ new_enquiries_count: number }>()) || { new_enquiries_count: 0 };

        return jsonResponse({
          stats: {
            total_sales: Number(salesRow.total_sales) || 0,
            verified_sales: Number(salesRow.verified_sales) || 0,
            total_orders: Number(salesRow.total_orders) || 0,
            pending_orders: Number(salesRow.pending_orders) || 0,
            completed_orders: Number(salesRow.completed_orders) || 0,
            total_products: Number(prodRow.total_products) || 0,
            low_stock_products: Number(prodRow.low_stock_products) || 0,
            pending_reviews: Number(reviewRow.pending_reviews) || 0,
            custom_requests_count: Number(customRow.custom_requests_count) || 0,
            new_enquiries_count: Number(enquiryRow.new_enquiries_count) || 0,
          },
        });
      }

      if (method === 'POST' && pathname === '/api/admin/upload') {
        const body = await parseJsonBody(request);
        const dataUrl = typeof body.imageData === 'string' ? body.imageData : '';
        const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
        if (!match) {
          return jsonResponse({ error: 'Please upload a valid JPEG, PNG, or WebP image.' }, 400);
        }

        const extMap: Record<string, { ext: string; mime: string }> = {
          jpeg: { ext: 'jpg', mime: 'image/jpeg' },
          jpg: { ext: 'jpg', mime: 'image/jpeg' },
          png: { ext: 'png', mime: 'image/png' },
          webp: { ext: 'webp', mime: 'image/webp' },
        };
        const meta = extMap[match[1]];
        const bytes = base64ToBytes(match[2]);

        if (bytes.length > 3 * 1024 * 1024) {
          return jsonResponse({ error: 'Image must be smaller than 3 MB.' }, 400);
        }

        const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
        const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const isWebp =
          bytes.length >= 12 &&
          bytes[0] === 0x52 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x46 &&
          bytes[8] === 0x57 &&
          bytes[9] === 0x45 &&
          bytes[10] === 0x42 &&
          bytes[11] === 0x50;

        if (!isJpeg && !isPng && !isWebp) {
          return jsonResponse({ error: 'Unsupported or corrupted image binary.' }, 400);
        }

        const filename = `oudvin_${Date.now()}_${randomHex(6)}.${meta.ext}`;
        await db
          .prepare('INSERT INTO media_uploads (filename, content_type, data_base64) VALUES (?, ?, ?)')
          .bind(filename, meta.mime, match[2])
          .run();

        return jsonResponse({ image_url: `/api/uploads/${filename}` }, 201);
      }

      if (method === 'GET' && pathname === '/api/admin/products') {
        const { results } = await db
          .prepare(`
            SELECT p.*,
              COALESCE(r.avg_rating, 0) as avg_rating,
              COALESCE(r.review_count, 0) as review_count
            FROM products p
            LEFT JOIN (
              SELECT product_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as review_count
              FROM reviews
              WHERE status = 'approved'
              GROUP BY product_id
            ) r ON p.id = r.product_id
            ORDER BY p.featured DESC, p.is_bestseller DESC, p.id ASC
          `)
          .all();
        return jsonResponse({ products: results || [] });
      }

      if (method === 'POST' && pathname === '/api/admin/products') {
        const body = await parseJsonBody(request);
        const name = sanitizeText(body.name, 120);
        const collection = ['signature', 'classic', 'premium'].includes(String(body.collection))
          ? String(body.collection)
          : 'signature';
        const fragranceFamily = sanitizeText(body.fragrance_family, 80) || 'Oriental Oud';
        const description = sanitizeText(body.description, 1000);
        const topNotes = sanitizeText(body.top_notes, 200);
        const middleNotes = sanitizeText(body.middle_notes, 200);
        const baseNotes = sanitizeText(body.base_notes, 200);
        const price50 = Math.max(0, Math.round(Number(body.price_50ml) || 900));
        const price100 = Math.max(0, Math.round(Number(body.price_100ml) || 1700));
        const stock50 = Math.max(0, Math.round(Number(body.stock_50ml) || 0));
        const stock100 = Math.max(0, Math.round(Number(body.stock_100ml) || 0));
        const imageUrl = sanitizeText(body.image_url, 500);
        const isBestseller = body.is_bestseller ? 1 : 0;
        const isNewArrival = body.is_new_arrival ? 1 : 0;
        const featured = body.featured ? 1 : 0;
        const isPublished = body.is_published === false || body.is_published === 0 ? 0 : 1;

        if (name.length < 2 || description.length < 5) {
          return jsonResponse({ error: 'Perfume name and description are required.' }, 400);
        }
        if (!isSafeImageUrl(imageUrl)) {
          return jsonResponse({ error: 'Please select or upload a valid product photograph.' }, 400);
        }

        let slug = slugify(name);
        const slugExists = await db.prepare('SELECT id FROM products WHERE slug = ?').bind(slug).first();
        if (slugExists) {
          slug = `${slug}-${randomInt(100, 999)}`;
        }

        const result = await db
          .prepare(`
            INSERT INTO products (
              slug, name, collection, fragrance_family, description,
              top_notes, middle_notes, base_notes,
              price_50ml, price_100ml, stock_50ml, stock_100ml,
              image_url, is_bestseller, is_new_arrival, featured, is_published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            slug,
            name,
            collection,
            fragranceFamily,
            description,
            topNotes || 'Saffron, Bergamot',
            middleNotes || 'Oud Wood, Rose',
            baseNotes || 'Amber, Sandalwood',
            price50,
            price100,
            stock50,
            stock100,
            imageUrl,
            isBestseller,
            isNewArrival,
            featured,
            isPublished
          )
          .run();

        const created = await db
          .prepare('SELECT * FROM products WHERE id = ?')
          .bind(result.meta?.last_row_id)
          .first();
        return jsonResponse({ product: created }, 201);
      }

      const prodPublishMatch = /^\/api\/admin\/products\/(\d+)\/publish$/.exec(pathname);
      if (method === 'PATCH' && prodPublishMatch) {
        const id = Number(prodPublishMatch[1]);
        const body = await parseJsonBody(request);
        const isPublished = body.is_published ? 1 : 0;
        await db
          .prepare(`UPDATE products SET is_published = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(isPublished, id)
          .run();
        const updated = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
        if (!updated) return jsonResponse({ error: 'Product not found.' }, 404);
        return jsonResponse({ product: updated });
      }

      const prodIdMatch = /^\/api\/admin\/products\/(\d+)$/.exec(pathname);
      if (prodIdMatch) {
        const id = Number(prodIdMatch[1]);
        if (method === 'PUT') {
          const existing = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first<RawProductRow>();
          if (!existing) return jsonResponse({ error: 'Product not found.' }, 404);

          const body = await parseJsonBody(request);
          const name = sanitizeText(body.name, 120) || existing.name;
          const collection = ['signature', 'classic', 'premium'].includes(String(body.collection))
            ? String(body.collection)
            : existing.collection;
          const fragranceFamily = sanitizeText(body.fragrance_family, 80) || existing.fragrance_family;
          const description = sanitizeText(body.description, 1000) || existing.description;
          const topNotes = sanitizeText(body.top_notes, 200) || existing.top_notes;
          const middleNotes = sanitizeText(body.middle_notes, 200) || existing.middle_notes;
          const baseNotes = sanitizeText(body.base_notes, 200) || existing.base_notes;
          const price50 =
            body.price_50ml !== undefined ? Math.max(0, Math.round(Number(body.price_50ml))) : existing.price_50ml;
          const price100 =
            body.price_100ml !== undefined ? Math.max(0, Math.round(Number(body.price_100ml))) : existing.price_100ml;
          const stock50 =
            body.stock_50ml !== undefined ? Math.max(0, Math.round(Number(body.stock_50ml))) : existing.stock_50ml;
          const stock100 =
            body.stock_100ml !== undefined ? Math.max(0, Math.round(Number(body.stock_100ml))) : existing.stock_100ml;
          const imageUrl = body.image_url ? sanitizeText(body.image_url, 500) : existing.image_url;
          const isBestseller = body.is_bestseller !== undefined ? (body.is_bestseller ? 1 : 0) : existing.is_bestseller;
          const isNewArrival = body.is_new_arrival !== undefined ? (body.is_new_arrival ? 1 : 0) : existing.is_new_arrival;
          const featured = body.featured !== undefined ? (body.featured ? 1 : 0) : existing.featured;
          const isPublished =
            body.is_published !== undefined ? (body.is_published ? 1 : 0) : existing.is_published ?? 1;

          if (!isSafeImageUrl(imageUrl)) {
            return jsonResponse({ error: 'Invalid product image URL.' }, 400);
          }

          await db
            .prepare(`
              UPDATE products SET
                name = ?, collection = ?, fragrance_family = ?, description = ?,
                top_notes = ?, middle_notes = ?, base_notes = ?,
                price_50ml = ?, price_100ml = ?, stock_50ml = ?, stock_100ml = ?,
                image_url = ?, is_bestseller = ?, is_new_arrival = ?, featured = ?, is_published = ?,
                updated_at = datetime('now')
              WHERE id = ?
            `)
            .bind(
              name,
              collection,
              fragranceFamily,
              description,
              topNotes,
              middleNotes,
              baseNotes,
              price50,
              price100,
              stock50,
              stock100,
              imageUrl,
              isBestseller,
              isNewArrival,
              featured,
              isPublished,
              id
            )
            .run();

          const updated = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
          return jsonResponse({ product: updated });
        }

        if (method === 'DELETE') {
          const info = await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
          if (!info.meta?.changes) return jsonResponse({ error: 'Product not found.' }, 404);
          return jsonResponse({ deleted: true });
        }
      }

      if (method === 'GET' && pathname === '/api/admin/orders') {
        const { results } = await db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all<OrderRow>();
        return jsonResponse({ orders: (results || []).map(formatOrderRow) });
      }

      const orderIdMatch = /^\/api\/admin\/orders\/(\d+)$/.exec(pathname);
      if (method === 'PATCH' && orderIdMatch) {
        const id = Number(orderIdMatch[1]);
        const existing = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
        if (!existing) return jsonResponse({ error: 'Order not found.' }, 404);

        const body = await parseJsonBody(request);
        const validPaymentStatuses = ['pending_verification', 'cod_pending', 'verified_paid', 'payment_rejected'];
        const validOrderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        const paymentStatus = validPaymentStatuses.includes(String(body.payment_status))
          ? String(body.payment_status)
          : existing.payment_status;
        const orderStatus = validOrderStatuses.includes(String(body.order_status))
          ? String(body.order_status)
          : existing.order_status;

        await db
          .prepare(`UPDATE orders SET payment_status = ?, order_status = ?, updated_at = datetime('now') WHERE id = ?`)
          .bind(paymentStatus, orderStatus, id)
          .run();

        const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
        return jsonResponse({ order: updated ? formatOrderRow(updated) : formatOrderRow(existing) });
      }

      if (method === 'GET' && pathname === '/api/admin/offers') {
        const { results } = await db.prepare('SELECT * FROM offers ORDER BY id ASC').all();
        return jsonResponse({ offers: results || [] });
      }

      if (method === 'POST' && pathname === '/api/admin/offers') {
        const body = await parseJsonBody(request);
        const title = sanitizeText(body.title, 120);
        const code = sanitizeText(body.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const description = sanitizeText(body.description, 400);
        const offerType = ['buy2get1', 'percentage', 'flat'].includes(String(body.offer_type))
          ? String(body.offer_type)
          : 'percentage';
        const discountValue = Math.max(0, Math.round(Number(body.discount_value) || 0));
        const minItems = Math.max(1, Math.round(Number(body.min_items) || (offerType === 'buy2get1' ? 3 : 1)));
        const expiresAt = sanitizeText(body.expires_at, 20) || null;
        const isActive = body.is_active === false || body.is_active === 0 ? 0 : 1;

        if (title.length < 3 || code.length < 3) {
          return jsonResponse({ error: 'Offer title and code (3+ chars) are required.' }, 400);
        }

        try {
          const info = await db
            .prepare(`
              INSERT INTO offers (title, code, description, offer_type, discount_value, min_items, expires_at, is_active)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(title, code, description, offerType, discountValue, minItems, expiresAt, isActive)
            .run();
          const created = await db.prepare('SELECT * FROM offers WHERE id = ?').bind(info.meta?.last_row_id).first();
          return jsonResponse({ offer: created }, 201);
        } catch {
          return jsonResponse({ error: 'Offer code already exists. Please use a unique code.' }, 400);
        }
      }

      const offerIdMatch = /^\/api\/admin\/offers\/(\d+)$/.exec(pathname);
      if (offerIdMatch) {
        const id = Number(offerIdMatch[1]);
        if (method === 'PUT') {
          const existing = await db.prepare('SELECT * FROM offers WHERE id = ?').bind(id).first<OfferRow>();
          if (!existing) return jsonResponse({ error: 'Offer not found.' }, 404);

          const body = await parseJsonBody(request);
          const title = sanitizeText(body.title, 120) || existing.title;
          const code = sanitizeText(body.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '') || existing.code;
          const description = sanitizeText(body.description, 400) || existing.description;
          const offerType = ['buy2get1', 'percentage', 'flat'].includes(String(body.offer_type))
            ? String(body.offer_type)
            : existing.offer_type;
          const discountValue =
            body.discount_value !== undefined
              ? Math.max(0, Math.round(Number(body.discount_value)))
              : existing.discount_value;
          const minItems =
            body.min_items !== undefined ? Math.max(1, Math.round(Number(body.min_items))) : existing.min_items;
          const expiresAt =
            body.expires_at !== undefined ? sanitizeText(body.expires_at, 20) || null : existing.expires_at;
          const isActive = body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active;

          try {
            await db
              .prepare(`
                UPDATE offers
                SET title = ?, code = ?, description = ?, offer_type = ?, discount_value = ?, min_items = ?, expires_at = ?, is_active = ?
                WHERE id = ?
              `)
              .bind(title, code, description, offerType, discountValue, minItems, expiresAt, isActive, id)
              .run();
            const updated = await db.prepare('SELECT * FROM offers WHERE id = ?').bind(id).first();
            return jsonResponse({ offer: updated });
          } catch {
            return jsonResponse({ error: 'Offer code must be unique.' }, 400);
          }
        }
        if (method === 'DELETE') {
          await db.prepare('DELETE FROM offers WHERE id = ?').bind(id).run();
          return jsonResponse({ deleted: true });
        }
      }

      if (method === 'GET' && pathname === '/api/admin/custom-requests') {
        const { results } = await db.prepare('SELECT * FROM custom_requests ORDER BY created_at DESC').all();
        return jsonResponse({ requests: results || [] });
      }

      const customReqIdMatch = /^\/api\/admin\/custom-requests\/(\d+)$/.exec(pathname);
      if (method === 'PATCH' && customReqIdMatch) {
        const id = Number(customReqIdMatch[1]);
        const body = await parseJsonBody(request);
        const status = ['new', 'contacted', 'completed'].includes(String(body.status)) ? String(body.status) : null;
        if (!status) return jsonResponse({ error: 'Invalid request or status.' }, 400);
        await db.prepare('UPDATE custom_requests SET status = ? WHERE id = ?').bind(status, id).run();
        const updated = await db.prepare('SELECT * FROM custom_requests WHERE id = ?').bind(id).first();
        return jsonResponse({ request: updated });
      }

      if (method === 'GET' && pathname === '/api/admin/reviews') {
        const { results } = await db
          .prepare(`
            SELECT r.*, p.name as product_name
            FROM reviews r
            LEFT JOIN products p ON r.product_id = p.id
            ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.created_at DESC
          `)
          .all();
        return jsonResponse({ reviews: results || [] });
      }

      const reviewIdMatch = /^\/api\/admin\/reviews\/(\d+)$/.exec(pathname);
      if (reviewIdMatch) {
        const id = Number(reviewIdMatch[1]);
        if (method === 'PATCH') {
          const body = await parseJsonBody(request);
          const status = ['pending', 'approved', 'rejected'].includes(String(body.status)) ? String(body.status) : null;
          if (!status) return jsonResponse({ error: 'Invalid review ID or status.' }, 400);
          await db.prepare('UPDATE reviews SET status = ? WHERE id = ?').bind(status, id).run();
          const updated = await db.prepare('SELECT * FROM reviews WHERE id = ?').bind(id).first();
          return jsonResponse({ review: updated });
        }
        if (method === 'DELETE') {
          await db.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
          return jsonResponse({ deleted: true });
        }
      }

      if (method === 'GET' && pathname === '/api/admin/customers') {
        const { results } = await db
          .prepare(`
            SELECT
              customer_phone,
              MAX(customer_name) as customer_name,
              MAX(city) as city,
              COUNT(*) as order_count,
              SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END) as total_spent,
              MAX(created_at) as last_order_at
            FROM orders
            GROUP BY customer_phone
            ORDER BY last_order_at DESC
          `)
          .all();
        return jsonResponse({ customers: results || [] });
      }

      if (method === 'GET' && pathname === '/api/admin/enquiries') {
        const { results } = await db.prepare('SELECT * FROM customer_enquiries ORDER BY created_at DESC').all();
        return jsonResponse({ enquiries: results || [] });
      }

      const enquiryIdMatch = /^\/api\/admin\/enquiries\/(\d+)$/.exec(pathname);
      if (method === 'PATCH' && enquiryIdMatch) {
        const id = Number(enquiryIdMatch[1]);
        const body = await parseJsonBody(request);
        const status = ['new', 'replied', 'resolved'].includes(String(body.status)) ? String(body.status) : null;
        if (!status) return jsonResponse({ error: 'Invalid enquiry ID or status.' }, 400);
        await db.prepare('UPDATE customer_enquiries SET status = ? WHERE id = ?').bind(status, id).run();
        const updated = await db.prepare('SELECT * FROM customer_enquiries WHERE id = ?').bind(id).first();
        return jsonResponse({ enquiry: updated });
      }

      if (method === 'GET' && pathname === '/api/admin/settings') {
        const raw = await getSiteSettings(db);
        return jsonResponse({ settings: formatSiteSettingsResponse(raw, fallbackUpiId) });
      }

      if (method === 'PUT' && pathname === '/api/admin/settings') {
        const body = await parseJsonBody(request);
        const imageKeys = new Set([
          'hero_banner_url',
          'logo_url',
          'signature_banner_url',
          'classic_banner_url',
          'premium_banner_url',
        ]);
        const textMaxLengths: Record<string, number> = {
          hero_title: 160,
          hero_subtitle: 500,
          promo_banner_text: 240,
          seasonal_title: 140,
          seasonal_subtitle: 100,
          about_title: 160,
          about_story_1: 1200,
          about_story_2: 1200,
          contact_hours: 160,
          contact_dispatch: 240,
          contact_email: 120,
          upi_id: 100,
          currency: 20,
          payment_instructions: 600,
          maintenance_message: 400,
        };

        const updates: Array<[string, string]> = [];
        for (const key of imageKeys) {
          if (body[key] !== undefined) {
            const val = sanitizeText(body[key], 500);
            if (val && !isSafeImageUrl(val)) {
              return jsonResponse({ error: `Invalid image URL for ${key}.` }, 400);
            }
            updates.push([key, val]);
          }
        }
        for (const [key, maxLen] of Object.entries(textMaxLengths)) {
          if (body[key] !== undefined) {
            updates.push([key, sanitizeText(body[key], maxLen)]);
          }
        }
        if (body.whatsapp_number !== undefined) {
          const normalized = normalizeBusinessWhatsAppNumber(String(body.whatsapp_number));
          if (!/^91[0-9]{10}$/.test(normalized)) {
            return jsonResponse({ error: 'Please enter a valid 10-digit Indian WhatsApp number (+91).' }, 400);
          }
          updates.push(['whatsapp_number', normalized]);
        }
        if (body.delivery_charge !== undefined) {
          const charge = Math.max(0, Math.min(5000, Math.round(Number(body.delivery_charge) || 0)));
          updates.push(['delivery_charge', String(charge)]);
        }
        if (body.free_delivery_above !== undefined) {
          const threshold = Math.max(0, Math.min(100000, Math.round(Number(body.free_delivery_above) || 0)));
          updates.push(['free_delivery_above', String(threshold)]);
        }
        if (body.store_available !== undefined) {
          updates.push(['store_available', body.store_available ? '1' : '0']);
        }

        if (updates.length > 0) {
          const stmts = updates.map(([k, v]) =>
            db
              .prepare(`
                INSERT INTO site_settings (key, value, updated_at)
                VALUES (?, ?, datetime('now'))
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
              `)
              .bind(k, v)
          );
          await db.batch(stmts);
        }

        const raw = await getSiteSettings(db);
        return jsonResponse({ settings: formatSiteSettingsResponse(raw, fallbackUpiId) });
      }
    }

    return jsonResponse({ error: 'API route not found.' }, 404);
  } catch (err) {
    console.error('OUDVIN Pages Function error:', err);
    return jsonResponse({ error: 'Temporary server error. Please try again.' }, 500);
  }
}
