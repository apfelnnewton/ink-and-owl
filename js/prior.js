/* Prior Incantato (2026-10-05 user decision, docs/plan-wand.md): before the first card of the day in a classroom, the
   learner's wand gives back the lines answered there on the last day of study, newest first, rising out of real smoke
   (assets/prior/smoke.mp4, black ground, screen-blended). 3–5 lines (missed ones first), one or two words gone from
   each (from the line's key expression where possible), shown by their first letter. The smoke is drawn through a
   canvas that turns the clip's black into real transparency (screen blending a <video> is not honoured everywhere —
   hardware-drawn video and iOS ignore it), and the 10-second clip is cross-faded into itself so the loop never jumps. A warm-up only: nothing here
   touches the review schedule. Once a day per classroom (day.prior), only with a wand, and only if settings.prior is on.
   "Wave it away" skips straight to the lesson. */
import * as wand from './wand.js';
import * as store from './store.js';
import * as srs from './srs.js';
import * as speech from './speech.js';
import {findRanges} from './room.js';
import {esc, reduced, wait} from './ui.js';

const STOP = new Set('the a an and or but of to in on at for with by from as is are was were be been am it its this that these those you your yours i me my we our he she him her his they them their not no do does did have has had will would shall should can could may might must there here then than so if very just such also only even well some many much more most what when where which who whom whose how why into onto upon about after before over under through again ever never quite rather still yet one ones all any each every both'.split(' '));
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const norm = w => w.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, '');
const fmt = t => { const [, m, d] = t.split('-').map(Number); return `${m}월 ${d}일`; };

