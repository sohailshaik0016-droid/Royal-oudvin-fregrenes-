import React from 'react';

interface BrandLogoProps {
  compact?: boolean;
  className?: string;
  logoUrl?: string;
}

export const BrandEmblem: React.FC<{ size?: number; className?: string }> = ({
  size = 34,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`shrink-0 ${className}`}
  >
    <rect x="2" y="2" width="60" height="60" rx="8" fill="#101010" stroke="#C9A24A" strokeWidth="1.5" />
    <path
      d="M32 10L47 26L32 54L17 26L32 10Z"
      stroke="#C9A24A"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path
      d="M32 16L41 26L32 45L23 26L32 16Z"
      stroke="#C9A24A"
      strokeWidth="1"
      strokeOpacity="0.6"
    />
    <circle cx="32" cy="26.5" r="4.5" stroke="#C9A24A" strokeWidth="1.6" />
    <path d="M32 10V16M32 45V54M17 26H23M41 26H47" stroke="#C9A24A" strokeWidth="1.2" strokeOpacity="0.7" />
  </svg>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  compact = false,
  className = '',
  logoUrl = '',
}) => {
  const customLogo = logoUrl.trim();
  if (compact) {
    return (
      <span className={`inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 ${className}`}>
        {customLogo ? (
          <img
            src={customLogo}
            alt="OUDVIN Fragrances Logo"
            referrerPolicy="no-referrer"
            className="h-8 w-8 shrink-0 rounded object-contain bg-[#101010] border border-[#C9A24A]/40"
          />
        ) : (
          <BrandEmblem size={30} />
        )}
        <span className="font-display text-lg sm:text-xl font-semibold tracking-[0.2em] text-[#C9A24A]">
          OUDVIN
        </span>
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3.5 ${className}`}>
      {customLogo ? (
        <img
          src={customLogo}
          alt="OUDVIN Fragrances Logo"
          referrerPolicy="no-referrer"
          className="h-11 w-11 shrink-0 rounded object-contain bg-[#101010] border border-[#C9A24A]/40"
        />
      ) : (
        <BrandEmblem size={44} />
      )}
      <div className="flex flex-col leading-none">
        <span className="font-display text-2xl font-semibold tracking-[0.22em] text-[#C9A24A]">
          OUDVIN
        </span>
        <span className="mt-1 text-[10px] font-medium tracking-[0.34em] text-[#F3EBDD]/75 uppercase">
          Fragrances
        </span>
      </div>
    </div>
  );
};
