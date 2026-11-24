import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import {
  authenticateAdmin,
  claimInitialAdmin,
  getAdminSetupStatus,
  requireAdmin,
  resetAdminPassword,
} from './server/auth.ts';
import {
  db,
  DEFAULT_SITE_SETTINGS_RAW,
  getSiteSettings,
  initDatabase,
  slugify,
  uploadsDir,
} from './server/db.ts';

initDatabase();

const PORT = Number(process.env.PORT) || 3000;
const PRIMARY_DOMAIN = 'oudvinfragrances.com';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN?.trim().replace(/\/+$/, '') || '';
const FALLBACK_UPI_ID = process.env.UPI_ID?.trim() || 'sohailshaik0016@okhdfcbank';

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

function getActiveWhatsAppNumber(): string {
  const settings = getSiteSettings();
  return normalizeBusinessWhatsAppNumber(settings.whatsapp_number || process.env.WHATSAPP_NUMBER);
}

function getActiveUpiId(): string {
  const settings = getSiteSettings();
  return settings.upi_id?.trim() || FALLBACK_UPI_ID;
}

function formatSiteSettingsResponse(raw: Record<string, string>) {
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
    upi_id: raw.upi_id?.trim() || FALLBACK_UPI_ID,
    currency: raw.currency || 'INR',
    delivery_charge: Math.max(0, Math.round(Number(raw.delivery_charge) || 0)),
    free_delivery_above: Math.max(0, Math.round(Number(raw.free_delivery_above) || 0)),
    payment_instructions: raw.payment_instructions || DEFAULT_SITE_SETTINGS_RAW.payment_instructions,
    store_available: raw.store_available !== '0',
    maintenance_message: raw.maintenance_message || DEFAULT_SITE_SETTINGS_RAW.maintenance_message,
  };
}

