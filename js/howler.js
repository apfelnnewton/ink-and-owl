/* Howlers (2026-10-06 user decision, docs/plan-magic.md; words in bond/howlers.json). After 3 / 7 / 14 / 30 days without
   any lesson, the professor whose open door has gone longest unvisited writes: a Howler from Snape, McGonagall, Moody,
   Slughorn — and from Umbridge a pink one — or, from Dumbledore and Lupin, a gentle note that comes like any letter.
   One per level in a stretch away, at most one a week; two texts per level, used in turn. Nothing is lost by it.
   The Howler comes by owl (owl.js). Opened — aloud or quietly — it hovers and snaps its flap like a mouth (a black-ground
   clip turned transparent, keyvid.js), the professor's words burst out one sentence at a time (read by the en-GB
   voice if aloud, with a low rumble, sfx.js) on the letter it lets fall; when the learner says so, the letter burns away. What it said stays in the
   post as "타고 남은 재" on scorched paper, with its two key expressions explained.
   state.howl = {since: the last day studied (this stretch away), got: [levels sent in it], last: date, n: {who+level: count}} */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as speech from './speech.js';
import * as sfx from './sfx.js';
import {keyed} from './keyvid.js';
import {byId} from './decks.js';
import {esc, reduced, wait, toast} from './ui.js';

let DATA = null;
export const load = () => DATA ? Promise.resolve(DATA) : fetch('bond/howlers.json').then(r => r.ok ? r.json() : null).then(j => (DATA = j)).catch(() => null);
export const loaded = () => !!DATA;
const AT = [0, 3, 7, 14, 30];
const between = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
const KEY = /^H-([1-4])-([01])-\d{4}-\d\d-\d\d$/;

function lastStudy(){
  const log = store.get().log || {}; let last = '';
  for (const [d, v] of Object.entries(log)) if (v && Object.keys(v).length && d > last) last = d;
  return last;
}
function hs(){ const s = store.get(); return s.howl || (s.howl = {since: '', got: [], last: '', n: {}}); }

/* is one due now? → {who, level} or null */
export function due(){
  const s = store.get();
  if (!DATA || !s.settings.named || s.settings.howler === false) return null;
  const since = lastStudy(); if (!since) return null;
  const today = srs.today(), gap = between(since, today);
  let level = 0; AT.forEach((d, i) => { if (i && gap >= d) level = i; });
  if (!level) return null;
  const h = hs();
  if (h.since !== since){ h.since = since; h.got = []; }
  if (h.got.includes(level) || (h.last && between(h.last, today) < 7)) return null;
  const open = ((s.doors && s.doors.open) || []).filter(id => DATA[id]);
  if (!open.length) return null;
  /* the professor left longest: never studied with comes first, then the oldest last lesson */
  const who = open.slice().sort((a, b) => (bond.bondOf(a).lastDay || '').localeCompare(bond.bondOf(b).lastDay || ''))[0];
  return {who, level};
}
/* it is going out: note it, put it in the post, and say whether it is a Howler (true) or a gentle note */
export function take({who, level}){
  const h = hs(), today = srs.today(), n = h.n[who + level] || 0, key = `H-${level}-${n % 2}-${today}`;
  h.got.push(level); h.last = today; h.n[who + level] = n + 1;
  bond.postItem(who, key);
  store.save();
  return {key, howler: DATA[who].kind === 'howler'};
}
export const isHowler = who => !!(DATA && DATA[who] && DATA[who].kind === 'howler');
export const isPink = who => !!(DATA && DATA[who] && DATA[who].pink);

/* the words for a piece of post H-<level>-<i>-<date> */
export function textOf(who, key){
  const m = key.match(KEY), d = DATA && DATA[who]; if (!m || !d) return null;
  const t = (d.levels[m[1]] || [])[+m[2]]; if (!t) return null;
  return {kind: d.kind === 'howler' ? '타고 남은 재' : '편지', en: t.en, ko: t.ko, keys: t.keys, howler: d.kind === 'howler', pink: !!d.pink};
}

