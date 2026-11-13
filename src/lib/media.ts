export interface ParsedVideoMedia {
  kind: 'embed' | 'video' | 'link';
  embedUrl?: string;
  rawUrl: string;
}

export function parseVideoMedia(rawUrl: string): ParsedVideoMedia {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { kind: 'link', rawUrl: '' };
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const vid = parsed.searchParams.get('v');
        if (vid) {
          return {
            kind: 'embed',
            embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?rel=0`,
            rawUrl: trimmed,
          };
        }
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const vid = parsed.pathname.split('/')[2];
        if (vid) {
          return {
            kind: 'embed',
            embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?rel=0`,
            rawUrl: trimmed,
          };
        }
      }
      if (parsed.pathname.startsWith('/live/')) {
        const vid = parsed.pathname.split('/')[2];
        if (vid) {
          return {
            kind: 'embed',
            embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?rel=0`,
            rawUrl: trimmed,
          };
        }
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return { kind: 'embed', embedUrl: trimmed, rawUrl: trimmed };
      }
    }

    if (host === 'youtu.be') {
      const vid = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (vid) {
        return {
          kind: 'embed',
          embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid)}?rel=0`,
          rawUrl: trimmed,
        };
      }
    }

    if (host === 'vimeo.com') {
      const vid = parsed.pathname.replace(/^\//, '').split('/')[0];
      if (vid && /^\d+$/.test(vid)) {
        return {
          kind: 'embed',
          embedUrl: `https://player.vimeo.com/video/${vid}`,
          rawUrl: trimmed,
        };
      }
    }
  } catch {
    // Non-standard URL or relative path
  }

  if (/\.(mp4|webm|ogg|m3u8)(\?.*)?$/i.test(trimmed) || trimmed.startsWith('data:video/')) {
    return { kind: 'video', rawUrl: trimmed };
  }

  return { kind: 'video', rawUrl: trimmed };
}
