import React from 'react';
import { motion } from 'motion/react';
import { POWERED_BY_CREDIT } from '../lib/parishInfo';
import { ChariteLogoMark } from './landing/ChariteLogoMark';

interface SplashScreenProps {
  variant?: 'boot' | 'login';
  userName?: string;
  message?: string;
  onSkip?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  variant = 'boot',
  userName,
  message = 'Initialisation de votre communauté paroissiale...',
  onSkip,
}) => {
  const isPostLogin = variant === 'login';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } }}
      exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }}
      className="fixed inset-0 z-[100] bg-gradient-to-br from-[#030D22] via-[#061A40] to-[#123D94] text-white flex flex-col items-center justify-center p-6 overflow-hidden select-none"
      role="status"
      aria-live="polite"
      aria-label="Chargement de CHARITAS — Église Saint Louis Roi d’Ebimpé"
    >
      {/* Pure CSS Motion-Design Rotating Conic Rays & Ambient Glow */}
      <div aria-hidden="true" className="charitas-splash-rays" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute w-[24rem] h-[24rem] rounded-full bg-[#F5B82E]/15 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md space-y-6">
        {isPostLogin && (
          <motion.span
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F5B82E]/18 border border-[#F5B82E]/50 text-[#F5B82E] text-xs font-bold tracking-wider uppercase"
          >
            Connexion établie{userName ? ` · ${userName}` : ''}
          </motion.span>
        )}

        {/* Captivating CSS Motion-Design Circular Emblem */}
        <div className="relative py-2">
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full p-2.5 bg-gradient-to-br from-[#F5B82E]/35 via-white/10 to-[#1D4ED8]/40 shadow-[0_24px_60px_-10px_rgba(245,184,46,0.55)] flex items-center justify-center">
            <ChariteLogoMark
              churchName="CHARITAS — Église Saint Louis Roi d’Ebimpé"
              sizeClass="w-full h-full"
              motion="splash"
            />
          </div>
        </div>

        {/* Typographic Official Identity */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-2"
        >
          <h1 className="text-4xl sm:text-5xl font-black tracking-[0.18em] text-white drop-shadow-sm">
            CHARITAS
          </h1>
          <div className="flex items-center justify-center gap-2.5">
            <span className="h-px w-8 bg-[#F5B82E]/75" aria-hidden="true" />
            <p className="text-xs sm:text-sm font-bold tracking-[0.14em] text-[#F5B82E] uppercase">
              ÉGLISE SAINT LOUIS ROI D’EBIMPÉ
            </p>
            <span className="h-px w-8 bg-[#F5B82E]/75" aria-hidden="true" />
          </div>
          <p className="text-xs sm:text-sm text-blue-100/85 pt-1">
            Foi · Solidarité · Fraternité · CHARITAS TV
          </p>
        </motion.div>

        {/* Pure CSS Progress Sweep Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="w-60 space-y-2.5"
        >
          <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
            <div className="charitas-splash-progress-bar h-full w-1/2 rounded-full bg-gradient-to-r from-[#F5B82E]/35 via-[#F5B82E] to-[#F5B82E]/35" />
          </div>
          <p className="text-xs font-medium text-blue-100/90">{message}</p>
        </motion.div>

        {onSkip && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            onClick={onSkip}
            className="text-xs font-semibold text-[#F5B82E] hover:text-white underline underline-offset-4 cursor-pointer"
          >
            {isPostLogin ? 'Entrer maintenant' : 'Accéder directement'}
          </motion.button>
        )}
      </div>

      <p className="relative z-10 mt-8 text-[11px] font-semibold text-[#F5B82E]/85 tracking-wide">
        {POWERED_BY_CREDIT}
      </p>
    </motion.div>
  );
};
