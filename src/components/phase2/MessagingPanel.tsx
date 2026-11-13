import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Ban,
  CheckCheck,
  Loader2,
  Mic,
  Paperclip,
  Phone,
  PhoneOff,
  Plus,
  Send,
  Square,
  Users,
  Video,
} from 'lucide-react';
import { apiFetch, getMemoryAuthToken } from '../../lib/api';
import type { ChatMessageItem, ChurchMemberItem, ConversationItem } from '../../types/platform';

interface MessagingPanelProps {
  churchId: number;
  currentUserId: number;
}

export const MessagingPanel: React.FC<MessagingPanelProps> = ({ churchId, currentUserId }) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [participants, setParticipants] = useState<{ userId: number; lastReadAt: string | null }[]>([]);
  const [onlineIds, setOnlineIds] = useState<number[]>([]);
  const [members, setMembers] = useState<ChurchMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState('');
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newConvType, setNewConvType] = useState<'direct' | 'group'>('direct');
  const [newConvTitle, setNewConvTitle] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [callState, setCallState] = useState<{
    active: boolean;
    targetUserId: number | null;
    mode: 'audio' | 'video';
    statusText: string;
  }>({ active: false, targetUserId: null, mode: 'audio', statusText: '' });

  const activeConv = conversations.find((c) => c.id === activeConvId) || null;

  const loadConversations = useCallback(async () => {
    setLoading(true);
    try {
      const [convRes, presenceRes, memRes] = await Promise.all([
        apiFetch<{ conversations: ConversationItem[] }>(
          `/api/churches/${churchId}/messaging/conversations`
        ),
        apiFetch<{ onlineUserIds: number[] }>(`/api/churches/${churchId}/messaging/presence`),
        apiFetch<{ members: ChurchMemberItem[] }>(`/api/churches/${churchId}/members`),
      ]);
      setConversations(convRes.conversations);
      setOnlineIds(presenceRes.onlineUserIds);
      setMembers(memRes.members.filter((m) => m.userId !== currentUserId));
      if (!activeConvId && convRes.conversations.length > 0) {
        setActiveConvId(convRes.conversations[0].id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur messagerie.');
    } finally {
      setLoading(false);
    }
  }, [churchId, currentUserId, activeConvId]);

  const loadMessages = useCallback(
    async (convId: number) => {
      try {
        const res = await apiFetch<{
          messages: ChatMessageItem[];
          participants: { userId: number; lastReadAt: string | null }[];
        }>(`/api/churches/${churchId}/messaging/conversations/${convId}/messages`);
        setMessages(res.messages);
        setParticipants(res.participants);
        await apiFetch(`/api/churches/${churchId}/messaging/conversations/${convId}/read`, {
          method: 'POST',
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur chargement messages.');
      }
    },
    [churchId]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    }
  }, [activeConvId, loadMessages]);

  const cleanupCall = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    if (localVideoRef.current?.srcObject instanceof MediaStream) {
      localVideoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      localVideoRef.current.srcObject = null;
    }
    setCallState({ active: false, targetUserId: null, mode: 'audio', statusText: '' });
  }, []);

  // Live WebSocket connection for real-time messages, read receipts, presence & WebRTC signaling
  useEffect(() => {
    const token = getMemoryAuthToken();
    if (!token) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'subscribe:church', payload: { churchId } }));
    };

    ws.onmessage = async (event) => {
      try {
        const { event: evtName, payload } = JSON.parse(event.data);
        if (evtName === 'presence:update' && Array.isArray(payload?.onlineUserIds)) {
          setOnlineIds(payload.onlineUserIds);
        } else if (evtName === 'chat:message' && payload?.conversationId === activeConvId) {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.id) ? prev : [...prev, payload]
          );
        } else if (evtName === 'chat:read' && payload?.conversationId === activeConvId) {
          setParticipants((prev) =>
            prev.map((p) =>
              p.userId === payload.userId ? { ...p, lastReadAt: payload.lastReadAt } : p
            )
          );
        } else if (evtName === 'call:signal') {
          if (payload.signalType === 'hangup') {
            cleanupCall();
          } else if (payload.signalType === 'offer') {
            try {
              const mode = payload.callMode === 'video' ? 'video' : 'audio';
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: mode === 'video',
              });
              if (localVideoRef.current) localVideoRef.current.srcObject = stream;
              const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
              });
              peerRef.current = pc;
              stream.getTracks().forEach((t) => pc.addTrack(t, stream));
              pc.ontrack = (e) => {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
              };
              pc.onicecandidate = (e) => {
                if (e.candidate) {
                  ws.send(
                    JSON.stringify({
                      event: 'call:signal',
                      payload: {
                        targetUserId: payload.fromUserId,
                        signalType: 'ice-candidate',
                        data: e.candidate,
                      },
                    })
                  );
                }
              };
              await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(
                JSON.stringify({
                  event: 'call:signal',
                  payload: {
                    targetUserId: payload.fromUserId,
                    signalType: 'answer',
                    data: answer,
                  },
                })
              );
              setCallState({
                active: true,
                targetUserId: payload.fromUserId,
                mode,
                statusText: `En appel avec ${payload.fromName}`,
              });
            } catch {
              setError('Autorisez le micro/caméra pour répondre à l’appel WebRTC.');
            }
          } else if (payload.signalType === 'answer' && peerRef.current) {
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.data));
            setCallState((s) => ({ ...s, statusText: 'Appel connecté' }));
          } else if (payload.signalType === 'ice-candidate' && peerRef.current && payload.data) {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.data));
          }
        }
      } catch {
        // Ignore malformed frame
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [churchId, activeConvId, cleanupCall]);

  const startCall = async (mode: 'audio' | 'video') => {
    const other = activeConv?.participants.find((p) => p.userId !== currentUserId);
    if (!other || !wsRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video',
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      peerRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      };
      pc.onicecandidate = (e) => {
        if (e.candidate && wsRef.current) {
          wsRef.current.send(
            JSON.stringify({
              event: 'call:signal',
              payload: { targetUserId: other.userId, signalType: 'ice-candidate', data: e.candidate },
            })
          );
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current.send(
        JSON.stringify({
          event: 'call:signal',
          payload: {
            targetUserId: other.userId,
            signalType: 'offer',
            callMode: mode,
            data: offer,
          },
        })
      );
      setCallState({
        active: true,
        targetUserId: other.userId,
        mode,
        statusText: `Appel ${mode} en cours...`,
      });
    } catch {
      setError('Accès micro/caméra indisponible dans ce navigateur.');
    }
  };

  const hangupCall = () => {
    if (callState.targetUserId && wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          event: 'call:signal',
          payload: { targetUserId: callState.targetUserId, signalType: 'hangup' },
        })
      );
    }
    cleanupCall();
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !text.trim()) return;
    const msgText = text;
    setText('');
    try {
      const res = await apiFetch<{ message: ChatMessageItem }>(
        `/api/churches/${churchId}/messaging/conversations/${activeConvId}/messages`,
        { method: 'POST', body: JSON.stringify({ messageType: 'text', content: msgText }) }
      );
      setMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur d'envoi.");
    }
  };

  const toggleVoiceRecording = async () => {
    if (recording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          if (!activeConvId) return;
          const res = await apiFetch<{ message: ChatMessageItem }>(
            `/api/churches/${churchId}/messaging/conversations/${activeConvId}/messages`,
            {
              method: 'POST',
              body: JSON.stringify({
                messageType: 'voice',
                content: 'Note vocale',
                attachmentUrl: String(reader.result || ''),
                attachmentName: 'vocal.webm',
              }),
            }
          );
          setMessages((prev) => [...prev, res.message]);
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError('Microphone indisponible pour enregistrer un message vocal.');
    }
  };

  const handleFileUpload = (file: File) => {
    if (!activeConvId) return;
    const isImage = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await apiFetch<{ message: ChatMessageItem }>(
        `/api/churches/${churchId}/messaging/conversations/${activeConvId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            messageType: isImage ? 'image' : 'file',
            content: isImage ? `Image : ${file.name}` : `Fichier : ${file.name}`,
            attachmentUrl: String(reader.result || ''),
            attachmentName: file.name,
          }),
        }
      );
      setMessages((prev) => [...prev, res.message]);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ conversation: ConversationItem }>(
        `/api/churches/${churchId}/messaging/conversations`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: newConvType,
            title: newConvType === 'group' ? newConvTitle : undefined,
            participantUserIds: selectedUserIds,
          }),
        }
      );
      setNewConvOpen(false);
      setSelectedUserIds([]);
      setNewConvTitle('');
      await loadConversations();
      setActiveConvId(res.conversation.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Impossible de créer la discussion.');
    }
  };

  const handleBlockOther = async () => {
    const other = activeConv?.participants.find((p) => p.userId !== currentUserId);
    if (!other) return;
    const res = await apiFetch<{ blocked: boolean }>(
      `/api/churches/${churchId}/messaging/users/${other.userId}/block`,
      { method: 'POST' }
    );
    setError(res.blocked ? 'Utilisateur bloqué.' : 'Utilisateur débloqué.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-semibold text-stone-900 dark:text-white">
            Messagerie CHARITAS &amp; Salons Temps Réel
          </h2>
          <p className="text-sm text-stone-600 dark:text-slate-400">
            Discussions privées, groupes de l’Église Saint Louis Roi d’Ebimpé, salons publics, vocaux et appels audio/vidéo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewConvOpen((v) => !v)}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nouvelle discussion
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {newConvOpen && (
        <form
          onSubmit={handleCreateConversation}
          className="rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setNewConvType('direct')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                newConvType === 'direct' ? 'bg-slate-900 text-white' : 'border border-stone-300'
              }`}
            >
              Message privé
            </button>
            <button
              type="button"
              onClick={() => setNewConvType('group')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                newConvType === 'group' ? 'bg-slate-900 text-white' : 'border border-stone-300'
              }`}
            >
              Groupe
            </button>
          </div>
          {newConvType === 'group' && (
            <input
              type="text"
              value={newConvTitle}
              onChange={(e) => setNewConvTitle(e.target.value)}
              placeholder="Nom du groupe de discussion"
              className="w-full h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
            />
          )}
          <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
            {members.map((m) => {
              const checked = selectedUserIds.includes(m.userId);
              return (
                <label
                  key={m.userId}
                  className="flex items-center gap-2 p-2 rounded-lg border border-stone-200 dark:border-slate-800 text-xs cursor-pointer"
                >
                  <input
                    type={newConvType === 'direct' ? 'radio' : 'checkbox'}
                    checked={checked}
                    onChange={() => {
                      if (newConvType === 'direct') {
                        setSelectedUserIds([m.userId]);
                      } else {
                        setSelectedUserIds((prev) =>
                          checked ? prev.filter((id) => id !== m.userId) : [...prev, m.userId]
                        );
                      }
                    }}
                  />
                  <span>{m.fullName}</span>
                </label>
              );
            })}
          </div>
          <button
            type="submit"
            disabled={selectedUserIds.length === 0}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold disabled:opacity-50 cursor-pointer"
          >
            Démarrer
          </button>
        </form>
      )}

      {callState.active && (
        <div className="rounded-xl border border-amber-500/40 bg-slate-950 text-white p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{callState.statusText}</p>
            <div className="flex gap-3">
              <video ref={localVideoRef} autoPlay muted playsInline className="w-28 h-20 rounded bg-slate-800 object-cover" />
              <video ref={remoteVideoRef} autoPlay playsInline className="w-28 h-20 rounded bg-slate-800 object-cover" />
            </div>
          </div>
          <button
            type="button"
            onClick={hangupCall}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            Raccrocher
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[540px]">
        {/* Sidebar conversations */}
        <div className="lg:col-span-4 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 space-y-1 overflow-y-auto">
          {loading && conversations.length === 0 ? (
            <div className="py-8 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-stone-400" />
            </div>
          ) : (
            conversations.map((conv) => {
              const other = conv.participants.find((p) => p.userId !== currentUserId);
              const isOtherOnline = other ? onlineIds.includes(other.userId) : false;
              const isSelected = conv.id === activeConvId;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setActiveConvId(conv.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-amber-600'
                      : 'hover:bg-stone-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate">{conv.displayTitle}</span>
                    {conv.type === 'direct' && (
                      <span
                        className={`text-[10px] ${
                          isOtherOnline
                            ? 'text-emerald-500 font-semibold'
                            : isSelected
                              ? 'text-stone-300'
                              : 'text-stone-400'
                        }`}
                      >
                        {isOtherOnline ? 'En ligne' : 'Hors ligne'}
                      </span>
                    )}
                    {conv.type !== 'direct' && <Users className="w-3.5 h-3.5 opacity-70" />}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${isSelected ? 'text-stone-200' : 'text-stone-500'}`}>
                    {conv.type === 'public_room'
                      ? 'Salon public de l’église'
                      : conv.type === 'group'
                        ? `${conv.participants.length} participants`
                        : 'Conversation privée'}
                  </p>
                </button>
              );
            })
          )}
        </div>

        {/* Thread panel */}
        <div className="lg:col-span-8 rounded-xl border border-stone-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col">
          {activeConv ? (
            <>
              <div className="p-4 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{activeConv.displayTitle}</h3>
                  <p className="text-[11px] text-stone-500">
                    {onlineIds.length} membre(s) connecté(s) en temps réel
                  </p>
                </div>
                {activeConv.type === 'direct' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startCall('audio')}
                      className="p-2 rounded-lg border border-stone-200 dark:border-slate-700 cursor-pointer"
                      title="Appel audio"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startCall('video')}
                      className="p-2 rounded-lg border border-stone-200 dark:border-slate-700 cursor-pointer"
                      title="Appel vidéo"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleBlockOther}
                      className="p-2 rounded-lg border border-stone-200 dark:border-slate-700 text-red-600 cursor-pointer"
                      title="Bloquer / Débloquer"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px]">
                {messages.map((m) => {
                  const isMine = m.senderUserId === currentUserId;
                  const readByOther =
                    isMine &&
                    participants.some(
                      (p) =>
                        p.userId !== currentUserId &&
                        p.lastReadAt &&
                        new Date(p.lastReadAt).getTime() >= new Date(m.createdAt).getTime()
                    );
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-xl p-3 text-xs space-y-1.5 ${
                          isMine
                            ? 'bg-slate-900 text-white dark:bg-amber-600'
                            : 'bg-stone-100 dark:bg-slate-800 text-stone-900 dark:text-white'
                        }`}
                      >
                        {!isMine && <p className="font-semibold opacity-75">{m.senderName}</p>}
                        {m.messageType === 'image' && m.attachmentUrl && (
                          <img src={m.attachmentUrl} alt={m.attachmentName || 'Image'} className="rounded-lg max-h-52 object-cover" />
                        )}
                        {m.messageType === 'voice' && m.attachmentUrl && (
                          <audio controls src={m.attachmentUrl} className="max-w-[230px]" />
                        )}
                        {m.messageType === 'file' && m.attachmentUrl && (
                          <a
                            href={m.attachmentUrl}
                            download={m.attachmentName || 'fichier'}
                            className="underline font-medium block"
                          >
                            Télécharger {m.attachmentName || 'le fichier'}
                          </a>
                        )}
                        <p className="text-sm whitespace-pre-wrap">{m.content}</p>
                        <div className="flex items-center justify-end gap-1 text-[10px] opacity-70">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMine && readByOther && <CheckCheck className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleSendText}
                className="p-3 border-t border-stone-200 dark:border-slate-800 flex items-center gap-2"
              >
                <label className="p-2 rounded-lg border border-stone-200 dark:border-slate-700 cursor-pointer" title="Joindre image ou fichier">
                  <Paperclip className="w-4 h-4" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={toggleVoiceRecording}
                  className={`p-2 rounded-lg border cursor-pointer ${
                    recording
                      ? 'bg-red-600 text-white border-red-600'
                      : 'border-stone-200 dark:border-slate-700'
                  }`}
                  title={recording ? 'Arrêter enregistrement' : 'Message vocal'}
                >
                  {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Écrivez votre message..."
                  className="flex-1 h-10 px-3 rounded-lg border border-stone-200 dark:border-slate-700 bg-stone-50 dark:bg-slate-950 text-sm"
                />
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="h-10 px-4 rounded-lg bg-slate-900 text-white dark:bg-amber-600 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Envoyer
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-stone-500 p-8">
              Sélectionnez ou démarrez une conversation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
