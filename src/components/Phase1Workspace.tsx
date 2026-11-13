import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  FolderKanban,
  Gavel,
  Globe2,
  GraduationCap,
  HandCoins,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  MailPlus,
  Menu,
  MessageCircle,
  Moon,
  Palette,
  Plus,
  Share2,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tv,
  UserCheck,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../db/rbac';
import { apiFetch } from '../lib/api';
import type { DashboardResponse, NotificationItem } from '../types/platform';
import { CreateChurchModal, JoinChurchModal } from './ChurchModals';
import { PWAInstallButton } from './PWAInstallButton';
import { ResilientImage } from './ResilientImage';
import { DepartmentsPanel, MembersPanel } from './phase1/MembersDepartmentsPanels';
import {
  AuditLogsPanel,
  BrandingSettingsPanel,
  ProfilePanel,
  RolesPermissionsPanel,
} from './phase1/RolesBrandingAuditPanels';
import { InvitationsPanel, VisitorsPanel } from './phase1/VisitorsInvitesPanels';
import { EventsPanel } from './phase2/EventsPanel';
import { MessagingPanel } from './phase2/MessagingPanel';
import { SocialPanel } from './phase2/SocialPanel';
import { SpiritualPanel } from './phase2/SpiritualPanel';
import { DonationsPanel } from './phase3/DonationsPanel';
import { HumanitarianPanel } from './phase3/HumanitarianPanel';
import { MarketplacePanel } from './phase4/MarketplacePanel';
import { AuctionsPanel } from './phase4/AuctionsPanel';
import { AcademyMediaPanel } from './phase4/AcademyMediaPanel';
import { AiAssistantPanel } from './phase4/AiAssistantPanel';
import { SuperAdminPanel } from './phase5/SuperAdminPanel';
import { ChariteTvHub } from './tv/ChariteTvHub';
import { ChariteTvAdminPanel } from './tv/ChariteTvAdminPanel';

type WorkspaceTab =
  | 'dashboard'
  | 'tv'
  | 'tv_admin'
  | 'social'
  | 'messaging'
  | 'spiritual'
  | 'events'
  | 'donations'
  | 'humanitarian'
  | 'marketplace'
  | 'auctions'
  | 'academy'
  | 'ai'
  | 'members'
  | 'departments'
  | 'visitors'
  | 'invitations'
  | 'roles'
  | 'branding'
  | 'audit'
  | 'superadmin'
  | 'profile';

