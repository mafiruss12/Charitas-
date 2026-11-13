import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  HandCoins,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Newspaper,
  Phone,
  Quote,
  Share2,
  Sun,
  Users,
  X,
} from 'lucide-react';
import type {
  PublicFeaturedChurch,
  PublicShowcaseResponse,
  ThemeMode,
} from '../../types/platform';
import { ResilientImage } from '../ResilientImage';
import { ChariteLogoMark } from './ChariteLogoMark';
import type { ExplorerTab } from './PublicCommunityExplorer';

interface LandingShowcaseSectionsProps {
  showcase: PublicShowcaseResponse | null;
  loading: boolean;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenAuth: (mode: 'login' | 'register', prefill?: { churchId?: number; inviteCode?: string }) => void;
  onOpenExplorer: (tab: ExplorerTab) => void;
  onOpenTv?: () => void;
}

function formatShortDate(dateValue: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(dateValue));
  } catch {
    return dateValue;
  }
}

function formatMoney(amount: number, currency: string): string {
  return `${new Intl.NumberFormat('fr-FR').format(amount)} ${currency}`;
}

export const LandingShowcaseSections: React.FC<LandingShowcaseSectionsProps> = ({
  showcase,
  loading,
  theme,
  onToggleTheme,
  onOpenAuth,
  onOpenExplorer,
  onOpenTv,
}) => {
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [supportOpen, setSupportOpen] = useState(false);

  const featured: PublicFeaturedChurch | null = showcase?.featuredChurch ?? null;
  const churches = showcase?.churches ?? [];
  const latestPosts = showcase?.latestPosts ?? [];
  const upcomingEvents = showcase?.upcomingEvents ?? [];
  const activeCampaigns = showcase?.activeCampaigns ?? [];
  const humanitarianActions = showcase?.humanitarianActions ?? [];
  const testimonies = showcase?.testimonies ?? [];

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCodeInput.trim()) {
      onOpenAuth('register', { inviteCode: inviteCodeInput.trim().toUpperCase() });
    }
  };

  return (
    <>
      {/* Dernières actualités & Publications récentes */}
      <section
        id="actualites"
        className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0F172A]/60 py-16 lg:py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8] dark:text-[#60A5FA]">
                Vie communautaire en temps réel
              </p>
              <h2 className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-[#061A40] dark:text-white">
                Actualités &amp; Publications récentes
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
                Suivez les annonces paroissiales, versets partagés et nouvelles des œuvres de
                solidarité.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onOpenExplorer('shorts')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#061A40] dark:text-[#F5B82E] hover:underline whitespace-nowrap cursor-pointer"
              >
                Vidéos courtes (9:16)
              </button>
              <button
                type="button"
                onClick={() => onOpenExplorer('feed')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap cursor-pointer"
              >
                Explorer le fil complet
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
                />
              ))}
            </div>
          ) : latestPosts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#1D4ED8] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
                  <Newspaper className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#061A40] dark:text-white">
                    Aucune publication publique enregistrée pour l’instant
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Connectez-vous à votre espace membre pour partager les premières actualités,
                    annonces et méditations de la communauté.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth('register', featured ? { churchId: featured.id } : undefined)}
                className="px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Participer au fil
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {latestPosts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-[#061A40] dark:text-slate-200">
                        {post.authorName}
                      </span>
                      <span className="tabular-nums">{formatShortDate(post.createdAt)}</span>
                    </div>
                    <p className="mt-3 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-4">
                      {post.content}
                    </p>
                    {post.mediaUrl && (
                      <div className="mt-4 h-44 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <ResilientImage
                          src={post.mediaUrl}
                          alt={`Illustration de ${post.authorName}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="tabular-nums">
                      {post.likesCount} réactions · {post.commentsCount} commentaires
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login', { churchId: post.churchId })}
                      className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                    >
                      Réagir &amp; commenter
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Prochains événements & Programmes */}
      <section
        id="evenements"
        className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0B111E] py-16 lg:py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8] dark:text-[#60A5FA]">
                Agenda &amp; Rencontres
              </p>
              <h2 className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-[#061A40] dark:text-white">
                Prochains événements &amp; Célébrations
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {onOpenTv && (
                <button
                  type="button"
                  onClick={onOpenTv}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#061A40] dark:text-[#F5B82E] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Ouvrir CHARITAS TV
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenExplorer('events')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap cursor-pointer"
              >
                Calendrier &amp; directs en ligne
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7">
              {upcomingEvents.length === 0 ? (
                <div className="h-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#111827] p-7 flex flex-col justify-between gap-4">
                  <div>
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-[#061A40] dark:text-white">
                      Aucun événement ponctuel planifié actuellement
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                      Les conférences, veillées et retransmissions en direct publiées par les
                      responsables apparaîtront automatiquement ici.
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenAuth('login', featured ? { churchId: featured.id } : undefined)
                      }
                      className="px-4 py-2.5 rounded-xl bg-[#061A40] dark:bg-[#1D4ED8] text-white text-xs font-semibold cursor-pointer"
                    >
                      Proposer ou consulter l’agenda
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {upcomingEvents.map((ev) => (
                    <article
                      key={ev.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#111827] p-5 flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                            {formatShortDate(ev.startsAt)}
                          </span>
                          {ev.isLive && (
                            <span className="font-semibold text-rose-600 dark:text-rose-400">
                              En direct
                            </span>
                          )}
                        </div>
                        <h3 className="mt-2 text-base font-bold text-[#061A40] dark:text-white">
                          {ev.title}
                        </h3>
                        {ev.description && (
                          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                            {ev.description}
                          </p>
                        )}
                      </div>
                      <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500 dark:text-slate-400 truncate">
                          {ev.location || 'Paroisse'} · {ev.registrationsCount} inscrits
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenAuth('register', { churchId: ev.churchId })}
                          className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline whitespace-nowrap cursor-pointer"
                        >
                          Participer
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {/* Programme hebdomadaire réel de l'église */}
            <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#061A40] text-white p-6 sm:p-7 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-[#F5B82E]">
                  Programme régulier de la paroisse
                </p>
                <h3 className="mt-1.5 text-xl font-bold">
                  {featured?.name || 'CHARITAS — Église Saint Louis Roi d’Ebimpé'}
                </h3>
                <div className="mt-5 space-y-3.5">
                  {(featured?.serviceSchedule || []).length > 0 ? (
                    featured!.serviceSchedule.map((item, idx) => (
                      <div
                        key={idx}
                        className="pb-3 border-b border-white/10 last:border-b-0 last:pb-0 flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{item.title}</p>
                          <p className="text-xs text-blue-200/80">
                            {item.location || featured?.city || 'Sanctuaire'}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-[#F5B82E] whitespace-nowrap tabular-nums">
                          {item.day} · {item.time}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-blue-100/85">
                      Consultez les horaires des cultes et célébrations depuis votre espace.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenAuth('register', featured ? { churchId: featured.id } : undefined)
                }
                className="mt-6 w-full h-11 rounded-xl bg-[#F5B82E] hover:bg-[#FACC15] text-[#061A40] text-sm font-semibold cursor-pointer transition-colors"
              >
                Rejoindre l’assemblée
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Actions caritatives, Dons & Appel aux bénévoles */}
      <section
        id="nos-actions"
        className="border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-[#0F172A]/60 py-16 lg:py-20"
      >
        <div id="dons" className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-semibold tracking-wide text-[#1D4ED8] dark:text-[#60A5FA]">
                Solidarité &amp; Transparence
              </p>
              <h2 className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-[#061A40] dark:text-white">
                Actions caritatives &amp; Appel aux bénévoles
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
                Soutenez concrètement les familles vulnérables, participez aux collectes ou
                engagez-vous sur le terrain avec l’équipe bénévole.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenAuth('login', featured ? { churchId: featured.id } : undefined)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <HandCoins className="w-4 h-4" />
              Faire un don sécurisé
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Campagnes & Rapports réels */}
            <div className="lg:col-span-8 space-y-6">
              {activeCampaigns.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {activeCampaigns.map((camp) => {
                    const pct = Math.min(
                      100,
                      Math.round((camp.collectedAmount / Math.max(1, camp.goalAmount)) * 100)
                    );
                    return (
                      <div
                        key={camp.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 flex flex-col justify-between gap-4"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                            {camp.fundCategory === 'humanitarian'
                              ? 'Action humanitaire'
                              : 'Vie paroissiale'}
                          </p>
                          <h3 className="mt-1.5 text-lg font-bold text-[#061A40] dark:text-white">
                            {camp.title}
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                            {camp.description}
                          </p>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums mb-1.5">
                            <span>{formatMoney(camp.collectedAmount, camp.currency)}</span>
                            <span>Objectif : {formatMoney(camp.goalAmount, camp.currency)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#1D4ED8] to-[#F5B82E]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenAuth('login', { churchId: camp.churchId })}
                            className="mt-4 w-full h-10 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-[#061A40] dark:text-white cursor-pointer"
                          >
                            Contribuer à cette campagne
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {humanitarianActions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {humanitarianActions.map((rep) => (
                    <article
                      key={rep.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden flex flex-col"
                    >
                      {rep.photoUrl && (
                        <div className="h-40">
                          <ResilientImage
                            src={rep.photoUrl}
                            alt={rep.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                            {rep.beneficiariesHelped} bénéficiaires accompagnés ·{' '}
                            {formatShortDate(rep.publishedAt)}
                          </p>
                          <h3 className="mt-1 text-base font-bold text-[#061A40] dark:text-white">
                            {rep.title}
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                            {rep.summary}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                activeCampaigns.length === 0 && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-7 flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-full sm:w-48 h-36 rounded-xl overflow-hidden shrink-0">
                      <ResilientImage
                        src="/src/assets/images/charitas_food_solidarity_1794525620555.jpg"
                        alt="Préparation d'actions solidaires à la paroisse"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#061A40] dark:text-white">
                        Permanence CHARITAS &amp; Collectes solidaires
                      </h3>
                      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                        Les campagnes de financement participatif et les bilans d’intervention
                        humanitaire créés par les responsables s’affichent ici en toute
                        transparence (sans exposer les données personnelles des bénéficiaires).
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAuth('login', featured ? { churchId: featured.id } : undefined)
                        }
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                      >
                        Accéder au module Dons &amp; Solidarité
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Appel aux bénévoles */}
            <aside className="lg:col-span-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-gradient-to-br from-[#061A40] via-[#0E3278] to-[#1D4ED8] text-white p-6 sm:p-7 flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
                  <HeartHandshake className="w-5 h-5 text-[#F5B82E]" />
                </div>
                <h3 className="mt-4 text-2xl font-bold">Appel aux bénévoles</h3>
                <p className="mt-2 text-sm text-blue-100/90 leading-relaxed">
                  Donnez de votre temps pour les visites aux malades, la distribution alimentaire,
                  l’accueil des familles ou l’accompagnement scolaire.
                </p>
                <p className="mt-4 text-xs font-medium text-[#F5B82E] tabular-nums">
                  {showcase?.openVolunteerMissionsCount
                    ? `${showcase.openVolunteerMissionsCount} missions de terrain planifiées`
                    : 'Équipes d’entraide ouvertes aux nouveaux volontaires'}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenAuth('register', featured ? { churchId: featured.id } : undefined)
                }
                className="mt-6 w-full h-11 rounded-xl bg-gradient-to-r from-[#F5B82E] to-[#E5A015] hover:from-[#FACC15] hover:to-[#F5B82E] text-[#061A40] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                Devenir bénévole
                <ArrowRight className="w-4 h-4" />
              </button>
            </aside>
          </div>
        </div>
      </section>

      {/* Témoignages & Communautés */}
      <section
        id="temoignages"
        className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0B111E] py-16 lg:py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
          {/* Témoignages réels */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-semibold tracking-wide text-[#1D4ED8] dark:text-[#60A5FA]">
                  Foi &amp; Reconnaissance
                </p>
                <h2 className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-[#061A40] dark:text-white">
                  Témoignages de la communauté
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenAuth('login', featured ? { churchId: featured.id } : undefined)
                }
                className="text-sm font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
              >
                Partager un témoignage
              </button>
            </div>

            {testimonies.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#111827] p-7 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <Quote className="w-5 h-5 text-[#1D4ED8] dark:text-[#60A5FA] mt-0.5 shrink-0" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Aucun témoignage publié pour le moment. Les membres connectés peuvent partager
                    leurs actions de grâce et expériences fraternelles depuis l’espace Vie
                    spirituelle.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenAuth('register', featured ? { churchId: featured.id } : undefined)
                  }
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-[#061A40] dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Rejoindre l’espace
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {testimonies.map((t) => (
                  <blockquote
                    key={t.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#111827] p-6 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <h3 className="text-base font-bold text-[#061A40] dark:text-white">
                        {t.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        « {t.content} »
                      </p>
                    </div>
                    <footer className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {t.authorName} · {formatShortDate(t.createdAt)}
                    </footer>
                  </blockquote>
                ))}
              </div>
            )}
          </div>

          {/* Paroisses actives & Code d'invitation */}
          <div id="communaute" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-5">
              <h3 className="text-2xl font-bold text-[#061A40] dark:text-white">
                Paroisses &amp; Communautés connectées
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {churches.map((church) => (
                  <article
                    key={church.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#111827] overflow-hidden flex flex-col"
                  >
                    <div className="h-36 relative">
                      <ResilientImage
                        src={church.bannerUrl}
                        alt={church.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#061A40]/85 via-[#061A40]/30 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4 flex items-center gap-3">
                        <ChariteLogoMark
                          logoUrl={church.logoUrl}
                          churchName={church.name}
                          sizeClass="w-10 h-10"
                        />
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{church.name}</h4>
                          <p className="text-[11px] text-blue-100 truncate">
                            {[church.city, church.country].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {church.tagline || church.description}
                      </p>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-800 text-xs">
                        <span className="text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 tabular-nums">
                          <Users className="w-3.5 h-3.5" />
                          {church.membersCount} membres
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenAuth('register', { churchId: church.id })}
                          className="font-semibold text-[#1D4ED8] dark:text-[#60A5FA] hover:underline cursor-pointer"
                        >
                          Rejoindre
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#111827] p-6 sm:p-7">
              <p className="text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">
                Code d’invitation
              </p>
              <h3 className="mt-1.5 text-xl font-bold text-[#061A40] dark:text-white">
                Rejoindre directement votre groupe
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Vous avez reçu un code d’invitation d’un responsable ? Saisissez-le pour intégrer
                votre église avec votre rôle attribué.
              </p>
              <form onSubmit={handleInviteSubmit} className="mt-5 flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={inviteCodeInput}
                  onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                  placeholder="Ex. SLR-4F8A12C0"
                  aria-label="Code d'invitation"
                  className="flex-1 h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
                <button
                  type="submit"
                  className="h-11 px-5 rounded-xl bg-[#061A40] hover:bg-[#0D2E6E] dark:bg-[#1D4ED8] text-white text-sm font-semibold whitespace-nowrap cursor-pointer"
                >
                  Valider
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Pied de page professionnel */}
      <footer className="bg-[#051330] text-slate-300 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/10">
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <ChariteLogoMark
                  logoUrl={featured?.logoUrl}
                  churchName={featured?.name || 'CHARITAS — Église Saint Louis Roi d’Ebimpé'}
                  sizeClass="w-10 h-10"
                />
                <div>
                  <p className="text-base sm:text-lg font-bold text-white">
                    CHARITAS — Église Saint Louis Roi d’Ebimpé
                  </p>
                  <p className="text-xs text-blue-200/80">
                    {featured?.tagline || 'Plateforme chrétienne, communautaire et solidaire'}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-400 max-w-md leading-relaxed">
                {featured?.description ||
                  'Plateforme chrétienne communautaire pour partager la foi, organiser les événements et coordonner les actions de charité.'}
              </p>
            </div>

            <div className="md:col-span-3 space-y-2.5 text-sm">
              <p className="font-semibold text-white">Navigation</p>
              <ul className="space-y-2 text-slate-400">
                <li>
                  <a href="#a-propos" className="hover:text-white transition-colors">
                    À propos &amp; Mission
                  </a>
                </li>
                <li>
                  <a href="#nos-actions" className="hover:text-white transition-colors">
                    Nos actions solidaires
                  </a>
                </li>
                <li>
                  <a href="#actualites" className="hover:text-white transition-colors">
                    Actualités
                  </a>
                </li>
                <li>
                  <a href="#evenements" className="hover:text-white transition-colors">
                    Événements
                  </a>
                </li>
                {onOpenTv && (
                  <li>
                    <button
                      type="button"
                      onClick={onOpenTv}
                      className="text-[#F5B82E] hover:underline transition-colors cursor-pointer"
                    >
                      CHARITAS TV &amp; Directs
                    </button>
                  </li>
                )}
              </ul>
            </div>

            <div className="md:col-span-4 space-y-2.5 text-sm">
              <p className="font-semibold text-white">Coordonnées &amp; Contact</p>
              <ul className="space-y-2 text-slate-400">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#F5B82E] mt-0.5 shrink-0" />
                  <span>
                    {[featured?.address, featured?.city, featured?.country]
                      .filter(Boolean)
                      .join(', ') || "Ebimpé, Abidjan, Côte d'Ivoire"}
                  </span>
                </li>
                {featured?.phone && (
                  <li className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-[#F5B82E] shrink-0" />
                    <span>{featured.phone}</span>
                  </li>
                )}
                {featured?.email && (
                  <li className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#F5B82E] shrink-0" />
                    <span>{featured.email}</span>
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[#F5B82E] shrink-0" />
                  <span>Communauté CHARITAS · Facebook, WhatsApp &amp; YouTube paroissial</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <span>
              © {new Date().getFullYear()} {featured?.name || 'CHARITAS — Église Saint Louis Roi d’Ebimpé'} — Tous droits réservés.
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer"
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5 text-[#F5B82E]" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
                {theme === 'dark' ? 'Thème clair' : 'Thème sombre'}
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="hover:text-white cursor-pointer"
              >
                Connexion
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="text-[#F5B82E] hover:underline cursor-pointer"
              >
                S'inscrire
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Bouton flottant de contact / assistance */}
      <div className="fixed bottom-5 right-5 z-40">
        {supportOpen && (
          <div className="mb-3 w-80 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] shadow-2xl p-5 text-slate-800 dark:text-slate-100">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="text-sm font-bold text-[#061A40] dark:text-white">
                Accueil — CHARITAS · Église Saint Louis Roi d’Ebimpé
              </span>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Fermer la fenêtre d'assistance"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Besoin d’un renseignement paroissial, d’une intention de prière ou d’annoncer votre
              première visite ?
            </p>
            <div className="mt-3 space-y-2 text-xs">
              {featured?.phone && (
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  Secrétariat : {featured.phone}
                </p>
              )}
              {featured?.email && (
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  Email : {featured.email}
                </p>
              )}
            </div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setSupportOpen(false);
                  onOpenExplorer('visitor');
                }}
                className="w-full h-9 rounded-xl bg-[#F5B82E] hover:bg-[#FACC15] text-[#061A40] text-xs font-semibold cursor-pointer"
              >
                Envoyer un message / Intention de prière
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSupportOpen(false);
                    onOpenAuth('login', featured ? { churchId: featured.id } : undefined);
                  }}
                  className="h-9 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Se connecter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSupportOpen(false);
                    onOpenAuth('register', featured ? { churchId: featured.id } : undefined);
                  }}
                  className="h-9 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-semibold cursor-pointer"
                >
                  Nous rejoindre
                </button>
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setSupportOpen((v) => !v)}
          className="w-13 h-13 rounded-full bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white shadow-[0_10px_28px_-4px_rgba(29,78,216,0.6)] flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
          aria-label="Contacter l'assistance CHARITAS"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>
    </>
  );
};
