import React from 'react';
import { motion } from 'motion/react';
import { ChariteLogoMark } from './landing/ChariteLogoMark';

interface SplashScreenProps {
  message?: string;
  onSkip?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  message = 'Initialisation de votre communauté paroissiale...',
  onSkip,
}) => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeOut' } }}
      className="fixed inset-0 z-[100] bg-gradient-to-br from-[#04112B] via-[#061A40] to-[#123D94] text-white flex flex-col items-center justify-center p-6 overflow-hidden select-none"
      role="status"
      aria-live="polite"
      aria-label="Chargement de CHARITAS — Église Saint Louis Roi d’Ebimpé"
    >
      {/* Subtle luminous radial glow */}
      <motion.div
        aria-hidden="true"
        initial={{ scale: 0.85, opacity: 0.25 }}
        animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute w-[26rem] h-[26rem] rounded-full bg-[#F5B82E]/15 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md space-y-6">
        {/* Animated Emblem Crest */}
        <motion.div
          initial={{ scale: 0.72, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-1.5 bg-gradient-to-br from-[#F5B82E] via-[#FACC15]/80 to-white/25 shadow-[0_20px_50px_-10px_rgba(245,184,46,0.55)]">
            <div className="w-full h-full rounded-[1.25rem] bg-[#04112B] flex items-center justify-center overflow-hidden p-2">
              <ChariteLogoMark
                churchName="CHARITAS — Église Saint Louis Roi d’Ebimpé"
                sizeClass="w-full h-full"
              />
            </div>
          </div>
        </motion.div>

        {/* Typographic Official Identity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
          className="space-y-2"
        >
          <h1 className="text-4xl sm:text-5xl font-black tracking-[0.16em] text-white">
            CHARITAS
          </h1>
          <div className="flex items-center justify-center gap-2.5">
            <span className="h-px w-8 bg-[#F5B82E]/70" aria-hidden="true" />
            <p className="text-xs sm:text-sm font-bold tracking-[0.14em] text-[#F5B82E] uppercase">
              ÉGLISE SAINT LOUIS ROI D’EBIMPÉ
            </p>
            <span className="h-px w-8 bg-[#F5B82E]/70" aria-hidden="true" />
          </div>
          <p className="text-xs sm:text-sm text-blue-100/85 pt-1">
            Foi · Solidarité · Fraternité · CHARITAS TV
          </p>
        </motion.div>

        {/* Animated Progress Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="w-56 space-y-2.5"
        >
          <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
              className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#F5B82E]/40 via-[#F5B82E] to-[#F5B82E]/40"
            />
          </div>
          <p className="text-[11px] font-medium text-blue-200/80">{message}</p>
        </motion.div>

        {onSkip && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            onClick={onSkip}
            className="text-[11px] font-semibold text-blue-200/75 hover:text-white underline underline-offset-4 cursor-pointer"
          >
            Accéder directement
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};
