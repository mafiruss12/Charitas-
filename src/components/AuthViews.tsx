import React, { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { PublicChurch } from '../types/platform';

interface AuthViewsProps {
  initialMode: 'login' | 'register' | 'forgot';
  prefillChurchId?: number;
  prefillInviteCode?: string;
  onBackToLanding: () => void;
}

export const AuthViews: React.FC<AuthViewsProps> = ({
  initialMode,
  prefillChurchId,
  prefillInviteCode,
  onBackToLanding,
}) => {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [selectedChurchId, setSelectedChurchId] = useState<string>(
    prefillChurchId ? String(prefillChurchId) : ''
  );
  const [invitationCode, setInvitationCode] = useState(prefillInviteCode || '');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [publicChurches, setPublicChurches] = useState<PublicChurch[]>([]);
  const [inviteInfo, setInviteInfo] = useState<{
    churchName: string;
    roleLabel: string;
    isValid: boolean;
    reason: string | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ churches: PublicChurch[] }>('/api/public/churches')
      .then((d) => setPublicChurches(d.churches))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const code = invitationCode.trim().toUpperCase();
    if (code.length < 5) {
      setInviteInfo(null);
      return;
    }
    const timer = setTimeout(() => {
      apiFetch<{
        invitation: {
          churchName: string;
          roleLabel: string;
          isValid: boolean;
          reason: string | null;
        };
      }>(`/api/public/invitations/${encodeURIComponent(code)}`)
        .then((res) => setInviteInfo(res.invitation))
        .catch(() => setInviteInfo(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [invitationCode]);

  const handleGoogleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Échec de la connexion Google.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Identifiants invalides.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await registerWithEmail({
        email,
        password,
        fullName,
        phone: phone || undefined,
        city: city || undefined,
        invitationCode: invitationCode.trim() || undefined,
        churchId: selectedChurchId ? Number(selectedChurchId) : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'inscription.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string; previewResetCode?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          token: null,
          body: JSON.stringify({ email }),
        }
      );
      setInfoMessage(
        res.previewResetCode
          ? `${res.message} Code de réinitialisation (aperçu sans SMTP) : ${res.previewResetCode}`
          : res.message
      );
      if (res.previewResetCode) {
        setResetToken(res.previewResetCode);
      }
      setMode('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        token: null,
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      setInfoMessage(res.message);
      setPassword('');
      setMode('login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Jeton invalide ou expiré.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0B111E] flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-2 text-xs font-medium text-stone-600 dark:text-slate-400 hover:text-[#1B365D] dark:hover:text-white mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l’accueil
        </button>

        <div className="rounded-2xl border border-[#E5DED3] dark:border-slate-800 bg-white dark:bg-[#111827] p-7 sm:p-8 shadow-sm">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/src/assets/images/charitas_emblem_crest_1794525619241.jpg"
                alt="Emblème Charitas Saint-Louis"
                className="w-10 h-10 rounded-xl object-cover border border-[#E5DED3] dark:border-slate-700"
              />
              <span className="text-xs font-semibold tracking-wide text-[#881337] dark:text-amber-400">
                Église Saint Louis Roi d’Ebimpé
              </span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-[#1B365D] dark:text-white">
              {mode === 'login' && 'Connexion à Charitas'}
              {mode === 'register' && 'Rejoindre Charitas'}
              {mode === 'forgot' && 'Mot de passe oublié'}
              {mode === 'reset' && 'Réinitialiser le mot de passe'}
            </h1>
            <p className="mt-1.5 text-sm text-stone-600 dark:text-slate-400">
              {mode === 'login' && 'Accédez à votre espace paroissial et à vos œuvres solidaires.'}
              {mode === 'register' && 'Rejoignez la paroisse d’Ebimpé ou créez votre propre assemblée.'}
              {mode === 'forgot' && 'Recevez un code sécurisé pour définir un nouveau mot de passe.'}
              {mode === 'reset' && 'Saisissez votre code de réinitialisation et votre nouveau mot de passe.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="mb-5 p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-300 break-all">
              {infoMessage}
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <>
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleLogin}
                className="w-full h-11 px-4 rounded-lg border border-[#D8CFC1] dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-[#FAF7F2] dark:hover:bg-slate-800 text-sm font-medium text-stone-800 dark:text-slate-100 flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4 text-[#1B365D] dark:text-amber-400" />
                Continuer avec Google
              </button>

              <div className="my-5 flex items-center gap-3 text-xs text-stone-400 dark:text-slate-500">
                <div className="h-px flex-1 bg-[#E5DED3] dark:bg-slate-800" />
                <span>ou avec votre email</span>
                <div className="h-px flex-1 bg-[#E5DED3] dark:bg-slate-800" />
              </div>
            </>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-amber-600"
                  placeholder="vous@saintlouis-ebimpe.ci"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-stone-700 dark:text-slate-300">
                    Mot de passe
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('forgot');
                    }}
                    className="text-xs text-[#881337] dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B365D] dark:focus:ring-amber-600"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-[#1B365D] text-white hover:bg-[#132744] dark:bg-amber-600 dark:hover:bg-amber-500 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Se connecter
              </button>

              <p className="text-center text-xs text-stone-600 dark:text-slate-400 pt-2">
                Pas encore de compte ?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('register');
                  }}
                  className="font-semibold text-stone-900 dark:text-white hover:underline cursor-pointer"
                >
                  Créer un compte
                </button>
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Nom complet
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  placeholder="Jean Kouassi"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Adresse email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  placeholder="jean.kouassi@exemple.ci"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Mot de passe (8 caractères min.)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                    placeholder="+225 07..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                    placeholder="Abidjan"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Code d’invitation (optionnel)
                </label>
                <input
                  type="text"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-tabular text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  placeholder="GRA-XXXXXXXX"
                />
                {inviteInfo && (
                  <p
                    className={`mt-1.5 text-xs ${
                      inviteInfo.isValid
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {inviteInfo.isValid
                      ? `Invitation valide : ${inviteInfo.churchName} (${inviteInfo.roleLabel})`
                      : inviteInfo.reason}
                  </p>
                )}
              </div>

              {!invitationCode.trim() && (
                <div>
                  <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                    Rejoindre une église publique (optionnel)
                  </label>
                  <select
                    value={selectedChurchId}
                    onChange={(e) => setSelectedChurchId(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  >
                    <option value="">Je créerai ou rejoindrai une église après connexion</option>
                    {publicChurches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.city || c.country})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Créer mon compte
              </button>

              <p className="text-center text-xs text-stone-600 dark:text-slate-400 pt-2">
                Déjà inscrit ?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('login');
                  }}
                  className="font-semibold text-stone-900 dark:text-white hover:underline cursor-pointer"
                >
                  Se connecter
                </button>
              </p>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Adresse email du compte
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  placeholder="vous@eglise.org"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Envoyer le code de réinitialisation
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-stone-600 dark:text-slate-400 hover:underline cursor-pointer"
                >
                  Retour à la connexion
                </button>
                <button
                  type="button"
                  onClick={() => setMode('reset')}
                  className="text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  J’ai déjà un code
                </button>
              </div>
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Code / jeton de réinitialisation
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-tabular text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  placeholder="Collez le code reçu"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                  Nouveau mot de passe (8 caractères min.)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-600"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Mettre à jour le mot de passe
              </button>

              <p className="text-center text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="text-stone-600 dark:text-slate-400 hover:underline cursor-pointer"
                >
                  Retour à la connexion
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
