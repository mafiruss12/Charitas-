import React, { useState } from 'react';
import { BookText, FileEdit, Loader2, Search, Send, Sparkles } from 'lucide-react';
import { apiFetch } from '../../lib/api';

interface AiAssistantPanelProps {
  churchId: number;
  canAdminDraft: boolean;
}

type AiMode = 'bible_research' | 'sermon_summary' | 'content_search' | 'admin_draft';

export const AiAssistantPanel: React.FC<AiAssistantPanelProps> = ({
  churchId,
  canAdminDraft,
}) => {
  const [mode, setMode] = useState<AiMode>('bible_research');
  const [prompt, setPrompt] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modes: { id: AiMode; label: string; icon: React.ReactNode; visible: boolean }[] = [
    {
      id: 'bible_research',
      label: 'Recherche biblique',
      icon: <BookText className="w-3.5 h-3.5" />,
      visible: true,
    },
    {
      id: 'sermon_summary',
      label: 'Résumé de prédication',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      visible: true,
    },
    {
      id: 'content_search',
      label: "Catalogue de l'église",
      icon: <Search className="w-3.5 h-3.5" />,
      visible: true,
    },
    {
      id: 'admin_draft',
      label: 'Rédaction administrative',
      icon: <FileEdit className="w-3.5 h-3.5" />,
      visible: canAdminDraft,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setReply(null);
    try {
      const res = await apiFetch<{ reply: string }>(`/api/churches/${churchId}/ai/assist`, {
        method: 'POST',
        body: JSON.stringify({ mode, prompt }),
      });
      setReply(res.reply);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de l'assistant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display text-2xl font-semibold text-stone-900 dark:text-white">
          Assistant Biblique & Éditorial
        </h2>
        <p className="text-sm text-stone-500 dark:text-slate-400">
          Exécuté côté serveur dans le périmètre de votre église : aucune donnée confidentielle
          (bénéficiaires humanitaires ou journal spirituel privé) n’est accessible.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {modes
          .filter((m) => m.visible)
          .map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border cursor-pointer ${
                mode === m.id
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-600 dark:border-amber-600'
                  : 'border-stone-200 dark:border-slate-700 bg-white dark:bg-slate-900'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
      >
        <textarea
          rows={4}
          required
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === 'bible_research'
              ? 'Ex : Quels passages bibliques éclairent l’hospitalité et le service envers les veuves ?'
              : mode === 'sermon_summary'
                ? 'Collez les notes ou le texte de la prédication à synthétiser...'
                : mode === 'content_search'
                  ? 'Ex : Quelles formations ou campagnes sont ouvertes actuellement ?'
                  : "Ex : Rédige une lettre d'annonce sobre pour la collecte humanitaire de Pâques..."
          }
          className="w-full p-3.5 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white dark:bg-amber-600 disabled:opacity-50 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Générer la réponse
          </button>
        </div>
      </form>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {reply && (
        <div className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400 mb-3">
            Réponse structurée
          </p>
          <div className="text-sm text-stone-800 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">
            {reply}
          </div>
        </div>
      )}
    </div>
  );
};
