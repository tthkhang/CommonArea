// YouTube helpers: link parsing, IFrame API loading, metadata probe, player factory.

export function parseYouTubeId(input) {
  const text = (input || '').trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  let url;
  try {
    url = new URL(text.startsWith('http') ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) id = m[1];
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

let apiPromise;
export function loadYouTubeApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('Could not load the YouTube player (offline?)'));
    document.head.append(s);
  });
  return apiPromise;
}

/** Create a YT.Player inside `host` and resolve once it is ready. */
export async function createPlayer(host, { width, height, onState, onError }) {
  const YT = await loadYouTubeApi();
  return new Promise((resolve) => {
    const player = new YT.Player(host, {
      width,
      height,
      playerVars: { controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1, fs: 0 },
      events: {
        onReady: () => resolve(player),
        onStateChange: (e) => onState && onState(e.data),
        onError: (e) => onError && onError(e.data),
      },
    });
  });
}

/**
 * Looks up title + duration of a video with a hidden player (YouTube's IFrame API
 * is the only no-API-key way to get the duration). Rejects if it can't be played/embedded.
 */
let probe;
let probeBusy = Promise.resolve();
export function probeVideo(videoId) {
  const run = async () => {
    if (!probe) {
      const host = document.createElement('div');
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:120px;';
      box.append(host);
      document.body.append(box);
      let resolveState = () => {};
      let rejectErr = () => {};
      const p = await createPlayer(host, {
        width: 200,
        height: 120,
        onState: (s) => resolveState(s),
        onError: (c) => rejectErr(c),
      });
      probe = { player: p, setHandlers: (a, b) => { resolveState = a; rejectErr = b; } };
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out reading the video')), 10000);
      const done = (fn, v) => { clearTimeout(timer); probe.setHandlers(() => {}, () => {}); fn(v); };
      probe.setHandlers(
        (state) => {
          if (state === 5 /* CUED */) {
            const duration = probe.player.getDuration();
            const title = (probe.player.getVideoData() || {}).title || videoId;
            if (duration > 0) done(resolve, { videoId, title, duration });
          }
        },
        (code) => done(reject, new Error(
          code === 101 || code === 150
            ? 'The owner does not allow this video to be embedded'
            : 'This video is not available'
        ))
      );
      probe.player.cueVideoById(videoId);
    });
  };
  // one probe at a time
  const result = probeBusy.then(run, run);
  probeBusy = result.catch(() => {});
  return result;
}
