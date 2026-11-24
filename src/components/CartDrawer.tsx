import React from 'react';
import { MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import type { BottleSize, CartItem, Offer, SiteSettings } from '../types';
import {
  buildCartWhatsAppMessage,
  buildWhatsAppLink,
  computeCartTotals,
  formatIndianDisplayPhone,
  formatINR,
  WHATSAPP_NUMBER,
} from '../lib/format';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  offers: Offer[];
  siteSettings?: SiteSettings | null;
  onClose: () => void;
  onUpdateQty: (productId: number, size: BottleSize, delta: number) => void;
  onRemove: (productId: number, size: BottleSize) => void;
  onCheckout: () => void;
  onBrowse: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  items,
  offers,
  siteSettings,
  onClose,
  onUpdateQty,
  onRemove,
  onCheckout,
  onBrowse,
}) => {
  if (!open) return null;

  const { subtotal, totalBottles, discountAmount, appliedOffer, totalAmount } = computeCartTotals(
    items,
    offers
  );

  const hasBuy2Get1 = offers.some((o) => o.is_active && o.offer_type === 'buy2get1');
  const bottlesNeededForFree = hasBuy2Get1 ? (3 - (totalBottles % 3)) % 3 : 0;
  const waNumber = siteSettings?.whatsapp_number || WHATSAPP_NUMBER;
  const waDisplay = formatIndianDisplayPhone(waNumber);
  const directWhatsAppUrl = buildWhatsAppLink(
    buildCartWhatsAppMessage(items, offers),
    waNumber
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label="Shopping Bag">
      <div className="flex h-full w-full max-w-md flex-col border-l border-[#C9A24A]/25 bg-[#141311] text-[#F3EBDD]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#C9A24A]/20 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[#C9A24A]" />
            <h2 className="font-display text-2xl font-semibold text-[#F3EBDD]">
              Your Fragrance Bag
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[#F3EBDD]/75 hover:bg-white/10 hover:text-[#F3EBDD]"
            aria-label="Close bag"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Buy 2 Get 1 Free Progress Hint */}
        {hasBuy2Get1 && items.length > 0 && (
          <div className="border-b border-[#C9A24A]/15 bg-[#1B1814] px-5 py-3 text-xs text-[#F3EBDD]/85">
            {bottlesNeededForFree === 0 && discountAmount > 0 ? (
              <span className="text-[#C9A24A] font-medium">
                BUY 2 GET 1 FREE unlocked — saving {formatINR(discountAmount)} on this order.
              </span>
            ) : (
              <span>
                Add <strong className="text-[#C9A24A]">{bottlesNeededForFree}</strong> more bottle
                {bottlesNeededForFree > 1 ? 's' : ''} to unlock{' '}
                <strong className="text-[#C9A24A]">BUY 2 GET 1 FREE</strong> automatically.
              </span>
            )}
          </div>
        )}

        {/* Item List */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <ShoppingBag className="h-10 w-10 text-[#C9A24A]/50" />
              <p className="mt-4 font-display text-2xl text-[#F3EBDD]">Your bag is empty</p>
              <p className="mt-2 max-w-xs text-sm text-[#F3EBDD]/65">
                Explore our Signature, Classic, and Premium Arabian fragrances to begin your collection.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onBrowse();
                }}
                className="mt-6 min-h-[44px] rounded-md bg-[#C9A24A] px-6 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#DFC076]"
              >
                Explore Catalogue
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-[#C9A24A]/15">
              {items.map((item) => (
                <li key={`${item.productId}-${item.size}`} className="flex gap-4 py-4">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="h-20 w-20 shrink-0 rounded-md object-cover bg-[#1E1C1A]"
                  />
                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-lg font-semibold text-[#F3EBDD]">
                          {item.name}
                        </h3>
                        <p className="text-xs text-[#F3EBDD]/65">
                          {item.size === '50ML' ? '50 ML' : '100 ML'} · {formatINR(item.unitPrice)} each
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(item.productId, item.size)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded text-[#F3EBDD]/50 hover:text-red-400"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-md border border-[#C9A24A]/30 bg-[#101010]">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.productId, item.size, -1)}
                          className="inline-flex h-9 w-9 items-center justify-center text-[#F3EBDD] hover:text-[#C9A24A]"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.productId, item.size, 1)}
                          disabled={item.quantity >= item.maxStock}
                          className="inline-flex h-9 w-9 items-center justify-center text-[#F3EBDD] hover:text-[#C9A24A] disabled:opacity-35"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <span className="text-sm font-semibold text-[#C9A24A] tabular-nums">
                        {formatINR(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Summary Footer */}
        {items.length > 0 && (
          <div className="border-t border-[#C9A24A]/20 bg-[#101010] px-5 py-4 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-[#F3EBDD]/75">
                <span>Subtotal ({totalBottles} {totalBottles === 1 ? 'bottle' : 'bottles'})</span>
                <span className="tabular-nums">{formatINR(subtotal)}</span>
              </div>
              {discountAmount > 0 && appliedOffer && (
                <div className="flex justify-between text-[#C9A24A]">
                  <span>Offer ({appliedOffer.title})</span>
                  <span className="tabular-nums">−{formatINR(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#C9A24A]/15 pt-2 text-base font-semibold text-[#F3EBDD]">
                <span>Estimated Total (INR)</span>
                <span className="text-[#C9A24A] tabular-nums">{formatINR(totalAmount)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onCheckout}
              className="w-full min-h-[48px] rounded-md bg-[#C9A24A] px-5 py-3 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#DFC076]"
            >
              Proceed to Checkout
            </button>

            <a
              href={directWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full min-h-[46px] items-center justify-center gap-2 rounded-md border border-[#C9A24A]/45 px-5 py-2.5 text-xs font-semibold text-[#C9A24A] transition-colors hover:bg-[#C9A24A]/10"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              Quick Order on WhatsApp ({waDisplay})
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
