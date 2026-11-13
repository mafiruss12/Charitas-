import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  HandHeart,
  Heart,
  PlayCircle,
  Target,
  Tv,
  Users,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { PublicShowcaseResponse, ThemeMode } from '../types/platform';
import { ResilientImage } from './ResilientImage';
import { LandingNavbar } from './landing/LandingNavbar';
import { LandingShowcaseSections } from './landing/LandingShowcaseSections';
import { PublicCommunityExplorer, type ExplorerTab } from './landing/PublicCommunityExplorer';
import { ChariteTvHub } from './tv/ChariteTvHub';

interface LandingViewProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenAuth: (mode: 'login' | 'register', prefill?: { churchId?: number; inviteCode?: string }) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  theme,
  onToggleTheme,
  onOpenAuth,
}) => {
  const [showcase, setShowcase] = useState<PublicShowcaseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('accueil');
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>('feed');
  const [tvOpen, setTvOpen] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<PublicShowcaseResponse>('/api/public/showcase')
      .then((data) => {
        if (active) setShowcase(data);
      })
      .catch(() => {
        // Fallback gracefully if showcase endpoint temporarily unavailable
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const navigateToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openExplorer = (tab: ExplorerTab) => {
    setExplorerTab(tab);
    setExplorerOpen(true);
  };

  const featuredChurch = showcase?.featuredChurch;
  const featuredChurchId = featuredChurch?.id;

  const featureCards = [
    {
      title: 'Communauté active et engagée',
      target: 'communaute',
      icon: <Users className="w-5 h-5 text-white" />,
      badgeClass: 'from-[#2563EB] to-[#1D4ED8]',
    },
    {
      title: "Actions de solidarité et d'entraide",
      target: 'nos-actions',
      icon: <HandHeart className="w-5 h-5 text-white" />,
      badgeClass: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Événements et rencontres',
      target: 'evenements',
      icon: <CalendarDays className="w-5 h-5 text-white" />,
      badgeClass: 'from-indigo-500 to-violet-600',
    },
    {
      title: 'Actualités et messages',
      target: 'actualites',
      icon: <Bell className="w-5 h-5 text-white" />,
      badgeClass: 'from-amber-400 to-orange-500',
    },
    {
      title: 'Soutien spirituel et bienveillance',
      target: 'temoignages',
      icon: <Heart className="w-5 h-5 text-white" />,
      badgeClass: 'from-cyan-400 to-sky-600',
    },
  ];

  const missionPillars = [
    'Partager la parole de Dieu',
    'Encourager la solidarité',
    'Soutenir les personnes vulnérables',
    'Développer la fraternité',
    "Maintenir le lien entre l'église et ses membres",
  ];

  const checklistItems = [
    'Partager des messages et des prières',
    'Faire des dons en toute sécurité',
    'Participer aux œuvres de charité',
    'Rester connecté avec votre église',
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-[#0B111E] dark:text-slate-100">
      <LandingNavbar
        churchName={featuredChurch?.name || 'CHARITAS — Église Saint Louis Roi d’Ebimpé'}
        tagline={featuredChurch?.tagline || 'Partager · Aider · Bâtir ensemble'}
        logoUrl={featuredChurch?.logoUrl}
        activeSection={activeSection}
        onNavigateSection={navigateToSection}
        onOpenTv={() => setTvOpen(true)}
        onOpenAuth={(mode) =>
          onOpenAuth(mode, featuredChurchId ? { churchId: featuredChurchId } : undefined)
        }
      />

      {/* Hero Section — Deep Midnight Navy to Royal Blue with Community Photo */}
      <section
        id="accueil"
        className="relative overflow-hidden bg-gradient-to-br from-[#04112B] via-[#0A2B6E] to-[#1750B5] text-white"
      >
        {/* Subtle luminous atmospheric accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#2563EB]/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/3 right-1/4 w-80 h-80 rounded-full bg-[#F5B82E]/10 blur-3xl"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-24 lg:pt-14 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Copy Column */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs sm:text-sm font-medium text-blue-100 backdrop-blur-sm">
                <Users className="w-4 h-4 text-[#F5B82E] shrink-0" aria-hidden="true" />
                <span>Une église connectée pour une communauté solidaire</span>
              </div>

              <div>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.08] text-white text-balance">
                  Ensemble, faisons{' '}
                  <span className="relative inline-block text-[#F5B82E]">
                    le bien autour de nous
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 320 16"
                      fill="none"
                      className="w-full h-3.5 mt-1 text-[#F5B82E]"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M3 12C82 4 214 2 317 9"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </h1>
                <p className="mt-4 text-base sm:text-lg text-blue-100/90 leading-relaxed max-w-xl">
                  <strong>CHARITAS — Église Saint Louis Roi d’Ebimpé</strong> est la plateforme
                  numérique de notre paroisse pour partager, communiquer, soutenir les plus
                  vulnérables et bâtir une communauté plus solidaire.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onOpenAuth(
                      'register',
                      featuredChurchId ? { churchId: featuredChurchId } : undefined
                    )
                  }
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-gradient-to-r from-[#F5B82E] to-[#E5A015] hover:from-[#FACC15] hover:to-[#F5B82E] text-[#061A40] text-sm font-bold shadow-[0_12px_30px_-8px_rgba(245,184,46,0.65)] transition-all whitespace-nowrap cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-[#061A40]" aria-hidden="true" />
                  <span>Rejoindre notre communauté</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => openExplorer('feed')}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full border border-white/35 bg-white/10 hover:bg-white/18 text-white text-sm font-semibold backdrop-blur-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <PlayCircle className="w-4 h-4 text-[#F5B82E]" aria-hidden="true" />
                  <span>Explorer la communauté</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTvOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full border border-[#F5B82E]/50 bg-[#04112B]/65 hover:bg-[#061A40] text-[#F5B82E] text-sm font-semibold backdrop-blur-sm transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Tv className="w-4 h-4" aria-hidden="true" />
                  <span>CHARITAS TV en direct</span>
                </button>
              </div>
            </div>

            {/* Right Photography Column */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden border border-white/20 shadow-[0_24px_70px_-15px_rgba(4,17,43,0.75)] bg-[#071D49]">
                <div className="aspect-[16/10] sm:aspect-[16/9]">
                  <ResilientImage
                    src="/src/assets/images/charite_hero_community_1794553951858.jpg"
                    alt="Responsable religieux, bénévoles et personne âgée réunis dans une action de solidarité chrétienne"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061A40]/45 via-transparent to-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Curved bottom wave transition matching the visual reference */}
        <div className="relative z-10 -mb-px">
          <svg
            aria-hidden="true"
            viewBox="0 0 1440 72"
            fill="none"
            className="w-full h-10 sm:h-14 text-white dark:text-[#0B111E]"
            preserveAspectRatio="none"
          >
            <path
              d="M0 16C360 66 1080 66 1440 16V72H0V16Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </section>

      {/* 5 Interactive Feature Cards */}
      <section aria-label="Fonctionnalités principales" className="relative z-20 -mt-14 sm:-mt-16 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {featureCards.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => navigateToSection(card.target)}
                className="group text-left rounded-2xl bg-[#0A255C]/95 hover:bg-[#0D327A] border border-white/15 p-4 sm:p-5 text-white shadow-[0_14px_30px_-10px_rgba(6,26,64,0.45)] transition-all duration-200 hover:-translate-y-1 flex items-center gap-3.5 cursor-pointer"
              >
                <div
                  className={`w-11 h-11 rounded-full bg-gradient-to-br ${card.badgeClass} flex items-center justify-center shrink-0 shadow-inner transition-transform duration-200 group-hover:scale-105`}
                >
                  {card.icon}
                </div>
                <span className="text-sm font-semibold leading-snug text-white">
                  {card.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Section Notre mission — Clean White Reading Space with Bible/Smartphone & Checklist Card */}
      <section id="a-propos" className="bg-white dark:bg-[#0B111E] py-12 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Illustration: Bible + Smartphone CHARITAS */}
            <div className="lg:col-span-4">
              <div className="rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-[0_18px_45px_-18px_rgba(15,23,42,0.18)]">
                <div className="aspect-[4/3]">
                  <ResilientImage
                    src="/src/assets/images/charite_mission_smartphone_1794553951626.jpg"
                    alt="Sainte Bible avec croix dorée et smartphone affichant l'application CHARITAS"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Center Column: Notre mission & 5 engagements */}
            <div className="lg:col-span-4 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                <Target className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Notre mission</span>
              </div>

              <h2 className="text-3xl sm:text-[2.15rem] font-extrabold tracking-tight text-[#061A40] dark:text-white leading-tight text-balance">
                Partager l’amour de Dieu{' '}
                <span className="text-[#1D4ED8] dark:text-[#60A5FA]">et agir pour les autres</span>
              </h2>

              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                À travers <strong>CHARITAS — Église Saint Louis Roi d’Ebimpé</strong>, nous unissons
                nos forces pour soutenir les démunis, partager la parole de Dieu et construire une
                société plus humaine.
              </p>

              <ul className="pt-1 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {missionPillars.map((pillar) => (
                  <li key={pillar} className="flex items-center gap-2.5">
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-[#F5B82E] shrink-0"
                    />
                    <span>{pillar}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right Elevated Checklist Card */}
            <div className="lg:col-span-4">
              <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 sm:p-7 shadow-[0_18px_50px_-15px_rgba(15,23,42,0.12)] space-y-5">
                <ul className="space-y-3.5">
                  {checklistItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      <CheckCircle2
                        className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA] shrink-0"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() =>
                    onOpenAuth(
                      'register',
                      featuredChurchId ? { churchId: featuredChurchId } : undefined
                    )
                  }
                  className="w-full h-12 rounded-full bg-gradient-to-r from-[#1D4ED8] to-[#2563EB] hover:from-[#1E40AF] hover:to-[#1D4ED8] text-white text-sm font-semibold shadow-[0_10px_25px_-8px_rgba(29,78,216,0.55)] inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Rejoindre maintenant</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingShowcaseSections
        showcase={showcase}
        loading={loading}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenAuth={onOpenAuth}
        onOpenExplorer={openExplorer}
        onOpenTv={() => setTvOpen(true)}
      />

      <PublicCommunityExplorer
        open={explorerOpen}
        initialTab={explorerTab}
        churches={showcase?.churches || []}
        initialChurchId={featuredChurchId}
        onClose={() => setExplorerOpen(false)}
        onOpenAuth={(mode, prefill) => {
          setExplorerOpen(false);
          onOpenAuth(mode, prefill);
        }}
      />

      {tvOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="CHARITAS TV — Directs et chaînes chrétiennes"
          className="fixed inset-0 z-50 bg-[#04112B]/80 backdrop-blur-sm overflow-y-auto p-3 sm:p-6"
        >
          <div className="max-w-7xl mx-auto bg-[#FAF7F2] dark:bg-[#0B111E] rounded-3xl border border-white/15 p-4 sm:p-6 shadow-2xl">
            <ChariteTvHub
              churchId={featuredChurchId}
              isAuthenticated={false}
              isModal
              onCloseModal={() => setTvOpen(false)}
              onOpenAuth={(mode) => {
                setTvOpen(false);
                onOpenAuth(mode, featuredChurchId ? { churchId: featuredChurchId } : undefined);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
