import React from 'react';
import { MessageCircle } from 'lucide-react';
import type { SiteSettings } from '../types';
import { BrandLogo } from './BrandLogo';
import {
  buildWhatsAppLink,
  formatIndianDisplayPhone,
  WHATSAPP_NUMBER,
} from '../lib/format';

interface FooterProps {
  siteSettings?: SiteSettings | null;
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ siteSettings, onNavigate }) => {
  const waNumber = siteSettings?.whatsapp_number || WHATSAPP_NUMBER;
  const waDisplay = formatIndianDisplayPhone(waNumber);
  const waHref = buildWhatsAppLink(
    'Hello OUDVIN FRAGRANCES, I would like assistance with selecting a perfume.',
    waNumber
  );

  return (
    <footer className="border-t border-[#C9A24A]/20 bg-[#0B0B0B] text-[#F3EBDD]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Column */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-left focus-visible:outline-none"
            >
              <BrandLogo logoUrl={siteSettings?.logo_url} />
            </button>
            <p className="max-w-xs text-sm leading-relaxed text-[#F3EBDD]/65">
              Experience The Art Of Luxury. Arabian haute parfumerie crafted with rare oud, velvety rose, pure musk, and golden amber.
            </p>
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-md border border-[#C9A24A]/45 px-4 py-2 text-xs font-semibold text-[#C9A24A] transition-colors hover:bg-[#C9A24A] hover:text-[#101010]"
            >
              <MessageCircle className="h-4 w-4 shrink-0" />
              WhatsApp {waDisplay}
            </a>
          </div>

          {/* Collections */}
          <div>
            <h3 className="font-display text-lg font-semibold text-[#C9A24A]">Collections</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[#F3EBDD]/75">
              <li>
                <button type="button" onClick={() => onNavigate('/shop')} className="hover:text-[#C9A24A] transition-colors">
                  Shop All Perfumes
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/collection/signature')} className="hover:text-[#C9A24A] transition-colors">
                  Signature Collection
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/collection/classic')} className="hover:text-[#C9A24A] transition-colors">
                  Classic Collection
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/collection/premium')} className="hover:text-[#C9A24A] transition-colors">
                  Premium Collection
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/offers')} className="hover:text-[#C9A24A] transition-colors">
                  Special Offers
                </button>
              </li>
            </ul>
          </div>

          {/* House & Services */}
          <div>
            <h3 className="font-display text-lg font-semibold text-[#C9A24A]">The House</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[#F3EBDD]/75">
              <li>
                <button type="button" onClick={() => onNavigate('/wishlist')} className="hover:text-[#C9A24A] transition-colors">
                  My Wishlist
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/custom-perfume')} className="hover:text-[#C9A24A] transition-colors">
                  Create Custom Perfume
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/about')} className="hover:text-[#C9A24A] transition-colors">
                  About Us
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/reviews')} className="hover:text-[#C9A24A] transition-colors">
                  Customer Reviews
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/contact')} className="hover:text-[#C9A24A] transition-colors">
                  Contact Us
                </button>
              </li>
            </ul>
          </div>

          {/* Policies */}
          <div>
            <h3 className="font-display text-lg font-semibold text-[#C9A24A]">Client Care</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-[#F3EBDD]/75">
              <li>
                <button type="button" onClick={() => onNavigate('/track-order')} className="hover:text-[#C9A24A] transition-colors">
                  Track Your Order
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/policy/privacy')} className="hover:text-[#C9A24A] transition-colors">
                  Privacy Policy
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/policy/terms')} className="hover:text-[#C9A24A] transition-colors">
                  Terms &amp; Conditions
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onNavigate('/policy/shipping')} className="hover:text-[#C9A24A] transition-colors">
                  Shipping &amp; Return Policy
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#C9A24A]/15 pt-8 text-xs text-[#F3EBDD]/55 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} OUDVIN FRAGRANCES · India. All rights reserved.</p>
          <p>Pan-India Delivery · Currency: INR (₹) · WhatsApp: {waDisplay}</p>
        </div>
      </div>
    </footer>
  );
};
