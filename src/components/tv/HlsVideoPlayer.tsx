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
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { parseVideoMedia } from '../../lib/media';
import { ResilientImage } from '../ResilientImage';

export interface PlayerSourceMeta {
  title: string;
  subtitle?: string | null;
  logoUrl?: string | null;
  streamUrl: string;
  streamFormat?: 'hls' | 'mp4' | 'embed' | string;
  isLive?: boolean;
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
  onProgress?: (positionSeconds: number, durationSeconds: number) => void;
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
  onProgress,
  actionsSlot,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const appliedInitialSeekRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connectionLabel, setConnectionLabel] = useState<string>('Connexion au flux...');
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1); // -1 = Auto
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reloadNonce, setReloadNonce] = useState(0);

  const mediaInfo = useMemo(() => parseVideoMedia(source.streamUrl), [source.streamUrl]);
  const isEmbed = source.streamFormat === 'embed' || mediaInfo.kind === 'embed';
  const isHlsSource =
    !isEmbed &&
    (source.streamFormat === 'hls' ||
      /\.m3u8(\?.*)?$/i.test(source.streamUrl) ||
      /format=m3u8/i.test(source.streamUrl));

  useEffect(() => {
    appliedInitialSeekRef.current = false;
    setErrorMsg(null);
    setQualityLevels([]);
    setSelectedLevel(-1);
    setCurrentTime(0);
    setDuration(0);
    setIsBuffering(!isEmbed);
    setConnectionLabel(isEmbed ? 'Lecteur intégré prêt' : 'Connexion au flux...');
  }, [source.streamUrl, isEmbed, reloadNonce]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (isEmbed) return;
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    let cancelled = false;
    video.volume = volume;
    video.muted = isMuted;

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

    const handleLoadedMeta = () => {
      if (cancelled) return;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
      tryInitialSeek();
      setIsBuffering(false);
      setConnectionLabel(source.isLive ? 'En direct' : 'Flux prêt');
    };

    const handleCanPlay = () => {
      if (cancelled) return;
      setIsBuffering(false);
      setErrorMsg(null);
      setConnectionLabel(source.isLive ? 'Flux connecté' : 'Prêt à lire');
    };

    const handleWaiting = () => {
      if (cancelled) return;
      setIsBuffering(true);
      setConnectionLabel('Mise en mémoire tampon...');
    };

    const handlePlaying = () => {
      if (cancelled) return;
      setIsPlaying(true);
      setIsBuffering(false);
      setErrorMsg(null);
      setConnectionLabel(source.isLive ? 'En direct' : 'Lecture en cours');
    };

    const handlePause = () => {
      if (cancelled) return;
      setIsPlaying(false);
      setConnectionLabel('En pause');
    };

    const handleTimeUpdate = () => {
      if (cancelled) return;
      setCurrentTime(video.currentTime || 0);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    const handleNativeError = () => {
      if (cancelled) return;
      setIsBuffering(false);
      setIsPlaying(false);
      setConnectionLabel('Flux indisponible');
      setErrorMsg(
        'Le flux vidéo est momentanément inaccessible ou incompatible avec ce navigateur.'
      );
    };

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
        backBufferLength: 60,
        maxBufferLength: 30,
      });
      hlsRef.current = hls;

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
        setIsBuffering(false);
        setConnectionLabel(source.isLive ? 'En direct (HLS)' : 'Prêt (HLS)');
        video.play().catch(() => {
          // Autoplay may require user interaction on mobile/desktop; controls stay ready
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled) return;
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setConnectionLabel('Reprise réseau...');
            setIsBuffering(true);
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setConnectionLabel('Récupération média...');
            hls.recoverMediaError();
          } else {
            setIsBuffering(false);
            setIsPlaying(false);
            setConnectionLabel('Flux indisponible');
            setErrorMsg(
              'Impossible de décoder ce flux HLS. Vérifiez votre connexion ou réessayez.'
            );
            hls.destroy();
          }
        }
      });

      hls.loadSource(source.streamUrl);
      hls.attachMedia(video);
    } else if (isHlsSource && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source.streamUrl;
      video.load();
      video.play().catch(() => {});
    } else {
      video.src = source.streamUrl;
      video.load();
      video.play().catch(() => {});
    }

    return () => {
      cancelled = true;
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
      video.removeAttribute('src');
    };
  }, [source.streamUrl, source.isLive, isEmbed, isHlsSource, reloadNonce]);

  // Periodic watch progress callback for resume playback
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
        setErrorMsg('Appuyez de nouveau pour lancer la lecture audio/vidéo.');
      });
    } else {
      v.pause();
    }
  }, []);

  const toggleMute = () => {
    const v = videoRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (v) v.muted = nextMuted;
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    const v = videoRef.current;
    if (v) {
      v.volume = val;
      if (val > 0 && isMuted) {
        v.muted = false;
        setIsMuted(false);
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
      className="rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-[#04112B] text-white shadow-[0_24px_65px_-20px_rgba(4,17,43,0.75)]"
    >
      {/* Top Channel / Broadcast Identity Bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-[#061A40]/95 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/15 bg-white/10 shrink-0 flex items-center justify-center">
            {source.logoUrl ? (
              <ResilientImage
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
              <h2 className="text-sm sm:text-base font-bold text-white truncate max-w-[260px] sm:max-w-md">
                {source.title}
              </h2>
              {source.isLive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600/90 text-[10px] font-bold tracking-wide text-white uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Direct
                </span>
              )}
            </div>
            {source.subtitle && (
              <p className="text-xs text-blue-200/85 truncate max-w-md">{source.subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-[11px] font-medium text-blue-100">
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
      <div className="relative aspect-video bg-black flex items-center justify-center">
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
              onClick={togglePlay}
              className="w-full h-full object-contain cursor-pointer"
              aria-label={`Lecteur vidéo pour ${source.title}`}
            />

            {isBuffering && !errorMsg && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#04112B]/45 backdrop-blur-[1px]">
                <div className="px-4 py-2.5 rounded-2xl bg-[#061A40]/90 border border-white/15 flex items-center gap-2.5 text-xs font-medium text-white shadow-lg">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#F5B82E]" aria-hidden="true" />
                  <span>{connectionLabel}</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#04112B]/90 p-6 text-center">
                <div className="max-w-md space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/30 text-rose-300 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-white">Interruption du flux</p>
                  <p className="text-xs text-blue-100/80 leading-relaxed">{errorMsg}</p>
                  <button
                    type="button"
                    onClick={() => setReloadNonce((n) => n + 1)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5B82E] hover:bg-[#FACC15] text-[#061A40] text-xs font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    Réessayer le flux
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Custom Player Controls Bar (for HLS / MP4 streams) */}
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

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
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
                className="w-11 h-11 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white cursor-pointer"
                aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-300" />
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
                className="w-20 sm:w-28 accent-[#F5B82E] cursor-pointer"
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
                    <div className="absolute right-0 bottom-13 w-36 rounded-xl border border-white/15 bg-[#061A40] shadow-xl p-1.5 z-30 space-y-0.5">
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
