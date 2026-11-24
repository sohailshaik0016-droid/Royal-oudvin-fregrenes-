import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Smartphone,
  Truck,
} from 'lucide-react';
import type { CartItem, CheckoutResponse, Offer, PaymentMethod, SiteSettings } from '../types';
import {
  buildCartWhatsAppMessage,
  buildWhatsAppLink,
  computeCartTotals,
  DEFAULT_COUNTRY,
  DEFAULT_COUNTRY_CODE,
  extractIndianMobileDigits,
  formatIndianDisplayPhone,
  formatINR,
  formatPaymentStatusLabel,
  UPI_ID,
  WHATSAPP_NUMBER,
} from '../lib/format';

interface CheckoutViewProps {
  items: CartItem[];
  offers: Offer[];
  siteSettings?: SiteSettings | null;
  onClearCart: () => void;
  onNavigate: (path: string) => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  items,
  offers,
  siteSettings,
  onClearCart,
  onNavigate,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<CheckoutResponse | null>(null);

  // Manual UPI UTR submission state
  const [utr, setUtr] = useState('');
  const [utrSubmitting, setUtrSubmitting] = useState(false);
  const [utrSuccess, setUtrSuccess] = useState<string | null>(null);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedOrderMsg, setCopiedOrderMsg] = useState(false);

  const waNumber = siteSettings?.whatsapp_number || WHATSAPP_NUMBER;
  const waDisplay = formatIndianDisplayPhone(waNumber);
  const upiId = siteSettings?.upi_id || UPI_ID;
  const paymentInstructions =
    siteSettings?.payment_instructions ||
    'Next step generates a dynamic UPI QR code & Android UPI app links for your exact order total in INR (₹). Payments are verified manually by OUDVIN Admin before dispatch.';

  const totals = computeCartTotals(items, offers, offerCode);
  const baseDeliveryFee = Math.max(0, Number(siteSettings?.delivery_charge || 0));
  const freeDeliveryAbove = Math.max(0, Number(siteSettings?.free_delivery_above || 0));
  const deliveryFee =
    baseDeliveryFee > 0 && (freeDeliveryAbove === 0 || totals.totalAmount < freeDeliveryAbove)
      ? baseDeliveryFee
      : 0;
  const finalPayable = totals.totalAmount + deliveryFee;

  const quickWhatsAppUrl = buildWhatsAppLink(
    buildCartWhatsAppMessage(items, offers, offerCode),
    waNumber
  );

  const copyTextSafely = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback below
    }
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.setAttribute('readonly', '');
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (items.length === 0) {
      setError('Your bag is empty.');
      return;
    }

    const cleanName = customerName.trim();
    const mobileDigits = extractIndianMobileDigits(customerPhone);
    const cleanAddress = deliveryAddress.trim();
    const cleanCity = city.trim();
    const cleanPin = pincode.replace(/[^0-9]/g, '');

    if (cleanName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (mobileDigits.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number (+91).');
      return;
    }
    if (cleanAddress.length < 4) {
      setError('Please enter your complete delivery address.');
      return;
    }
    if (cleanCity.length < 2) {
      setError('Please enter your city.');
      return;
    }
    if (cleanPin.length < 5 || cleanPin.length > 8) {
      setError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: cleanName,
          customer_phone: `${DEFAULT_COUNTRY_CODE}${mobileDigits}`,
          delivery_address: cleanAddress,
          city: cleanCity,
          pincode: cleanPin,
          payment_method: paymentMethod,
          offer_code: offerCode.trim() || undefined,
          items: items.map((item) => ({
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
          })),
        }),
      });

      let data: { error?: string } & Partial<CheckoutResponse> = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        setError(data.error || 'Unable to place order. Please review your details.');
      } else {
        setConfirmation(data as CheckoutResponse);
        onClearCart();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch {
      setError('Connection issue while placing your order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    setUtrError(null);
    setUtrSuccess(null);
    setUtrSubmitting(true);

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(confirmation.order.order_number)}/utr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_phone: confirmation.order.customer_phone,
          upi_utr: utr.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUtrError(data.error || 'Could not save UPI Transaction ID.');
      } else {
        setConfirmation({ ...confirmation, order: data.order });
        setUtrSuccess(data.message);
      }
    } catch {
      setUtrError('Network error while submitting UPI reference.');
    } finally {
      setUtrSubmitting(false);
    }
  };

  const handleCopyUpi = async (id: string) => {
    const ok = await copyTextSafely(id);
    if (ok) {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleCopyOrderMessage = async (msg: string) => {
    const ok = await copyTextSafely(msg);
    if (ok) {
      setCopiedOrderMsg(true);
      setTimeout(() => setCopiedOrderMsg(false), 2500);
    }
  };

  // Post-Order Confirmation & Genuine UPI Payment / WhatsApp Screen
  if (confirmation) {
    const { order, upi, whatsapp_message } = confirmation;
    const orderWhatsAppUrl = buildWhatsAppLink(whatsapp_message, waNumber);
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[#C9A24A]/30 bg-[#171614] p-6 sm:p-8 text-[#F3EBDD]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#C9A24A]/20 pb-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-[#C9A24A] mt-0.5" />
              <div>
                <p className="text-xs text-[#C9A24A] font-medium">Order Recorded Successfully</p>
                <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F3EBDD]">
                  Order {order.order_number}
                </h1>
              </div>
            </div>
            <div className="text-left sm:text-right text-xs text-[#F3EBDD]/75">
              <div className="font-medium text-[#C9A24A]">
                {formatPaymentStatusLabel(order.payment_status)}
              </div>
              <div className="mt-0.5 font-mono tabular-nums">
                Total: {formatINR(order.total_amount)}
              </div>
            </div>
          </div>

          {/* Step 1: Immediate Top-of-Screen WhatsApp Order Notification CTA */}
          <div className="mt-6 rounded-lg border border-[#C9A24A]/50 bg-[#211C14] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#C9A24A]">
                  Final Step · WhatsApp Order Dispatch ({waDisplay})
                </p>
                <h2 className="font-display text-2xl font-semibold text-[#F3EBDD]">
                  Send Your Order Details on WhatsApp
                </h2>
                <p className="text-xs leading-relaxed text-[#F3EBDD]/80">
                  Your order <strong className="font-mono text-[#C9A24A]">{order.order_number}</strong> is already saved in our store system. Tap the button below to open WhatsApp pre-filled to <strong className="font-mono text-[#F3EBDD]">{waDisplay}</strong> and press Send for immediate confirmation.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:shrink-0 sm:w-64">
                <a
                  href={orderWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-[#C9A24A] px-5 py-3 text-sm font-semibold text-[#101010] hover:bg-[#DFC076] whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  Send Order on WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyOrderMessage(whatsapp_message)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-[#C9A24A]/40 bg-[#101010] px-4 py-2 text-xs font-semibold text-[#F3EBDD] hover:border-[#C9A24A] hover:text-[#C9A24A]"
                >
                  {copiedOrderMsg ? <Check className="h-3.5 w-3.5 text-[#C9A24A]" /> : <Copy className="h-3.5 w-3.5 text-[#C9A24A]" />}
                  {copiedOrderMsg ? 'Order Message Copied' : 'Copy Order Message'}
                </button>
              </div>
            </div>

            <details className="mt-4 rounded-md border border-[#C9A24A]/20 bg-[#101010]/80 px-4 py-2.5 text-xs text-[#F3EBDD]/80">
              <summary className="cursor-pointer font-medium text-[#C9A24A] select-none">
                View formatted WhatsApp order message
              </summary>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#F3EBDD]/85">
                {whatsapp_message}
              </pre>
            </details>
          </div>

          {/* Genuine UPI Payment Section (Never fakes payment confirmation!) */}
          {order.payment_method === 'UPI' && upi && (
            <div className="mt-6 rounded-lg border border-[#C9A24A]/30 bg-[#F3EBDD] p-5 sm:p-6 text-[#101010]">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
                <div className="md:col-span-5 flex flex-col items-center text-center">
                  <div className="rounded-lg border border-[#493323]/25 bg-white p-3">
                    <img
                      src={upi.qr_data_url}
                      alt={`UPI QR code to pay ${formatINR(order.total_amount)} to ${upi.upi_id}`}
                      className="h-52 w-52 sm:h-56 sm:w-56"
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-[#493323]">
                    Scan &amp; Pay {formatINR(order.total_amount)} (INR)
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 rounded-md border border-[#493323]/20 bg-[#EAE0CE] px-3 py-1.5">
                    <span className="font-mono text-xs text-[#101010]">{upi.upi_id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyUpi(upi.upi_id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#493323] hover:text-[#101010]"
                    >
                      {copiedUpi ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedUpi ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="md:col-span-7 space-y-4">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-[#101010]">
                      Complete UPI Payment (India)
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-[#493323]">
                      Pay exact amount <strong className="tabular-nums">{formatINR(order.total_amount)}</strong> to{' '}
                      <strong className="font-mono">{upi.upi_id}</strong> ({upi.merchant_name}). Your payment status stays{' '}
                      <strong>Awaiting UPI Verification</strong> until our team manually verifies receipt in our bank account.
                    </p>
                  </div>

                  {/* Android Compatible UPI Deep-Link Intents */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#493323]">
                      Pay Directly on Mobile UPI Apps:
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <a
                        href={upi.gpay_uri}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-[#101010] px-3 py-2 text-xs font-semibold text-[#F3EBDD] hover:bg-[#26221E]"
                      >
                        <Smartphone className="h-3.5 w-3.5 text-[#C9A24A]" />
                        Google Pay
                      </a>
                      <a
                        href={upi.phonepe_uri}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-[#101010] px-3 py-2 text-xs font-semibold text-[#F3EBDD] hover:bg-[#26221E]"
                      >
                        <Smartphone className="h-3.5 w-3.5 text-[#C9A24A]" />
                        PhonePe
                      </a>
                      <a
                        href={upi.upi_uri}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-[#493323]/40 bg-[#EAE0CE] px-3 py-2 text-xs font-semibold text-[#101010] hover:bg-[#DFD2BC]"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Other UPI App
                      </a>
                    </div>
                  </div>

                  {/* Submit UTR / Reference Number for Admin Verification */}
                  <form onSubmit={handleSubmitUtr} className="border-t border-[#493323]/15 pt-4 space-y-2.5">
                    <label htmlFor="upi-utr-input" className="block text-xs font-semibold text-[#493323]">
                      After Paying, Enter Your 12-Digit UPI Reference / UTR Number
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="upi-utr-input"
                        type="text"
                        required
                        minLength={6}
                        maxLength={35}
                        value={utr}
                        onChange={(e) => setUtr(e.target.value)}
                        placeholder="e.g., 432819482710"
                        className="flex-1 min-h-[44px] rounded-md border border-[#493323]/30 bg-white px-3.5 font-mono text-sm text-[#101010] placeholder:text-[#493323]/40"
                      />
                      <button
                        type="submit"
                        disabled={utrSubmitting}
                        className="min-h-[44px] rounded-md bg-[#C9A24A] px-4 py-2 text-xs font-semibold text-[#101010] hover:bg-[#DFC076] whitespace-nowrap disabled:opacity-50"
                      >
                        {utrSubmitting ? 'Saving...' : 'Submit UTR'}
                      </button>
                    </div>
                    {order.upi_utr && (
                      <p className="text-xs text-[#493323]">
                        Recorded UTR: <span className="font-mono font-semibold">{order.upi_utr}</span> (Pending Admin confirmation)
                      </p>
                    )}
                    {utrError && <p className="text-xs text-red-700">{utrError}</p>}
                    {utrSuccess && <p className="text-xs font-medium text-[#493323]">{utrSuccess}</p>}
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Cash on Delivery Summary */}
          {order.payment_method === 'COD' && (
            <div className="mt-6 rounded-lg border border-[#C9A24A]/25 bg-[#101010] p-5 text-sm text-[#F3EBDD]/85">
              <div className="flex items-center gap-2 font-semibold text-[#C9A24A]">
                <Truck className="h-4 w-4" />
                Cash on Delivery Selected (Pan-India)
              </div>
              <p className="mt-2 leading-relaxed">
                Pay <strong className="text-[#F3EBDD] tabular-nums">{formatINR(order.total_amount)}</strong> in cash or UPI upon delivery anywhere in India. Tap <strong>Send Order on WhatsApp</strong> above to notify {waDisplay} for dispatch priority.
              </p>
            </div>
          )}

          {/* Order Receipt Summary */}
          <div className="mt-6 grid grid-cols-1 gap-6 border-t border-[#C9A24A]/15 pt-6 sm:grid-cols-2 text-sm">
            <div>
              <h3 className="text-xs font-semibold text-[#C9A24A]">Delivery Details ({DEFAULT_COUNTRY})</h3>
              <p className="mt-2 font-medium text-[#F3EBDD]">{order.customer_name}</p>
              <p className="text-[#F3EBDD]/75 font-mono tabular-nums">
                {formatIndianDisplayPhone(order.customer_phone)}
              </p>
              <p className="mt-1 text-[#F3EBDD]/75">
                {order.delivery_address}, {order.city}, {DEFAULT_COUNTRY} — {order.pincode}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#C9A24A]">Order Summary (INR)</h3>
              <ul className="mt-2 space-y-1.5 text-xs text-[#F3EBDD]/85">
                {order.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between gap-2">
                    <span>
                      {item.name} ({item.size}) × {item.quantity}
                    </span>
                    <span className="tabular-nums">{formatINR(item.line_total)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 space-y-1 border-t border-[#C9A24A]/15 pt-2 text-xs">
                <div className="flex justify-between text-[#F3EBDD]/70">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatINR(order.subtotal)}</span>
                </div>
                {order.discount_amount > 0 && (
                  <div className="flex justify-between text-[#C9A24A]">
                    <span>Offer ({order.applied_offer})</span>
                    <span className="tabular-nums">−{formatINR(order.discount_amount)}</span>
                  </div>
                )}
                {Number(order.delivery_charge || 0) > 0 && (
                  <div className="flex justify-between text-[#F3EBDD]/70">
                    <span>Delivery ({DEFAULT_COUNTRY})</span>
                    <span className="tabular-nums">{formatINR(Number(order.delivery_charge))}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-semibold text-[#F3EBDD] pt-1">
                  <span>Total Payable</span>
                  <span className="text-[#C9A24A] tabular-nums">{formatINR(order.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate(`/track-order?id=${encodeURIComponent(order.order_number)}`)}
              className="min-h-[44px] rounded-md bg-[#C9A24A] px-6 py-2.5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076]"
            >
              Track Order Status
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/shop')}
              className="min-h-[44px] rounded-md border border-[#C9A24A]/40 px-6 py-2.5 text-xs font-semibold text-[#F3EBDD] hover:border-[#C9A24A] hover:text-[#C9A24A]"
            >
              Continue Exploring OUDVIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Empty Bag Guard
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl font-semibold text-[#F3EBDD]">Your Bag Is Empty</h1>
        <p className="mt-3 text-sm text-[#F3EBDD]/70">
          Add your preferred OUDVIN perfumes to proceed with fast guest checkout across India.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/shop')}
          className="mt-6 min-h-[48px] rounded-md bg-[#C9A24A] px-6 py-3 text-sm font-semibold text-[#101010] hover:bg-[#DFC076]"
        >
          Shop Perfumes
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <button
        type="button"
        onClick={() => onNavigate('/shop')}
        className="mb-6 inline-flex min-h-[40px] items-center gap-2 text-xs font-medium text-[#F3EBDD]/75 hover:text-[#C9A24A]"
      >
        <ArrowLeft className="h-4 w-4" />
        Continue Shopping
      </button>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* Guest Checkout Form */}
        <form onSubmit={handlePlaceOrder} noValidate className="lg:col-span-7 space-y-6">
          <div className="rounded-lg border border-[#C9A24A]/20 bg-[#F3EBDD] p-6 sm:p-8 text-[#101010]">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#101010]">
              Express Guest Checkout
            </h1>
            <p className="mt-1 text-xs text-[#493323]">
              No account registration required. Pan-India delivery in INR (₹).
            </p>

            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="chk-name" className="block text-xs font-semibold text-[#493323] mb-1.5">
                    Customer Full Name *
                  </label>
                  <input
                    id="chk-name"
                    type="text"
                    required
                    maxLength={100}
                    autoComplete="name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Full name"
                    className="w-full min-h-[46px] rounded-md border border-[#493323]/25 bg-white px-3.5 text-sm text-[#101010]"
                  />
                </div>
                <div>
                  <label htmlFor="chk-phone" className="block text-xs font-semibold text-[#493323] mb-1.5">
                    Mobile Number (India +91) *
                  </label>
                  <div className="flex min-h-[46px] overflow-hidden rounded-md border border-[#493323]/25 bg-white focus-within:ring-2 focus-within:ring-[#C9A24A]">
                    <span
                      className="inline-flex shrink-0 items-center border-r border-[#493323]/20 bg-[#EAE0CE] px-3 font-mono text-xs font-semibold text-[#493323]"
                      aria-label="India country code +91"
                    >
                      IN {DEFAULT_COUNTRY_CODE}
                    </span>
                    <input
                      id="chk-phone"
                      type="tel"
                      required
                      maxLength={22}
                      autoComplete="tel-national"
                      inputMode="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(extractIndianMobileDigits(e.target.value))}
                      placeholder="10-digit mobile number"
                      className="w-full min-h-[46px] bg-white px-3 font-mono text-sm text-[#101010] focus:outline-none tabular-nums"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[#493323]/75">
                    Default: India (+91). Enter 10 digits or paste +91 number.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="chk-address" className="block text-xs font-semibold text-[#493323] mb-1.5">
                  Delivery Address *
                </label>
                <textarea
                  id="chk-address"
                  required
                  maxLength={300}
                  rows={3}
                  autoComplete="street-address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="House / Flat No., Building, Street, Area, Landmark"
                  className="w-full rounded-md border border-[#493323]/25 bg-white p-3.5 text-sm text-[#101010]"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="chk-city" className="block text-xs font-semibold text-[#493323] mb-1.5">
                    City *
                  </label>
                  <input
                    id="chk-city"
                    type="text"
                    required
                    maxLength={80}
                    autoComplete="address-level2"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g., Hyderabad"
                    className="w-full min-h-[46px] rounded-md border border-[#493323]/25 bg-white px-3.5 text-sm text-[#101010]"
                  />
                </div>
                <div>
                  <label htmlFor="chk-pin" className="block text-xs font-semibold text-[#493323] mb-1.5">
                    PIN Code *
                  </label>
                  <input
                    id="chk-pin"
                    type="text"
                    required
                    inputMode="numeric"
                    maxLength={8}
                    autoComplete="postal-code"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="6-digit PIN"
                    className="w-full min-h-[46px] rounded-md border border-[#493323]/25 bg-white px-3.5 font-mono text-sm text-[#101010] tabular-nums"
                  />
                </div>
                <div>
                  <label htmlFor="chk-country" className="block text-xs font-semibold text-[#493323] mb-1.5">
                    Delivery Country
                  </label>
                  <input
                    id="chk-country"
                    type="text"
                    readOnly
                    value={DEFAULT_COUNTRY}
                    className="w-full min-h-[46px] rounded-md border border-[#493323]/20 bg-[#EAE0CE] px-3.5 text-sm font-medium text-[#493323] cursor-default"
                  />
                </div>
              </div>
            </div>

            {/* Payment Option Selection */}
            <div className="mt-7 border-t border-[#493323]/15 pt-6">
              <h2 className="font-display text-2xl font-semibold text-[#101010]">Payment Method (INR ₹)</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`flex flex-col items-start rounded-md border p-4 text-left transition-colors ${
                    paymentMethod === 'UPI'
                      ? 'border-[#101010] bg-[#101010] text-[#F3EBDD]'
                      : 'border-[#493323]/25 bg-[#EAE0CE]/60 text-[#101010]'
                  }`}
                >
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-[#C9A24A]" />
                    UPI Payment (Scan &amp; Pay)
                  </span>
                  <span className={`mt-1 text-xs ${paymentMethod === 'UPI' ? 'text-[#F3EBDD]/70' : 'text-[#493323]'}`}>
                    Google Pay, PhonePe &amp; Dynamic QR ({upiId})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`flex flex-col items-start rounded-md border p-4 text-left transition-colors ${
                    paymentMethod === 'COD'
                      ? 'border-[#101010] bg-[#101010] text-[#F3EBDD]'
                      : 'border-[#493323]/25 bg-[#EAE0CE]/60 text-[#101010]'
                  }`}
                >
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <Truck className="h-4 w-4 text-[#C9A24A]" />
                    Cash on Delivery
                  </span>
                  <span className={`mt-1 text-xs ${paymentMethod === 'COD' ? 'text-[#F3EBDD]/70' : 'text-[#493323]'}`}>
                    Pay conveniently upon doorstep delivery across India
                  </span>
                </button>
              </div>

              {paymentMethod === 'UPI' && (
                <p className="mt-3 text-xs text-[#493323]">{paymentInstructions}</p>
              )}
            </div>

            {error && (
              <div className="mt-5 rounded-md border border-red-700/30 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full min-h-[52px] rounded-md bg-[#C9A24A] px-6 py-3.5 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#DFC076] disabled:opacity-50"
            >
              {submitting
                ? 'Creating Order...'
                : paymentMethod === 'UPI'
                ? `Generate UPI QR & Place Order (${formatINR(finalPayable)})`
                : `Place Cash on Delivery Order (${formatINR(finalPayable)})`}
            </button>
          </div>
        </form>

        {/* Order Summary Sidebar */}
        <aside className="lg:col-span-5 rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-6 text-[#F3EBDD]">
          <h2 className="font-display text-2xl font-semibold text-[#F3EBDD]">Order Summary</h2>
          <ul className="mt-4 divide-y divide-[#C9A24A]/15">
            {items.map((item) => (
              <li key={`${item.productId}-${item.size}`} className="flex items-center gap-3 py-3">
                <img
                  src={item.image_url}
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="h-14 w-14 rounded object-cover bg-[#101010]"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-[#F3EBDD]">{item.name}</p>
                  <p className="text-xs text-[#F3EBDD]/60">
                    {item.size === '50ML' ? '50 ML' : '100 ML'} × {item.quantity}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[#C9A24A] tabular-nums">
                  {formatINR(item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          {/* Optional Offer Code */}
          <div className="mt-5 border-t border-[#C9A24A]/15 pt-4">
            <label htmlFor="chk-offer-code" className="block text-xs text-[#F3EBDD]/70 mb-1.5">
              Offer Code (BUY 2 GET 1 FREE applies automatically)
            </label>
            <input
              id="chk-offer-code"
              type="text"
              value={offerCode}
              onChange={(e) => setOfferCode(e.target.value.toUpperCase())}
              placeholder="Optional offer code"
              className="w-full min-h-[42px] rounded-md border border-[#C9A24A]/25 bg-[#101010] px-3.5 font-mono text-xs text-[#F3EBDD] placeholder:text-[#F3EBDD]/35"
            />
          </div>

          <div className="mt-5 space-y-2 border-t border-[#C9A24A]/15 pt-4 text-sm">
            <div className="flex justify-between text-[#F3EBDD]/75">
              <span>Subtotal ({totals.totalBottles} bottles)</span>
              <span className="tabular-nums">{formatINR(totals.subtotal)}</span>
            </div>
            {totals.discountAmount > 0 && totals.appliedOffer && (
              <div className="flex justify-between text-[#C9A24A]">
                <span>Offer ({totals.appliedOffer.title})</span>
                <span className="tabular-nums">−{formatINR(totals.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#F3EBDD]/75">
              <span>Shipping ({DEFAULT_COUNTRY})</span>
              <span className="text-[#C9A24A] tabular-nums">
                {deliveryFee > 0 ? formatINR(deliveryFee) : 'Complimentary'}
              </span>
            </div>
            {deliveryFee > 0 && freeDeliveryAbove > 0 && (
              <p className="text-[11px] text-[#F3EBDD]/55">
                Complimentary pan-India shipping on orders above {formatINR(freeDeliveryAbove)}.
              </p>
            )}
            <div className="flex justify-between border-t border-[#C9A24A]/15 pt-3 text-lg font-semibold text-[#F3EBDD]">
              <span>Final Payable (INR)</span>
              <span className="text-[#C9A24A] tabular-nums">{formatINR(finalPayable)}</span>
            </div>
          </div>

          <div className="mt-5 border-t border-[#C9A24A]/15 pt-4">
            <a
              href={quickWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md border border-[#C9A24A]/40 px-4 py-2.5 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A]/10"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              Or Order Bag via WhatsApp ({waDisplay})
            </a>
          </div>

          <div className="mt-4 flex items-start gap-2.5 text-xs text-[#F3EBDD]/60">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#C9A24A] mt-0.5" />
            <span>
              Final order total in INR (₹) and active discounts are verified server-side. Every order is recorded securely and ready for direct WhatsApp confirmation to {waDisplay}.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
};
