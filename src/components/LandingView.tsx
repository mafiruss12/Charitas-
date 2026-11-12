import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  HandCoins,
  HeartHandshake,
  Moon,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { PublicChurch, ThemeMode } from '../types/platform';
import { ResilientImage } from './ResilientImage';

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
  const [churches, setChurches] = useState<PublicChurch[]>([]);
  const [loadingChurches, setLoadingChurches] = useState(true);
  const [inviteCodeInput, setInviteCodeInput] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<{ churches: PublicChurch[] }>('/api/public/churches')
      .then((data) => {
        if (active) setChurches(data.churches);
      })
      .catch(() => {
        // Keep empty list gracefully
      })
      .finally(() => {
        if (active) setLoadingChurches(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCodeInput.trim()) {
      onOpenAuth('register', { inviteCode: inviteCodeInput.trim().toUpperCase() });
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-900 dark:bg-[#0B111E] dark:text-stone-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-[#E5DED3]/90 dark:border-slate-800/90 bg-[#FAF7F2]/92 dark:bg-[#0B111E]/92 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#accueil"
            className="inline-flex items-center gap-3 whitespace-nowrap shrink-0 group"
          >
            <img
              src="/src/assets/images/charitas_emblem_crest_1794525619241.jpg"
              alt="Emblème Charitas Saint-Louis"
              className="w-8 h-8 rounded-lg object-cover border border-[#E5DED3] dark:border-slate-700"
            />
            <span className="font-display text-2xl font-bold tracking-tight text-[#1B365D] dark:text-stone-100 whitespace-nowrap">
              Charitas Saint-Louis
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-stone-600 dark:text-slate-300">
            <a
              href="#missions"
              className="hover:text-[#1B365D] dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Missions
            </a>
            <a
              href="#eglises"
              className="hover:text-[#1B365D] dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Paroisse
            </a>
            <a
              href="#transparence"
              className="hover:text-[#1B365D] dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Transparence
            </a>
            <a
              href="#invitation"
              className="hover:text-[#1B365D] dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0"
            >
              Rejoindre
            </a>
          </nav>

          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hidden sm:inline-block text-sm font-medium text-stone-700 dark:text-slate-300 hover:text-[#1B365D] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-[#1B365D] text-white hover:bg-[#132744] dark:bg-amber-600 dark:hover:bg-amber-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Ouvrir l’espace
            </button>
          </div>
        </div>
      </header>

      {/* Editorial Hero Section */}
      <section id="accueil" className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-18 lg:pb-22">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-wide text-[#881337] dark:text-amber-400 mb-3">
              Paroisse d’Ebimpé · Archidiocèse d’Abidjan · Côte d’Ivoire
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.65rem] font-semibold tracking-tight text-[#1B365D] dark:text-white leading-[1.06] text-balance">
              Charitas — Église Saint Louis Roi d’Ebimpé
            </h1>
            <p className="mt-4 font-display italic text-xl sm:text-2xl text-[#881337] dark:text-amber-300/90">
              « Que tout ce que vous faites soit fait avec charité. »
            </p>
            <p className="mt-5 text-base sm:text-lg text-stone-600 dark:text-slate-300 leading-relaxed max-w-xl">
              L’espace fraternel, spirituel et humanitaire de la paroisse Saint Louis Roi d’Ebimpé.
              Accompagnez les familles vulnérables, soutenez la scolarité et la santé de proximité,
              participez à la vie paroissiale et suivez chaque don en toute transparence.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg bg-[#1B365D] text-white hover:bg-[#132744] dark:bg-amber-600 dark:hover:bg-amber-500 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer shadow-sm"
              >
                Rejoindre l’œuvre Charitas
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="inline-flex items-center px-6 py-3.5 rounded-lg border border-[#D8CFC1] dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 text-stone-800 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-900 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                Accéder à mon espace
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[340px] lg:min-h-[470px] rounded-2xl overflow-hidden border border-[#E5DED3] dark:border-slate-800 bg-[#EFE9DF] dark:bg-slate-900 shadow-[0_24px_60px_-20px_rgba(27,54,93,0.18)]">
              <ResilientImage
                src="/src/assets/images/charitas_parish_hero_1794525618732.jpg"
                alt="Sanctuaire lumineux et cour accueillante de l'Église Saint Louis Roi d'Ebimpé"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Full-Width 4-Column Architectural Pillars Strip */}
        <div className="mt-16 pt-10 border-t border-[#E5DED3] dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <p className="font-mono-tabular text-xs font-semibold text-[#881337] dark:text-amber-400">
              01
            </p>
            <h3 className="mt-1.5 text-base font-semibold text-[#1B365D] dark:text-white">
              Entraide &amp; Familles d’Ebimpé
            </h3>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
              Colis alimentaires, suivi confidentiel des foyers en difficulté, soutien aux veuves,
              orphelins et personnes âgées.
            </p>
          </div>
          <div>
            <p className="font-mono-tabular text-xs font-semibold text-[#881337] dark:text-amber-400">
              02
            </p>
            <h3 className="mt-1.5 text-base font-semibold text-[#1B365D] dark:text-white">
              Éducation &amp; Soins de Proximité
            </h3>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
              Distribution de kits scolaires, cours d’alphabétisation, bourses et permanences
              médicales bénévoles.
            </p>
          </div>
          <div>
            <p className="font-mono-tabular text-xs font-semibold text-[#881337] dark:text-amber-400">
              03
            </p>
            <h3 className="mt-1.5 text-base font-semibold text-[#1B365D] dark:text-white">
              Dons Locaux &amp; Transparence
            </h3>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
              Contributions Orange Money, MTN, Moov, Wave ou carte bancaire avec reçus et grand
              livre comptable immuable.
            </p>
          </div>
          <div>
            <p className="font-mono-tabular text-xs font-semibold text-[#881337] dark:text-amber-400">
              04
            </p>
            <h3 className="mt-1.5 text-base font-semibold text-[#1B365D] dark:text-white">
              Communion &amp; Vie Paroissiale
            </h3>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
              Messes en direct, Bible et méditations, mur de prière, messagerie fraternelle et
              gestion multi-paroisses isolée (RLS).
            </p>
          </div>
        </div>
      </section>

      {/* Asymmetric Missions & Scripture Showcase */}
      <section
        id="missions"
        className="border-t border-[#E5DED3] dark:border-slate-800 bg-[#F3EFE6] dark:bg-[#0F172A]/75 py-16 lg:py-22"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold tracking-wide text-[#881337] dark:text-amber-400">
              Charité en action sur le terrain
            </p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#1B365D] dark:text-white leading-tight text-balance">
              Des œuvres concrètes portées par toute la communauté paroissiale.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-7 space-y-4">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-[#E5DED3] dark:border-slate-800 bg-white dark:bg-slate-900">
                <ResilientImage
                  src="/src/assets/images/charitas_food_solidarity_1794525620555.jpg"
                  alt="Bénévoles de la paroisse préparant des paniers alimentaires et cahiers scolaires à Ebimpé"
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-slate-400">
                Permanence solidaire hebdomadaire — Préparation des paniers de vivres et dotations
                scolaires dans la cour paroissiale.
              </p>
            </div>

            <div className="lg:col-span-5 space-y-8">
              <blockquote className="border-y border-[#D8CFC1] dark:border-slate-800 py-6">
                <p className="font-display italic text-2xl sm:text-[1.65rem] leading-snug text-[#1B365D] dark:text-stone-100">
                  « Maintenant donc ces trois choses demeurent : la foi, l’espérance, la charité ;
                  mais la plus grande de ces choses, c’est la charité. »
                </p>
                <footer className="mt-3 text-xs font-semibold tracking-wide text-[#881337] dark:text-amber-400">
                  1 Corinthiens 13, 13
                </footer>
              </blockquote>

              <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-[#E5DED3] dark:border-slate-800 bg-white dark:bg-slate-900">
                <ResilientImage
                  src="/src/assets/images/charitas_education_health_1794525620242.jpg"
                  alt="Permanence d'alphabétisation et d'orientation médicale communautaire"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-3 text-sm text-stone-700 dark:text-slate-300">
                <div className="flex items-start gap-3">
                  <HeartHandshake className="w-4 h-4 text-[#881337] dark:text-amber-400 mt-0.5 shrink-0" />
                  <span>
                    Dossiers familiaux évalués avec dignité, priorisation équitable des besoins et
                    traçabilité complète des aides remises.
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <BookOpenCheck className="w-4 h-4 text-[#1B365D] dark:text-amber-400 mt-0.5 shrink-0" />
                  <span>
                    Vie spirituelle vivante : lectures quotidiennes, méditations, intentions de
                    prière et groupes de fraternité.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Public Parishes & Communities Directory */}
      <section
        id="eglises"
        className="border-t border-[#E5DED3] dark:border-slate-800 bg-white dark:bg-[#0B111E] py-16 lg:py-22"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#881337] dark:text-amber-400">
                Réseau paroissial &amp; multi-églises
              </p>
              <h2 className="mt-1.5 font-display text-3xl sm:text-4xl font-semibold text-[#1B365D] dark:text-white">
                Paroisse &amp; Communautés actives
              </h2>
              <p className="mt-2 text-sm sm:text-base text-stone-600 dark:text-slate-400 max-w-2xl">
                Rejoignez Charitas — Église Saint Louis Roi d’Ebimpé ou connectez votre propre
                paroisse dans un espace strictement souverain.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="text-sm font-semibold text-[#881337] dark:text-amber-400 hover:underline whitespace-nowrap cursor-pointer"
            >
              Inscrire une nouvelle paroisse
            </button>
          </div>

          {loadingChurches ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-72 rounded-2xl border border-[#E5DED3] dark:border-slate-800 bg-[#FAF7F2] dark:bg-slate-900 animate-pulse"
                />
              ))}
            </div>
          ) : churches.length === 0 ? (
            <div className="rounded-2xl border border-[#E5DED3] dark:border-slate-800 p-8 text-center">
              <p className="text-sm text-stone-600 dark:text-slate-400">
                Aucune communauté publique enregistrée pour le moment. Créez le premier espace.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {churches.map((church) => (
                <article
                  key={church.id}
                  className="rounded-2xl border border-[#E5DED3] dark:border-slate-800 bg-[#FAF7F2] dark:bg-[#111827] overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="h-48 relative bg-[#EFE9DF] dark:bg-slate-800">
                    <ResilientImage
                      src={church.bannerUrl}
                      alt={church.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B111E]/85 via-[#0B111E]/35 to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5 flex items-end gap-3.5">
                      <div className="w-13 h-13 rounded-xl overflow-hidden border border-white/40 bg-white shrink-0 shadow-sm">
                        <ResilientImage
                          src={church.logoUrl}
                          alt={`Emblème ${church.name}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-xl sm:text-2xl font-semibold text-white truncate">
                          {church.name}
                        </h3>
                        <p className="text-xs text-stone-200 truncate">
                          {[church.city, church.country, church.denomination]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 flex-1 flex flex-col justify-between gap-5">
                    <div>
                      <p className="text-sm text-stone-700 dark:text-slate-300 leading-relaxed">
                        {church.description || church.tagline}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-stone-500 dark:text-slate-400 font-mono-tabular">
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {church.membersCount} membres
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{church.departmentsCount} départements</span>
                        <span aria-hidden="true">·</span>
                        <span>Devise {church.currency}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#E5DED3] dark:border-slate-800 flex items-center justify-between gap-4">
                      <span className="text-xs text-stone-600 dark:text-slate-400 truncate">
                        {church.serviceSchedule?.[0]
                          ? `${church.serviceSchedule[0].day} ${church.serviceSchedule[0].time} — ${church.serviceSchedule[0].title}`
                          : 'Messes & permanences hebdomadaires'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenAuth('register', { churchId: church.id })}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer transition-opacity hover:opacity-90"
                        style={{ backgroundColor: church.primaryColor || '#1B365D' }}
                      >
                        Rejoindre
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Financial Transparency, Governance & Daily Solidarity */}
      <section
        id="transparence"
        className="border-t border-[#E5DED3] dark:border-slate-800 max-w-7xl mx-auto px-6 py-16 lg:py-22"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6">
            <p className="text-xs font-semibold tracking-wide text-[#881337] dark:text-amber-400">
              Gouvernance &amp; Intégrité
            </p>
            <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-[#1B365D] dark:text-white text-balance">
              Conçue pour la confiance des fidèles, donateurs et responsables.
            </h2>
            <p className="mt-4 text-base text-stone-600 dark:text-slate-300 leading-relaxed">
              Chaque paroisse conserve une autonomie complète sur ses membres, ses départements, ses
              collectes et ses œuvres sociales. Les écritures financières sont enregistrées dans un
              journal immuable afin que chaque franc offert serve fidèlement sa mission.
            </p>

            <ul className="mt-7 space-y-3.5 text-sm text-stone-700 dark:text-slate-300">
              <li className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#1B365D] dark:text-amber-400 mt-0.5 shrink-0" />
                <span>
                  11 rôles ecclésiaux et caritatifs granulaires avec isolation PostgreSQL Row Level
                  Security (RLS) par paroisse.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <HandCoins className="w-4 h-4 text-[#881337] dark:text-amber-400 mt-0.5 shrink-0" />
                <span>
                  Dons ponctuels ou récurrents, campagnes solidaires, ventes aux enchères et
                  marketplace caritative intégrés.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  Suivi des visiteurs, présence aux événements par QR code, et rapports
                  d’intervention avec justificatifs vérifiés.
                </span>
              </li>
            </ul>
          </div>

          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[#E5DED3] dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
              <p className="font-mono-tabular text-xs font-semibold text-[#881337] dark:text-amber-400">
                COTISATIONS &amp; DONS
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-[#1B365D] dark:text-white">
                Mobile Money &amp; Espèces
              </h3>
              <p className="mt-2 text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
                Orange Money, MTN Mobile Money, Moov Money, Wave, cartes bancaires et quêtes
                enregistrées par les trésoriers habilités.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5DED3] dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
              <p className="font-mono-tabular text-xs font-semibold text-[#881337] dark:text-amber-400">
                VIE COMMUNAUTAIRE
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-[#1B365D] dark:text-white">
                Réseau &amp; Messagerie
              </h3>
              <p className="mt-2 text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
                Fil d’actualité paroissial, stories, vidéos courtes, discussions de groupe par
                mouvement et notifications en temps réel.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5DED3] dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
              <p className="font-mono-tabular text-xs font-semibold text-[#881337] dark:text-amber-400">
                FORMATION &amp; MÉDIA
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-[#1B365D] dark:text-white">
                Catéchèse &amp; Directs
              </h3>
              <p className="mt-2 text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
                Retransmissions des célébrations, homélies audio/vidéo, parcours de formation et
                quiz bibliques.
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5DED3] dark:border-slate-800 bg-white dark:bg-[#111827] p-6">
              <p className="font-mono-tabular text-xs font-semibold text-[#881337] dark:text-amber-400">
                AUDIT &amp; SÉCURITÉ
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold text-[#1B365D] dark:text-white">
                Registre Immuable
              </h3>
              <p className="mt-2 text-sm text-stone-600 dark:text-slate-400 leading-relaxed">
                Journalisation de chaque attribution de rôle, validation d’aide humanitaire et
                décaissement financier.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Join with Invitation Code */}
      <section
        id="invitation"
        className="border-t border-[#E5DED3] dark:border-slate-800 bg-[#F3EFE6] dark:bg-[#0F172A]/75 py-16"
      >
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold tracking-wide text-[#881337] dark:text-amber-400">
            Intégration paroissiale
          </p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-semibold text-[#1B365D] dark:text-white">
            Vous avez reçu un code d’invitation ?
          </h2>
          <p className="mt-2 text-sm sm:text-base text-stone-600 dark:text-slate-400">
            Saisissez votre code pour rejoindre Charitas — Église Saint Louis Roi d’Ebimpé ou votre
            assemblée avec votre rôle attribué.
          </p>
          <form
            onSubmit={handleInviteSubmit}
            className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto"
          >
            <input
              type="text"
              value={inviteCodeInput}
              onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
              placeholder="Ex. SLR-4F8A12C0"
              className="w-full sm:flex-1 h-11 px-4 rounded-lg border border-[#D8CFC1] dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-tabular text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-amber-500"
            />
            <button
              type="submit"
              className="w-full sm:w-auto h-11 px-5 rounded-lg bg-[#1B365D] text-white hover:bg-[#132744] dark:bg-amber-600 dark:hover:bg-amber-500 text-sm font-semibold whitespace-nowrap cursor-pointer transition-colors"
            >
              Utiliser le code
            </button>
          </form>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-[#E5DED3] dark:border-slate-800 bg-[#FAF7F2] dark:bg-[#0B111E] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-600 dark:text-slate-400">
          <span>Charitas — Église Saint Louis Roi d’Ebimpé · Côte d’Ivoire</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onToggleTheme}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D8CFC1] dark:border-slate-800 bg-white/60 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800 text-stone-700 dark:text-slate-300 cursor-pointer transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-[#1B365D] dark:hover:text-white cursor-pointer"
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="hover:text-[#1B365D] dark:hover:text-white cursor-pointer"
            >
              Inscription
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
