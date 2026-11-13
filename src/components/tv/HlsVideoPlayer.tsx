import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertTriangle,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Settings2,
  SkipForward,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { parseVideoMedia } from '../../lib/media';
import { ResilientImage } from '../ResilientImage';

export interface PlayerSourceMeta {
  id?: number | string;
  title: string;
  subtitle?: string | null;
  logoUrl?: string | null;
  streamUrl: string;
  streamFormat?: 'hls' | 'mp4' | 'embed' | string;
  isLive?: boolean;
  country?: string | null;
  language?: string | null;
  category?: string | null;
}

interface QualityLevel {
  index: number;
  label: string;
  height: number;
  bitrate: number;
}

interface HlsVideoPlayerProps {
  source: PlayerSourceMeta;
  initialPositionSeconds?: number;
  autoPlayMuted?: boolean;
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
  onPlaybackReady?: (info: { streamUrl: string; codecInfo?: string }) => void;
  onPlaybackFailed?: (reason: string, kind: 'unavailable' | 'incompatible') => void;
  onNextChannel?: () => void;
  actionsSlot?: React.ReactNode;
}

function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const HlsVideoPlayer: React.FC<HlsVideoPlayerProps> = ({
  source,
  initialPositionSeconds = 0,
  autoPlayMuted = true,
  onProgress,
  onPlaybackReady,
  onPlaybackFailed,
  onNextChannel,
  actionsSlot,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const appliedInitialSeekRef = useRef(false);
  const hasUserUnmutedRef = useRef(!autoPlayMuted);
  const hasErrorRef = useRef(false);
  const onPlaybackReadyRef = useRef(onPlaybackReady);
  const onPlaybackFailedRef = useRef(onPlaybackFailed);

  onPlaybackReadyRef.current = onPlaybackReady;
  onPlaybackFailedRef.current = onPlaybackFailed;

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(autoPlayMuted);
  const [volume, setVolume] = useState(0.85);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [connectionLabel, setConnectionLabel] = useState<string>('Chargement de la chaîne...');
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [useProxy, setUseProxy] = useState(false);

  useEffect(() => {
    setUseProxy(false);
  }, [source.streamUrl]);

  const mediaInfo = useMemo(() => parseVideoMedia(source.streamUrl), [source.streamUrl]);
  const isEmbed = source.streamFormat === 'embed' || mediaInfo.kind === 'embed';
  const isHlsSource =
    !isEmbed &&
    (source.streamFormat === 'hls' ||
      /\.m3u8(\?.*)?$/i.test(source.streamUrl) ||
      /format=m3u8/i.test(source.streamUrl));

  const effectiveStreamUrl = useMemo(() => {
    if (isEmbed || !isHlsSource) return source.streamUrl;
    // Always use backend stream proxy by default on web to eliminate CORS & Mixed Content 100%
    return `/api/public/tv/stream-proxy?url=${encodeURIComponent(source.streamUrl)}`;
  }, [source.streamUrl, isEmbed, isHlsSource]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    appliedInitialSeekRef.current = false;
    hasErrorRef.current = false;
    setErrorMsg(null);
    setErrorDetail(null);
    setQualityLevels([]);
    setSelectedLevel(-1);
    setQualityMenuOpen(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsBuffering(!isEmbed);
    setConnectionLabel(isEmbed ? 'Lecture en cours.' : 'Chargement de la chaîne...');
  }, [source.streamUrl, isEmbed, reloadNonce]);

  useEffect(() => {
    if (isEmbed) {
      onPlaybackReadyRef.current?.({ streamUrl: source.streamUrl });
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // 1. Clean teardown of any previous stream so no two streams can ever play concurrently
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.pause();
    video.removeAttribute('src');
    video.load();

    // Mixed content protection check before attempting HTTPS->HTTP load
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      source.streamUrl.startsWith('http://')
    ) {
      const msg = 'Impossible de lire cette chaîne.';
      const detail =
        'Ce flux utilise HTTP non sécurisé et est bloqué par la sécurité HTTPS du navigateur.';
      setIsBuffering(false);
      setIsPlaying(false);
      setErrorMsg(msg);
      setErrorDetail(detail);
      setConnectionLabel(msg);
      onPlaybackFailedRef.current?.(detail, 'incompatible');
      return;
    }

    let cancelled = false;
    let playbackConfirmed = false;
    let networkRetries = 0;
    let mediaRecoverAttempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const shouldStartMuted = !hasUserUnmutedRef.current;
    video.volume = volume;
    video.muted = shouldStartMuted;
    setIsMuted(shouldStartMuted);

    const attemptAutoPlay = async () => {
      if (cancelled) return;
      try {
        await video.play();
      } catch {
        // Browser policy blocked unmuted autoplay: fall back to muted autoplay cleanly
        if (cancelled) return;
        video.muted = true;
        setIsMuted(true);
        try {
          await video.play();
        } catch {
          // User interaction will still play cleanly on tap
        }
      }
    };

    const tryInitialSeek = () => {
      if (
        !appliedInitialSeekRef.current &&
        initialPositionSeconds > 5 &&
        Number.isFinite(video.duration) &&
        video.duration > initialPositionSeconds + 5
      ) {
        video.currentTime = initialPositionSeconds;
        appliedInitialSeekRef.current = true;
      }
    };

    const watchdogTimer = setTimeout(() => {
      if (!cancelled && !playbackConfirmed) {
        hasErrorRef.current = true;
        setIsBuffering(false);
        setIsPlaying(false);
        setErrorMsg('Cette chaîne est temporairement indisponible.');
        setErrorDetail(
          'Le flux met trop de temps à répondre (délai de connexion dépassé). Essayez une autre chaîne ou réessayez.'
        );
        setConnectionLabel('Cette chaîne est temporairement indisponible.');
        onPlaybackFailedRef.current?.(
          'Délai dépassé lors de la connexion au flux vidéo.',
          'unavailable'
        );
      }
    }, 13000);

    const handleLoadStart = () => {
      if (cancelled) return;
      setConnectionLabel('Connexion au flux...');
    };

    const handleLoadedMeta = () => {
      if (cancelled) return;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
      tryInitialSeek();
      setConnectionLabel('Connexion au flux...');
    };

    const handleCanPlay = () => {
      if (cancelled) return;
      hasErrorRef.current = false;
      setIsBuffering(false);
      setErrorMsg(null);
      setErrorDetail(null);
      void attemptAutoPlay();
    };

    const handleWaiting = () => {
      if (cancelled || hasErrorRef.current) return;
      setIsBuffering(true);
      setConnectionLabel('Connexion au flux...');
    };

    const handlePlaying = () => {
      if (cancelled) return;
      playbackConfirmed = true;
      hasErrorRef.current = false;
      setIsPlaying(true);
      setIsBuffering(false);
      setErrorMsg(null);
      setErrorDetail(null);
      setConnectionLabel('Lecture en cours.');
      onPlaybackReadyRef.current?.({ streamUrl: source.streamUrl });
    };

    const handlePause = () => {
      if (cancelled) return;
      setIsPlaying(false);
      if (!hasErrorRef.current) {
        setConnectionLabel('Lecture en pause.');
      }
    };

    const handleTimeUpdate = () => {
      if (cancelled) return;
      if ((video.currentTime || 0) > 0.1 && !playbackConfirmed) {
        playbackConfirmed = true;
        hasErrorRef.current = false;
        setIsBuffering(false);
        setIsPlaying(!video.paused);
        setConnectionLabel('Lecture en cours.');
        onPlaybackReadyRef.current?.({ streamUrl: source.streamUrl });
      }
      setCurrentTime(video.currentTime || 0);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    const handleNativeError = () => {
      if (cancelled) return;
      hasErrorRef.current = true;
      setIsBuffering(false);
      setIsPlaying(false);
      setErrorMsg('Impossible de lire cette chaîne.');
      setErrorDetail(
        'Le navigateur n’a pas pu décoder ce flux vidéo ou la source est inaccessible.'
      );
      setConnectionLabel('Impossible de lire cette chaîne.');
      onPlaybackFailedRef.current?.('Erreur native du lecteur vidéo HTML5.', 'incompatible');
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadedmetadata', handleLoadedMeta);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('error', handleNativeError);

    if (isHlsSource && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: Boolean(source.isLive),
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        backBufferLength: 60,
        maxBufferLength: 30,
        manifestLoadingTimeOut: 9000,
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut: 9000,
        levelLoadingMaxRetry: 2,
        fragLoadingTimeOut: 9000,
        fragLoadingMaxRetry: 3,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_LOADING, () => {
        if (!cancelled) setConnectionLabel('Connexion au flux...');
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (cancelled) return;
        const levels: QualityLevel[] = data.levels.map((lvl, idx) => ({
          index: idx,
          height: lvl.height || 0,
          bitrate: lvl.bitrate || 0,
          label: lvl.height
            ? `${lvl.height}p`
            : `${Math.max(100, Math.round((lvl.bitrate || 0) / 1000))} kbps`,
        }));
        setQualityLevels(levels);
        setConnectionLabel('Connexion au flux...');
        void attemptAutoPlay();
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (!cancelled && !playbackConfirmed) {
          setIsBuffering(false);
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
          networkRetries += 1;
          setConnectionLabel('Connexion au flux...');
          setIsBuffering(true);
          retryTimer = setTimeout(() => {
            if (!cancelled && hlsRef.current) {
              hlsRef.current.startLoad();
            }
          }, 1200 * networkRetries);
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoverAttempts < 2) {
          mediaRecoverAttempts += 1;
          setConnectionLabel('Connexion au flux...');
          if (mediaRecoverAttempts === 2) {
            hls.swapAudioCodec();
          }
          hls.recoverMediaError();
          return;
        }

        hasErrorRef.current = true;
        setIsBuffering(false);
        setIsPlaying(false);
        const httpStatus = data.response?.code;
        const isCorsOrCodec =
          data.type === Hls.ErrorTypes.MEDIA_ERROR ||
          (data.type === Hls.ErrorTypes.NETWORK_ERROR && !httpStatus && data.details?.includes('manifestLoadError'));

        if (isCorsOrCodec && !useProxy) {
          hls.destroy();
          if (hlsRef.current === hls) {
            hlsRef.current = null;
          }
          setUseProxy(true);
          setConnectionLabel('Basculement vers le proxy de streaming sécurisé...');
          return;
        }

        if (httpStatus && httpStatus >= 400) {
          const reason = `Le serveur de diffusion a retourné HTTP ${httpStatus}.`;
          setErrorMsg('Cette chaîne est temporairement indisponible.');
          setErrorDetail(reason);
          setConnectionLabel('Cette chaîne est temporairement indisponible.');
          onPlaybackFailedRef.current?.(reason, 'unavailable');
        } else if (isCorsOrCodec) {
          const reason =
            'Flux bloqué par les règles CORS du diffuseur ou codec non compatible avec ce navigateur.';
          setErrorMsg('Impossible de lire cette chaîne.');
          setErrorDetail(reason);
          setConnectionLabel('Impossible de lire cette chaîne.');
          onPlaybackFailedRef.current?.(reason, 'incompatible');
        } else {
          const reason = 'Interruption réseau ou flux temporairement hors ligne.';
          setErrorMsg('Cette chaîne est temporairement indisponible.');
          setErrorDetail(reason);
          setConnectionLabel('Cette chaîne est temporairement indisponible.');
          onPlaybackFailedRef.current?.(reason, 'unavailable');
        }

        hls.destroy();
        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }
      });

      hls.loadSource(effectiveStreamUrl);
      hls.attachMedia(video);
    } else if (isHlsSource && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = effectiveStreamUrl;
      video.load();
      void attemptAutoPlay();
    } else {
      video.src = effectiveStreamUrl;
      video.load();
      void attemptAutoPlay();
    }

    return () => {
      cancelled = true;
      clearTimeout(watchdogTimer);
      if (retryTimer) clearTimeout(retryTimer);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadedmetadata', handleLoadedMeta);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('error', handleNativeError);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [source.streamUrl, source.isLive, isEmbed, isHlsSource, reloadNonce]);

  useEffect(() => {
    if (!onProgress || isEmbed) return;
    const timer = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused && v.currentTime > 1) {
        onProgress(v.currentTime, Number.isFinite(v.duration) ? v.duration : 0);
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [onProgress, isEmbed]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {
        v.muted = true;
        setIsMuted(true);
        v.play().catch(() => {
          setErrorMsg('Impossible de lire cette chaîne.');
        });
      });
    } else {
      v.pause();
    }
  }, []);

  const activateSound = useCallback(() => {
    const v = videoRef.current;
    hasUserUnmutedRef.current = true;
    setIsMuted(false);
    const targetVol = volume > 0 ? volume : 0.85;
    if (volume === 0) setVolume(targetVol);
    if (v) {
      v.muted = false;
      v.volume = targetVol;
      if (v.paused) {
        v.play().catch(() => {});
      }
    }
  }, [volume]);

  const toggleMute = () => {
    if (isMuted) {
      activateSound();
    } else {
      hasUserUnmutedRef.current = false;
      setIsMuted(true);
      if (videoRef.current) videoRef.current.muted = true;
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    const v = videoRef.current;
    if (v) {
      v.volume = val;
      if (val > 0 && isMuted) {
        hasUserUnmutedRef.current = true;
        v.muted = false;
        setIsMuted(false);
      } else if (val === 0) {
        v.muted = true;
        setIsMuted(true);
      }
    }
  };

  const handleQualitySelect = (levelIdx: number) => {
    setSelectedLevel(levelIdx);
    setQualityMenuOpen(false);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIdx;
    }
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (container?.requestFullscreen) {
      await container.requestFullscreen().catch(() => {
        video?.webkitEnterFullscreen?.();
      });
    } else {
      video?.webkitEnterFullscreen?.();
    }
  };

  const handleSeek = (nextSec: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(duration) || duration <= 0) return;
    v.currentTime = nextSec;
    setCurrentTime(nextSec);
  };

  return (
    <div
      ref={containerRef}
      className="rounded-3xl overflow-hidden border border-white/10 bg-[#04112B] text-white shadow-[0_24px_65px_-20px_rgba(4,17,43,0.75)]"
    >
      {/* Top Channel / Broadcast Identity Bar */}
      <div className="px-4 sm:px-5 py-3.5 bg-[#061A40] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/15 bg-white/10 shrink-0 flex items-center justify-center">
            {source.logoUrl ? (
              <ResilientImage
                key={source.logoUrl}
                src={source.logoUrl}
                alt={source.title}
                className="w-full h-full object-contain p-1"
              />
            ) : (
              <Radio className="w-5 h-5 text-[#F5B82E]" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[220px] sm:max-w-md">
                {source.title}
              </h2>
              {source.isLive && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-600 text-[10px] font-bold tracking-wide text-white uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  EN DIRECT
                </span>
              )}
            </div>
            {source.subtitle && (
              <p className="text-xs text-blue-200/85 truncate max-w-md">{source.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 border border-white/10 text-[11px] font-medium text-blue-100">
            <Wifi
              className={`w-3.5 h-3.5 ${
                errorMsg
                  ? 'text-rose-400'
                  : isBuffering
                    ? 'text-[#F5B82E]'
                    : 'text-emerald-400'
              }`}
              aria-hidden="true"
            />
            <span>{connectionLabel}</span>
          </span>
          {actionsSlot}
        </div>
      </div>

      {/* Video Stage */}
      <div className="relative aspect-video bg-[#020A1B] flex items-center justify-center">
        {isEmbed && mediaInfo.embedUrl ? (
          <iframe
            src={mediaInfo.embedUrl}
            title={source.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted={isMuted}
              onClick={togglePlay}
              className="w-full h-full object-contain cursor-pointer bg-black"
              aria-label={`Lecteur vidéo pour ${source.title}`}
            />

            {/* Unmute CTA while muted autoplay is active */}
            {!errorMsg && isMuted && (isPlaying || !isBuffering) && (
              <button
                type="button"
                onClick={activateSound}
                data-testid="unmute-cta"
                className="absolute bottom-4 left-4 z-20 min-h-[44px] px-4 py-2 rounded-xl bg-[#F5B82E] hover:bg-[#FACC15] text-[#04112B] text-xs font-extrabold shadow-lg inline-flex items-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
              >
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                <span>Activer le son</span>
              </button>
            )}

            {/* Informative Loading / Connection Overlay (never an unexplained black screen) */}
            {isBuffering && !errorMsg && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#04112B]/80 via-[#061A40]/75 to-[#04112B]/85 px-6 text-center">
                {source.logoUrl && (
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/10 border border-white/15 p-1.5">
                    <ResilientImage
                      key={`overlay-${source.logoUrl}`}
                      src={source.logoUrl}
                      alt={source.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div className="px-4 py-2 rounded-xl bg-[#04112B]/90 border border-white/15 flex items-center gap-2.5 text-xs font-semibold text-white shadow-lg">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#F5B82E]" aria-hidden="true" />
                  <span>{connectionLabel}</span>
                </div>
              </div>
            )}

            {/* Error Overlay */}
            {errorMsg && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#04112B]/95 p-6 text-center">
                <div className="max-w-md space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/30 text-rose-300 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <p className="text-sm sm:text-base font-bold text-white">{errorMsg}</p>
                  {errorDetail && (
                    <p className="text-xs text-blue-100/80 leading-relaxed">{errorDetail}</p>
                  )}
                  <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setReloadNonce((n) => n + 1)}
                      className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F5B82E] hover:bg-[#FACC15] text-[#061A40] text-xs font-bold cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      Réessayer le flux
                    </button>
                    {onNextChannel && (
                      <button
                        type="button"
                        onClick={onNextChannel}
                        className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#2563EB] text-white text-xs font-semibold cursor-pointer"
                      >
                        <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                        Chaîne suivante
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Custom Player Controls Bar (HLS / MP4) */}
      {!isEmbed && (
        <div className="px-4 sm:px-5 py-3 bg-[#051536] border-t border-white/10 space-y-2">
          {duration > 0 && Number.isFinite(duration) && (
            <div className="flex items-center gap-3 text-[11px] font-mono-tabular text-blue-200">
              <span className="w-12 text-right tabular-nums">{formatSeconds(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={Math.floor(duration)}
                value={Math.min(Math.floor(currentTime), Math.floor(duration))}
                onChange={(e) => handleSeek(Number(e.target.value))}
                aria-label="Position de lecture"
                className="flex-1 accent-[#F5B82E] h-1.5 cursor-pointer"
              />
              <span className="w-12 tabular-nums">{formatSeconds(duration)}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="min-w-[44px] h-11 px-3.5 rounded-xl bg-[#1D4ED8] hover:bg-[#2563EB] text-white inline-flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer"
                aria-label={isPlaying ? 'Mettre en pause' : 'Lire le flux'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Lecture'}</span>
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className={`min-w-[44px] h-11 px-3 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer ${
                  isMuted
                    ? 'border-[#F5B82E]/70 bg-[#F5B82E]/15 text-[#F5B82E] hover:bg-[#F5B82E]/25'
                    : 'border-white/15 bg-white/5 hover:bg-white/10 text-white'
                }`}
                aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
              >
                {isMuted || volume === 0 ? (
                  <>
                    <VolumeX className="w-4 h-4" />
                    <span className="hidden md:inline">Activer le son</span>
                  </>
                ) : (
                  <Volume2 className="w-4 h-4 text-[#F5B82E]" />
                )}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                aria-label="Volume"
                className="w-20 sm:w-24 accent-[#F5B82E] cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 relative">
              {qualityLevels.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setQualityMenuOpen((v) => !v)}
                    className="h-11 px-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 inline-flex items-center gap-1.5 text-xs font-medium text-blue-100 cursor-pointer"
                    aria-label="Sélectionner la qualité vidéo"
                  >
                    <Settings2 className="w-4 h-4 text-[#F5B82E]" />
                    <span>
                      {selectedLevel === -1
                        ? 'Auto'
                        : qualityLevels.find((q) => q.index === selectedLevel)?.label || 'Qualité'}
                    </span>
                  </button>

                  {qualityMenuOpen && (
                    <div className="absolute right-0 bottom-13 w-40 rounded-xl border border-white/15 bg-[#061A40] shadow-xl p-1.5 z-30 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => handleQualitySelect(-1)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium cursor-pointer ${
                          selectedLevel === -1
                            ? 'bg-[#1D4ED8] text-white'
                            : 'text-blue-100 hover:bg-white/10'
                        }`}
                      >
                        Auto (Adaptatif)
                      </button>
                      {qualityLevels.map((lvl) => (
                        <button
                          key={lvl.index}
                          type="button"
                          onClick={() => handleQualitySelect(lvl.index)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium cursor-pointer ${
                            selectedLevel === lvl.index
                              ? 'bg-[#1D4ED8] text-white'
                              : 'text-blue-100 hover:bg-white/10'
                          }`}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setReloadNonce((n) => n + 1)}
                className="w-11 h-11 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-blue-100 cursor-pointer"
                title="Actualiser le flux"
                aria-label="Actualiser le flux"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="w-11 h-11 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white cursor-pointer"
                title="Plein écran"
                aria-label="Plein écran"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
