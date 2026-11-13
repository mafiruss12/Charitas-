import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'workspace';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'navbar' }) => {
  const { canInstall, canShowIosGuide, isInstalled, promptInstall } = usePWAInstall();
  const [iosModalOpen, setIosModalOpen] = useState(false);

  if (isInstalled || (!canInstall && !canShowIosGuide)) {
    return null;
  }

  const handleClick = async () => {
    const outcome = await promptInstall();
    if (outcome === 'ios') {
      setIosModalOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label="Installer l’application CHARITAS"
        className={
          variant === 'navbar'
            ? 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/25 bg-white/10 hover:bg-white/18 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-stone-100 dark:hover:bg-slate-800 text-xs font-semibold text-[#061A40] dark:text-[#F5B82E] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Installer l’app</span>
      </button>

      {iosModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Installer CHARITAS sur iPhone ou iPad"
          className="fixed inset-0 z-50 bg-[#04112B]/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="max-w-sm w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] p-6 text-slate-900 dark:text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-sm font-bold text-[#061A40] dark:text-white">
                <Smartphone className="w-4 h-4 text-[#1D4ED8] dark:text-[#F5B82E]" />
                <span>Installer CHARITAS sur iOS</span>
              </div>
              <button
                type="button"
                onClick={() => setIosModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Ajoutez <strong>CHARITAS — Église Saint Louis Roi d’Ebimpé</strong> sur votre écran
              d’accueil pour un accès rapide en plein écran :
            </p>
            <ol className="space-y-2.5 text-xs text-slate-700 dark:text-slate-200 list-decimal pl-4">
              <li>
                Appuyez sur le bouton <Share className="inline w-3.5 h-3.5 text-[#1D4ED8]" />{' '}
                <strong>Partager</strong> dans la barre de Safari.
              </li>
              <li>
                Faites défiler et choisissez <strong>Sur l’écran d’accueil</strong>.
              </li>
              <li>
                Confirmez en appuyant sur <strong>Ajouter</strong>.
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setIosModalOpen(false)}
              className="w-full h-10 rounded-xl bg-[#061A40] dark:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer"
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/95 text-amber-900 dark:text-amber-200 px-3.5 py-2.5 shadow-lg flex items-center gap-2 text-xs font-semibold"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <span>Mode hors ligne — Données CHARITAS en cache disponibles</span>
    </div>
  );
};