/* the last day before today this classroom was studied, and the lines answered on it */
function echoes(deckId, cards){
  const recs = store.deck(deckId).cards, today = srs.today();
  let last = '';
  for (const r of Object.values(recs)) if (r.t && r.t < today && r.t > last) last = r.t;
  if (!last) return null;
  const rank = {again: 0, hard: 1, good: 2, learn: 3};
  const words = c => (c.line.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
  const pool = cards.filter(c => c.card !== false && !c.minimal && recs[c.id] && recs[c.id].t === last && words(c) >= 3);
  if (!pool.length) return null;
  const picked = pool.sort((a, b) => (rank[recs[a.id].g] ?? 3) - (rank[recs[b.id].g] ?? 3) || hash(last + a.id) - hash(last + b.id)).slice(0, 5);
  /* shown newest first, as the echoes leave a wand: the later in the script, the sooner it rises */
  return {day: last, lines: picked.sort((a, b) => b.order - a.order)};
}

/* the words to take out: inside the key expression first, never a name or a little word; one, or two in a long line */
function gaps(c, seed){
  const toks = [...c.line.matchAll(/[A-Za-z][A-Za-z'’-]*/g)].map((m, k) => ({w: m[0], a: m.index, b: m.index + m[0].length, k}));
  const ok = t => t.w.length >= 3 && !STOP.has(norm(t.w)) && !/^[A-Z]/.test(t.w);   // capitals: names, or the start of a line
  const ranges = findRanges(c.line, c.bre || []);
  const inExpr = t => ranges.some(([a, b]) => t.a >= a && t.b <= b);
  const cand = toks.filter(ok);
  const n = toks.length > 8 ? 2 : 1;
  const first = cand.filter(inExpr), rest = cand.filter(t => !inExpr(t)).sort((x, y) => y.w.length - x.w.length);
  const order = [...first.sort((x, y) => hash(seed + x.k) - hash(seed + y.k)), ...rest];
  const out = [];
  for (const t of order){ if (out.length >= n) break; if (!out.some(o => Math.abs(o.k - t.k) < 2)) out.push(t); }
  return out.sort((x, y) => x.a - y.a);
}

/* ---------- the smoke: clip → small canvas, brightness → alpha, two players cross-fading at the loop point */
const SMOKE = 'assets/prior/smoke.mp4', STILL = 'assets/prior/smoke.webp', CW = 360, CH = 640, FADE = 1.4;
function smoke(canvas){
  canvas.width = CW; canvas.height = CH;
  const out = canvas.getContext('2d'), off = document.createElement('canvas');
  off.width = CW; off.height = CH;
  const ox = off.getContext('2d', {willReadFrequently: true});
  const key = () => {
    const img = ox.getImageData(0, 0, CW, CH), d = img.data;
    for (let i = 0; i < d.length; i += 4){
      const m = Math.max(d[i], d[i + 1], d[i + 2]);
      if (m < 8){ d[i + 3] = 0; continue; }
      const k = 255 / m;
      d[i] = d[i] * k; d[i + 1] = d[i + 1] * k; d[i + 2] = d[i + 2] * k;
      d[i + 3] = Math.min(255, (m - 8) * 1.3);
    }
    out.putImageData(img, 0, 0);
  };
  const still = () => { const im = new Image(); im.onload = () => { ox.clearRect(0, 0, CW, CH); ox.drawImage(im, 0, 0, CW, CH); key(); }; im.src = STILL; };
  if (reduced()){ still(); return () => {}; }
  const mk = () => { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.src = SMOKE; return v; };
  let cur = mk(), nxt = mk(), raf = 0, last = 0, stopped = false, failed = false;
  cur.addEventListener('error', () => { failed = true; still(); }, {once: true});
  cur.play().catch(() => { if (!failed){ failed = true; still(); } });
  const frame = ts => {
    if (stopped || failed) return;
    raf = requestAnimationFrame(frame);
    if (ts - last < 33 || cur.readyState < 2) return;
    last = ts;
    if (cur.duration && cur.duration - cur.currentTime < FADE && nxt.paused){ nxt.currentTime = 0; nxt.play().catch(() => {}); }
    ox.globalAlpha = 1; ox.clearRect(0, 0, CW, CH); ox.drawImage(cur, 0, 0, CW, CH);
    if (!nxt.paused && nxt.readyState >= 2){
      const k = Math.min(1, nxt.currentTime / FADE);
      ox.globalAlpha = k; ox.drawImage(nxt, 0, 0, CW, CH); ox.globalAlpha = 1;
      if (k >= 1 || cur.ended){ cur.pause(); [cur, nxt] = [nxt, cur]; }
    }
    key();
  };
  raf = requestAnimationFrame(frame);
  return () => { stopped = true; cancelAnimationFrame(raf); [cur, nxt].forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); }); };
}

let active = null, quit = null;
export const running = () => !!active;
/* leaving the classroom while the echoes are up: they go at once */
export function dismiss(){ if (quit) quit(); }

/* is there anything to give back before this lesson? → the echoes, or null */
export function ready(deckId, cards, day){
  const w = wand.get(), st = store.get().settings;
  if (!w || st.prior === false || !day || day.prior === srs.today() || day.pos > 0) return null;
  return echoes(deckId, cards);
}
/* run before the lesson; resolves when the echoes are gone (filled in or waved away) */
export function run(e, day){
  day.prior = srs.today(); store.save();
  return new Promise(res => show(wand.get(), e, res));
}

function show(w, e, done){
  const core = wand.CORES[w.core].spark;
  const items = e.lines.map(c => ({c, g: gaps(c, e.day + c.id)})).filter(x => x.g.length);
  if (!items.length){ done(false); return; }
  const lineHtml = ({c, g}, i) => {
    let html = '', at = 0;
    g.forEach((t, j) => {
      html += esc(c.line.slice(at, t.a));
      const first = t.w[0], rest = t.w.slice(1);
      html += `<span class="pi-gap" data-w="${esc(t.w)}"><b>${esc(first)}</b><input type="text" inputmode="text" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" style="width:${(Math.max(2, rest.length) * .45 + .4).toFixed(2)}em" aria-label="빈칸 ${j + 1}: ${esc(first)}로 시작"></span>`;
      at = t.b;
    });
    return `<li style="--i:${i}" data-line="${i}"><p class="en" lang="en">${html}${esc(c.line.slice(at))}</p></li>`;
  };
  const layer = document.createElement('div');
  layer.className = 'pi-layer';
  layer.style.setProperty('--c', core);
  layer.style.setProperty('--n', items.length);
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-label', '프리오리 인칸타템: 지난번 대사 되감기');
  layer.innerHTML =
    `<canvas class="pi-smoke" aria-hidden="true"></canvas>` +
    `<figure class="pi-wand" aria-hidden="true"><img src="${wand.img(w.wood)}" alt=""><i class="pi-tip"></i></figure>` +
    `<div class="pi-scroll"><div class="pi-wrap">` +
      `<header class="pi-head"><p class="t" lang="en">Prior Incantato</p><p class="k">지팡이가 기억하는 지난 대사 · ${fmt(e.day)}</p></header>` +
      `<ol class="pi-lines">${items.map(lineHtml).join('')}</ol>` +
      `<p class="pi-sum" hidden></p>` +
      `<div class="pi-btns"><button type="button" class="pi-go" data-pi="check"><span lang="en">Reveal</span><small>확인</small></button>` +
      `<button type="button" class="pi-away" data-pi="away"><span lang="en">Wave it away</span><small>흩어 버리기</small></button></div>` +
    `</div></div>`;
  document.body.appendChild(layer);
  active = layer;
  const inputs = [...layer.querySelectorAll('.pi-gap input')];
  let checked = false;

  /* the wand comes in from the bottom right; the smoke rises from its tip */
  function place(){
    const vw = innerWidth, vh = innerHeight, f = layer.querySelector('.pi-wand'), v = layer.querySelector('.pi-smoke');
    /* low in the frame, so the lines and buttons stand clear of it: the handle beyond the bottom-right corner, the tip
       just above the bottom edge, a little right of centre */
    const hx = vw + 10, hy = vh + 14, tx = vw * .56, ty = vh - Math.min(72, vh * .09);
    const dx = hx - tx, dy = hy - ty, L = Math.min(Math.hypot(dx, dy), 460), a = Math.atan2(dy, dx) * 180 / Math.PI;
    const W = L / .9, H = W * 600 / 1400;
    Object.assign(f.style, {width: W + 'px', left: hx - W * .08 + 'px', top: hy - H / 2 + 'px'});
    f.style.setProperty('--base', `scaleX(-1) rotate(${-a}deg)`);
    /* where the tip actually is: along the wand from the handle */
    const r = Math.PI * a / 180, len = W * .87, tipX = hx - Math.cos(r) * len, tipY = hy - Math.sin(r) * len;
    const sh = Math.min(vh * .95, 980), sw = sh * 9 / 16;
    Object.assign(v.style, {height: sh + 'px', width: sw + 'px', left: tipX - sw / 2 + 'px', top: tipY - sh + 'px'});
  }
  place();
  addEventListener('resize', place);

  quit = () => { removeEventListener('resize', place); speech.stop(); layer.dispatchEvent(new Event('pi-gone')); layer.remove(); active = null; quit = null; done(false); };
  const close = async () => {
    if (!active) return;
    quit = null;
    removeEventListener('resize', place);
    layer.classList.add('out');
    speech.stop();
    await wait(reduced() ? 0 : 950);
    layer.dispatchEvent(new Event('pi-gone')); layer.remove(); active = null;
    done(true);
  };

  function check(){
    if (checked) return;
    checked = true;
    let lines = 0;
    layer.querySelectorAll('.pi-lines li').forEach(li => {
      let all = true;
      li.querySelectorAll('.pi-gap').forEach(g => {
        const word = g.dataset.w, typed = g.querySelector('input').value.trim();
        const right = norm(typed) === norm(word.slice(1)) || norm(typed) === norm(word);
        g.classList.add(right ? 'ok' : 'miss');
        /* the blank closes up around what was written */
        g.querySelector('input').replaceWith(Object.assign(document.createElement('span'), {className: 'ty', textContent: right ? word.slice(1) : typed || '—'}));
        if (right) wand.spark(g);
        else g.insertAdjacentHTML('beforeend', `<em lang="en">${esc(word)}</em>`);
        all = all && right;
      });
      if (all) lines++;
      li.classList.add('heard');
    });
    const sum = layer.querySelector('.pi-sum');
    sum.hidden = false;
    sum.innerHTML = `${items.length}줄 중 <b>${lines}줄</b> 기억함 <small>· 줄을 누르면 들을 수 있습니다</small>`;
    const go = layer.querySelector('[data-pi="check"]');
    go.dataset.pi = 'begin'; go.innerHTML = '<span lang="en">To the lesson</span><small>수업 시작</small>';
    layer.querySelector('[data-pi="away"]').hidden = true;
  }

  layer.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pi]');
    if (b){ ({check, away: close, begin: close})[b.dataset.pi]?.(); return; }
    const li = ev.target.closest('.pi-lines li.heard');
    if (li) speech.speak(items[+li.dataset.line].c.line, store.get().settings.voice);
  });
  layer.addEventListener('keydown', ev => {
    if (ev.key === 'Escape'){ ev.preventDefault(); close(); return; }
    if (ev.key !== 'Enter' || ev.isComposing) return;
    const k = inputs.indexOf(ev.target); if (k < 0) return;
    ev.preventDefault();
    if (k < inputs.length - 1) inputs[k + 1].focus(); else check();
  });
  const stopSmoke = smoke(layer.querySelector('.pi-smoke'));
  layer.addEventListener('pi-gone', stopSmoke, {once: true});
  requestAnimationFrame(() => layer.classList.add('in'));
  setTimeout(() => { if (inputs[0] && matchMedia('(pointer: fine)').matches) inputs[0].focus({preventScroll: true}); }, reduced() ? 0 : 2600);
}
