import React, { useState } from 'react';
import { Home, Menu, Tv, User, X } from 'lucide-react';
import { PWAInstallButton } from '../PWAInstallButton';
import { ChariteLogoMark } from './ChariteLogoMark';

interface LandingNavbarProps {
  churchName: string;
  tagline: string;
  logoUrl?: string | null;
  activeSection: string;
  onNavigateSection: (sectionId: string) => void;
  onOpenTv: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
}

const NAV_LINKS: { id: string; label: string; isHome?: boolean }[] = [
  { id: 'accueil', label: 'Accueil', isHome: true },
  { id: 'a-propos', label: 'À propos' },
  { id: 'nos-actions', label: 'Nos actions' },
  { id: 'actualites', label: 'Actualités' },
  { id: 'evenements', label: 'Événements' },
  { id: 'dons', label: 'Faire un don' },
];

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  churchName,
  tagline,
  logoUrl,
  activeSection,
  onNavigateSection,
  onOpenTv,
  onOpenAuth,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLinkClick = (sectionId: string) => {
    setMobileOpen(false);
    onNavigateSection(sectionId);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#061A40]/92 backdrop-blur-md border-b border-white/10 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-2.5 lg:gap-3 xl:gap-6">
        {/* Brand Zone */}
        <a
          href="#accueil"
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick('accueil');
          }}
          className="inline-flex items-center gap-2.5 min-w-0 shrink-0 group"
        >
          <ChariteLogoMark logoUrl={logoUrl} churchName={churchName} sizeClass="w-10 h-10 xl:w-11 xl:h-11" />
          <div className="min-w-0">
            <span className="block text-sm sm:text-base xl:text-lg font-extrabold tracking-tight text-white leading-tight truncate max-w-[195px] sm:max-w-[260px] xl:max-w-[320px]">
              CHARITAS <span className="text-[#F5B82E] font-semibold">· St Louis Roi d’Ebimpé</span>
            </span>
            <span className="hidden sm:block mt-0.5 text-[11px] font-medium text-blue-200/85 truncate max-w-[245px] xl:max-w-[320px]">
              Église Saint Louis Roi d’Ebimpé · {tagline}
            </span>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <nav
          aria-label="Navigation principale"
          className="hidden lg:flex items-center gap-3 xl:gap-5 text-[13px] xl:text-sm font-medium text-blue-100/90"
        >
          {NAV_LINKS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(item.id);
                }}
                className={`relative py-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  isActive ? 'text-white font-semibold' : 'hover:text-white'
                }`}
              >
                {item.isHome && <Home className="w-3.5 h-3.5 text-[#F5B82E]" aria-hidden="true" />}
                <span>{item.label}</span>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 right-0 bottom-0 h-0.5 rounded-full bg-[#F5B82E]"
                  />
                )}
              </a>
            );
          })}
          <button
            type="button"
            onClick={onOpenTv}
            className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/18 border border-white/15 text-[#F5B82E] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Tv className="w-3.5 h-3.5" aria-hidden="true" />
            <span>CHARITAS TV</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenAuth('login')}
            className="py-2 text-blue-100/90 hover:text-white whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            Connexion
          </button>
        </nav>

        {/* Actions Zone */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:block">
            <PWAInstallButton variant="navbar" />
          </div>
          <button
            type="button"
            onClick={() => onOpenAuth('register')}
            className="hidden sm:inline-flex items-center gap-2 px-4 xl:px-5 py-2.5 rounded-full bg-gradient-to-r from-[#F5B82E] to-[#E5A015] hover:from-[#FACC15] hover:to-[#F5B82E] text-[#061A40] text-[13px] xl:text-sm font-semibold shadow-[0_6px_20px_-4px_rgba(245,184,46,0.55)] transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <User className="w-4 h-4" aria-hidden="true" />
            <span>S'inscrire</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="lg:hidden p-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 text-white cursor-pointer"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#051536] px-4 py-4 space-y-2">
          <p className="px-2 pb-1 text-xs text-blue-200/80 truncate">{churchName}</p>
          <div className="grid grid-cols-1 gap-1">
            {NAV_LINKS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleLinkClick(item.id);
                  }}
                  className={`px-3 py-3 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
                    isActive
                      ? 'bg-white/12 text-[#F5B82E]'
                      : 'text-blue-100 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  {item.isHome && <Home className="w-4 h-4" aria-hidden="true" />}
                  <span>{item.label}</span>
                </a>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenTv();
              }}
              className="px-3 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 bg-white/10 text-[#F5B82E] text-left cursor-pointer"
            >
              <Tv className="w-4 h-4" aria-hidden="true" />
              <span>CHARITAS TV (Directs &amp; Chaînes)</span>
            </button>
            <div className="pt-1">
              <PWAInstallButton variant="navbar" />
            </div>
          </div>
          <div className="pt-3 border-t border-white/10 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAuth('login');
              }}
              className="h-11 rounded-xl border border-white/25 bg-white/5 text-white text-sm font-medium cursor-pointer"
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAuth('register');
              }}
              className="h-11 rounded-xl bg-gradient-to-r from-[#F5B82E] to-[#E5A015] text-[#061A40] text-sm font-semibold cursor-pointer"
            >
              S'inscrire
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
