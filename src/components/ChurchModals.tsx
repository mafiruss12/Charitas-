import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { PublicChurch } from '../types/platform';

interface CreateChurchModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (churchId: number) => Promise<void>;
}

export const CreateChurchModal: React.FC<CreateChurchModalProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [denomination, setDenomination] = useState('Catholique');
  const [city, setCity] = useState('Ebimpé / Abidjan');
  const [country, setCountry] = useState("Côte d'Ivoire");
  const [currency, setCurrency] = useState('XOF');
  const [primaryColor, setPrimaryColor] = useState('#1B365D');
  const [accentColor, setAccentColor] = useState('#881337');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ church: { id: number } }>('/api/churches', {
        method: 'POST',
        body: JSON.stringify({
          name,
          tagline,
          denomination,
          city,
          country,
          currency,
          primaryColor,
          accentColor,
          isPublic,
        }),
      });
      await onCreated(res.church.id);
      setName('');
      setTagline('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-slate-800">
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-white">
            Créer un espace église
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
              Nom de l’église ou de l’organisation
            </label>
            <input
              type="text"
              required
              minLength={3}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Assemblée Parole de Vie"
              className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
              Slogan / Vision
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Bâtir des familles solides dans la foi et la charité"
              className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                Ville
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                Pays
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                Dénomination
              </label>
              <input
                type="text"
                value={denomination}
                onChange={(e) => setDenomination(e.target.value)}
                className="w-full h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                Devise principale
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-stone-900 dark:text-white"
              >
                <option value="XOF">XOF (FCFA)</option>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                Couleur principale
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-12 rounded border border-stone-300 dark:border-slate-700 cursor-pointer"
                />
                <span className="text-xs font-mono-tabular text-stone-600 dark:text-slate-400">
                  {primaryColor}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-1.5">
                Couleur d’accent
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-12 rounded border border-stone-300 dark:border-slate-700 cursor-pointer"
                />
                <span className="text-xs font-mono-tabular text-stone-600 dark:text-slate-400">
                  {accentColor}
                </span>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-stone-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 rounded border-stone-300"
            />
            Rendre l’église visible dans l’annuaire public
          </label>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-stone-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 dark:text-slate-300 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer l’église
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface JoinChurchModalProps {
  open: boolean;
  onClose: () => void;
  onJoined: (churchId: number) => Promise<void>;
}

export const JoinChurchModal: React.FC<JoinChurchModalProps> = ({ open, onClose, onJoined }) => {
  const [churches, setChurches] = useState<PublicChurch[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch<{ churches: PublicChurch[] }>('/api/public/churches')
      .then((d) => setChurches(d.churches))
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const handleJoinPublic = async (churchId: number) => {
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/api/churches/${churchId}/join`, { method: 'POST', body: JSON.stringify({}) });
      await onJoined(churchId);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Impossible de rejoindre l'église.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ churchId: number }>('/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ code: inviteCode.trim().toUpperCase() }),
      });
      await onJoined(res.churchId);
      setInviteCode('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Code invalide ou expiré.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-slate-800">
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-white">
            Rejoindre une église
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        <form onSubmit={handleAcceptInvite} className="mt-5 pb-5 border-b border-stone-200 dark:border-slate-800">
          <label className="block text-xs font-medium text-stone-700 dark:text-slate-300 mb-2">
            Via un code d’invitation
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="Ex. GRA-XXXXXXXX"
              className="flex-1 h-11 px-3.5 rounded-lg border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono-tabular text-stone-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={submitting}
              className="h-11 px-4 rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-500 text-sm font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              Valider
            </button>
          </div>
        </form>

        <div className="mt-5">
          <p className="text-xs font-medium text-stone-700 dark:text-slate-300 mb-3">
            Ou rejoindre une assemblée publique
          </p>
          <div className="space-y-2.5">
            {churches.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-stone-200 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-900 dark:text-white truncate">
                    {c.name}
                  </p>
                  <p className="text-xs text-stone-500 dark:text-slate-400 truncate">
                    {[c.city, c.country].filter(Boolean).join(', ')} · {c.membersCount} membres
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleJoinPublic(c.id)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: c.primaryColor || '#1B365D' }}
                >
                  Rejoindre
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
