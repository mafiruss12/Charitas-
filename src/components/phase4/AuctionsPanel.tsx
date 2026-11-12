import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Gavel, Loader2, Plus, ShieldCheck, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { AuctionItem } from '../../types/platform';

interface AuctionsPanelProps {
  churchId: number;
  currentUserId: number;
  canManage: boolean;
}

export const AuctionsPanel: React.FC<AuctionsPanelProps> = ({
  churchId,
  currentUserId,
  canManage,
}) => {
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bidAmounts, setBidAmounts] = useState<Record<number, string>>({});

  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startPrice, setStartPrice] = useState('15000');
  const [reservePrice, setReservePrice] = useState('25000');
  const [durationDays, setDurationDays] = useState('5');
  const [fundAllocation, setFundAllocation] = useState<'humanitarian' | 'church'>('humanitarian');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ auctions: AuctionItem[] }>(
        `/api/churches/${churchId}/auctions`
      );
      setAuctions(res.auctions);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur chargement des enchères.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const createAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/churches/${churchId}/auctions`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          startPrice: Number(startPrice),
          reservePrice: Number(reservePrice),
          durationDays: Number(durationDays),
          fundAllocation,
        }),
      });
      setTitle('');
      setDescription('');
      setShowNew(false);
      setMessage("Lot soumis pour modération avant mise en ligne.");
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur soumission lot.');
    }
  };

  const placeBid = async (auction: AuctionItem) => {
    setError(null);
    setMessage(null);
    const minReq = auction.currentBidAmount > 0 ? auction.currentBidAmount + 500 : auction.startPrice;
    const raw = bidAmounts[auction.id] ?? String(minReq);
    try {
      await apiFetch(`/api/churches/${churchId}/auctions/${auction.id}/bids`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(raw) }),
      });
      setMessage(`Enchère enregistrée sur « ${auction.title} ».`);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enchère.");
    }
  };

  const moderateAuction = async (auctionId: number, decision: 'approved' | 'rejected') => {
    setError(null);
    try {
      await apiFetch(`/api/churches/${churchId}/auctions/${auctionId}/moderate`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur modération.');
    }
  };

  const confirmWinner = async (auctionId: number) => {
    setError(null);
    setMessage(null);
    try {
      await apiFetch(`/api/churches/${churchId}/auctions/${auctionId}/confirm-winner`, {
        method: 'POST',
      });
      setMessage('Adjudication confirmée et créditée au grand livre financier.');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur adjudication.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-white">
            Ventes aux Enchères Solidaires
          </h2>
          <p className="text-sm text-stone-500 dark:text-slate-400">
            Lots modérés, protection anti-surenchère fictive et affectation caritative certifiée.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew((v) => !v)}
          className="px-3.5 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Proposer un lot
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 dark:text-emerald-300">
          {message}
        </div>
      )}

      {showNew && (
        <form
          onSubmit={createAuction}
          className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold">Soumettre un bien ou service aux enchères</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              required
              placeholder="Titre du lot"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
            <select
              value={fundAllocation}
              onChange={(e) => setFundAllocation(e.target.value as 'humanitarian' | 'church')}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            >
              <option value="humanitarian">Au profit du Fonds Humanitaire</option>
              <option value="church">Au profit du Fonds Église</option>
            </select>
            <input
              type="number"
              required
              min={500}
              placeholder="Mise à prix (XOF)"
              value={startPrice}
              onChange={(e) => setStartPrice(e.target.value)}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="number"
              required
              min={0}
              placeholder="Prix de réserve (XOF)"
              value={reservePrice}
              onChange={(e) => setReservePrice(e.target.value)}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="number"
              required
              min={1}
              max={30}
              placeholder="Durée (jours)"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
          </div>
          <textarea
            required
            rows={2}
            placeholder="Description et état du lot"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-4 py-2 rounded-lg border border-stone-200 dark:border-slate-700 text-xs cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
            >
              Soumettre à la modération
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {auctions.map((a) => {
            const isSeller = a.sellerUserId === currentUserId;
            const suggestedBid =
              a.currentBidAmount > 0 ? a.currentBidAmount + 500 : a.startPrice;
            const daysLeft = Math.max(
              0,
              Math.ceil((new Date(a.endsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            );
            return (
              <div
                key={a.id}
                className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-medium text-stone-500 dark:text-slate-400">
                      <span>Par {a.sellerName}</span>
                      <span>·</span>
                      <span>
                        Fonds {a.fundAllocation === 'humanitarian' ? 'Humanitaire' : 'Église'}
                      </span>
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-stone-900 dark:text-white">
                      {a.title}
                    </h3>
                  </div>
                  <span className="font-mono-tabular text-[11px] px-2 py-0.5 rounded border border-stone-200 dark:border-slate-700">
                    {a.moderationStatus === 'pending' ? 'En attente validation' : a.status}
                  </span>
                </div>

                <p className="text-xs text-stone-600 dark:text-slate-400">{a.description}</p>

                <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-stone-50 dark:bg-slate-950 border border-stone-100 dark:border-slate-800 text-xs">
                  <div>
                    <p className="text-stone-500">Mise à prix</p>
                    <p className="font-mono-tabular font-semibold">
                      {a.startPrice.toLocaleString('fr-FR')} {a.currency}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-500">Offre actuelle</p>
                    <p className="font-mono-tabular font-bold text-amber-800 dark:text-amber-400">
                      {a.currentBidAmount > 0
                        ? `${a.currentBidAmount.toLocaleString('fr-FR')} ${a.currency}`
                        : 'Aucune'}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-500">Clôture</p>
                    <p className="font-mono-tabular font-semibold inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {daysLeft} j
                    </p>
                  </div>
                </div>

                {a.highestBidderName && (
                  <p className="text-xs text-stone-500 dark:text-slate-400">
                    Meilleur enchérisseur :{' '}
                    <span className="font-semibold text-stone-900 dark:text-white">
                      {a.highestBidderName}
                    </span>{' '}
                    ({a.bidsCount} mise{a.bidsCount > 1 ? 's' : ''})
                  </p>
                )}

                {a.moderationStatus === 'approved' && a.status === 'active' && !isSeller && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={a.currentBidAmount > 0 ? a.currentBidAmount + 1 : a.startPrice}
                      value={bidAmounts[a.id] ?? String(suggestedBid)}
                      onChange={(e) =>
                        setBidAmounts((prev) => ({ ...prev, [a.id]: e.target.value }))
                      }
                      className="flex-1 h-9 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
                    />
                    <button
                      type="button"
                      onClick={() => placeBid(a)}
                      className="h-9 px-4 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      Enchérir
                    </button>
                  </div>
                )}

                {isSeller && a.status === 'active' && (
                  <p className="text-[11px] text-stone-500 italic">
                    Règle d’intégrité : le déposant ne peut pas enchérir sur son propre lot.
                  </p>
                )}

                {canManage && a.moderationStatus === 'pending' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => moderateAuction(a.id, 'approved')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approuver & Activer
                    </button>
                    <button
                      type="button"
                      onClick={() => moderateAuction(a.id, 'rejected')}
                      className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Rejeter
                    </button>
                  </div>
                )}

                {canManage &&
                  a.moderationStatus === 'approved' &&
                  a.status !== 'confirmed' &&
                  a.currentBidAmount > 0 && (
                    <div className="pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-stone-500">
                        Réserve : {a.reservePrice.toLocaleString('fr-FR')} {a.currency}
                      </span>
                      <button
                        type="button"
                        onClick={() => confirmWinner(a.id)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-stone-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Adjuger au gagnant
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
