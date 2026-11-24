import React, { useState } from 'react';
import { Check, CheckCircle2, Copy, MessageCircle } from 'lucide-react';
import {
  buildWhatsAppLink,
  DEFAULT_COUNTRY_CODE,
  extractIndianMobileDigits,
  WHATSAPP_DISPLAY,
  WHATSAPP_NUMBER,
} from '../lib/format';

interface CustomPerfumeSectionProps {
  standalone?: boolean;
}

const FRAGRANCE_STYLES = [
  'Arabian',
  'French',
  'Italian',
  'Woody Oud',
  'Floral & Rose',
  'Pure Musk & Amber',
  'Other',
];

export const CustomPerfumeSection: React.FC<CustomPerfumeSectionProps> = ({ standalone = false }) => {
  const [perfumeName, setPerfumeName] = useState('');
  const [referenceBrand, setReferenceBrand] = useState('');
  const [fragranceStyle, setFragranceStyle] = useState('Arabian');
  const [preferredNotes, setPreferredNotes] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [result, setResult] = useState<{ whatsappUrl: string; whatsappMessage: string } | null>(null);

  const handleCopyMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2200);
    } catch {
      // Fallback ignored gracefully
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (perfumeName.trim().length < 2) {
      setError('Please enter your desired perfume name or inspiration.');
      return;
    }

    const mobileDigits = extractIndianMobileDigits(customerPhone);
    if (customerPhone.trim().length > 0 && mobileDigits.length !== 10) {
      setError('Please enter a valid 10-digit Indian mobile number (+91), or leave it blank.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/custom-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          perfume_name: perfumeName.trim(),
          reference_brand: referenceBrand.trim(),
          fragrance_style: fragranceStyle,
          preferred_notes: preferredNotes.trim(),
          customer_name: customerName.trim(),
          customer_phone: mobileDigits.length === 10 ? `${DEFAULT_COUNTRY_CODE}${mobileDigits}` : '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit your request.');
      } else {
        setResult({
          whatsappUrl: data.whatsapp_url,
          whatsappMessage: data.whatsapp_message,
        });
      }
    } catch {
      setError('Network error while saving your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={standalone ? 'mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8' : 'border-t border-[#C9A24A]/15 bg-[#141311] py-16 sm:py-20'}>
      <div className={standalone ? '' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
          {/* Editorial Intro */}
          <div className={standalone ? 'lg:col-span-12' : 'lg:col-span-5'}>
            <p className="text-xs font-medium tracking-[0.2em] text-[#C9A24A]">Bespoke Atelier · India</p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#F3EBDD]">
              Create Your Own Signature Perfume
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#F3EBDD]/75">
              Have a favourite international perfume, rare Arabian oud accord, or personal blend in mind? Enter just the perfume name—or share your full note preferences—and our perfumers in India will connect directly on WhatsApp ({WHATSAPP_DISPLAY}).
            </p>
            <div className="mt-6 space-y-2.5 text-xs text-[#F3EBDD]/65 border-t border-[#C9A24A]/15 pt-5">
              <p>Quick Request Supported: Only the perfume name is required to submit.</p>
              <p>Styles Available: Arabian, French, Italian, and custom oil concentrations.</p>
              <p>Direct Consultation: Every request is saved and sent straight to our WhatsApp desk ({WHATSAPP_DISPLAY}).</p>
            </div>
          </div>

          {/* Interactive Form */}
          <div className={standalone ? 'lg:col-span-12' : 'lg:col-span-7'}>
            <div className="rounded-lg border border-[#C9A24A]/25 bg-[#F3EBDD] p-6 sm:p-8 text-[#101010]">
              {result ? (
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-[#493323]" />
                    <div>
                      <h3 className="font-display text-2xl font-semibold text-[#101010]">
                        Your Bespoke Request Is Saved
                      </h3>
                      <p className="mt-1 text-sm text-[#493323]">
                        Tap below to send your fragrance details directly to our WhatsApp perfumer at {WHATSAPP_DISPLAY}.
                      </p>
                    </div>
                  </div>

                  <pre className="whitespace-pre-wrap rounded-md border border-[#493323]/20 bg-[#EAE0CE] p-4 font-sans text-xs leading-relaxed text-[#101010]">
                    {result.whatsappMessage}
                  </pre>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <a
                      href={buildWhatsAppLink(result.whatsappMessage, WHATSAPP_NUMBER)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-md bg-[#101010] px-5 py-3 text-sm font-semibold text-[#C9A24A] transition-colors hover:bg-[#24201C]"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Send Custom Request on WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(result.whatsappMessage)}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-md border border-[#493323]/30 px-4 py-3 text-xs font-semibold text-[#493323] hover:bg-[#493323]/10"
                    >
                      {copiedMsg ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedMsg ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResult(null);
                        setPerfumeName('');
                        setReferenceBrand('');
                        setPreferredNotes('');
                      }}
                      className="min-h-[48px] rounded-md border border-[#493323]/30 px-5 py-3 text-sm font-medium text-[#493323] hover:bg-[#493323]/10"
                    >
                      New Request
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="custom-perfume-name" className="block text-xs font-semibold text-[#493323] mb-1.5">
                      Favourite Perfume Name or Inspiration <span className="text-red-700">*</span>
                    </label>
                    <input
                      id="custom-perfume-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={140}
                      value={perfumeName}
                      onChange={(e) => setPerfumeName(e.target.value)}
                      placeholder="e.g., Royal Oud Wood, Baccarat style amber, or your own custom name"
                      className="w-full min-h-[46px] rounded-md border border-[#493323]/25 bg-white px-3.5 text-sm text-[#101010] placeholder:text-[#493323]/45"
                    />
                    <p className="mt-1 text-[11px] text-[#493323]/75">
                      You may submit with just this field filled—all details below are optional.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="custom-ref-brand" className="block text-xs font-semibold text-[#493323] mb-1.5">
                        Famous Brand &amp; Fragrance (Optional)
                      </label>
                      <input
                        id="custom-ref-brand"
                        type="text"
                        maxLength={140}
                        value={referenceBrand}
                        onChange={(e) => setReferenceBrand(e.target.value)}
                        placeholder="e.g., Maison Francis, Tom Ford, Creed"
                        className="w-full min-h-[46px] rounded-md border border-[#493323]/25 bg-white px-3.5 text-sm text-[#101010] placeholder:text-[#493323]/45"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-style" className="block text-xs font-semibold text-[#493323] mb-1.5">
                        Fragrance Style (Optional)
                      </label>
                      <select
                        id="custom-style"
                        value={fragranceStyle}
                        onChange={(e) => setFragranceStyle(e.target.value)}
                        className="w-full min-h-[46px] rounded-md border border-[#493323]/25 bg-white px-3.5 text-sm text-[#101010]"
                      >
                        {FRAGRANCE_STYLES.map((style) => (
                          <option key={style} value={style}>
                            {style}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="custom-notes" className="block text-xs font-semibold text-[#493323] mb-1.5">
                      Preferred Fragrance Notes (Optional)
                    </label>
                    <textarea
                      id="custom-notes"
                      rows={3}
                      maxLength={600}
                      value={preferredNotes}
                      onChange={(e) => setPreferredNotes(e.target.value)}
                      placeholder="e.g., Smoky agarwood, saffron, Damascus rose, warm vanilla, crisp bergamot..."
                      className="w-full rounded-md border border-[#493323]/25 bg-white p-3.5 text-sm text-[#101010] placeholder:text-[#493323]/45"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="custom-cust-name" className="block text-xs font-semibold text-[#493323] mb-1.5">
                        Your Name (Optional)
                      </label>
                      <input
                        id="custom-cust-name"
                        type="text"
                        maxLength={80}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Full name"
                        className="w-full min-h-[46px] rounded-md border border-[#493323]/25 bg-white px-3.5 text-sm text-[#101010] placeholder:text-[#493323]/45"
                      />
                    </div>
                    <div>
                      <label htmlFor="custom-cust-phone" className="block text-xs font-semibold text-[#493323] mb-1.5">
                        Mobile / WhatsApp Number (India +91, Optional)
                      </label>
                      <div className="flex min-h-[46px] overflow-hidden rounded-md border border-[#493323]/25 bg-white focus-within:ring-2 focus-within:ring-[#C9A24A]">
                        <span
                          className="inline-flex shrink-0 items-center border-r border-[#493323]/20 bg-[#EAE0CE] px-3 font-mono text-xs font-semibold text-[#493323]"
                          aria-label="India country code +91"
                        >
                          IN {DEFAULT_COUNTRY_CODE}
                        </span>
                        <input
                          id="custom-cust-phone"
                          type="tel"
                          inputMode="tel"
                          maxLength={22}
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(extractIndianMobileDigits(e.target.value))}
                          placeholder="10-digit mobile number"
                          className="w-full min-h-[46px] bg-white px-3 font-mono text-sm text-[#101010] placeholder:text-[#493323]/45 focus:outline-none tabular-nums"
                        />
                      </div>
                    </div>
                  </div>

                  {error && <p className="text-xs font-medium text-red-700">{error}</p>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md bg-[#101010] px-6 py-3 text-sm font-semibold text-[#C9A24A] transition-colors hover:bg-[#231F1B] disabled:opacity-50"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {submitting ? 'Saving Request...' : 'Submit & Send to WhatsApp'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
