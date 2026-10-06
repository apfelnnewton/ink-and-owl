/* Casting a spell by its wand movement (2026-10-06 user decision): the learner's own wand floats in from the bottom
   right, a faint gold dotted path shows the movement (shapes after the "Wand Movements for Common Spells" chart the user
   chose — redrawn here, the chart itself is not used), and a finger or the mouse traces it. The wand's tip follows the
   finger and leaves a trail in the colour of its core. Judged leniently: the stroke is resampled and compared point
   by point with the path (also after scaling it to the path's box), so shape and direction matter, size, place and speed
   do not; closed shapes may start anywhere. Two misses and the wand shows the way itself, then lets it pass. With reduced motion there is one button instead. */
import * as wand from './wand.js';
import {reduced, wait} from './ui.js';

/* the paths, in a unit box (x right, y down) */
const arc = (cx, cy, r, a0, a1, n = 24) => Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const PI = Math.PI;
export const PATHS = {
  expelliarmus: [[.14, .32], [.82, .32], [.82, .82]],
  protego: [[.2, .2], [.47, .82], [.8, .16]],
  finite: [[.82, .3], [.22, .3], [.22, .82]],
  reparo: [[.25, .25], [.25, .75], [.75, .75], [.75, .25], [.27, .25]],
  locomotor: [[.62, .14], [.2, .62], [.86, .62]],
  duro: [[.32, .18], ...arc(.32, .5, .32, -PI / 2, PI / 2).slice(1)],
  riddikulus: [...arc(.48, .3, .36, PI * .92, PI * .1, 20), [.9, .14]],
  lumos: [[.08, .66], [.38, .66], ...arc(.46, .48, .16, PI * .85, -PI * 1.15, 22).slice(1), [.56, .66], [.92, .66]],
  patronum: Array.from({length: 49}, (_, i) => { const t = i / 48, a = -PI / 2 + t * PI * 3, r = .4 - t * .3; return [.5 + Math.cos(a) * r, .5 + Math.sin(a) * r]; }),
  stupefy: [[.5, .12], [.5, .88]],
  aguamenti: Array.from({length: 33}, (_, i) => { const t = i / 32; return [.08 + t * .84, .5 - Math.sin(t * PI * 2) * .2]; }),
  arresto: [[.12, .82], [.31, .2], [.5, .6], [.69, .2], [.88, .82]],
  prior: arc(.5, .5, .34, -PI / 2, -PI / 2 - PI * 2, 36),
  confundo: [[.34, .16], [.78, .74], [.2, .74]],
  revelio: [...Array.from({length: 25}, (_, i) => { const t = i / 24; return [.5 + Math.sin(t * PI * 2) * -.14, .26 + t * .48]; }), ...arc(.5, .5, .38, PI / 2, PI / 2 + PI * 2, 32).slice(1)],
  descendo: [[.4, .44], [.4, .14], ...arc(.4, .27, .13, -PI / 2, PI / 2, 14).slice(1), [.4, .4], [.4, .88]],
  silencio: [...arc(.46, .3, .14, PI, PI * 2, 12), [.6, .88]],
  impedimenta: [[.86, .5], [.14, .5]],
  petrificus: [[.14, .5], [.86, .5]]
};

const N = 40;
function resample(pts, n = N){
  const d = [0]; for (let i = 1; i < pts.length; i++) d.push(d[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = d[d.length - 1] || 1, out = [];
  for (let k = 0, j = 1; k < n; k++){
    const t = L * k / (n - 1);
    while (j < d.length - 1 && d[j] < t) j++;
    const a = pts[j - 1], b = pts[j], s = (t - d[j - 1]) / ((d[j] - d[j - 1]) || 1);
    out.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s]);
  }
  return {pts: out, len: L};
}
/* how far the stroke is from the path, as a share of the path box (0 = exact) */
/* 2026-10-06: a hand-drawn square kept failing, so judging is looser — the stroke is compared in its own box scaled to
   the path's box (where on the screen it is drawn does not matter), and a closed shape (a square, a circle) may start
   at any point and go either way round */