function buildWhatsAppUrl(message: string): string {
  const num = getActiveWhatsAppNumber();
  return `https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(message)}`;
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
const MERCHANT_NAME = 'OUDVIN FRAGRANCES';

// Simple in-memory rate limiter for auth & write endpoints
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

function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

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

async function createServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));

  // Redirect www.oudvinfragrances.com -> https://oudvinfragrances.com (301 permanent) + strict CORS if ALLOWED_ORIGIN is set
  app.use((req, res, next) => {
    const rawHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().toLowerCase().split(':')[0];
    if (rawHost === `www.${PRIMARY_DOMAIN}`) {
      res.redirect(301, `https://${PRIMARY_DOMAIN}${req.originalUrl}`);
      return;
    }
    if (ALLOWED_ORIGIN && req.headers.origin === ALLOWED_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Fast Health Check
  app.get('/api/health', (_req, res) => {
    try {
      db.prepare('SELECT 1').get();
      res.json({ ok: true, domain: PRIMARY_DOMAIN });
    } catch {
      res.status(503).json({ ok: false, error: 'Database temporarily unavailable.' });
    }
  });

  // Serve safely uploaded product & CMS images
  app.get('/api/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(filename)) {
      res.status(400).json({ error: 'Invalid filename.' });
      return;
    }
    const resolved = path.resolve(uploadsDir, filename);
    if (!resolved.startsWith(uploadsDir + path.sep)) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: 'Image not found.' });
      return;
    }
    res.sendFile(resolved);
  });

  // Public Storefront Config & CMS Site Settings (no secrets exposed)
  app.get('/api/store-config', (_req, res) => {
    const waNum = getActiveWhatsAppNumber();
    const waDisplay = waNum.length === 12 && waNum.startsWith('91') ? `+91 ${waNum.slice(2)}` : `+${waNum}`;
    res.json({
      brandName: MERCHANT_NAME,
      tagline: 'Experience The Art Of Luxury.',
      primaryDomain: PRIMARY_DOMAIN,
      country: 'India',
      countryCode: '+91',
      currency: 'INR',
      whatsappNumber: waNum,
      whatsappDisplay: waDisplay,
      upiId: getActiveUpiId(),
    });
  });

  app.get('/api/site-settings', (_req, res) => {
    res.json({ settings: formatSiteSettingsResponse(getSiteSettings()) });
  });

  // Public Customer Enquiry submission (persisted in SQLite + WhatsApp handoff)
  app.post('/api/enquiries', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`enquiry:${ip}`, 15, 10 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many enquiries. Please try again shortly.' });
      return;
    }

    const customerName = sanitizeText(req.body.customer_name, 80);
    const rawPhone = sanitizeText(req.body.customer_phone, 24);
    const customerPhone = rawPhone ? normalizePhone(rawPhone) || rawPhone : '';
    const message = sanitizeText(req.body.message, 1000);

    if (message.length < 3) {
      res.status(400).json({ error: 'Please enter your message or enquiry.' });
      return;
    }

    const result = db
      .prepare(`INSERT INTO customer_enquiries (customer_name, customer_phone, message) VALUES (?, ?, ?)`)
      .run(customerName, customerPhone, message);

    const waMessage = [
      '*CUSTOMER ENQUIRY — OUDVIN FRAGRANCES (INDIA)*',
      customerName ? `Name: ${customerName}` : '',
      customerPhone ? `Mobile: ${customerPhone}` : '',
      'Country: India',
      `Message: ${message}`,
    ]
      .filter(Boolean)
      .join('\n');

    res.status(201).json({
      id: result.lastInsertRowid,
      whatsapp_url: buildWhatsAppUrl(waMessage),
      whatsapp_message: waMessage,
    });
  });

  // Public Products API with ratings summary (published products only)
  app.get('/api/products', (req, res) => {
    const collection = sanitizeText(req.query.collection, 20).toLowerCase();
    const search = sanitizeText(req.query.search, 80).toLowerCase();

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
      sql += ' AND (LOWER(p.name) LIKE ? OR LOWER(p.fragrance_family) LIKE ? OR LOWER(p.top_notes) LIKE ? OR LOWER(p.middle_notes) LIKE ? OR LOWER(p.base_notes) LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like, like);
    }

    sql += ' ORDER BY p.featured DESC, p.is_bestseller DESC, p.id ASC';
    const rows = db.prepare(sql).all(...params);
    res.json({ products: rows });
  });

  app.get('/api/products/:slug', (req, res) => {
    const slug = sanitizeText(req.params.slug, 100);
    const product = db
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
      .get(slug);

    if (!product) {
      res.status(404).json({ error: 'Perfume not found.' });
      return;
    }

    const reviews = db
      .prepare(`
        SELECT id, product_id, customer_name, rating, comment, status, created_at
        FROM reviews
        WHERE product_id = ? AND status = 'approved'
        ORDER BY created_at DESC
      `)
      .all((product as RawProductRow).id);

    res.json({ product, reviews });
  });

  // Public Active Offers
  app.get('/api/offers', (_req, res) => {
    const rows = db.prepare('SELECT * FROM offers ORDER BY is_active DESC, id ASC').all() as OfferRow[];
    const active = rows.filter(isOfferValidNow);
    res.json({ offers: active });
  });

  // Public Approved Reviews & Submission
  app.get('/api/reviews', (req, res) => {
    const productId = req.query.productId ? Number(req.query.productId) : null;
    if (productId && Number.isInteger(productId)) {
      const reviews = db
        .prepare(`
          SELECT r.*, p.name as product_name
          FROM reviews r
          LEFT JOIN products p ON r.product_id = p.id
          WHERE r.status = 'approved' AND r.product_id = ?
          ORDER BY r.created_at DESC
        `)
        .all(productId);
      res.json({ reviews });
      return;
    }
    const reviews = db
      .prepare(`
        SELECT r.*, p.name as product_name
        FROM reviews r
        LEFT JOIN products p ON r.product_id = p.id
        WHERE r.status = 'approved'
        ORDER BY r.created_at DESC
        LIMIT 50
      `)
      .all();
    res.json({ reviews });
  });

  app.post('/api/reviews', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`review:${ip}`, 10, 10 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many review submissions. Please try again shortly.' });
      return;
    }

    const customerName = sanitizeText(req.body.customer_name, 80);
    const comment = sanitizeText(req.body.comment, 1000);
    const rating = Number(req.body.rating);
    const productId = req.body.product_id ? Number(req.body.product_id) : null;

    if (customerName.length < 2) {
      res.status(400).json({ error: 'Please enter your name.' });
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Please select a star rating between 1 and 5.' });
      return;
    }
    if (comment.length < 5) {
      res.status(400).json({ error: 'Please write at least a brief review (5+ characters).' });
      return;
    }

    if (productId !== null) {
      const exists = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
      if (!exists) {
        res.status(400).json({ error: 'Selected perfume does not exist.' });
        return;
      }
    }

    const result = db
      .prepare(`
        INSERT INTO reviews (product_id, customer_name, rating, comment, status)
        VALUES (?, ?, ?, ?, 'pending')
      `)
      .run(productId, customerName, rating, comment);

    res.status(201).json({
      id: result.lastInsertRowid,
      message: 'Thank you for your review. It has been submitted for moderation and will appear once approved.',
    });
  });

  // Public Custom Perfume Requests (only perfume_name is required!)
  app.post('/api/custom-requests', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`custom:${ip}`, 15, 10 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many requests. Please try again shortly.' });
      return;
    }

    const perfumeName = sanitizeText(req.body.perfume_name, 140);
    const customerName = sanitizeText(req.body.customer_name, 80);
    const rawCustomPhone = sanitizeText(req.body.customer_phone, 24);
    const customerPhone = rawCustomPhone ? normalizePhone(rawCustomPhone) || rawCustomPhone : '';
    const referenceBrand = sanitizeText(req.body.reference_brand, 140);
    const preferredNotes = sanitizeText(req.body.preferred_notes, 600);
    const fragranceStyle = sanitizeText(req.body.fragrance_style, 60) || 'Arabian';

    if (perfumeName.length < 2) {
      res.status(400).json({ error: 'Please enter a perfume name or fragrance idea.' });
      return;
    }

    const result = db
      .prepare(`
        INSERT INTO custom_requests (
          customer_name, customer_phone, perfume_name, reference_brand, preferred_notes, fragrance_style
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(customerName, customerPhone, perfumeName, referenceBrand, preferredNotes, fragranceStyle);

    const whatsappMessage = buildCustomRequestWhatsAppMessage({
      customer_name: customerName,
      customer_phone: customerPhone,
      perfume_name: perfumeName,
      reference_brand: referenceBrand,
      preferred_notes: preferredNotes,
      fragrance_style: fragranceStyle,
    });
    const whatsappUrl = buildWhatsAppUrl(whatsappMessage);

    res.status(201).json({
      id: result.lastInsertRowid,
      whatsapp_url: whatsappUrl,
      whatsapp_message: whatsappMessage,
    });
  });

  // Public Checkout & Authoritative Order Creation (No account required)
  app.post('/api/orders', async (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`order:${ip}`, 20, 15 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many checkout attempts. Please try again in a few minutes.' });
      return;
    }

    const customerName = sanitizeText(req.body.customer_name, 100);
    const customerPhone = normalizePhone(req.body.customer_phone);
    const deliveryAddress = sanitizeText(req.body.delivery_address, 300);
    const city = sanitizeText(req.body.city, 80);
    const pincode = sanitizeText(req.body.pincode, 12).replace(/\s+/g, '');
    const paymentMethod = req.body.payment_method === 'COD' ? 'COD' : req.body.payment_method === 'UPI' ? 'UPI' : null;
    const offerCode = sanitizeText(req.body.offer_code, 40);
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

    if (customerName.length < 2) {
      res.status(400).json({ error: 'Please enter the recipient full name.' });
      return;
    }
    if (!/^\+91[0-9]{10}$/.test(customerPhone)) {
      res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number (+91).' });
      return;
    }
    if (deliveryAddress.length < 4) {
      res.status(400).json({ error: 'Please enter your delivery address.' });
      return;
    }
    if (city.length < 2) {
      res.status(400).json({ error: 'Please enter your city.' });
      return;
    }
    if (!/^[0-9]{5,8}$/.test(pincode)) {
      res.status(400).json({ error: 'Please enter a valid 6-digit PIN code.' });
      return;
    }
    if (!paymentMethod) {
      res.status(400).json({ error: 'Please select UPI Payment or Cash on Delivery.' });
      return;
    }
    if (rawItems.length === 0 || rawItems.length > 30) {
      res.status(400).json({ error: 'Your shopping bag is empty.' });
      return;
    }

    // Recompute prices and validate stock strictly from database
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

    for (const item of rawItems) {
      const productId = Number(item?.productId ?? item?.product_id);
      const size = item?.size === '100ML' ? '100ML' : item?.size === '50ML' ? '50ML' : null;
      const qty = Number(item?.quantity);

      if (!Number.isInteger(productId) || !size || !Number.isInteger(qty) || qty < 1 || qty > 20) {
        res.status(400).json({ error: 'Invalid item or quantity in shopping bag.' });
        return;
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as RawProductRow | undefined;
      if (!product) {
        res.status(400).json({ error: 'One or more perfumes in your bag are no longer available.' });
        return;
      }

      const availableStock = size === '100ML' ? product.stock_100ml : product.stock_50ml;
      if (availableStock < qty) {
        res.status(400).json({
          error: `Only ${availableStock} bottle(s) of ${product.name} (${size}) left in stock.`,
        });
        return;
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

    const activeOffers = db.prepare('SELECT * FROM offers WHERE is_active = 1').all() as OfferRow[];
    const { discountAmount, appliedOffer } = calculateDiscount(expandedUnitPrices, subtotal, activeOffers, offerCode);
    const liveSettings = formatSiteSettingsResponse(getSiteSettings());
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const deliveryCharge =
      liveSettings.delivery_charge > 0 &&
      (liveSettings.free_delivery_above <= 0 || afterDiscount < liveSettings.free_delivery_above)
        ? liveSettings.delivery_charge
        : 0;
    const totalAmount = afterDiscount + deliveryCharge;

    const orderNumber = `OUD-${new Date().getFullYear()}-${crypto.randomInt(100000, 999999)}`;
    const initialPaymentStatus = paymentMethod === 'UPI' ? 'pending_verification' : 'cod_pending';

    const createOrderTx = db.transaction(() => {
      for (const item of verifiedItems) {
        if (item.size === '100ML') {
          db.prepare('UPDATE products SET stock_100ml = stock_100ml - ?, updated_at = datetime(\'now\') WHERE id = ? AND stock_100ml >= ?').run(
            item.quantity,
            item.product_id,
            item.quantity
          );
        } else {
          db.prepare('UPDATE products SET stock_50ml = stock_50ml - ?, updated_at = datetime(\'now\') WHERE id = ? AND stock_50ml >= ?').run(
            item.quantity,
            item.product_id,
            item.quantity
          );
        }
      }

      const info = db
        .prepare(`
          INSERT INTO orders (
            order_number, customer_name, customer_phone, delivery_address, city, pincode,
            items_json, subtotal, discount_amount, delivery_charge, applied_offer, total_amount,
            payment_method, payment_status, order_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        `)
        .run(
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
        );

      return db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid) as OrderRow;
    });

    const savedRow = createOrderTx();
    const order = formatOrderRow(savedRow);

    let upiPayload = null;
    if (paymentMethod === 'UPI') {
      const activeUpiId = getActiveUpiId();
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
      const qrDataUrl = await QRCode.toDataURL(upiUri, {
        width: 320,
        margin: 2,
        color: {
          dark: '#101010',
          light: '#F3EBDD',
        },
      });

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
    const whatsappUrl = buildWhatsAppUrl(whatsappMessage);

    res.status(201).json({
      order,
      upi: upiPayload,
      whatsapp_url: whatsappUrl,
      whatsapp_message: whatsappMessage,
    });
  });

  // Customer submits UPI UTR / Transaction Reference for manual Admin verification (never marks paid!)
  app.post('/api/orders/:orderNumber/utr', (req, res) => {
    const orderNumber = sanitizeText(req.params.orderNumber, 40);
    const phone = normalizePhone(req.body.customer_phone);
    const utr = sanitizeText(req.body.upi_utr, 40);

    if (!/^[a-zA-Z0-9]{6,35}$/.test(utr)) {
      res.status(400).json({ error: 'Please enter a valid UPI Transaction ID / UTR (6–35 letters or digits).' });
      return;
    }

    const existing = db
      .prepare('SELECT * FROM orders WHERE order_number = ?')
      .get(orderNumber) as OrderRow | undefined;

    if (!existing || phoneDigits(existing.customer_phone) !== phoneDigits(phone)) {
      res.status(404).json({ error: 'Order not found for this mobile number.' });
      return;
    }

    if (existing.payment_method !== 'UPI') {
      res.status(400).json({ error: 'UTR submission applies only to UPI orders.' });
      return;
    }

    db.prepare(`
      UPDATE orders
      SET upi_utr = ?, payment_status = 'pending_verification', updated_at = datetime('now')
      WHERE id = ?
    `).run(utr, existing.id);

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(existing.id) as OrderRow;
    res.json({
      order: formatOrderRow(updated),
      message: 'UPI reference received. Our team will verify your payment manually and confirm your order shortly.',
    });
  });

  // Public Order Tracking lookup (rate-limited, PII-minimized: omits phone & street address)
  app.get('/api/orders/track/:orderNumber', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`track:${ip}`, 25, 10 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many tracking lookups. Please try again in a few minutes.' });
      return;
    }

    const orderNumber = sanitizeText(req.params.orderNumber, 40).toUpperCase();
    if (!/^[A-Z0-9-]{6,32}$/.test(orderNumber)) {
      res.status(400).json({ error: 'Please enter a valid Order ID (e.g., OUD-2026-123456).' });
      return;
    }

    const row = db
      .prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?')
      .get(orderNumber) as OrderRow | undefined;

    if (!row) {
      res.status(404).json({ error: `No order found with ID "${orderNumber}". Please verify your Order ID and try again.` });
      return;
    }

    const formatted = formatOrderRow(row);
    const firstName = formatted.customer_name.split(/\s+/)[0] || 'Client';
    const maskedName =
      firstName.length > 2 ? `${firstName[0]}${'*'.repeat(Math.min(firstName.length - 1, 5))}` : firstName;

    res.json({
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
  });

  // ===================== ADMIN AUTH ENDPOINTS =====================
  app.get('/api/admin/auth/status', (_req, res) => {
    res.json(getAdminSetupStatus());
  });

  app.post('/api/admin/auth/setup', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`admin-setup:${ip}`, 10, 15 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
      return;
    }

    const email = sanitizeText(req.body.email, 120);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const recoveryPassphrase = typeof req.body.recovery_passphrase === 'string' ? req.body.recovery_passphrase.trim() : '';

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid admin email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }
    if (recoveryPassphrase.length < 6) {
      res.status(400).json({ error: 'Please set a recovery passphrase (at least 6 characters) for future password resets.' });
      return;
    }

    try {
      const token = claimInitialAdmin(email, password, recoveryPassphrase);
      res.status(201).json({ token, email: email.toLowerCase() });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to complete setup.' });
    }
  });

  app.post('/api/admin/auth/login', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`admin-login:${ip}`, 15, 15 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many sign-in attempts. Please wait 15 minutes.' });
      return;
    }

    const email = sanitizeText(req.body.email, 120);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!password) {
      res.status(400).json({ error: 'Password is required.' });
      return;
    }

    const authResult = authenticateAdmin(email, password);
    if (!authResult) {
      res.status(401).json({ error: 'Invalid admin credentials.' });
      return;
    }

    res.json(authResult);
  });

  app.post('/api/admin/auth/reset-password', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!checkRateLimit(`admin-reset:${ip}`, 10, 15 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many reset attempts. Please try again later.' });
      return;
    }

    const email = sanitizeText(req.body.email, 120);
    const recoveryKey = typeof req.body.recovery_key === 'string' ? req.body.recovery_key.trim() : '';
    const newPassword = typeof req.body.new_password === 'string' ? req.body.new_password : '';

    if (!recoveryKey) {
      res.status(400).json({ error: 'Recovery passphrase or recovery key is required.' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const result = resetAdminPassword(email, recoveryKey, newPassword);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ message: 'Admin password updated successfully. Please sign in with your new password.' });
  });

  // ===================== PROTECTED ADMIN ROUTES =====================
  app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
    const salesRow = db
      .prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) as total_sales,
          COALESCE(SUM(CASE WHEN payment_status = 'verified_paid' THEN total_amount ELSE 0 END), 0) as verified_sales,
          COUNT(*) as total_orders,
          SUM(CASE WHEN order_status IN ('pending', 'processing') THEN 1 ELSE 0 END) as pending_orders,
          SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as completed_orders
        FROM orders
      `)
      .get() as Record<string, number>;

    const prodRow = db
      .prepare(`
        SELECT
          COUNT(*) as total_products,
          SUM(CASE WHEN stock_50ml <= 5 OR stock_100ml <= 5 THEN 1 ELSE 0 END) as low_stock_products
        FROM products
      `)
      .get() as Record<string, number>;

    const reviewRow = db
      .prepare(`SELECT COUNT(*) as pending_reviews FROM reviews WHERE status = 'pending'`)
      .get() as { pending_reviews: number };

    const customRow = db
      .prepare(`SELECT COUNT(*) as custom_requests_count FROM custom_requests`)
      .get() as { custom_requests_count: number };

    const enquiryRow = db
      .prepare(`SELECT COUNT(*) as new_enquiries_count FROM customer_enquiries WHERE status = 'new'`)
      .get() as { new_enquiries_count: number };

    res.json({
      stats: {
        total_sales: salesRow.total_sales || 0,
        verified_sales: salesRow.verified_sales || 0,
        total_orders: salesRow.total_orders || 0,
        pending_orders: salesRow.pending_orders || 0,
        completed_orders: salesRow.completed_orders || 0,
        total_products: prodRow.total_products || 0,
        low_stock_products: prodRow.low_stock_products || 0,
        pending_reviews: reviewRow.pending_reviews || 0,
        custom_requests_count: customRow.custom_requests_count || 0,
        new_enquiries_count: enquiryRow.new_enquiries_count || 0,
      },
    });
  });

  // Admin Image Upload (Base64 PNG/JPEG/WebP, max 3MB, validated magic bytes)
  app.post('/api/admin/upload', requireAdmin, (req, res) => {
    const dataUrl = typeof req.body.imageData === 'string' ? req.body.imageData : '';
    const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      res.status(400).json({ error: 'Please upload a valid JPEG, PNG, or WebP image.' });
      return;
    }

    const extMap: Record<string, string> = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp' };
    const ext = extMap[match[1]];
    const buffer = Buffer.from(match[2], 'base64');

    if (buffer.length > 3 * 1024 * 1024) {
      res.status(400).json({ error: 'Image must be smaller than 3 MB.' });
      return;
    }

    // Validate binary magic bytes
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isWebp =
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isJpeg && !isPng && !isWebp) {
      res.status(400).json({ error: 'Unsupported or corrupted image binary.' });
      return;
    }

    const filename = `oudvin_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const dest = path.resolve(uploadsDir, filename);
    if (!dest.startsWith(uploadsDir + path.sep)) {
      res.status(403).json({ error: 'Forbidden path.' });
      return;
    }

    fs.writeFileSync(dest, buffer);
    res.status(201).json({ image_url: `/api/uploads/${filename}` });
  });

  // Admin Product CRUD (returns both published and hidden products)
  app.get('/api/admin/products', requireAdmin, (_req, res) => {
    const rows = db
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
    res.json({ products: rows });
  });

  app.post('/api/admin/products', requireAdmin, (req, res) => {
    const name = sanitizeText(req.body.name, 120);
    const collection = ['signature', 'classic', 'premium'].includes(req.body.collection) ? req.body.collection : 'signature';
    const fragranceFamily = sanitizeText(req.body.fragrance_family, 80) || 'Oriental Oud';
    const description = sanitizeText(req.body.description, 1000);
    const topNotes = sanitizeText(req.body.top_notes, 200);
    const middleNotes = sanitizeText(req.body.middle_notes, 200);
    const baseNotes = sanitizeText(req.body.base_notes, 200);
    const price50 = Math.max(0, Math.round(Number(req.body.price_50ml) || 900));
    const price100 = Math.max(0, Math.round(Number(req.body.price_100ml) || 1700));
    const stock50 = Math.max(0, Math.round(Number(req.body.stock_50ml) || 0));
    const stock100 = Math.max(0, Math.round(Number(req.body.stock_100ml) || 0));
    const imageUrl = sanitizeText(req.body.image_url, 500);
    const isBestseller = req.body.is_bestseller ? 1 : 0;
    const isNewArrival = req.body.is_new_arrival ? 1 : 0;
    const featured = req.body.featured ? 1 : 0;
    const isPublished = req.body.is_published === false || req.body.is_published === 0 ? 0 : 1;

    if (name.length < 2 || description.length < 5) {
      res.status(400).json({ error: 'Perfume name and description are required.' });
      return;
    }
    if (!isSafeImageUrl(imageUrl)) {
      res.status(400).json({ error: 'Please select or upload a valid product photograph.' });
      return;
    }

    let slug = slugify(name);
    const slugExists = db.prepare('SELECT id FROM products WHERE slug = ?').get(slug);
    if (slugExists) {
      slug = `${slug}-${crypto.randomInt(100, 999)}`;
    }

    const result = db
      .prepare(`
        INSERT INTO products (
          slug, name, collection, fragrance_family, description,
          top_notes, middle_notes, base_notes,
          price_50ml, price_100ml, stock_50ml, stock_100ml,
          image_url, is_bestseller, is_new_arrival, featured, is_published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
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
      );

    const created = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ product: created });
  });

  app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as RawProductRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const name = sanitizeText(req.body.name, 120) || existing.name;
    const collection = ['signature', 'classic', 'premium'].includes(req.body.collection)
      ? req.body.collection
      : existing.collection;
    const fragranceFamily = sanitizeText(req.body.fragrance_family, 80) || existing.fragrance_family;
    const description = sanitizeText(req.body.description, 1000) || existing.description;
    const topNotes = sanitizeText(req.body.top_notes, 200) || existing.top_notes;
    const middleNotes = sanitizeText(req.body.middle_notes, 200) || existing.middle_notes;
    const baseNotes = sanitizeText(req.body.base_notes, 200) || existing.base_notes;
    const price50 = req.body.price_50ml !== undefined ? Math.max(0, Math.round(Number(req.body.price_50ml))) : existing.price_50ml;
    const price100 = req.body.price_100ml !== undefined ? Math.max(0, Math.round(Number(req.body.price_100ml))) : existing.price_100ml;
    const stock50 = req.body.stock_50ml !== undefined ? Math.max(0, Math.round(Number(req.body.stock_50ml))) : existing.stock_50ml;
    const stock100 = req.body.stock_100ml !== undefined ? Math.max(0, Math.round(Number(req.body.stock_100ml))) : existing.stock_100ml;
    const imageUrl = req.body.image_url ? sanitizeText(req.body.image_url, 500) : existing.image_url;
    const isBestseller = req.body.is_bestseller !== undefined ? (req.body.is_bestseller ? 1 : 0) : existing.is_bestseller;
    const isNewArrival = req.body.is_new_arrival !== undefined ? (req.body.is_new_arrival ? 1 : 0) : existing.is_new_arrival;
    const featured = req.body.featured !== undefined ? (req.body.featured ? 1 : 0) : existing.featured;
    const isPublished =
      req.body.is_published !== undefined
        ? req.body.is_published
          ? 1
          : 0
        : existing.is_published ?? 1;

    if (!isSafeImageUrl(imageUrl)) {
      res.status(400).json({ error: 'Invalid product image URL.' });
      return;
    }

    db.prepare(`
      UPDATE products SET
        name = ?, collection = ?, fragrance_family = ?, description = ?,
        top_notes = ?, middle_notes = ?, base_notes = ?,
        price_50ml = ?, price_100ml = ?, stock_50ml = ?, stock_100ml = ?,
        image_url = ?, is_bestseller = ?, is_new_arrival = ?, featured = ?, is_published = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
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
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json({ product: updated });
  });

  app.patch('/api/admin/products/:id/publish', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }
    const isPublished = req.body.is_published ? 1 : 0;
    db.prepare(`UPDATE products SET is_published = ?, updated_at = datetime('now') WHERE id = ?`).run(
      isPublished,
      id
    );
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!updated) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    res.json({ product: updated });
  });

  app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid product ID.' });
      return;
    }
    const info = db.prepare('DELETE FROM products WHERE id = ?').run(id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }
    res.json({ deleted: true });
  });

  // Admin Orders Management
  app.get('/api/admin/orders', requireAdmin, (_req, res) => {
    const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all() as OrderRow[];
    res.json({ orders: rows.map(formatOrderRow) });
  });

  app.patch('/api/admin/orders/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid order ID.' });
      return;
    }
    const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const validPaymentStatuses = ['pending_verification', 'cod_pending', 'verified_paid', 'payment_rejected'];
    const validOrderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    const paymentStatus = validPaymentStatuses.includes(req.body.payment_status)
      ? req.body.payment_status
      : existing.payment_status;
    const orderStatus = validOrderStatuses.includes(req.body.order_status)
      ? req.body.order_status
      : existing.order_status;

    db.prepare(`
      UPDATE orders
      SET payment_status = ?, order_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(paymentStatus, orderStatus, id);

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow;
    res.json({ order: formatOrderRow(updated) });
  });

  // Admin Offers Management
  app.get('/api/admin/offers', requireAdmin, (_req, res) => {
    const offers = db.prepare('SELECT * FROM offers ORDER BY id ASC').all();
    res.json({ offers });
  });

  app.post('/api/admin/offers', requireAdmin, (req, res) => {
    const title = sanitizeText(req.body.title, 120);
    const code = sanitizeText(req.body.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const description = sanitizeText(req.body.description, 400);
    const offerType = ['buy2get1', 'percentage', 'flat'].includes(req.body.offer_type) ? req.body.offer_type : 'percentage';
    const discountValue = Math.max(0, Math.round(Number(req.body.discount_value) || 0));
    const minItems = Math.max(1, Math.round(Number(req.body.min_items) || (offerType === 'buy2get1' ? 3 : 1)));
    const expiresAt = sanitizeText(req.body.expires_at, 20) || null;
    const isActive = req.body.is_active === false || req.body.is_active === 0 ? 0 : 1;

    if (title.length < 3 || code.length < 3) {
      res.status(400).json({ error: 'Offer title and code (3+ chars) are required.' });
      return;
    }

    try {
      const info = db
        .prepare(`
          INSERT INTO offers (title, code, description, offer_type, discount_value, min_items, expires_at, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(title, code, description, offerType, discountValue, minItems, expiresAt, isActive);
      const created = db.prepare('SELECT * FROM offers WHERE id = ?').get(info.lastInsertRowid);
      res.status(201).json({ offer: created });
    } catch {
      res.status(400).json({ error: 'Offer code already exists. Please use a unique code.' });
    }
  });

  app.put('/api/admin/offers/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid offer ID.' });
      return;
    }
    const existing = db.prepare('SELECT * FROM offers WHERE id = ?').get(id) as OfferRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Offer not found.' });
      return;
    }

    const title = sanitizeText(req.body.title, 120) || existing.title;
    const code = sanitizeText(req.body.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '') || existing.code;
    const description = sanitizeText(req.body.description, 400) || existing.description;
    const offerType = ['buy2get1', 'percentage', 'flat'].includes(req.body.offer_type)
      ? req.body.offer_type
      : existing.offer_type;
    const discountValue =
      req.body.discount_value !== undefined ? Math.max(0, Math.round(Number(req.body.discount_value))) : existing.discount_value;
    const minItems =
      req.body.min_items !== undefined ? Math.max(1, Math.round(Number(req.body.min_items))) : existing.min_items;
    const expiresAt = req.body.expires_at !== undefined ? sanitizeText(req.body.expires_at, 20) || null : existing.expires_at;
    const isActive = req.body.is_active !== undefined ? (req.body.is_active ? 1 : 0) : existing.is_active;

    try {
      db.prepare(`
        UPDATE offers
        SET title = ?, code = ?, description = ?, offer_type = ?, discount_value = ?, min_items = ?, expires_at = ?, is_active = ?
        WHERE id = ?
      `).run(title, code, description, offerType, discountValue, minItems, expiresAt, isActive, id);

      const updated = db.prepare('SELECT * FROM offers WHERE id = ?').get(id);
      res.json({ offer: updated });
    } catch {
      res.status(400).json({ error: 'Offer code must be unique.' });
    }
  });

  app.delete('/api/admin/offers/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid offer ID.' });
      return;
    }
    db.prepare('DELETE FROM offers WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // Admin Custom Perfume Requests
  app.get('/api/admin/custom-requests', requireAdmin, (_req, res) => {
    const requests = db.prepare('SELECT * FROM custom_requests ORDER BY created_at DESC').all();
    res.json({ requests });
  });

  app.patch('/api/admin/custom-requests/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const status = ['new', 'contacted', 'completed'].includes(req.body.status) ? req.body.status : null;
    if (!Number.isInteger(id) || !status) {
      res.status(400).json({ error: 'Invalid request or status.' });
      return;
    }
    db.prepare('UPDATE custom_requests SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare('SELECT * FROM custom_requests WHERE id = ?').get(id);
    res.json({ request: updated });
  });

  // Admin Review Moderation
  app.get('/api/admin/reviews', requireAdmin, (_req, res) => {
    const reviews = db
      .prepare(`
        SELECT r.*, p.name as product_name
        FROM reviews r
        LEFT JOIN products p ON r.product_id = p.id
        ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, r.created_at DESC
      `)
      .all();
    res.json({ reviews });
  });

  app.patch('/api/admin/reviews/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const status = ['pending', 'approved', 'rejected'].includes(req.body.status) ? req.body.status : null;
    if (!Number.isInteger(id) || !status) {
      res.status(400).json({ error: 'Invalid review ID or status.' });
      return;
    }
    db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    res.json({ review: updated });
  });

  app.delete('/api/admin/reviews/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: 'Invalid review ID.' });
      return;
    }
    db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
    res.json({ deleted: true });
  });

  // Admin Customers Overview (aggregated from real orders)
  app.get('/api/admin/customers', requireAdmin, (_req, res) => {
    const customers = db
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
    res.json({ customers });
  });

  // Admin Customer Enquiries
  app.get('/api/admin/enquiries', requireAdmin, (_req, res) => {
    const enquiries = db.prepare('SELECT * FROM customer_enquiries ORDER BY created_at DESC').all();
    res.json({ enquiries });
  });

  app.patch('/api/admin/enquiries/:id', requireAdmin, (req, res) => {
    const id = Number(req.params.id);
    const status = ['new', 'replied', 'resolved'].includes(req.body.status) ? req.body.status : null;
    if (!Number.isInteger(id) || !status) {
      res.status(400).json({ error: 'Invalid enquiry ID or status.' });
      return;
    }
    db.prepare('UPDATE customer_enquiries SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare('SELECT * FROM customer_enquiries WHERE id = ?').get(id);
    res.json({ enquiry: updated });
  });

  // Admin Website Content Management & Store Settings (Protected)
  app.get('/api/admin/settings', requireAdmin, (_req, res) => {
    res.json({ settings: formatSiteSettingsResponse(getSiteSettings()) });
  });

  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const body = req.body || {};
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
          res.status(400).json({ error: `Invalid image URL for ${key}.` });
          return;
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
        res.status(400).json({ error: 'Please enter a valid 10-digit Indian WhatsApp number (+91).' });
        return;
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

    const upsert = db.prepare(`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `);
    const saveTx = db.transaction(() => {
      for (const [k, v] of updates) {
        upsert.run(k, v);
      }
    });
    saveTx();

    res.json({ settings: formatSiteSettingsResponse(getSiteSettings()) });
  });

  // Global API error guard so unexpected failures return clean JSON instead of hanging
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    if (res.headersSent) {
      next(err);
      return;
    }
    if (req.path.startsWith('/api/')) {
      res.status(500).json({ error: 'Temporary server error. Please try again.' });
      return;
    }
    res.status(500).send('Temporary server error. Please refresh the page.');
  });

  // Vite dev middleware or production static files
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OUDVIN FRAGRANCES server running at http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start OUDVIN server:', err);
  process.exit(1);
});