/* ---------- the scene (2026-10-06, second version): the envelope is torn open and flaps; the letter slides out of it,
   unfolds in the middle of the screen and the professor's words are written on it one sentence at a time (read aloud
   if chosen). Nothing burns until the learner says so. Then the letter catches at a corner and burns away where it
   lies: a dark scorched band and a glowing edge creep across it, and the burnt paper falls as ash all the way down
   the screen while the dark film lifts. Everything is drawn on canvases; no burning video. */
const plain = s => bond.fill(s).replace(/\[\[|\]\]/g, '');
const sentences = s => s.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]+["'’”]?\s*|[^.!?]+$/g).map(x => x.trim()).filter(Boolean);
/* the flapping clip: red-flap starts with the flap already open; pink-talk opens at once and flaps on its own */
const TALK = {red: {src: 'assets/howler/red-flap.mp4', from: 0}, pink: {src: 'assets/howler/pink-talk.mp4', from: 1.2}};
let active = false;
export const playing = () => active;

/* falling ash and rising sparks over the whole screen; spawn() adds some at a point; settle() resolves once all is down */
function ashfall(layer){
  const c = document.createElement('canvas'); c.className = 'hw-ash'; layer.appendChild(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const x = c.getContext('2d'); x.scale(dpr, dpr);
  const P = [];
  const shape = () => { const n = 4 + Math.floor(Math.random() * 3); return Array.from({length: n}, (_, i) => { const a = i / n * Math.PI * 2 + Math.random() * .6, r = .55 + Math.random() * .5; return [Math.cos(a) * r, Math.sin(a) * r]; }); };
  let last = performance.now(), age = 0, closing = null, stopped = false;
  const spawn = (px, py, ember) => P.push({x: px, y: py, vx: (Math.random() * 2 - 1) * 26, vy: ember ? -40 - Math.random() * 50 : Math.random() * 30,
    g: ember ? 40 + Math.random() * 20 : 150 + Math.random() * 130, s: ember ? .8 + Math.random() * 1.2 : 1.3 + Math.random() * 3, r: Math.random() * 6.3, vr: (Math.random() * 2 - 1) * 4,
    f: 2 + Math.random() * 3, ph: Math.random() * 6.3, born: age, life: ember ? 1.1 + Math.random() * 1.5 : 99, ember, pts: ember ? null : shape(), grey: 38 + Math.random() * 74, a: .7 + Math.random() * .3});
  const frame = now => {
    if (stopped) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now; age += dt;
    x.clearRect(0, 0, W, H);
    for (let i = P.length - 1; i >= 0; i--){
      const p = P[i], a = age - p.born;
      p.vy += p.g * dt; p.vy *= Math.pow(p.ember ? .995 : .986, dt * 60);
      p.vx += Math.sin(a * p.f + p.ph) * (p.ember ? 6 : 22) * dt; p.vx *= Math.pow(.99, dt * 60);
      p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > H + 20 || a > p.life){ P.splice(i, 1); continue; }
      if (p.ember){
        const k = 1 - a / p.life;
        x.globalAlpha = Math.max(0, k); x.fillStyle = `rgb(255,${150 + Math.round(80 * k)},${60 + Math.round(60 * k)})`;
        x.shadowColor = 'rgba(255,120,30,.9)'; x.shadowBlur = 8;
        x.beginPath(); x.arc(p.x, p.y, p.s, 0, 6.283); x.fill();
      } else {
        const heat = Math.max(0, 1 - a / .35);
        x.shadowBlur = heat > 0 ? 5 * heat : 0; x.shadowColor = 'rgba(255,110,20,.8)';
        x.globalAlpha = p.a * Math.min(1, (H + 20 - p.y) / 120);
        x.fillStyle = heat > .05 ? `rgb(${Math.round(p.grey + (200 - p.grey) * heat)},${Math.round(p.grey + (70 - p.grey) * heat * .8)},${Math.round(p.grey * (1 - heat * .5))})` : `rgb(${p.grey},${p.grey - 3},${p.grey - 6})`;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(p.s, p.s * (.55 + .45 * Math.abs(Math.sin(a * p.f + p.ph))));
        x.beginPath(); p.pts.forEach(([u, v], j) => j ? x.lineTo(u, v) : x.moveTo(u, v)); x.closePath(); x.fill(); x.restore();
      }
    }
    x.globalAlpha = 1; x.shadowBlur = 0;
    if (closing && !P.length){ stopped = true; c.remove(); closing(); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {spawn, settle: () => new Promise(res => { closing = res; setTimeout(() => { if (!stopped){ stopped = true; c.remove(); res(); } }, 7000); })};
}

/* the letter itself is drawn on a canvas: the same photographed parchment as every other sheet (cut like the CSS
   border-image), the shouted sentences in the display face with the key expressions in bold red ink, the Korean below.
   The whole sheet is laid out at once, so the paper keeps its size while the words are written onto it. */
const SHEET = {pad: 34, edge: 30, slice: 118, en: 21, enLH: 29, gap: 9, ko: 14, koLH: 23, koGap: 16};
let parchImg = null;
const parchment = () => parchImg || (parchImg = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'assets/ui/parchment.webp'; }));
function nine(x, im, w, h){
  const S = SHEET.slice, B = SHEET.edge, iw = im.naturalWidth, ih = im.naturalHeight;
  const sx = [0, S, iw - S, iw], sy = [0, S, ih - S, ih], dx = [0, B, w - B, w], dy = [0, B, h - B, h];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) x.drawImage(im, sx[c], sy[r], sx[c + 1] - sx[c], sy[r + 1] - sy[r], dx[c], dy[r], dx[c + 1] - dx[c], dy[r + 1] - dy[r]);
}
function layoutSheet(x, W, sents, ko){
  const inner = W - SHEET.pad * 2, rows = [];
  let y = SHEET.pad + 4;
  const fontEn = b => `italic ${b ? 700 : 400} ${SHEET.en}px 'IM Fell English', Georgia, serif`;
  sents.forEach((s, si) => {
    /* words with their weight: [[key]] marks become bold */
    const words = [];
    bond.fill(s).split(/(\[\[[^\]]+\]\])/).forEach(seg => { const b = /^\[\[/.test(seg); seg.replace(/\[\[|\]\]/g, '').split(/(\s+)/).forEach((w, n) => {
      if (!w) return;
      if (/^\s+$/.test(w)){ if (words.length) words[words.length - 1].sp = true; return; }
      words.push({w, b, glue: n === 0 && words.length > 0 && !words[words.length - 1].sp});   // "explanation" + "." with no space between
    }); });
    let line = [], lw = 0;
    const flush = () => { if (!line.length) return; rows.push({si, y, w: lw, words: line}); y += SHEET.enLH; line = []; lw = 0; };
    x.font = fontEn(false); const space = x.measureText(' ').width;
    words.forEach(o => { x.font = fontEn(o.b); const ww = x.measureText(o.w).width; if (line.length && !o.glue && lw + space + ww > inner) flush(); o.x = line.length ? lw + (o.glue ? 0 : space) : 0; o.ww = ww; line.push(o); lw = o.x + ww; });
    flush(); y += SHEET.gap;
  });
  /* the Korean, wrapped by words */
  const koRows = []; y += SHEET.koGap - SHEET.gap;
  x.font = `${SHEET.ko}px 'Gowun Batang', serif`;
  let cur = '';
  ko.split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (cur && x.measureText(t).width > inner){ koRows.push({y, t: cur}); y += SHEET.koLH; cur = w; } else cur = t; });
  if (cur){ koRows.push({y, t: cur}); y += SHEET.koLH; }
  return {rows, koRows, H: Math.ceil(y + SHEET.pad - 6), fontEn};
}
/* draws the sheet: sentences before `upto` in full, sentence `upto` up to `chars` characters, the Korean if `showKo` */
function paintSheet(x, im, W, L, upto, chars, showKo){
  x.clearRect(0, 0, W, L.H);
  if (im) nine(x, im, W, L.H); else { x.fillStyle = '#E6D9B8'; x.fillRect(0, 0, W, L.H); }
  x.textBaseline = 'alphabetic';
  let left = chars;
  L.rows.forEach(r => {
    if (r.si > upto) return;
    r.words.forEach(o => {
      if (r.si === upto){ if (left <= 0) return; }
      x.font = L.fontEn(o.b); x.fillStyle = o.b ? '#7A1A12' : '#2A2118';
      let t = o.w;
      if (r.si === upto){ t = o.w.slice(0, Math.max(0, left)); left -= o.w.length + (o.glue ? 0 : 1); }
      x.fillText(t, SHEET.pad + (W - SHEET.pad * 2 - r.w) / 2 + o.x, r.y + SHEET.en);
    });
  });
  if (showKo){ x.font = `${SHEET.ko}px 'Gowun Batang', serif`; x.fillStyle = '#5B4A33'; x.textAlign = 'center'; L.koRows.forEach(r => x.fillText(r.t, W / 2, r.y + SHEET.ko + 2)); x.textAlign = 'left'; }
}