const closed = p => Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < .08;
function fit(pts, ref){
  const bb = q => { const xs = q.map(p => p[0]), ys = q.map(p => p[1]); return {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)}; };
  const a = bb(pts), b = bb(ref), k = Math.max(b.w, b.h) / (Math.max(a.w, a.h) || 1);
  const ca = [a.x + a.w / 2, a.y + a.h / 2], cb = [b.x + b.w / 2, b.y + b.h / 2];
  return pts.map(p => [cb[0] + (p[0] - ca[0]) * k, cb[1] + (p[1] - ca[1]) * k]);
}
const dist = (A, B) => A.reduce((s, p, i) => s + Math.hypot(p[0] - B[i][0], p[1] - B[i][1]), 0) / A.length;
export function score(stroke, path){
  if (stroke.length < 4) return 9;
  const A = resample(stroke), B = resample(path);
  const short = Math.max(0, .5 - A.len / B.len);   // a flick is not the movement
  const raw = dist(A.pts, B.pts), fitted = dist(fit(A.pts, B.pts), B.pts);
  let best = Math.min(raw, fitted);
  if (closed(path)){
    const ring = B.pts.slice(0, -1), F = fit(A.pts, B.pts);
    for (const dir of [1, -1]) for (let st = 0; st < ring.length; st += 2){
      const R = Array.from({length: N}, (_, i) => ring[((st + dir * Math.round(i * ring.length / (N - 1))) % ring.length + ring.length) % ring.length]);
      best = Math.min(best, dist(F, R));
    }
  }
  return best + short;
}
const PASS = .27;