export const Phase1Workspace: React.FC = () => {
  const {
    user,
    memberships,
    activeChurchId,
    activeMembership,
    setActiveChurchId,
    theme,
    setTheme,
    logout,
    refreshProfile,
    hasPermission,
  } = useAuth();

  const [tab, setTab] = useState<WorkspaceTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadingDash, setLoadingDash] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!activeChurchId) {
      setDashboard(null);
      return;
    }
    setLoadingDash(true);
    setDashError(null);
    try {
      const [data, notifRes] = await Promise.all([
        apiFetch<DashboardResponse>(`/api/churches/${activeChurchId}/dashboard`),
        apiFetch<{ notifications: NotificationItem[] }>(
          `/api/churches/${activeChurchId}/notifications`
        ),
      ]);
      setDashboard(data);
      setNotificationsList(notifRes.notifications);
    } catch (err: unknown) {
      setDashError(err instanceof Error ? err.message : 'Erreur lors du chargement.');
    } finally {
      setLoadingDash(false);
    }
  }, [activeChurchId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const markAllNotificationsRead = async () => {
    if (!activeChurchId) return;
    await apiFetch(`/api/churches/${activeChurchId}/notifications/read-all`, { method: 'POST' });
    setNotificationsList((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const handleSwitchSuccess = async (newChurchId: number) => {
    await refreshProfile();
    setActiveChurchId(newChurchId);
    setTab('dashboard');
  };

  // Empty state: User signed in but has no church yet
  if (!activeMembership && memberships.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0B111E] text-stone-900 dark:text-stone-100">
        <header className="border-b border-[#E5DED3] dark:border-slate-800 bg-white dark:bg-[#111827] px-6 h-16 flex items-center justify-between">
          <div className="inline-flex items-center gap-3">
            <img
              src="/src/assets/images/charitas_emblem_crest_1794525619241.jpg"
              alt="Emblème CHARITAS — Église Saint Louis Roi d’Ebimpé"
              className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
            />
            <span className="font-display text-lg sm:text-xl font-bold text-[#061A40] dark:text-white truncate max-w-[260px] sm:max-w-none">
              CHARITAS — Église Saint Louis Roi d’Ebimpé
            </span>
          </div>
          <div className="flex items-center gap-3">
            <PWAInstallButton variant="workspace" />
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg border border-[#D8CFC1] dark:border-slate-700 cursor-pointer"
              aria-label="Changer de thème"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D8CFC1] dark:border-slate-700 text-xs font-medium cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Déconnexion
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-xs font-semibold text-[#881337] dark:text-amber-400">
            Bienvenue sur CHARITAS, {user?.fullName}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-[#1B365D] dark:text-white text-balance">
            Rejoignez CHARITAS — Église Saint Louis Roi d’Ebimpé ou créez votre paroisse.
          </h1>
          <p className="mt-4 text-base text-stone-600 dark:text-slate-400">
            Vous n’êtes encore rattaché à aucune communauté. Choisissez une option ci-dessous pour
            commencer.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="px-6 py-3 rounded-lg bg-[#1B365D] text-white hover:bg-[#132744] dark:bg-amber-600 dark:hover:bg-amber-500 text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Créer une église
            </button>
            <button
              type="button"
              onClick={() => setJoinModalOpen(true)}
              className="px-6 py-3 rounded-lg border border-[#D8CFC1] dark:border-slate-700 text-sm font-semibold hover:bg-white dark:hover:bg-slate-900 cursor-pointer"
            >
              Rejoindre une église ou utiliser un code
            </button>
          </div>
        </main>

        <CreateChurchModal
          open={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreated={handleSwitchSuccess}
        />
        <JoinChurchModal
          open={joinModalOpen}
          onClose={() => setJoinModalOpen(false)}
          onJoined={handleSwitchSuccess}
        />
      </div>
    );
  }

  const mods = dashboard?.church.enabledModules || activeMembership?.enabledModules;
  const navItems: { id: WorkspaceTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: <LayoutDashboard className="w-4 h-4" />,
      visible: hasPermission('church.view'),
    },
    {
      id: 'tv',
      label: 'CHARITAS TV & Live',
      icon: <Tv className="w-4 h-4" />,
      visible: hasPermission('church.view'),
    },
    {
      id: 'tv_admin',
      label: 'Régie CHARITAS TV',
      icon: <SlidersHorizontal className="w-4 h-4" />,
      visible: hasPermission('streams.manage'),
    },
    {
      id: 'social',
      label: 'Réseau social',
      icon: <Share2 className="w-4 h-4" />,
      visible: hasPermission('social.view') && (mods?.social ?? true),
    },
    {
      id: 'messaging',
      label: 'Messagerie',
      icon: <MessageCircle className="w-4 h-4" />,
      visible: hasPermission('messaging.access') && (mods?.messaging ?? true),
    },
    {
      id: 'spiritual',
      label: 'Vie spirituelle',
      icon: <BookOpen className="w-4 h-4" />,
      visible: hasPermission('spiritual.view') && (mods?.spiritual ?? true),
    },
    {
      id: 'events',
      label: 'Événements & Directs',
      icon: <Calendar className="w-4 h-4" />,
      visible: hasPermission('church.view'),
    },
    {
      id: 'donations',
      label: 'Dons & Finances',
      icon: <HandCoins className="w-4 h-4" />,
      visible: hasPermission('donations.view') && (mods?.donations ?? true),
    },
    {
      id: 'humanitarian',
      label: 'Œuvres Humanitaires',
      icon: <HeartHandshake className="w-4 h-4" />,
      visible: hasPermission('humanitarian.view') && (mods?.humanitarian ?? true),
    },
    {
      id: 'marketplace',
      label: 'Marketplace Solidaire',
      icon: <ShoppingBag className="w-4 h-4" />,
      visible: hasPermission('church.view') && (mods?.marketplace ?? true),
    },
    {
      id: 'auctions',
      label: 'Enchères Solidaires',
      icon: <Gavel className="w-4 h-4" />,
      visible: hasPermission('church.view') && (mods?.auctions ?? true),
    },
    {
      id: 'academy',
      label: 'Académie & Média',
      icon: <GraduationCap className="w-4 h-4" />,
      visible: hasPermission('church.view') && (mods?.academy ?? true),
    },
    {
      id: 'ai',
      label: 'Assistant IA',
      icon: <Sparkles className="w-4 h-4" />,
      visible: hasPermission('ai.use'),
    },
    {
      id: 'members',
      label: 'Membres & Leaders',
      icon: <Users className="w-4 h-4" />,
      visible: hasPermission('members.view'),
    },
    {
      id: 'departments',
      label: 'Départements',
      icon: <FolderKanban className="w-4 h-4" />,
      visible: hasPermission('church.view'),
    },
    {
      id: 'visitors',
      label: 'Visiteurs',
      icon: <UserCheck className="w-4 h-4" />,
      visible: hasPermission('visitors.view'),
    },
    {
      id: 'invitations',
      label: 'Invitations',
      icon: <MailPlus className="w-4 h-4" />,
      visible: hasPermission('invitations.manage'),
    },
    {
      id: 'roles',
      label: 'Rôles & Droits',
      icon: <Shield className="w-4 h-4" />,
      visible: hasPermission('church.view'),
    },
    {
      id: 'branding',
      label: 'Identité & Paramètres',
      icon: <Palette className="w-4 h-4" />,
      visible: hasPermission('church.branding'),
    },
    {
      id: 'audit',
      label: "Journal d'audit",
      icon: <Activity className="w-4 h-4" />,
      visible: hasPermission('audit.view'),
    },
    {
      id: 'superadmin',
      label: 'Console Centrale SaaS',
      icon: <Globe2 className="w-4 h-4" />,
      visible: Boolean(user?.isPlatformSuperAdmin),
    },
    {
      id: 'profile',
      label: 'Mon profil',
      icon: <UserCircle className="w-4 h-4" />,
      visible: true,
    },
  ];

  const primaryColor = dashboard?.church.primaryColor || activeMembership?.churchPrimaryColor || '#1B365D';

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0B111E] text-stone-900 dark:text-stone-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col border-r border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="p-5 border-b border-stone-200 dark:border-slate-800">
          <div className="mb-3 pb-2.5 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold tracking-[0.14em] text-[#061A40] dark:text-[#F5B82E] uppercase">
              CHARITAS
            </span>
            <span className="text-[10px] font-medium text-stone-500 dark:text-slate-400 truncate">
              Église Saint Louis Roi d’Ebimpé
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-stone-200 dark:border-slate-700 shrink-0">
              <ResilientImage
                src={dashboard?.church.logoUrl || activeMembership?.churchLogoUrl}
                alt="Logo CHARITAS"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                {dashboard?.church.name || activeMembership?.churchName}
              </p>
              <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                {ROLE_LABELS[(activeMembership?.role || 'member') as keyof typeof ROLE_LABELS] ||
                  activeMembership?.role}
              </p>
            </div>
          </div>

          {/* Multi-tenant Church Switcher */}
          <div className="mt-4 space-y-2">
            <select
              value={activeChurchId ?? ''}
              onChange={(e) => {
                setActiveChurchId(Number(e.target.value));
                setTab('dashboard');
              }}
              aria-label="Changer d'église"
              className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-medium text-stone-900 dark:text-white"
            >
              {memberships.map((m) => (
                <option key={m.churchId} value={m.churchId}>
                  {m.churchName}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateModalOpen(true)}
                className="h-9 px-2.5 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium hover:bg-stone-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Nouvelle
              </button>
              <button
                type="button"
                onClick={() => setJoinModalOpen(true)}
                className="h-9 px-2.5 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium hover:bg-stone-50 dark:hover:bg-slate-800 inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Rejoindre
              </button>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems
            .filter((item) => item.visible)
            .map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'text-white'
                      : 'text-stone-700 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800'
                  }`}
                  style={active ? { backgroundColor: primaryColor } : undefined}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
        </nav>

        <div className="p-4 border-t border-stone-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-stone-900 dark:text-white truncate">
              {user?.fullName}
            </p>
            <p className="text-[11px] text-stone-500 dark:text-slate-400 truncate">
              {user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-stone-200 dark:border-slate-700 cursor-pointer"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm text-stone-500 dark:text-slate-400 truncate">
              <span>{dashboard?.church.name || activeMembership?.churchName}</span>
              <span className="mx-2" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-stone-900 dark:text-white">
                {navItems.find((i) => i.id === tab)?.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 relative">
            <div className="hidden sm:block">
              <PWAInstallButton variant="workspace" />
            </div>
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative p-2 rounded-lg border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Notifications CHARITAS"
            >
              <Bell className="w-4 h-4" />
              {notificationsList.some((n) => !n.isRead) && (
                <span className="absolute -top-1 -right-1 px-1 min-w-[16px] h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {notificationsList.filter((n) => !n.isRead).length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-12 w-80 rounded-xl border border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-3 z-40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Notifications CHARITAS</span>
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-[11px] text-amber-700 dark:text-amber-400 cursor-pointer"
                  >
                    Tout marquer lu
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-slate-800">
                  {notificationsList.length === 0 ? (
                    <p className="py-4 text-center text-xs text-stone-500">Aucune notification.</p>
                  ) : (
                    notificationsList.map((n) => (
                      <div key={n.id} className={`py-2 text-xs ${n.isRead ? 'opacity-65' : 'font-medium'}`}>
                        <p className="font-semibold">{n.title}</p>
                        <p className="text-stone-500 dark:text-slate-400">{n.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg border border-stone-200 dark:border-slate-700 text-stone-700 dark:text-slate-200 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Basculer thème clair/sombre"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setTab('profile')}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <UserCircle className="w-4 h-4" />
              {user?.fullName}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {dashError && (
            <div className="mb-6 p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300">
              {dashError}
            </div>
          )}

          {tab === 'dashboard' && (
            <div className="space-y-8">
              {/* Church Banner Header */}
              <div className="rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="h-36 sm:h-44 relative bg-stone-200 dark:bg-slate-800">
                  <ResilientImage
                    src={dashboard?.church.bannerUrl || activeMembership?.churchBannerUrl}
                    alt={dashboard?.church.name || 'Bannière'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                  <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between gap-4">
                    <div>
                      <h1 className="font-display text-2xl sm:text-4xl font-semibold text-white">
                        {dashboard?.church.name || activeMembership?.churchName}
                      </h1>
                      <p className="text-xs sm:text-sm text-stone-200 mt-1">
                        {dashboard?.church.tagline ||
                          [dashboard?.church.city, dashboard?.church.country]
                            .filter(Boolean)
                            .join(' · ')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {loadingDash && !dashboard ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-500" />
                </div>
              ) : (
                dashboard && (
                  <>
                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                        <p className="text-xs text-stone-500 dark:text-slate-400">Membres actifs</p>
                        <p className="mt-2 text-3xl font-semibold font-mono-tabular text-stone-900 dark:text-white">
                          {dashboard.stats.activeMembers}
                        </p>
                        <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
                          {dashboard.stats.leadersCount} responsables désignés
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                        <p className="text-xs text-stone-500 dark:text-slate-400">Départements</p>
                        <p className="mt-2 text-3xl font-semibold font-mono-tabular text-stone-900 dark:text-white">
                          {dashboard.stats.departmentsCount}
                        </p>
                        <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
                          Pôles et ministères actifs
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                        <p className="text-xs text-stone-500 dark:text-slate-400">
                          Visiteurs enregistrés
                        </p>
                        <p className="mt-2 text-3xl font-semibold font-mono-tabular text-stone-900 dark:text-white">
                          {dashboard.stats.totalVisitors}
                        </p>
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                          {dashboard.stats.pendingVisitors} en attente de suivi
                        </p>
                      </div>
                      <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                        <p className="text-xs text-stone-500 dark:text-slate-400">
                          Invitations actives
                        </p>
                        <p className="mt-2 text-3xl font-semibold font-mono-tabular text-stone-900 dark:text-white">
                          {dashboard.stats.activeInvites}
                        </p>
                        <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
                          Devise : {dashboard.church.currency}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Service Schedule & Role Breakdown */}
                      <div className="lg:col-span-6 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
                        <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                          Programme des cultes
                        </h3>
                        {dashboard.church.serviceSchedule?.length ? (
                          <div className="divide-y divide-stone-100 dark:divide-slate-800">
                            {dashboard.church.serviceSchedule.map((s, idx) => (
                              <div
                                key={idx}
                                className="py-3 flex items-center justify-between gap-4 text-sm"
                              >
                                <div>
                                  <p className="font-medium text-stone-900 dark:text-white">
                                    {s.title}
                                  </p>
                                  <p className="text-xs text-stone-500 dark:text-slate-400">
                                    {s.location || 'Sanctuaire'}
                                  </p>
                                </div>
                                <span className="font-mono-tabular text-xs font-medium text-stone-700 dark:text-slate-300 shrink-0">
                                  {s.day} · {s.time}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-stone-500">Aucun horaire défini.</p>
                        )}

                        <div className="pt-4 border-t border-stone-100 dark:border-slate-800">
                          <h4 className="text-xs font-semibold text-stone-500 dark:text-slate-400 mb-3">
                            Répartition par rôle
                          </h4>
                          <div className="space-y-2">
                            {Object.entries(dashboard.roleBreakdown).map(([role, count]) => (
                              <div
                                key={role}
                                className="flex items-center justify-between text-xs text-stone-700 dark:text-slate-300"
                              >
                                <span>
                                  {ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role}
                                </span>
                                <span className="font-mono-tabular font-semibold">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Recent Audit Logs */}
                      <div className="lg:col-span-6 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-stone-900 dark:text-white">
                            Activité administrative récente
                          </h3>
                          {hasPermission('audit.view') && (
                            <button
                              type="button"
                              onClick={() => setTab('audit')}
                              className="text-xs font-medium text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              Voir tout
                            </button>
                          )}
                        </div>

                        {dashboard.recentAudits.length === 0 ? (
                          <p className="text-sm text-stone-500 dark:text-slate-400">
                            Aucune action journalisée ou accès restreint selon votre rôle.
                          </p>
                        ) : (
                          <div className="divide-y divide-stone-100 dark:divide-slate-800">
                            {dashboard.recentAudits.map((log) => (
                              <div key={log.id} className="py-3 flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-xs font-mono-tabular font-semibold text-stone-900 dark:text-white truncate">
                                    {log.action}
                                  </p>
                                  <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                                    {log.actorEmail || 'Système'} · {log.entityType}
                                  </p>
                                </div>
                                <span className="text-[11px] font-mono-tabular text-stone-400 dark:text-slate-500 shrink-0">
                                  {new Date(log.createdAt).toLocaleDateString('fr-FR')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )
              )}
            </div>
          )}

          {tab === 'tv' && activeChurchId && (
            <ChariteTvHub
              churchId={activeChurchId}
              isAuthenticated
              canManageStreams={hasPermission('streams.manage')}
              onOpenAdminPanel={() => setTab('tv_admin')}
            />
          )}

          {tab === 'tv_admin' && activeChurchId && hasPermission('streams.manage') && (
            <ChariteTvAdminPanel churchId={activeChurchId} />
          )}

          {tab === 'social' && activeChurchId && (
            <SocialPanel
              churchId={activeChurchId}
              canPost={hasPermission('social.post')}
              canModerate={hasPermission('social.moderate')}
            />
          )}

          {tab === 'messaging' && activeChurchId && user && (
            <MessagingPanel churchId={activeChurchId} currentUserId={user.id} />
          )}

          {tab === 'spiritual' && activeChurchId && (
            <SpiritualPanel
              churchId={activeChurchId}
              canPublish={hasPermission('spiritual.publish')}
            />
          )}

          {tab === 'events' && activeChurchId && (
            <EventsPanel churchId={activeChurchId} canManage={hasPermission('events.manage')} />
          )}

          {tab === 'donations' && activeChurchId && (
            <DonationsPanel
              churchId={activeChurchId}
              churchName={dashboard?.church.name || activeMembership?.churchName || 'Église'}
              canManage={hasPermission('donations.manage')}
            />
          )}

          {tab === 'humanitarian' && activeChurchId && (
            <HumanitarianPanel
              churchId={activeChurchId}
              canManage={hasPermission('humanitarian.manage')}
            />
          )}

          {tab === 'marketplace' && activeChurchId && (
            <MarketplacePanel
              churchId={activeChurchId}
              canManage={hasPermission('marketplace.manage')}
            />
          )}

          {tab === 'auctions' && activeChurchId && user && (
            <AuctionsPanel
              churchId={activeChurchId}
              currentUserId={user.id}
              canManage={hasPermission('auctions.manage')}
            />
          )}

          {tab === 'academy' && activeChurchId && (
            <AcademyMediaPanel
              churchId={activeChurchId}
              canManageAcademy={hasPermission('academy.manage')}
              canManageMedia={
                hasPermission('streams.manage') || hasPermission('spiritual.publish')
              }
            />
          )}

          {tab === 'ai' && activeChurchId && (
            <AiAssistantPanel
              churchId={activeChurchId}
              canAdminDraft={
                hasPermission('church.manage') ||
                hasPermission('humanitarian.manage') ||
                hasPermission('spiritual.publish')
              }
            />
          )}

          {tab === 'members' && activeChurchId && (
            <MembersPanel
              churchId={activeChurchId}
              canManage={hasPermission('members.manage')}
              departments={dashboard?.departments || []}
              onRefreshDashboard={loadDashboard}
            />
          )}

          {tab === 'departments' && activeChurchId && (
            <DepartmentsPanel
              churchId={activeChurchId}
              canManage={hasPermission('departments.manage')}
              onRefreshDashboard={loadDashboard}
            />
          )}

          {tab === 'visitors' && activeChurchId && (
            <VisitorsPanel
              churchId={activeChurchId}
              canManage={hasPermission('visitors.manage')}
              canConvert={hasPermission('visitors.manage') && hasPermission('members.manage')}
              onRefreshDashboard={loadDashboard}
            />
          )}

          {tab === 'invitations' && activeChurchId && (
            <InvitationsPanel
              churchId={activeChurchId}
              departments={dashboard?.departments || []}
              onRefreshDashboard={loadDashboard}
            />
          )}

          {tab === 'roles' && activeChurchId && (
            <RolesPermissionsPanel
              churchId={activeChurchId}
              canConfigure={hasPermission('roles.configure')}
            />
          )}

          {tab === 'branding' && dashboard?.church && (
            <BrandingSettingsPanel
              church={dashboard.church}
              canManageSettings={hasPermission('church.manage')}
              onSaved={async () => {
                await refreshProfile();
                await loadDashboard();
              }}
            />
          )}

          {tab === 'audit' && activeChurchId && <AuditLogsPanel churchId={activeChurchId} />}

          {tab === 'superadmin' && user?.isPlatformSuperAdmin && (
            <SuperAdminPanel
              onRefreshWorkspace={async () => {
                await refreshProfile();
                await loadDashboard();
              }}
            />
          )}

          {tab === 'profile' && <ProfilePanel />}
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full flex flex-col z-10">
            <div className="p-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-5 h-5 text-amber-700 shrink-0" />
                <div className="min-w-0">
                  <span className="block text-[10px] font-extrabold tracking-widest text-[#061A40] dark:text-[#F5B82E] uppercase">
                    CHARITAS
                  </span>
                  <span className="block font-semibold text-sm truncate">
                    {activeMembership?.churchName}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-stone-200 dark:border-slate-800 space-y-2">
              <select
                value={activeChurchId ?? ''}
                onChange={(e) => {
                  setActiveChurchId(Number(e.target.value));
                  setMobileMenuOpen(false);
                }}
                className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs"
              >
                {memberships.map((m) => (
                  <option key={m.churchId} value={m.churchId}>
                    {m.churchName}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setCreateModalOpen(true);
                  }}
                  className="h-9 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  + Nouvelle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setJoinModalOpen(true);
                  }}
                  className="h-9 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                >
                  Rejoindre
                </button>
              </div>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems
                .filter((i) => i.visible)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                      tab === item.id
                        ? 'text-white'
                        : 'text-stone-700 dark:text-slate-300'
                    }`}
                    style={tab === item.id ? { backgroundColor: primaryColor } : undefined}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
            </nav>

            <div className="p-4 border-t border-stone-200 dark:border-slate-800">
              <button
                type="button"
                onClick={logout}
                className="w-full h-10 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateChurchModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleSwitchSuccess}
      />
      <JoinChurchModal
        open={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        onJoined={handleSwitchSuccess}
      />
    </div>
  );
};
