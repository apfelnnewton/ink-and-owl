/* A black-ground clip drawn through a canvas with its black turned into real transparency (screen blending a <video>
   is not honoured everywhere — hardware-drawn video and iOS ignore it). Used for the Howler (howler.js); the same idea
   as the Prior Incantato smoke (prior.js). loop: the clip is cross-faded into itself so the seam never shows;
   otherwise it plays once and onEnd runs. loopFrom: the point the loop returns to (to skip an opening that should
   happen only once). Brightness becomes alpha; colour is kept (lifted back to full strength). */
const FADE = 1.2;
export function keyed(canvas, {src, still, size = 480, h = 0, loop = false, loopFrom = 0, onEnd = null, reduced = false}){
  const SW = size, SH = h || size;   // a square unless a height is given (the portrait smoke clip)
  canvas.width = SW; canvas.height = SH;
  const out = canvas.getContext('2d'), off = document.createElement('canvas');
  off.width = SW; off.height = SH;
  const ox = off.getContext('2d', {willReadFrequently: true});
  const key = () => {
    const img = ox.getImageData(0, 0, SW, SH), d = img.data;
    for (let i = 0; i < d.length; i += 4){
      const m = Math.max(d[i], d[i + 1], d[i + 2]);
      if (m < 10){ d[i + 3] = 0; continue; }
      const a = Math.min(255, (m - 10) * 1.6);
      const k = 255 / m;
      d[i] = d[i] * k; d[i + 1] = d[i + 1] * k; d[i + 2] = d[i + 2] * k; d[i + 3] = a;
    }
    out.putImageData(img, 0, 0);
  };
  const showStill = () => { if (!still) return; const im = new Image(); im.onload = () => { ox.clearRect(0, 0, SW, SH); ox.drawImage(im, 0, 0, SW, SH); key(); }; im.src = still; };
  let stopped = false, raf = 0, failed = false;
  if (reduced){ showStill(); if (!loop && onEnd) setTimeout(onEnd, 600); return {stop(){}}; }
  const mk = () => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = src; return v; };
  let cur = mk(), nxt = loop ? mk() : null, last = 0, ended = false;
  const fail = () => { if (failed) return; failed = true; showStill(); if (!loop && onEnd) setTimeout(onEnd, 400); };
  cur.addEventListener('error', fail, {once: true});
  cur.play().catch(fail);
  if (!loop) cur.addEventListener('ended', () => { ended = true; }, {once: true});
  const frame = ts => {
    if (stopped || failed) return;
    raf = requestAnimationFrame(frame);
    if (ts - last < 33 || cur.readyState < 2) return;
    last = ts;
    if (loop && cur.duration && cur.duration - cur.currentTime < FADE && nxt.paused){ nxt.currentTime = loopFrom; nxt.play().catch(() => {}); }
    ox.globalAlpha = 1; ox.clearRect(0, 0, SW, SH); ox.drawImage(cur, 0, 0, SW, SH);
    if (loop && !nxt.paused && nxt.readyState >= 2){
      const k = Math.min(1, (nxt.currentTime - loopFrom) / FADE);
      ox.globalAlpha = k; ox.drawImage(nxt, 0, 0, SW, SH); ox.globalAlpha = 1;
      if (k >= 1 || cur.ended){ cur.pause(); [cur, nxt] = [nxt, cur]; }
    }
    key();
    if (ended){ stopped = true; cancelAnimationFrame(raf); if (onEnd) onEnd(); }
  };
  raf = requestAnimationFrame(frame);
  return {stop(){ stopped = true; cancelAnimationFrame(raf); [cur, nxt].forEach(v => { if (!v) return; v.pause(); v.removeAttribute('src'); v.load(); }); }};
}
