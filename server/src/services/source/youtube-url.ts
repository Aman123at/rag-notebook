import { AppError } from '@/errors/AppError.js';
import type { YouTubeRef } from '@/types/sources.types.js';

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YT_PLAYLIST_RE = /^[A-Za-z0-9_-]{10,64}$/;

export function parseYouTubeUrl(
  raw: string,
  expected: 'YOUTUBE_VIDEO' | 'YOUTUBE_PLAYLIST',
): YouTubeRef {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Not a valid URL.', { exposeDetails: false });
  }
  const host = url.hostname
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/^m\./, '');
  const path = url.pathname;
  const v = url.searchParams.get('v');
  const list = url.searchParams.get('list');

  const isYtHost = host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com';
  if (!isYtHost) {
    throw new AppError('VALIDATION_ERROR', 'Not a YouTube URL.', { exposeDetails: false });
  }

  let videoId: string | null = null;
  let playlistId: string | null = null;

  if (host === 'youtu.be') {
    const id = path.slice(1);
    if (YT_ID_RE.test(id)) videoId = id;
  } else if (path === '/watch') {
    if (v && YT_ID_RE.test(v)) videoId = v;
    if (list && YT_PLAYLIST_RE.test(list)) playlistId = list;
  } else if (path.startsWith('/shorts/')) {
    const id = path.slice('/shorts/'.length).split('/')[0] ?? '';
    if (YT_ID_RE.test(id)) videoId = id;
  } else if (path.startsWith('/embed/')) {
    const id = path.slice('/embed/'.length).split('/')[0] ?? '';
    if (YT_ID_RE.test(id)) videoId = id;
  } else if (path === '/playlist') {
    if (list && YT_PLAYLIST_RE.test(list)) playlistId = list;
  }

  if (expected === 'YOUTUBE_VIDEO') {
    if (!videoId) {
      throw new AppError('VALIDATION_ERROR', 'Could not extract a YouTube video id.', {
        exposeDetails: false,
      });
    }
    return { kind: 'video', videoId };
  }

  if (!playlistId) {
    throw new AppError('VALIDATION_ERROR', 'Could not extract a YouTube playlist id.', {
      exposeDetails: false,
    });
  }
  return { kind: 'playlist', playlistId };
}
