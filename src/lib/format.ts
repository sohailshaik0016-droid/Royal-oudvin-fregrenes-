import type { CartItem, Offer } from '../types';

export const DEFAULT_COUNTRY = 'India';
export const DEFAULT_COUNTRY_CODE = '+91';
export const DEFAULT_CURRENCY = 'INR';
export const WHATSAPP_NUMBER = '918074469549';
export const WHATSAPP_DISPLAY = '+91 8074469549';
export const UPI_ID = 'sohailshaik0016@okhdfcbank';

export const ASSETS = {
  hero: '/src/assets/images/hero_oudvin_luxury_1795431188233.jpg',
  signatureBanner: '/src/assets/images/collection_signature_banner_1795431190538.jpg',
  classicBanner: '/src/assets/images/collection_classic_banner_1795431188161.jpg',
  presets: [
    { label: 'Royal Oud (Black & Gold)', url: '/src/assets/images/bottle_oud_royal_1795431186846.jpg' },
    { label: 'Velvet Rose (Damascus)', url: '/src/assets/images/bottle_rose_velvet_1795431187983.jpg' },
    { label: 'White Musk (Frosted Pearl)', url: '/src/assets/images/bottle_musk_white_1795431189572.jpg' },
    { label: 'Golden Amber (Resin Elixir)', url: '/src/assets/images/bottle_amber_gold_1795431189137.jpg' },
    { label: 'Forest Wood (Emerald & Walnut)', url: '/src/assets/images/bottle_wood_forest_1795431190339.jpg' },
    { label: 'Midnight Sapphire (Cobalt Cut)', url: '/src/assets/images/bottle_sapphire_night_1795431190249.jpg' },
    { label: 'Sultan Heritage (Cut Crystal)', url: '/src/assets/images/bottle_sultan_heritage_1795431188998.jpg' },
  ],
};

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatCollectionName(col: string): string {
  if (col === 'signature') return 'Signature Collection';
  if (col === 'classic') return 'Classic Collection';
  if (col === 'premium') return 'Premium Collection';
  return col;
}

export function computeCartTotals(items: CartItem[], offers: Offer[], appliedCode?: string) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalBottles = items.reduce((sum, item) => sum + item.quantity, 0);

  const expandedPrices: number[] = [];
  for (const item of items) {
    for (let i = 0; i < item.quantity; i++) {
      expandedPrices.push(item.unitPrice);
    }
  }

  const now = Date.now();
  const activeOffers = offers.filter((o) => {
    if (!o.is_active) return false;
    if (!o.expires_at) return true;
    const exp = new Date(`${o.expires_at}T23:59:59Z`).getTime();
    return !Number.isNaN(exp) && exp >= now;
  });

  const candidates = appliedCode
    ? activeOffers.filter((o) => o.code.toLowerCase() === appliedCode.trim().toLowerCase() || o.offer_type === 'buy2get1')
    : activeOffers;

  const list = candidates.length > 0 ? candidates : activeOffers;

  let bestDiscount = 0;
  let appliedOffer: Offer | null = null;

  for (const offer of list) {
    if (totalBottles < offer.min_items) continue;
    let discount = 0;
    if (offer.offer_type === 'buy2get1') {
      const sorted = [...expandedPrices].sort((a, b) => a - b);
      const freeCount = Math.floor(sorted.length / 3);
      for (let i = 0; i < freeCount; i++) {
        discount += sorted[i];
      }
    } else if (offer.offer_type === 'percentage') {
      discount = Math.round((subtotal * Math.min(offer.discount_value, 90)) / 100);
    } else if (offer.offer_type === 'flat') {
      discount = Math.min(offer.discount_value, subtotal);
    }
    if (discount > bestDiscount) {
      bestDiscount = discount;
      appliedOffer = offer;
    }
  }

  return {
    subtotal,
    totalBottles,
    discountAmount: bestDiscount,
    appliedOffer,
    totalAmount: Math.max(0, subtotal - bestDiscount),
  };
}

/**
 * Cleans pasted or typed Indian mobile numbers (e.g., "+91 80744 69549", "08074469549", "8074469549")
 * down to the local 10-digit number for India (+91) inputs so foreign codes are never applied.
 */
export function extractIndianMobileDigits(rawInput: string): string {
  let digits = rawInput.replace(/[^0-9]/g, '');
  if (digits.startsWith('0091') && digits.length > 10) {
    digits = digits.slice(4);
  } else if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function formatIndianDisplayPhone(rawPhone: string): string {
  const digits = extractIndianMobileDigits(rawPhone);
  if (digits.length === 10) {
    return `+91 ${digits}`;
  }
  return rawPhone;
}

export function formatWhatsAppPhone(rawPhone: string = WHATSAPP_NUMBER): string {
  let digits = rawPhone.replace(/[^0-9]/g, '');
  if (!digits) {
    return WHATSAPP_NUMBER;
  }
  if (digits.startsWith('0091') && digits.length >= 14) {
    digits = digits.slice(2);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  if (digits.endsWith('8074469549')) {
    return WHATSAPP_NUMBER;
  }
  return digits.startsWith('91') ? digits : `91${digits.slice(-10)}`;
}

export function buildWhatsAppLink(message: string, phoneNumber: string = WHATSAPP_NUMBER): string {
  const cleanPhone = formatWhatsAppPhone(phoneNumber);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
}

export function buildCartWhatsAppMessage(items: CartItem[], offers: Offer[], appliedCode?: string): string {
  const totals = computeCartTotals(items, offers, appliedCode);
  const lines = [
    '*QUICK WHATSAPP ORDER — OUDVIN FRAGRANCES*',
    '',
    '*Selected Perfumes*',
    ...items.map(
      (item, idx) =>
        `${idx + 1}. ${item.name} (${item.size === '50ML' ? '50 ML' : '100 ML'}) x ${item.quantity} — ${formatINR(item.unitPrice * item.quantity)}`
    ),
    '',
    `Subtotal: ${formatINR(totals.subtotal)}`,
  ];
  if (totals.discountAmount > 0 && totals.appliedOffer) {
    lines.push(`Offer Applied (${totals.appliedOffer.title}): -${formatINR(totals.discountAmount)}`);
  }
  lines.push(`*Total Payable: ${formatINR(totals.totalAmount)}*`);
  lines.push('');
  lines.push('Please confirm my order and delivery details.');
  return lines.join('\n');
}

export function formatPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'verified_paid':
      return 'Payment Verified';
    case 'pending_verification':
      return 'Awaiting UPI Verification';
    case 'cod_pending':
      return 'Cash on Delivery';
    case 'payment_rejected':
      return 'Payment Rejected';
    default:
      return status;
  }
}

export function formatOrderStatusLabel(status: string): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'shipped':
      return 'Shipped';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}
