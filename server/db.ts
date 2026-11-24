import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { SEED_PRODUCTS } from './seedData.ts';

const dataDir = path.resolve(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const uploadsDir = path.resolve(dataDir, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const dbPath = path.resolve(dataDir, 'oudvin.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS offers (
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
    );

    CREATE TABLE IF NOT EXISTS orders (
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
      applied_offer TEXT,
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('UPI', 'COD')),
      payment_status TEXT NOT NULL CHECK(payment_status IN ('pending_verification', 'cod_pending', 'verified_paid', 'payment_rejected')),
      upi_utr TEXT,
      order_status TEXT NOT NULL DEFAULT 'pending' CHECK(order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      customer_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS custom_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL DEFAULT '',
      customer_phone TEXT NOT NULL DEFAULT '',
      perfume_name TEXT NOT NULL,
      reference_brand TEXT NOT NULL DEFAULT '',
      preferred_notes TEXT NOT NULL DEFAULT '',
      fragrance_style TEXT NOT NULL DEFAULT 'Arabian',
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_auth (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      admin_email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      recovery_hash TEXT NOT NULL,
      recovery_salt TEXT NOT NULL,
      token_version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customer_enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL DEFAULT '',
      customer_phone TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new', 'replied', 'resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection);
    CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, status);
    CREATE INDEX IF NOT EXISTS idx_enquiries_created ON customer_enquiries(created_at DESC);
  `);

  // Safe non-destructive schema migrations for existing SQLite databases
  const productCols = db.prepare('PRAGMA table_info(products)').all() as Array<{ name: string }>;
  if (!productCols.some((c) => c.name === 'is_published')) {
    db.exec('ALTER TABLE products ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1');
  }

  const orderCols = db.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>;
  if (!orderCols.some((c) => c.name === 'delivery_charge')) {
    db.exec('ALTER TABLE orders ADD COLUMN delivery_charge INTEGER NOT NULL DEFAULT 0');
  }

  const productCountRow = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productCountRow.count === 0) {
    const insertProduct = db.prepare(`
      INSERT INTO products (
        slug, name, collection, fragrance_family, description,
        top_notes, middle_notes, base_notes,
        price_50ml, price_100ml, stock_50ml, stock_100ml,
        image_url, is_bestseller, is_new_arrival, featured, is_published
      ) VALUES (
        @slug, @name, @collection, @fragrance_family, @description,
        @top_notes, @middle_notes, @base_notes,
        @price_50ml, @price_100ml, @stock_50ml, @stock_100ml,
        @image_url, @is_bestseller, @is_new_arrival, @featured, 1
      )
    `);
    const seedTx = db.transaction((items: typeof SEED_PRODUCTS) => {
      for (const item of items) {
        insertProduct.run(item);
      }
    });
    seedTx(SEED_PRODUCTS);
  }

  const offerCountRow = db.prepare('SELECT COUNT(*) as count FROM offers').get() as { count: number };
  if (offerCountRow.count === 0) {
    db.prepare(`
      INSERT INTO offers (title, code, description, offer_type, discount_value, min_items, expires_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'BUY 2 GET 1 FREE',
      'OUDVINB2G1',
      'Select any 3 luxury bottles across our collections and receive the lowest-priced bottle complimentary at checkout.',
      'buy2get1',
      100,
      3,
      '2027-12-31',
      1
    );
  }

  // Seed default Website Content & Store Settings (preserving any existing values!)
  const insertSetting = db.prepare(
    `INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)`
  );
  const seedSettingsTx = db.transaction(() => {
    for (const [key, value] of Object.entries(DEFAULT_SITE_SETTINGS_RAW)) {
      insertSetting.run(key, value);
    }
  });
  seedSettingsTx();
}

export const DEFAULT_SITE_SETTINGS_RAW: Record<string, string> = {
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

export function getSiteSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM site_settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const merged: Record<string, string> = { ...DEFAULT_SITE_SETTINGS_RAW };
  for (const row of rows) {
    merged[row.key] = row.value;
  }
  return merged;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}
