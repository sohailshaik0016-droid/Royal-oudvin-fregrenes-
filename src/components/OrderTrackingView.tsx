import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  MessageCircle,
  Package,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import type { OrderStatus, TrackedOrder } from '../types';
import {
  buildWhatsAppLink,
  formatINR,
  formatOrderStatusLabel,
  formatPaymentStatusLabel,
  WHATSAPP_DISPLAY,
  WHATSAPP_NUMBER,
} from '../lib/format';

interface OrderTrackingViewProps {
  initialOrderId?: string;
  onNavigate: (path: string) => void;
}

const SHIPMENT_STEPS: Array<{
  key: Exclude<OrderStatus, 'cancelled'>;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'pending',
    title: 'Order Placed',
    description: 'Your order is recorded and awaiting review or payment confirmation.',
    icon: <Clock className="h-5 w-5" />,
  },
  {
    key: 'processing',
    title: 'Processing',
    description: 'Our atelier is inspecting and hand-packing your fragrances.',
    icon: <Package className="h-5 w-5" />,
  },
  {
    key: 'shipped',
    title: 'Shipped',
    description: 'Your parcel has been dispatched and is on its way to your city.',
    icon: <Truck className="h-5 w-5" />,
  },
  {
    key: 'delivered',
    title: 'Delivered',
    description: 'Shipment delivered. Experience the art of luxury with OUDVIN.',
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
];