/* the guide, the trail and the wand on a full-screen layer over host; resolves when the spell is cast */
export function cast(host, {path, label = ''}){
  return new Promise(done => {
    const P = PATHS[path], w = wand.get(), core = w ? wand.CORES[w.core].spark : '#F2B24C';
    const layer = document.createElement('div');
    layer.className = 'tr-layer';
    layer.innerHTML = `<canvas class="tr-cv"></canvas><figure class="tr-wand" aria-hidden="true"><img src="${wand.img(w ? w.wood : 'oak')}" alt=""></figure>` +
      `<p class="tr-tip" aria-live="polite">${label}</p>` +
      `<button type="button" class="tr-btn" hidden><span lang="en">Cast</span><small>시전하기</small></button>`;
    host.appendChild(layer);
    const cv = layer.querySelector('.tr-cv'), x = cv.getContext('2d'), fig = layer.querySelector('.tr-wand'), tip = layer.querySelector('.tr-tip');
    const btn = layer.querySelector('.tr-btn');
    if (!P || reduced()){
      fig.remove(); cv.remove(); btn.hidden = false; tip.textContent = '';
      btn.addEventListener('click', () => { layer.remove(); done(); }, {once: true});
      return;
    }
    let W, H, box, dpr, stroke = [], drawing = false, misses = 0, trail = [], finished = false, demo = null, t0 = performance.now();
    function size(){
      dpr = Math.min(2, devicePixelRatio || 1); W = layer.clientWidth; H = layer.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const s = Math.min(W * .74, H * .46, 380);
      box = {x: (W - s) / 2, y: H * .42 - s / 2, s};
      aim(...toScreen(P[0]));
    }
    const toScreen = p => [box.x + p[0] * box.s, box.y + p[1] * box.s];
    const toUnit = (px, py) => [(px - box.x) / box.s, (py - box.y) / box.s];
    /* the wand: its handle just off the bottom-right corner, its tip on the point (the same geometry as at Ollivander's) */
    function aim(tx, ty){
      const hx = W + 8, hy = H * .86, dx = hx - tx, dy = hy - ty;
      const L = Math.max(120, Math.min(Math.hypot(dx, dy), W * 1.1)), a = Math.atan2(dy, dx) * 180 / Math.PI;
      const fw = L / .89, fh = fw * 600 / 1400;
      Object.assign(fig.style, {width: fw + 'px', left: hx - fw * .08 + 'px', top: hy - fh / 2 + 'px', transform: `scaleX(-1) rotate(${-a}deg)`});
    }
    function frame(now){
      if (finished) return;
      const t = (now - t0) / 1000;
      x.clearRect(0, 0, W, H);
      /* the dotted guide, breathing a little; a bright start and an arrowhead at the end */
      x.save();
      x.lineCap = 'round'; x.lineJoin = 'round';
      x.setLineDash([2, 11]); x.lineDashOffset = -t * 18;
      x.strokeStyle = `rgba(242,205,130,${.55 + Math.sin(t * 2.4) * .15})`; x.lineWidth = 4;
      x.shadowColor = 'rgba(242,190,90,.7)'; x.shadowBlur = 10;
      x.beginPath(); P.forEach((p, i) => { const [sx, sy] = toScreen(p); i ? x.lineTo(sx, sy) : x.moveTo(sx, sy); }); x.stroke();
      x.setLineDash([]);
      const [s0x, s0y] = toScreen(P[0]);
      x.fillStyle = 'rgba(255,236,190,.95)'; x.beginPath(); x.arc(s0x, s0y, 7 + Math.sin(t * 4) * 2, 0, 7); x.fill();
      const [ex, ey] = toScreen(P[P.length - 1]), [qx, qy] = toScreen(P[P.length - 3] || P[0]), ang = Math.atan2(ey - qy, ex - qx);
      x.translate(ex, ey); x.rotate(ang); x.fillStyle = 'rgba(242,205,130,.9)';
      x.beginPath(); x.moveTo(6, 0); x.lineTo(-10, -8); x.lineTo(-6, 0); x.lineTo(-10, 8); x.closePath(); x.fill();
      x.restore();
      /* the trail of light, fading behind the tip */
      const life = 900;
      trail = trail.filter(p => now - p.t < life);
      x.save(); x.lineCap = 'round'; x.lineJoin = 'round'; x.shadowColor = core; x.shadowBlur = 16;
      for (let i = 1; i < trail.length; i++){
        const a = trail[i - 1], b = trail[i], k = 1 - (now - b.t) / life;
        x.strokeStyle = core; x.globalAlpha = Math.max(0, k); x.lineWidth = 2 + k * 5;
        x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
      }
      x.restore();
      if (demo) demo(now);
      requestAnimationFrame(frame);
    }
    function point(e){ const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    cv.addEventListener('pointerdown', e => {
      if (finished || demo) return;
      drawing = true; stroke = []; cv.setPointerCapture(e.pointerId);
      const [px, py] = point(e); stroke.push(toUnit(px, py)); trail.push({x: px, y: py, t: performance.now()}); aim(px, py);
    });
    cv.addEventListener('pointermove', e => {
      if (!drawing) return;
      const [px, py] = point(e); stroke.push(toUnit(px, py)); trail.push({x: px, y: py, t: performance.now()}); aim(px, py);
    });
    const end = () => {
      if (!drawing) return; drawing = false;
      if (score(stroke, P) <= PASS){ win(); return; }
      misses++;
      tip.textContent = misses >= 2 ? '지팡이가 길을 보여 줍니다' : '조금 더 점선을 따라 처음부터 끝까지 그려 보세요';
      if (misses >= 2) showWay();
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    /* after three misses: the wand traces the path by itself, and the spell goes through */
    function showWay(){
      const start = performance.now(), dur = 1600, R = resample(P, 80).pts;
      demo = now => {
        const k = Math.min(1, (now - start) / dur), p = R[Math.min(R.length - 1, Math.floor(k * (R.length - 1)))], [px, py] = toScreen(p);
        trail.push({x: px, y: py, t: now}); aim(px, py);
        if (k >= 1){ demo = null; win(); }
      };
    }
    async function win(){
      if (finished) return;
      tip.textContent = '';
      layer.classList.add('cast');
      await wait(650);
      finished = true;
      layer.remove();
      removeEventListener('resize', size);
      done();
    }
    size();
    addEventListener('resize', size);
    requestAnimationFrame(frame);
  });
}
