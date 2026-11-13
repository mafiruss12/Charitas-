import React, { useState } from 'react';

interface ChariteLogoMarkProps {
  logoUrl?: string | null;
  churchName?: string;
  sizeClass?: string;
}

const DEFAULT_EMBLEM_PATHS = [
  '/src/assets/images/charitas_emblem_crest_1794525619241.jpg',
  '/src/assets/images/church_default_emblem_1794523063574.jpg',
];

export const ChariteLogoMark: React.FC<ChariteLogoMarkProps> = ({
  logoUrl,
  churchName = 'CHARITAS — Église Saint Louis Roi d’Ebimpé',
  sizeClass = 'w-11 h-11',
}) => {
  const [imgError, setImgError] = useState(false);
  const hasCustomLogo =
    Boolean(logoUrl) && !DEFAULT_EMBLEM_PATHS.includes(logoUrl || '') && !imgError;

  if (hasCustomLogo && logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`Logo ${churchName}`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-xl object-cover border border-white/25 bg-white/10 shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl flex items-center justify-center shrink-0`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
        {/* Protective sheltering hands */}
        <path
          d="M12 31C10 38 12.5 47.5 21 53L28 57V48.5C22.5 45 19.5 39.5 19 33L14.5 29.5C13.3 28.6 12.3 29.6 12 31Z"
          fill="#FFFFFF"
        />
        <path
          d="M52 31C54 38 51.5 47.5 43 53L36 57V48.5C41.5 45 44.5 39.5 45 33L49.5 29.5C50.7 28.6 51.7 29.6 52 31Z"
          fill="#FFFFFF"
        />
        {/* Royal blue heart outline + golden heart accent */}
        <path
          d="M32 45C32 45 17 35.8 17 24.5C17 19.2 21.1 15 26.2 15C29.1 15 31.2 16.5 32 18.2C32.8 16.5 34.9 15 37.8 15C42.9 15 47 19.2 47 24.5C47 35.8 32 45 32 45Z"
          fill="#1D4ED8"
          stroke="#F5B82E"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {/* Luminous golden cross */}
        <path
          d="M32 10V37M23 22H41"
          stroke="#F5B82E"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};
