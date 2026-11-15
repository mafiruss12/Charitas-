import React, { useState } from 'react';
import { OFFICIAL_PARISH_LOGO, OFFICIAL_PARISH_NAME } from '../../lib/parishInfo';

interface ChariteLogoMarkProps {
  logoUrl?: string | null;
  churchName?: string;
  sizeClass?: string;
}

const LEGACY_DEFAULT_EMBLEM_PATHS = [
  '/src/assets/images/charitas_emblem_crest_1794525619241.jpg',
  '/src/assets/images/church_default_emblem_1794523063574.jpg',
];

export const ChariteLogoMark: React.FC<ChariteLogoMarkProps> = ({
  logoUrl,
  churchName = OFFICIAL_PARISH_NAME,
  sizeClass = 'w-11 h-11',
}) => {
  const [imgError, setImgError] = useState(false);
  const resolvedSrc =
    logoUrl && !LEGACY_DEFAULT_EMBLEM_PATHS.includes(logoUrl)
      ? logoUrl
      : OFFICIAL_PARISH_LOGO;

  if (!imgError) {
    return (
      <img
        src={resolvedSrc}
        alt={`Logo ${churchName}`}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border-2 border-[#F5B82E]/80 bg-white shadow-sm shrink-0`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center shrink-0 bg-[#061A40] border border-[#F5B82E]/70`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" fill="none" className="w-full h-full p-1">
        <path
          d="M32 45C32 45 17 35.8 17 24.5C17 19.2 21.1 15 26.2 15C29.1 15 31.2 16.5 32 18.2C32.8 16.5 34.9 15 37.8 15C42.9 15 47 19.2 47 24.5C47 35.8 32 45 32 45Z"
          fill="#1D4ED8"
          stroke="#F5B82E"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
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

