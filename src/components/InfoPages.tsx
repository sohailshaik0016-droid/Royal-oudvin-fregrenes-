import React, { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircle, Send, Star } from 'lucide-react';
import type { Offer, Product, Review, SiteSettings } from '../types';
import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import {
  ASSETS,
  buildWhatsAppLink,
  DEFAULT_COUNTRY,
  DEFAULT_COUNTRY_CODE,
  extractIndianMobileDigits,
  formatIndianDisplayPhone,
  UPI_ID,
  WHATSAPP_NUMBER,
} from '../lib/format';

interface AboutPageProps {
  siteSettings?: SiteSettings | null;
  onNavigate: (path: string) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ siteSettings, onNavigate }) => {
  const title = siteSettings?.about_title || 'About OUDVIN Fragrances';
  const story1 =
    siteSettings?.about_story_1 ||
    'OUDVIN FRAGRANCES is a luxury fragrance house inspired by the timeless elegance of Arabian perfumery and the art of fine fragrance creation. We believe every fragrance tells a story, creates memories and expresses individuality. Our mission is to bring an exceptional fragrance experience through carefully selected scents and luxurious collections.';
  const story2 =
    siteSettings?.about_story_2 ||
    'From deep resinous agarwood harvested for our Signature Collection to clean white musk and sunlit floral blends in our Classic Collection, every flacon is composed for remarkable longevity and poise.';
  const banner = siteSettings?.signature_banner_url || ASSETS.signatureBanner;

  return (
  <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
      <div className="lg:col-span-6 space-y-5">
        <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">Our Heritage</p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[#F3EBDD]">
          {title}
        </h1>
        <p className="text-base leading-relaxed text-[#F3EBDD]/85">{story1}</p>
        <p className="text-sm leading-relaxed text-[#F3EBDD]/70">{story2}</p>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('/shop')}
            className="min-h-[46px] rounded-md bg-[#C9A24A] px-6 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#DFC076]"
          >
            Explore All Perfumes
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/custom-perfume')}
            className="min-h-[46px] rounded-md border border-[#C9A24A]/45 px-6 py-2.5 text-sm font-semibold text-[#F3EBDD] hover:border-[#C9A24A] hover:text-[#C9A24A]"
          >
            Create Custom Perfume
          </button>
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="overflow-hidden rounded-lg border border-[#C9A24A]/25">
          <img
            src={banner}
            alt="OUDVIN Fragrances luxury Arabian perfume atelier"
            referrerPolicy="no-referrer"
            className="aspect-[16/10] w-full object-cover"
          />
        </div>
      </div>
    </div>

    <div className="mt-14 grid grid-cols-1 gap-6 border-t border-[#C9A24A]/15 pt-12 md:grid-cols-3">
      <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-6">
        <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">01. Signature Collection</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#F3EBDD]/75">
          Intense Arabian oud, smoked incense, saffron, and velvet amber creations presented in bold obsidian and royal gold character.
        </p>
      </div>
      <div className="rounded-lg border border-[#C9A24A]/20 bg-[#F3EBDD] p-6 text-[#101010]">
        <h2 className="font-display text-2xl font-semibold text-[#493323]">02. Classic Collection</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#493323]/85">
          Refined everyday signatures featuring pure Mask E Tahara white musk, Mysore sandalwood, and luminous florals.
        </p>
      </div>
      <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-6">
        <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">03. Premium Collection</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#F3EBDD]/75">
          Exclusive reserve blends crafted with concentrated aged oud oils, Taif rose, and royal ambergris for distinguished occasions.
        </p>
      </div>
    </div>
  </div>
  );
};

interface OffersPageProps {
  offers: Offer[];
  onNavigate: (path: string) => void;
}

