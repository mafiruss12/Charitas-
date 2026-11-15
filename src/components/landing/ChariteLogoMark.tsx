import React, { useState } from 'react';
import { OFFICIAL_PARISH_LOGO, OFFICIAL_PARISH_NAME } from '../../lib/parishInfo';

export type ChariteLogoMotion = 'none' | 'subtle' | 'card' | 'hero' | 'splash';

interface ChariteLogoMarkProps {
  logoUrl?: string | null;
  churchName?: string;
  sizeClass?: string;
  motion?: ChariteLogoMotion;
}

const LEGACY_DEFAULT_EMBLEM_PATHS = [
  '/src/assets/images/charitas_emblem_crest_1794525619241.jpg',
  '/src/assets/images/church_default_emblem_1794523063574.jpg',
];

export const ChariteLogoMark: React.FC<ChariteLogoMarkProps> = ({
  logoUrl,
  churchName = OFFICIAL_PARISH_NAME,
  sizeClass = 'w-11 h-11',
  motion = 'card',
}) => {
  const [imgError, setImgError] = useState(false);
  const resolvedSrc =
    logoUrl && !LEGACY_DEFAULT_EMBLEM_PATHS.includes(logoUrl)
      ? logoUrl
      : OFFICIAL_PARISH_LOGO;

  const showOuterOrbit = motion !== 'none';
  const showInnerDashed = motion === 'hero' || motion === 'splash';
  const showRipples = motion === 'hero' || motion === 'splash';
  const showShine = motion === 'card' || motion === 'hero' || motion === 'splash';

  const coreMotionClass =
    motion === 'splash'
      ? 'charitas-logo-core--splash'
      : motion === 'card' || motion === 'hero'
        ? 'charitas-logo-core--float'
        : '';

  return (
    <span className={`charitas-logo-shell ${sizeClass} shrink-0`}>
      {showRipples && (
        <>
          <span aria-hidden="true" className="charitas-logo-ripple" />
          <span aria-hidden="true" className="charitas-logo-ripple charitas-logo-ripple--delayed" />
        </>
      )}
      {showInnerDashed && <span aria-hidden="true" className="charitas-logo-ring-inner" />}
      {showOuterOrbit && (
        <span
          aria-hidden="true"
          className={`charitas-logo-ring-outer ${motion === 'subtle' ? 'opacity-75' : 'opacity-95'}`}
        />
      )}

      <span className={`charitas-logo-core ${coreMotionClass}`}>
        {!imgError ? (
          <img
            src={resolvedSrc}
            alt={`Logo ${churchName}`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span
            className="w-full h-full flex items-center justify-center bg-[#061A40]"
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
          </span>
        )}
        {showShine && <span aria-hidden="true" className="charitas-logo-shine" />}
      </span>
    </span>
  );
};
