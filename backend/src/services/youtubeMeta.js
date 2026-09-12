/**
 * YouTube metadata helpers for Watch (long_video) — embed-only, no downloads.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');

const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extract an 11-char YouTube video id from common URL shapes.
 * Accepts watch, youtu.be, shorts, embed. Rejects playlists/channels without a video id.
 * @param {string} input
 * @returns {string|null}
 */
function parseYoutubeVideoId(input) {
  if (!input || typeof input !== 'string') return null;
  const raw = input.trim();
  if (VIDEO_ID_RE.test(raw)) return raw;

  let url;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    return null;
  }

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] || '';
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  const v = url.searchParams.get('v');
  if (v && VIDEO_ID_RE.test(v)) return v;

  const parts = url.pathname.split('/').filter(Boolean);
  // /shorts/ID, /embed/ID, /live/ID, /v/ID
  if (parts.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
    const id = parts[1];
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  return null;
}

function httpGetJson(urlString, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch (e) {
      reject(e);
      return;
    }
    const lib = parsed.protocol === 'http:' ? http : https;
    const req = lib.get(
      urlString,
      {
        timeout: timeoutMs,
        headers: { Accept: 'application/json', 'User-Agent': 'TaatomWatch/1.0' },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpGetJson(res.headers.location, timeoutMs).then(resolve, reject);
          res.resume();
          return;
        }
        let body = '';
        res.on('data', (c) => {
          body += c;
          if (body.length > 2_000_000) {
            req.destroy();
            reject(new Error('Response too large'));
          }
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/** Parse ISO-8601 duration (PT#H#M#S) to seconds. */
function parseIso8601Duration(iso) {
  if (!iso || typeof iso !== 'string') return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  return h * 3600 + min * 60 + s;
}

async function fetchViaDataApi(videoId, apiKey) {
  const url =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
  const data = await httpGetJson(url);
  const item = data?.items?.[0];
  if (!item) {
    const err = new Error('Video not found on YouTube');
    err.code = 'YOUTUBE_NOT_FOUND';
    throw err;
  }
  const sn = item.snippet || {};
  const thumbs = sn.thumbnails || {};
  const thumb =
    thumbs.maxres?.url || thumbs.standard?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || null;
  return {
    youtubeVideoId: videoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    title: sn.title || '',
    description: sn.description || '',
    thumbnailUrl: thumb,
    youtubeChannelTitle: sn.channelTitle || null,
    durationSeconds: parseIso8601Duration(item.contentDetails?.duration),
    source: 'youtube',
  };
}

async function fetchViaOEmbed(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  const data = await httpGetJson(oembedUrl);
  return {
    youtubeVideoId: videoId,
    youtubeUrl: watchUrl,
    title: data.title || '',
    description: '',
    thumbnailUrl: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    youtubeChannelTitle: data.author_name || null,
    durationSeconds: null,
    source: 'youtube',
  };
}

/**
 * Resolve metadata for a YouTube URL or bare video id.
 * @param {string} urlOrId
 * @returns {Promise<object>}
 */
async function fetchYoutubeMeta(urlOrId) {
  const videoId = parseYoutubeVideoId(urlOrId);
  if (!videoId) {
    const err = new Error('Invalid YouTube URL or video id');
    err.code = 'YOUTUBE_INVALID_URL';
    throw err;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      return await fetchViaDataApi(videoId, apiKey);
    } catch (e) {
      // Fall through to oEmbed for quota/network issues
      if (e.code === 'YOUTUBE_NOT_FOUND') throw e;
    }
  }

  try {
    return await fetchViaOEmbed(videoId);
  } catch (e) {
    const err = new Error('Unable to fetch YouTube metadata');
    err.code = 'YOUTUBE_META_FAILED';
    err.cause = e;
    throw err;
  }
}

module.exports = {
  parseYoutubeVideoId,
  fetchYoutubeMeta,
  parseIso8601Duration,
};