export const OffersPage: React.FC<OffersPageProps> = ({ offers, onNavigate }) => (
  <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
    <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">Exclusive Privileges</p>
    <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold text-[#F3EBDD]">
      Special Offers
    </h1>
    <p className="mt-3 max-w-2xl text-sm text-[#F3EBDD]/75">
      Active promotions apply automatically in your shopping bag and are validated securely at checkout.
    </p>

    {offers.length === 0 ? (
      <div className="mt-10 rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-10 text-center">
        <p className="font-display text-2xl text-[#F3EBDD]">No Active Offers Right Now</p>
        <p className="mt-2 text-sm text-[#F3EBDD]/65">
          Explore our Signature, Classic, and Premium collections starting at ₹900 for 50 ML.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('/shop')}
          className="mt-6 min-h-[44px] rounded-md bg-[#C9A24A] px-6 py-2.5 text-sm font-semibold text-[#101010]"
        >
          Shop Perfumes
        </button>
      </div>
    ) : (
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="flex flex-col justify-between rounded-lg border border-[#C9A24A]/35 bg-[#F3EBDD] p-7 text-[#101010]"
          >
            <div>
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#493323]">
                <span>Active House Offer</span>
                {offer.expires_at && <span className="tabular-nums">Valid until {offer.expires_at}</span>}
              </div>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[#101010]">
                {offer.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#493323]">{offer.description}</p>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#493323]/15 pt-5">
              <div>
                <span className="block text-[11px] text-[#493323]/75">Offer Code</span>
                <span className="font-mono text-sm font-semibold text-[#101010]">{offer.code}</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/shop')}
                className="min-h-[44px] rounded-md bg-[#101010] px-5 py-2.5 text-xs font-semibold text-[#C9A24A] hover:bg-[#231F1B]"
              >
                Shop &amp; Apply Offer
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

interface ReviewsPageProps {
  products: Product[];
}

export const ReviewsPage: React.FC<ReviewsPageProps> = ({ products }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [name, setName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchWithTimeout('/api/reviews', { signal: controller.signal }, 8000)
      .then((r) => (r.ok ? r.json() : { reviews: [] }))
      .then((d) => {
        setReviews(d.reviews || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProductId ? Number(selectedProductId) : null,
          customer_name: name,
          rating,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit review.');
      } else {
        setNotice(data.message);
        setName('');
        setRating(5);
        setComment('');
        setSelectedProductId('');
      }
    } catch {
      setError('Network error while submitting review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">Authentic Feedback</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold text-[#F3EBDD]">
            Customer Reviews
          </h1>
          <p className="mt-3 text-sm text-[#F3EBDD]/70">
            Every review published here is submitted by our clients and reviewed by our team for authenticity.
          </p>

          {loading ? (
            <div className="mt-8 space-y-4">
              <div className="h-28 animate-pulse rounded-lg bg-[#171614]" />
              <div className="h-28 animate-pulse rounded-lg bg-[#171614]" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="mt-8 rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-8">
              <p className="font-display text-2xl text-[#F3EBDD]">No Published Reviews Yet</p>
              <p className="mt-2 text-sm text-[#F3EBDD]/70">
                We never display fabricated reviews. Share your honest experience with an OUDVIN fragrance using the form alongside.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              {reviews.map((rev) => (
                <article key={rev.id} className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-[#F3EBDD]">{rev.customer_name}</h2>
                      {rev.product_name && (
                        <p className="text-xs text-[#C9A24A]">{rev.product_name}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 text-[#C9A24A]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < rev.rating ? 'fill-[#C9A24A]' : 'text-[#F3EBDD]/20'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[#F3EBDD]/80">{rev.comment}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-lg border border-[#C9A24A]/25 bg-[#F3EBDD] p-6 sm:p-7 text-[#101010]">
            <h2 className="font-display text-2xl font-semibold text-[#101010]">Share Your Review</h2>
            <p className="mt-1 text-xs text-[#493323]">
              Reviews appear publicly once approved by our team.
            </p>
            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="rev-name" className="block text-xs font-semibold text-[#493323] mb-1.5">
                  Your Name *
                </label>
                <input
                  id="rev-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] rounded-md border border-[#493323]/25 bg-white px-3.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="rev-product" className="block text-xs font-semibold text-[#493323] mb-1.5">
                  Perfume (Optional)
                </label>
                <select
                  id="rev-product"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full min-h-[44px] rounded-md border border-[#493323]/25 bg-white px-3.5 text-sm"
                >
                  <option value="">General Store Experience</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#493323] mb-1.5">Star Rating *</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setRating(s)}
                      className="p-1"
                      aria-label={`Rate ${s} stars`}
                    >
                      <Star
                        className={`h-6 w-6 ${s <= rating ? 'fill-[#C9A24A] text-[#C9A24A]' : 'text-[#493323]/30'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="rev-comment" className="block text-xs font-semibold text-[#493323] mb-1.5">
                  Written Review *
                </label>
                <textarea
                  id="rev-comment"
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Describe the fragrance opening, dry-down, and longevity..."
                  className="w-full rounded-md border border-[#493323]/25 bg-white p-3.5 text-sm"
                />
              </div>

              {error && <p className="text-xs text-red-700">{error}</p>}
              {notice && <p className="text-xs font-medium text-[#493323]">{notice}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[46px] rounded-md bg-[#101010] px-5 py-3 text-sm font-semibold text-[#C9A24A] hover:bg-[#231F1B] disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ContactPage: React.FC<{ siteSettings?: SiteSettings | null }> = ({ siteSettings }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState<string | null>(null);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);

  const waNumber = siteSettings?.whatsapp_number || WHATSAPP_NUMBER;
  const waDisplay = formatIndianDisplayPhone(waNumber);
  const upiId = siteSettings?.upi_id || UPI_ID;
  const contactHours = siteSettings?.contact_hours || 'Monday – Sunday, 10:00 AM – 9:00 PM IST';
  const contactDispatch =
    siteSettings?.contact_dispatch ||
    'All confirmed orders dispatch within 24–48 business hours across India.';
  const contactEmail = siteSettings?.contact_email || 'sohailshaik0016@gmail.com';

  const quickWaHref = buildWhatsAppLink(
    'Hello OUDVIN FRAGRANCES, I have a question regarding your perfume collections.',
    waNumber
  );

  const customInquiryHref = buildWhatsAppLink(
    [
      '*CUSTOMER INQUIRY — OUDVIN FRAGRANCES (INDIA)*',
      name.trim() ? `Name: ${name.trim()}` : '',
      phone.trim() ? `Mobile: ${DEFAULT_COUNTRY_CODE} ${phone.trim()}` : '',
      `Country: ${DEFAULT_COUNTRY}`,
      message.trim() ? `Message: ${message.trim()}` : 'I would like assistance with OUDVIN FRAGRANCES.',
    ]
      .filter(Boolean)
      .join('\n'),
    waNumber
  );

  const handleSaveEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnquiryError(null);
    setEnquirySuccess(null);

    if (name.trim().length < 2) {
      setEnquiryError('Please enter your full name.');
      return;
    }
    if (message.trim().length < 5) {
      setEnquiryError('Please write a brief message so our team can assist you.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetchWithTimeout(
        '/api/enquiries',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: name.trim(),
            customer_phone: phone.trim() ? `${DEFAULT_COUNTRY_CODE}${phone.trim()}` : '',
            message: message.trim(),
          }),
        },
        8000
      );
      const data = await res.json();
      if (!res.ok) {
        setEnquiryError(data.error || 'Could not submit your enquiry. Please try again.');
      } else {
        setEnquirySuccess(
          data.message || 'Thank you. Your enquiry has been saved for our team.'
        );
      }
    } catch {
      setEnquiryError('Network issue while sending your enquiry. You can still message us directly on WhatsApp below.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">Direct Concierge · {DEFAULT_COUNTRY}</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold text-[#F3EBDD]">
        Contact OUDVIN Fragrances
      </h1>
      <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#F3EBDD]/75">
        Connect directly with our fragrance advisors in India for personalised scent recommendations, custom blends, bulk gifting, or order assistance.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-lg border border-[#C9A24A]/25 bg-[#F3EBDD] p-6 text-[#101010]">
            <h2 className="font-display text-2xl font-semibold text-[#101010]">WhatsApp Concierge (India)</h2>
            <p className="mt-2 text-sm text-[#493323]">
              Fastest response for orders, UPI confirmation, and custom perfume consultations.
            </p>
            <p className="mt-4 font-mono text-base font-semibold text-[#101010]">{waDisplay}</p>
            <a
              href={quickWaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-[46px] items-center gap-2 rounded-md bg-[#101010] px-5 py-2.5 text-xs font-semibold text-[#C9A24A] hover:bg-[#24201C]"
            >
              <MessageCircle className="h-4 w-4" />
              Chat on WhatsApp ({waDisplay})
            </a>
          </div>

          <div className="rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-6 text-[#F3EBDD]">
            <h2 className="font-display text-2xl font-semibold text-[#C9A24A]">India Business &amp; Dispatch</h2>
            <dl className="mt-4 space-y-3 text-sm text-[#F3EBDD]/80">
              <div>
                <dt className="text-xs text-[#F3EBDD]/55">Country &amp; Currency</dt>
                <dd>{DEFAULT_COUNTRY} ({DEFAULT_COUNTRY_CODE}) · Indian Rupees (INR ₹)</dd>
              </div>
              <div>
                <dt className="text-xs text-[#F3EBDD]/55">Client Support</dt>
                <dd>{contactHours}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#F3EBDD]/55">Order Dispatch</dt>
                <dd>{contactDispatch}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#F3EBDD]/55">Support Email</dt>
                <dd className="font-mono text-xs text-[#F3EBDD]/90">{contactEmail}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#F3EBDD]/55">UPI Payment ID</dt>
                <dd className="font-mono text-xs text-[#C9A24A]">{upiId}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Direct Inquiry Form defaulting to India (+91), persisted to DB + WhatsApp option */}
        <div className="lg:col-span-7 rounded-lg border border-[#C9A24A]/25 bg-[#F3EBDD] p-6 sm:p-8 text-[#101010]">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#101010]">
            Send a Direct Enquiry
          </h2>
          <p className="mt-1 text-xs text-[#493323]">
            Submit directly to our India concierge desk or send immediately on WhatsApp ({waDisplay}).
          </p>

          <form onSubmit={handleSaveEnquiry} className="mt-5 space-y-4">
            <div>
              <label htmlFor="contact-name" className="block text-xs font-semibold text-[#493323] mb-1.5">
                Your Full Name *
              </label>
              <input
                id="contact-name"
                type="text"
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full min-h-[46px] rounded-md border border-[#493323]/25 bg-white px-3.5 text-sm text-[#101010]"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-phone" className="block text-xs font-semibold text-[#493323] mb-1.5">
                  Mobile Number (India {DEFAULT_COUNTRY_CODE})
                </label>
                <div className="flex min-h-[46px] overflow-hidden rounded-md border border-[#493323]/25 bg-white focus-within:ring-2 focus-within:ring-[#C9A24A]">
                  <span
                    className="inline-flex shrink-0 items-center border-r border-[#493323]/20 bg-[#EAE0CE] px-3 font-mono text-xs font-semibold text-[#493323]"
                    aria-label="India country code +91"
                  >
                    IN {DEFAULT_COUNTRY_CODE}
                  </span>
                  <input
                    id="contact-phone"
                    type="tel"
                    inputMode="tel"
                    maxLength={22}
                    value={phone}
                    onChange={(e) => setPhone(extractIndianMobileDigits(e.target.value))}
                    placeholder="10-digit mobile number"
                    className="w-full min-h-[46px] bg-white px-3 font-mono text-sm text-[#101010] focus:outline-none tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="contact-country" className="block text-xs font-semibold text-[#493323] mb-1.5">
                  Country
                </label>
                <input
                  id="contact-country"
                  type="text"
                  readOnly
                  value={DEFAULT_COUNTRY}
                  className="w-full min-h-[46px] rounded-md border border-[#493323]/20 bg-[#EAE0CE] px-3.5 text-sm font-medium text-[#493323] cursor-default"
                />
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-xs font-semibold text-[#493323] mb-1.5">
                How Can We Assist You? *
              </label>
              <textarea
                id="contact-message"
                required
                rows={4}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about a perfume, custom blend, bulk gifting, or an existing order..."
                className="w-full rounded-md border border-[#493323]/25 bg-white p-3.5 text-sm text-[#101010]"
              />
            </div>

            {enquiryError && <p className="text-xs font-medium text-red-700">{enquiryError}</p>}
            {enquirySuccess && (
              <div className="flex items-start gap-2 rounded-md border border-[#493323]/25 bg-[#EAE0CE] p-3 text-xs font-medium text-[#101010]">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#493323] mt-0.5" />
                <span>{enquirySuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-[#C9A24A] px-5 py-3 text-sm font-semibold text-[#101010] transition-colors hover:bg-[#DFC076] disabled:opacity-50"
              >
                <Send className="h-4 w-4 shrink-0" />
                {submitting ? 'Sending...' : 'Submit Enquiry'}
              </button>

              <a
                href={customInquiryHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-[#101010] px-5 py-3 text-sm font-semibold text-[#C9A24A] transition-colors hover:bg-[#24201C]"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                Send via WhatsApp
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export const PolicyPage: React.FC<{ type: string }> = ({ type }) => {
  const sections: Record<string, { title: string; paragraphs: string[] }> = {
    privacy: {
      title: 'Privacy Policy',
      paragraphs: [
        'OUDVIN FRAGRANCES respects your privacy and collects only the information necessary to process, verify, and deliver your perfume orders (your name, mobile number, delivery address, city, and PIN code).',
        'We never sell, rent, or trade customer contact details to third parties. Order data is stored securely in our protected database solely for order fulfilment, payment verification, and customer support via WhatsApp.',
        'If you wish to update or delete your order contact details after delivery, please message our WhatsApp concierge at +91 8074469549 with your Order ID.',
      ],
    },
    terms: {
      title: 'Terms & Conditions',
      paragraphs: [
        'All prices on OUDVIN FRAGRANCES are displayed in Indian Rupees (INR). Bottle sizes (50 ML and 100 ML) and active promotional offers such as BUY 2 GET 1 FREE are calculated and verified on our server at checkout.',
        'For UPI payments, orders remain in Pending Verification status until payment receipt is confirmed by our administrator. OUDVIN FRAGRANCES reserves the right to cancel orders with unverified payments or incomplete delivery information.',
        'Custom perfume requests are formulated to order based on consultation via WhatsApp and confirmed prior to compounding.',
      ],
    },
    shipping: {
      title: 'Shipping & Return Policy',
      paragraphs: [
        'Orders confirmed via UPI verification or Cash on Delivery are carefully packed in protective luxury packaging and dispatched within 24–48 business hours. Standard pan-India delivery takes 3–7 business days depending on your PIN code.',
        'Due to the hygienic and personal nature of fine fragrances, opened perfume bottles cannot be returned. However, if your bottle arrives damaged or incorrect, share an unboxing photograph or short video on WhatsApp (+91 8074469549) within 48 hours of delivery for a prompt replacement.',
      ],
    },
  };

  const doc = sections[type] || sections.privacy;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs font-medium tracking-[0.22em] text-[#C9A24A]">Client Care</p>
      <h1 className="mt-2 font-display text-4xl font-semibold text-[#F3EBDD]">{doc.title}</h1>
      <div className="mt-6 space-y-5 rounded-lg border border-[#C9A24A]/20 bg-[#171614] p-6 sm:p-8 text-sm leading-relaxed text-[#F3EBDD]/80">
        {doc.paragraphs.map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}
      </div>
    </div>
  );
};