function getStepIndex(status: OrderStatus): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'processing':
      return 1;
    case 'shipped':
      return 2;
    case 'delivered':
      return 3;
    default:
      return -1;
  }
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  initialOrderId = '',
  onNavigate,
}) => {
  const [orderIdInput, setOrderIdInput] = useState(initialOrderId);
  const [tracked, setTracked] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupOrder = useCallback(async (rawId: string) => {
    const cleaned = rawId.trim().toUpperCase();
    if (!cleaned) {
      setError('Please enter your Order ID to check shipment status.');
      return;
    }

    setLoading(true);
    setError(null);
    setTracked(null);

    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Order not found. Please check your Order ID.');
      } else {
        setTracked(data.tracking as TrackedOrder);
      }
    } catch {
      setError('Network error while checking order status. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromProp = initialOrderId.trim();
    const fromQuery = new URLSearchParams(window.location.search).get('id')?.trim() || '';
    const candidate = fromProp || fromQuery;
    if (candidate) {
      setOrderIdInput(candidate.toUpperCase());
      lookupOrder(candidate);
    }
  }, [initialOrderId, lookupOrder]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    lookupOrder(orderIdInput);
  };

  const currentStepIdx = tracked ? getStepIndex(tracked.order_status) : -1;
  const isCancelled = tracked?.order_status === 'cancelled';

  const waSupportHref = buildWhatsAppLink(
    tracked
      ? `Hello OUDVIN FRAGRANCES, I would like an update on my order *${tracked.order_number}* (Current Status: ${formatOrderStatusLabel(tracked.order_status)}).`
      : 'Hello OUDVIN FRAGRANCES, I need help tracking my perfume order.',
    WHATSAPP_NUMBER
  );

  return (
    <div className="min-h-screen bg-[#101010] text-[#F3EBDD]">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {/* Heading */}
        <div>
          <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">
            Live Shipment Updates
          </p>
          <h1 className="mt-1.5 font-display text-4xl sm:text-5xl font-semibold text-[#F3EBDD]">
            Track Your Order
          </h1>
          <p className="mt-2.5 max-w-2xl text-sm text-[#F3EBDD]/75">
            Enter the Order ID provided at checkout (for example, <span className="font-mono text-[#C9A24A]">OUD-2026-123456</span>) to view real-time processing, shipping, and delivery updates managed by our team.
          </p>
        </div>

        {/* Lookup Form */}
        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-lg border border-[#C9A24A]/30 bg-[#171614] p-5 sm:p-6"
        >
          <label
            htmlFor="track-order-id"
            className="block text-xs font-semibold text-[#C9A24A] mb-2"
          >
            Order ID
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#C9A24A]/70"
                aria-hidden="true"
              />
              <input
                id="track-order-id"
                type="text"
                required
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value.toUpperCase())}
                placeholder="e.g., OUD-2026-482910"
                className="min-h-[48px] w-full rounded-md border border-[#C9A24A]/30 bg-[#101010] pl-10 pr-4 font-mono text-sm text-[#F3EBDD] placeholder:text-[#F3EBDD]/35 focus:border-[#C9A24A] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="min-h-[48px] rounded-md bg-[#C9A24A] px-7 py-3 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#DFC076] whitespace-nowrap disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Track Shipment'}
            </button>
          </div>

          {error && (
            <p className="mt-3 text-xs font-medium text-red-400" role="alert">
              {error}
            </p>
          )}
        </form>

        {/* Tracked Shipment Status Card */}
        {tracked && (
          <div className="mt-8 space-y-6">
            <div className="rounded-lg border border-[#C9A24A]/30 bg-[#171614] p-6 sm:p-8">
              {/* Top Meta Row */}
              <div className="flex flex-col gap-4 border-b border-[#C9A24A]/20 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-[#F3EBDD]/60">Order Reference</p>
                  <h2 className="mt-0.5 font-mono text-2xl font-semibold text-[#C9A24A]">
                    {tracked.order_number}
                  </h2>
                  <p className="mt-1 text-xs text-[#F3EBDD]/70">
                    Destination: <span className="text-[#F3EBDD]">{tracked.destination_city}</span> · Recipient:{' '}
                    <span className="text-[#F3EBDD]">{tracked.recipient_hint}</span>
                  </p>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <div className="text-sm font-semibold text-[#F3EBDD]">
                    Shipment Status:{' '}
                    <span className={isCancelled ? 'text-red-400' : 'text-[#C9A24A]'}>
                      {formatOrderStatusLabel(tracked.order_status)}
                    </span>
                  </div>
                  <div className="text-xs text-[#F3EBDD]/75">
                    Payment: {tracked.payment_method} · {formatPaymentStatusLabel(tracked.payment_status)}
                  </div>
                  <div className="text-[11px] text-[#F3EBDD]/50">
                    Last Updated: {tracked.updated_at}
                  </div>
                </div>
              </div>

              {/* Shipment Progress Stepper */}
              {isCancelled ? (
                <div className="mt-6 flex items-start gap-3 rounded-md border border-red-500/35 bg-red-950/30 p-5">
                  <XCircle className="h-6 w-6 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <h3 className="font-display text-2xl font-semibold text-red-200">
                      Order Cancelled
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-red-200/80">
                      This order has been marked as cancelled by our team. If you have questions regarding a refund or replacement, please message us on WhatsApp ({WHATSAPP_DISPLAY}).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-7">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    {SHIPMENT_STEPS.map((step, idx) => {
                      const reached = idx <= currentStepIdx;
                      const isCurrent = idx === currentStepIdx;
                      return (
                        <div
                          key={step.key}
                          className={`rounded-md border p-4 transition-colors ${
                            isCurrent
                              ? 'border-[#C9A24A] bg-[#1E1A13]'
                              : reached
                              ? 'border-[#C9A24A]/35 bg-[#12110F]'
                              : 'border-[#F3EBDD]/10 bg-[#101010]/60 opacity-55'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${
                                reached
                                  ? 'bg-[#C9A24A] text-[#101010]'
                                  : 'border border-[#F3EBDD]/20 text-[#F3EBDD]/50'
                              }`}
                            >
                              {step.icon}
                            </span>
                            <span className="font-mono text-[11px] text-[#C9A24A]/80">
                              0{idx + 1}
                            </span>
                          </div>
                          <h3 className="mt-3 font-display text-xl font-semibold text-[#F3EBDD]">
                            {step.title}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-[#F3EBDD]/70">
                            {step.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Itemized Fragrances */}
              <div className="mt-8 border-t border-[#C9A24A]/15 pt-6">
                <h3 className="text-xs font-semibold text-[#C9A24A]">Fragrances in This Order</h3>
                <ul className="mt-3 divide-y divide-[#C9A24A]/10 text-sm">
                  {tracked.items.map((item, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <span className="font-medium text-[#F3EBDD]">{item.name}</span>
                        <span className="ml-2 text-xs text-[#F3EBDD]/60">
                          {item.size === '50ML' ? '50 ML' : '100 ML'} × {item.quantity}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-[#C9A24A] tabular-nums">
                        {formatINR(item.line_total)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 space-y-1.5 border-t border-[#C9A24A]/15 pt-3 text-xs">
                  <div className="flex justify-between text-[#F3EBDD]/70">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatINR(tracked.subtotal)}</span>
                  </div>
                  {tracked.discount_amount > 0 && (
                    <div className="flex justify-between text-[#C9A24A]">
                      <span>Offer ({tracked.applied_offer})</span>
                      <span className="tabular-nums">−{formatINR(tracked.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 text-sm font-semibold text-[#F3EBDD]">
                    <span>Total Amount</span>
                    <span className="font-mono text-[#C9A24A] tabular-nums">
                      {formatINR(tracked.total_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Support Footer */}
              <div className="mt-6 flex flex-col gap-3 border-t border-[#C9A24A]/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#F3EBDD]/65">
                  Questions about your delivery or UPI verification?
                </p>
                <a
                  href={waSupportHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#C9A24A] px-5 py-2.5 text-xs font-semibold text-[#101010] hover:bg-[#DFC076] whitespace-nowrap"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp Support ({WHATSAPP_DISPLAY})
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Helpful CTA when no order is loaded yet */}
        {!tracked && !loading && (
          <div className="mt-10 rounded-lg border border-[#C9A24A]/15 bg-[#141311] p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#F3EBDD]">
                Can&apos;t find your Order ID?
              </h2>
              <p className="mt-1 text-xs text-[#F3EBDD]/70">
                Check your WhatsApp order message or reach out to our concierge at {WHATSAPP_DISPLAY}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <a
                href={waSupportHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-[#C9A24A]/45 px-4 py-2 text-xs font-semibold text-[#C9A24A] hover:bg-[#C9A24A] hover:text-[#101010]"
              >
                <MessageCircle className="h-4 w-4" />
                Ask on WhatsApp
              </a>
              <button
                type="button"
                onClick={() => onNavigate('/shop')}
                className="min-h-[42px] rounded-md bg-[#C9A24A] px-4 py-2 text-xs font-semibold text-[#101010] hover:bg-[#DFC076]"
              >
                Browse Perfumes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