/* the letter burns where it lies. A noise field plus the distance from the corner where it caught decide when each bit
   of paper goes. Every frame: the finished sheet, cut away where it has burnt (a small mask, smoothed as it is
   stretched, so the edge is ragged but soft), a scorched brown band just ahead of the fire, and an orange glowing rim
   on the edge itself; the rim sheds grey flakes that fall down the whole screen and a few sparks that rise. */
function burnSheet(cv, paper, ash){
  return new Promise(done => {
    if (reduced()){ cv.style.visibility = 'hidden'; done(); return; }
    const R = cv.getBoundingClientRect(), x = cv.getContext('2d'), CW = cv.width, CH = cv.height;
    const MW = 120, MH = Math.max(30, Math.round(MW * R.height / R.width));
    const G = 7, grid = Array.from({length: (G + 1) * (G + 1)}, () => Math.random());
    const noise = (u, v) => { const X = u * G, Y = v * G, i = Math.min(G - 1, Math.floor(X)), j = Math.min(G - 1, Math.floor(Y)), fx = X - i, fy = Y - j, s = t => t * t * (3 - 2 * t);
      const g = (a, b) => grid[b * (G + 1) + a];
      const top = g(i, j) + (g(i + 1, j) - g(i, j)) * s(fx), bot = g(i, j + 1) + (g(i + 1, j + 1) - g(i, j + 1)) * s(fx); return top + (bot - top) * s(fy); };
    const ox = Math.random() < .5 ? 0 : 1, oy = .85 + Math.random() * .15, asp = R.height / R.width;   // a lower corner catches first
    const field = new Float32Array(MW * MH);
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++){
      const u = i / (MW - 1), v = j / (MH - 1);
      field[j * MW + i] = Math.hypot(u - ox, (v - oy) * asp) / Math.hypot(1, asp) * .8 + noise(u, v) * .26 + Math.random() * .012;
    }
    const mk = () => { const c = document.createElement('canvas'); c.width = MW; c.height = MH; return c; };
    const mask = mk(), mx = mask.getContext('2d'), md = mx.createImageData(MW, MH);
    const charC = mk(), cx = charC.getContext('2d'), cd = cx.createImageData(MW, MH);
    const rimC = mk(), rx = rimC.getContext('2d'), rd = rimC.getContext('2d').createImageData(MW, MH);
    const EDGE = .013, CHAR = .07, DUR = 6, t0 = performance.now();
    const frame = now => {
      const T = -.04 + ((now - t0) / 1000) / DUR * 1.32;
      const m = md.data, c = cd.data, r = rd.data, front = [];
      for (let k = 0; k < field.length; k++){
        const f = field[k] - T, o = k * 4;
        m[o + 3] = f <= 0 ? 0 : f < EDGE * .5 ? Math.round(f / (EDGE * .5) * 255) : 255;
        /* scorch: from black at the edge to nothing a little further in */
        c[o] = 34; c[o + 1] = 18; c[o + 2] = 8; c[o + 3] = f <= 0 ? 0 : f < CHAR ? Math.round(255 * Math.pow(1 - f / CHAR, 1.6)) : 0;
        /* the glowing rim: the last thin strip before the paper is gone */
        if (f > -EDGE * .3 && f < EDGE){ const k2 = 1 - Math.abs(f - EDGE * .35) / EDGE; r[o] = 255; r[o + 1] = Math.round(80 + 100 * k2); r[o + 2] = Math.round(10 + 40 * k2); r[o + 3] = Math.round(235 * Math.max(0, Math.min(1, k2 * 1.3))); if (f > 0 && Math.random() < .09) front.push(k); }
        else r[o + 3] = 0;
      }
      mx.putImageData(md, 0, 0); cx.putImageData(cd, 0, 0); rx.putImageData(rd, 0, 0);
      x.clearRect(0, 0, CW, CH);
      x.globalCompositeOperation = 'source-over'; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(paper, 0, 0);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(mask, 0, 0, CW, CH);
      x.globalCompositeOperation = 'source-atop'; x.drawImage(charC, 0, 0, CW, CH);
      /* heat: the paper near the fire tinted orange (not brightened), then the rim itself, glowing */
      x.filter = 'blur(6px)'; x.globalAlpha = .55; x.drawImage(rimC, 0, 0, CW, CH); x.filter = 'none'; x.globalAlpha = 1;
      x.globalCompositeOperation = 'lighter'; x.drawImage(rimC, 0, 0, CW, CH);
      x.globalCompositeOperation = 'source-over';
      for (let n = 0; n < Math.min(4, front.length); n++){
        const k = front[Math.floor(Math.random() * front.length)], i = k % MW, j = (k - i) / MW;
        ash.spawn(R.left + (i + Math.random()) / MW * R.width, R.top + (j + Math.random()) / MH * R.height, Math.random() < .22);
      }
      if (T > 1.3){ cv.style.visibility = 'hidden'; done(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

export async function play(who, key, done = () => {}){
  if (active) return; await load();
  const t = textOf(who, key); if (!t){ done(); return; }
  active = true;
  const prof = byId(who), base = t.pink ? 'pink' : 'red';
  const layer = document.createElement('div');
  layer.className = `hw-layer ${base}`;
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-label', `${prof.ko}의 호울러`);
  layer.innerHTML =
    `<div class="hw-back" aria-hidden="true"></div>` +
    `<canvas class="hw-env" aria-hidden="true"></canvas>` +
    `<div class="hw-scroll"><div class="hw-wrap">` +
      `<p class="hw-from"><span lang="en">A Howler</span> · ${esc(prof.ko)}</p>` +
      `<div class="hw-choose"><p>열면 큰 소리가 날 수 있습니다.</p>` +
        `<button type="button" class="hw-go" data-hw="loud"><span lang="en">Open it aloud</span><small>소리 내어 열기</small></button>` +
        `<button type="button" class="hw-go quiet" data-hw="quiet"><span lang="en">Open it quietly</span><small>조용히 열기</small></button></div>` +
      `<canvas class="hw-sheet" aria-hidden="true" hidden></canvas><div class="sr" aria-live="polite"></div>` +
      `<button type="button" class="hw-go hw-burn" data-hw="burn" hidden><span lang="en">Let it burn</span><small>태워 버리기</small></button>` +
    `</div></div>`;
  document.body.appendChild(layer);
  requestAnimationFrame(() => layer.classList.add('in'));
  const canvas = layer.querySelector('.hw-env'), sheet = layer.querySelector('.hw-sheet'), burnBtn = layer.querySelector('.hw-burn'), sr = layer.querySelector('.sr');
  /* sealed until it is opened: the still envelope, shivering (CSS) */
  let player = keyed(canvas, {still: `assets/howler/${base}.webp`, reduced: true, loop: true});
  let loud = false, stopRumble = () => {}, burning = false, skip = false, paper = null;

  /* the sheet, laid out for the whole text before a word is written */
  const sents = sentences(t.en), ko = bond.fill(t.ko).replace(/\n+/g, ' ');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.min(440, layer.querySelector('.hw-wrap').clientWidth);
  await Promise.all([document.fonts.load(`italic 400 ${SHEET.en}px 'IM Fell English'`), document.fonts.load(`${SHEET.ko}px 'Gowun Batang'`, ko)]).catch(() => {});
  const im = await parchment();
  const sx = sheet.getContext('2d');
  const L = layoutSheet(sx, W, sents, ko);
  sheet.width = Math.round(W * dpr); sheet.height = Math.round(L.H * dpr);
  sheet.style.width = W + 'px'; sheet.style.height = L.H + 'px';
  const paint = (upto, chars, showKo) => { sx.setTransform(dpr, 0, 0, dpr, 0, 0); paintSheet(sx, im, W, L, upto, chars, showKo); };
  paint(-1, 0, false);

  const burn = async () => {
    if (burning) return; burning = true; skip = true;
    speech.stop(); stopRumble();
    /* whatever was still to be written is on the paper when it burns */
    burnBtn.hidden = true;
    paint(sents.length, 0, true);
    paper = document.createElement('canvas'); paper.width = sheet.width; paper.height = sheet.height; paper.getContext('2d').drawImage(sheet, 0, 0);
    sx.setTransform(1, 0, 0, 1, 0, 0);
    player.stop(); canvas.style.opacity = '0';
    layer.classList.add('burn');   // the dark film lifts so the ash falls over the room itself
    if (loud) sfx.fire(4.8);
    const ash = ashfall(layer);
    await burnSheet(sheet, paper, ash);
    await ash.settle();
    layer.classList.add('out');
    await wait(reduced() ? 0 : 400);
    layer.remove(); active = false;
    const m = bond.bondOf(who).mail.find(x => x.id === key); if (m && !m.read){ m.read = true; store.save(); }
    toast(`<span class="q" lang="en">Nothing left but ash.</span><span class="k">${esc(prof.ko)} 편지함에 타고 남은 재가 남았습니다.</span>`, 3200, true);
    done();
  };

  const speak = s => new Promise(res => {
    if (!loud || !speech.speak(s, store.get().settings.voice, () => res(), 1)) wait(Math.max(1500, s.length * 58)).then(res);
  });
  /* one sentence written onto the sheet, a few letters a frame, as fast as it is shouted */
  const write = i => new Promise(res => {
    const n = plain(sents[i]).length, ms = reduced() ? 0 : Math.min(1800, n * 26), t0 = performance.now();
    sheet.classList.remove('jolt'); void sheet.offsetWidth; sheet.classList.add('jolt');
    const row = L.rows.find(r => r.si === i);
    if (row){ const sc = layer.querySelector('.hw-scroll'), top = sheet.getBoundingClientRect().top + row.y; if (top > innerHeight * .7) sc.scrollBy({top: top - innerHeight * .45, behavior: reduced() ? 'auto' : 'smooth'}); }
    const step = now => { if (skip){ res(); return; } const k = ms ? Math.min(1, (now - t0) / ms) : 1; paint(i, Math.ceil(n * k), false); if (k < 1) requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
  async function start(aloud){
    loud = aloud;
    layer.querySelector('.hw-choose').remove();
    layer.classList.add('open');
    if (loud){ sfx.rip(); stopRumble = sfx.rumble(); }
    /* torn open: the flap snaps a moment; then the letter comes out and unfolds, and the envelope, its work done, goes */
    player.stop();
    player = keyed(canvas, {src: TALK[base].src, still: `assets/howler/${base}.webp`, loop: true, loopFrom: TALK[base].from, reduced: reduced()});
    await wait(reduced() ? 0 : 1300);
    if (skip) return;
    sheet.hidden = false; layer.classList.add('letter-out');
    burnBtn.hidden = false;
    setTimeout(() => { if (!burning){ player.stop(); } }, reduced() ? 0 : 1100);
    await wait(reduced() ? 0 : 1000);
    for (let i = 0; i < sents.length; i++){
      if (skip) return;
      sr.textContent = plain(sents[i]);
      await Promise.all([write(i), speak(plain(sents[i]))]);
    }
    if (skip) return;
    stopRumble(); stopRumble = () => {};
    paint(sents.length, 0, true); sr.textContent = ko;
    /* it has had its say; it waits to be burnt (2026-10-06 user decision: it never burns by itself) */
    burnBtn.innerHTML = '<span lang="en">Let it burn</span><small>다 읽었어요 · 태우기</small>';
    burnBtn.classList.add('ready');
    burnBtn.scrollIntoView({block: 'nearest', behavior: reduced() ? 'auto' : 'smooth'});
  }
  layer.addEventListener('click', e => {
    const b = e.target.closest('[data-hw]'); if (!b) return;
    if (b.dataset.hw === 'loud') start(true);
    else if (b.dataset.hw === 'quiet') start(false);
    else if (b.dataset.hw === 'burn') burn();
  });
}
