import React, { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  Radio,
  Users,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { ChurchEventItem } from '../../types/platform';

interface EventsPanelProps {
  churchId: number;
  canManage: boolean;
}

export const EventsPanel: React.FC<EventsPanelProps> = ({ churchId, canManage }) => {
  const [events, setEvents] = useState<ChurchEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState<'culte' | 'conference' | 'reunion' | 'direct'>('culte');
  const [location, setLocation] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [description, setDescription] = useState('');

  const [ticketModal, setTicketModal] = useState<{
    eventTitle: string;
    qrDataUrl: string;
    qrPayload: string;
  } | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [attendees, setAttendees] = useState<
    { id: number; userId: number; fullName: string; email: string; status: string; checkedInAt: string | null }[]
  >([]);
  const [qrInput, setQrInput] = useState('');
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ events: ChurchEventItem[] }>(`/api/churches/${churchId}/events`);
      setEvents(res.events);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur chargement événements.');
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startsAt) return;
    await apiFetch(`/api/churches/${churchId}/events`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        eventType,
        location,
        startsAt,
        streamUrl: streamUrl.trim() || undefined,
        description,
      }),
    });
    setTitle('');
    setLocation('');
    setStartsAt('');
    setStreamUrl('');
    setDescription('');
    setShowForm(false);
    await loadEvents();
  };

  const handleRegister = async (ev: ChurchEventItem) => {
    const res = await apiFetch<{ qrDataUrl: string; qrPayload: string }>(
      `/api/churches/${churchId}/events/${ev.id}/register`,
      { method: 'POST' }
    );
    setTicketModal({
      eventTitle: ev.title,
      qrDataUrl: res.qrDataUrl,
      qrPayload: res.qrPayload,
    });
    await loadEvents();
  };

  const handleViewTicket = async (ev: ChurchEventItem) => {
    const res = await apiFetch<{ qrDataUrl: string; qrPayload: string }>(
      `/api/churches/${churchId}/events/${ev.id}/ticket`
    );
    setTicketModal({
      eventTitle: ev.title,
      qrDataUrl: res.qrDataUrl,
      qrPayload: res.qrPayload,
    });
  };

  const handleToggleLive = async (ev: ChurchEventItem) => {
    await apiFetch(`/api/churches/${churchId}/events/${ev.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isLive: !ev.isLive }),
    });
    await loadEvents();
  };

  const loadAttendees = async (eventId: number) => {
    setSelectedEventId(eventId);
    setCheckinMsg(null);
    const res = await apiFetch<{
      attendees: {
        id: number;
        userId: number;
        fullName: string;
        email: string;
        status: string;
        checkedInAt: string | null;
      }[];
    }>(`/api/churches/${churchId}/events/${eventId}/attendees`);
    setAttendees(res.attendees);
  };

  const handleQrCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !qrInput.trim()) return;
    setCheckinMsg(null);
    try {
      await apiFetch(`/api/churches/${churchId}/events/${selectedEventId}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ qrPayload: qrInput.trim() }),
      });
      setQrInput('');
      setCheckinMsg('Présence validée par QR code.');
      await loadAttendees(selectedEventId);
      await loadEvents();
    } catch (err: unknown) {
      setCheckinMsg(err instanceof Error ? err.message : 'Erreur QR.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold text-stone-900 dark:text-white">
            Événements, Cultes & Directs
          </h2>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            Calendrier paroissial, inscriptions, billets QR et pointage des présences.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Planifier un événement
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {showForm && canManage && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre (ex: Culte Dominical de Célébration)"
              required
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as typeof eventType)}
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            >
              <option value="culte">Culte</option>
              <option value="conference">Conférence</option>
              <option value="reunion">Réunion</option>
              <option value="direct">Retransmission directe</option>
            </select>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Lieu (ex: Grand Temple Cocody)"
              className="h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
          </div>
          <input
            type="url"
            value={streamUrl}
            onChange={(e) => setStreamUrl(e.target.value)}
            placeholder="URL du direct vidéo / YouTube / HLS (optionnel)"
            className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
          />
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Programme et informations pratiques..."
            className="w-full p-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
          >
            Enregistrer l’événement
          </button>
        </form>
      )}

      {loading ? (
        <div className="py-10 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-400" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-stone-500">
          Aucun événement planifié pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-400 font-semibold">
                    <span>{ev.eventType.toUpperCase()}</span>
                    {ev.isLive && (
                      <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                        <Radio className="w-3.5 h-3.5" />
                        EN DIRECT
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-2xl font-semibold mt-1">{ev.title}</h3>
                </div>
              </div>

              {ev.description && (
                <p className="text-sm text-stone-600 dark:text-slate-300">{ev.description}</p>
              )}

              <div className="text-xs text-stone-500 space-y-1">
                <p className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(ev.startsAt).toLocaleString('fr-FR')}
                </p>
                {ev.location && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    {ev.location}
                  </p>
                )}
                <p className="flex items-center gap-1.5 font-mono-tabular">
                  <Users className="w-3.5 h-3.5" />
                  {ev.registrationsCount} inscrits · {ev.checkedInCount} présents
                </p>
              </div>

              {ev.streamUrl && (
                <a
                  href={ev.streamUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs font-semibold text-amber-800 dark:text-amber-400 underline"
                >
                  Ouvrir la retransmission vidéo
                </a>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-100 dark:border-slate-800">
                {ev.myRegistration ? (
                  <button
                    type="button"
                    onClick={() => handleViewTicket(ev)}
                    className="px-3.5 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Mon billet QR ({ev.myRegistration.status === 'checked_in' ? 'Validé' : 'Inscrit'})
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRegister(ev)}
                    className="px-3.5 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
                  >
                    S’inscrire (QR code)
                  </button>
                )}

                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleToggleLive(ev)}
                      className="px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      {ev.isLive ? 'Arrêter le direct' : 'Passer en direct'}
                    </button>
                    <button
                      type="button"
                      onClick={() => loadAttendees(ev.id)}
                      className="px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      Contrôle QR & Présences
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedEventId && canManage && (
        <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <h3 className="text-base font-semibold">Validation de présence par QR code</h3>
          <form onSubmit={handleQrCheckin} className="flex flex-wrap gap-2">
            <input
              type="text"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="Collez le code SANCTUAIRE:EVENT:... scanné"
              className="flex-1 min-w-[260px] h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-xs font-mono-tabular"
            />
            <button
              type="submit"
              className="px-4 h-10 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
            >
              Valider le billet
            </button>
          </form>
          {checkinMsg && <p className="text-xs font-semibold text-emerald-700">{checkinMsg}</p>}
          <div className="divide-y divide-stone-100 dark:divide-slate-800">
            {attendees.map((a) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold">{a.fullName}</p>
                  <p className="text-stone-500">{a.email}</p>
                </div>
                <span className="inline-flex items-center gap-1 font-semibold">
                  {a.status === 'checked_in' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  {a.status === 'checked_in' ? 'Présent' : 'Inscrit'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ticketModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 text-center space-y-4">
            <h3 className="font-semibold text-base">{ticketModal.eventTitle}</h3>
            <img src={ticketModal.qrDataUrl} alt="Billet QR" className="mx-auto rounded-lg border p-2 bg-white" />
            <p className="text-[11px] font-mono-tabular break-all bg-stone-100 dark:bg-slate-800 p-2 rounded">
              {ticketModal.qrPayload}
            </p>
            <button
              type="button"
              onClick={() => setTicketModal(null)}
              className="w-full h-10 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
