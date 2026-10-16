/* A potions lesson in Snape's dungeon (#/potion/<n>), 2026-10-14 user decision: each year of his lines (film n + book n)
   learnt opens one potion. The board (potions/potions.json) is read and done by hand:
     · the cauldron, front on: drag an ingredient from its jar into the cauldron; stir by drawing circles in it with the
       glass rod (direction and number of turns are counted); the three heat buttons; "bottle it" when the colour is right
     · the bench, from above: the chopping board (each tap of the knife, or a stroke across, cuts the thing in two and the
       pieces part a little) and the mortar (the pestle rubbed round breaks what is in it smaller until only powder is
       left); what is made there is carried back to the cauldron as one handful.
   Every move is checked against the next thing the board asks for (`do`): the wrong jar, the wrong number, lumps,
   the wrong way round, a line skipped… each is one slip and a word from Snape; three slips, or the one fatal thing
   (here the porcupine quills while the cauldron is still on the fire), and the potion is vanished and begun again.
   0 slips → perfect, 1–2 → usable. By level: 하 the line to do now is lit and every line can show its Korean;
   중 the board is English only; 상 the board folds away at the first move, and looking again is a slip.
   The water's colour, bubbles, steam, ripples, the cut pieces and the powder are drawn here (canvas); the objects are
   photographs (assets/potions/, design/drafts/potions/). */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as shops from './shops.js';
import * as pots from './potions.js';
import * as sfx from './sfx.js';
import {$, $$, esc, wait, reduced, toast, fitPaper} from './ui.js';

const IMG = n => `assets/potions/${n}.webp`;
let DATA = null;
const load = () => DATA ? Promise.resolve(DATA) : fetch('potions/potions.json').then(r => r.json()).then(j => (DATA = j));
const pics = {};
const pic = src => pics[src] || (pics[src] = Object.assign(new Image(), {src, decoding: 'async'}));
/* a picture not there (yet): drawing it would throw and stop the frame — it is skipped, or stood in for */
const okImg = im => im.complete && im.naturalWidth > 0;
const fitIn = (x, im, side = 1) => { const r = im.naturalWidth / im.naturalHeight, w = r >= 1 ? side : side * r, h = r >= 1 ? side / r : side; x.drawImage(im, -w / 2, -h / 2, w, h); };

/* where things are in the photographs (pixels of the files in assets/potions/) */
const POT = {w: 742, h: 900, mouth: {cx: 372, cy: 235, rx: 276, ry: 158}, surf: {cx: 372, cy: 290, rx: 252, ry: 138}, feet: 868};
const TRIVET = {w: 896, h: 900, ring: 300, coals: [450, 470]};
const MORTAR = {w: 962, h: 1000, cx: 488, cy: 465, r: 330};
const ROD = {w: 404, h: 700, tip: [375, 675]};
const JARS = {squat: {img: 'jar-squat', label: [.135, .476, .735, .334]}, tall: {img: 'jar-tall', label: [.14, .38, .73, .38]}, bottle: {img: 'jar-bottle', label: [.165, .555, .67, .23]}};

const mix = (a, b, k) => { const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)), A = p(a), B = p(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * Math.max(0, Math.min(1, k))).toString(16).padStart(2, '0')).join(''); };
const rgba = (hex, a) => `rgba(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(',')},${a})`;
/* pointer capture (a finger that leaves the element keeps dragging); harmless when it cannot be had */
const cap = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (x){} };
const rnd = s => { const h = Math.sin(s * 12.9898 + 78.233) * 43758.5453; s = Math.floor((h - Math.floor(h)) * 2147483645) + 1; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; R(); R(); return R; };

/* a convex polygon cut by the line through p with direction d: the two halves (or null when the line misses it) */
function split(poly, p, d){
  const side = q => (q[0] - p[0]) * d[1] - (q[1] - p[1]) * d[0], a = [], b = [];
  for (let i = 0; i < poly.length; i++){
    const q = poly[i], r = poly[(i + 1) % poly.length], sq = side(q), sr = side(r);
    (sq >= 0 ? a : b).push(q);
    if ((sq > 0 && sr < 0) || (sq < 0 && sr > 0)){ const t = sq / (sq - sr), m = [q[0] + (r[0] - q[0]) * t, q[1] + (r[1] - q[1]) * t]; a.push(m); b.push(m); }
  }
  return a.length > 2 && b.length > 2 ? [a, b] : null;
}
const areaOf = poly => Math.abs(poly.reduce((s, q, i) => { const r = poly[(i + 1) % poly.length]; return s + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;

export function initPotion(app){
  const sec = $('#potion'), stage = $('#poStage'), lines = $('#poLines'), say = $('#poSay'), tray = $('#poTray'), ctl = $('#poCtl'), end = $('#poEnd');
  const potBox = $('#poPot'), liq = $('#poLiquid'), steam = $('#poSteam'), work = $('#poWork');
  const lx = liq.getContext('2d'), sx = steam.getContext('2d'), wx = work.getContext('2d');
  let P = null, S = null, raf = 0, level = 'mid';

  /* ---------- the state of one attempt */
  function fresh(){
    if (parked){ parked.g.remove(); parked = null; }
    if (S) clearTimeout(S.stirT);
    tallyEl.classList.remove('on');
    S = {i: 0, count: 0, slips: 0, over: false, heat: 'off', onFire: true, view: 'pot', started: false,
      colour: P.colours.water, from: P.colours.water, to: P.colours.water, ct: 0, boil: 0, waitAt: 0, peeked: false, knife: 'knife',
      ripples: [], bubbles: [], puffs: [], grains: [], film: 0, marks: {}, swirl: 0, swirlDir: 0, flash: 0, ruin: 0,
      board: null, mortar: null, tokens: [], stirring: null, tool: 'board'};
  }
  const cur = () => P.do[S.i];
  /* the next thing the board asks; a wait starts its clock now; a pause ends the first sitting */
  const next = () => {
    S.i++; S.count = 0; drawBoard();
    const a = cur();
    if (a && a.wait) S.waitAt = performance.now();
    if (a && a.pause){ const s0 = S; setTimeout(() => { if (S === s0) stewing(a); }, 900); }
  };
  /* a slip's words: the potion's own first (its colours and smells), then the shared ones */
  const SL = k => (P.slips || {})[k] || DATA.slips[k] || (P.slips || {})[k.split('_')[0]] || DATA.slips[k.split('_')[0]] || DATA.slips.wrong;

  /* ---------- Snape says */
  let sayT = 0;
  function speak(t, ms = 4200){
    if (!t) return;
    say.innerHTML = `<span lang="en">${esc(bond.fill(t.en))}</span><small>${esc(bond.fill(t.ko))}</small>`;
    say.classList.remove('on'); void say.offsetWidth; say.classList.add('on');
    clearTimeout(sayT); sayT = setTimeout(() => say.classList.remove('on'), ms);
  }
  /* a slip: Snape's word now, and a mark on the board line it belongs to (line), with what was done instead (did),
     for the marked board at the end */
  function slip(kind, did, line){
    S.slips++; S.flash = 1;
    /* a thing the board asks across two lines: the mark goes on the line whose words that kind of slip misread */
    const c = cur(); if (c && c.line && c.line.length > 1 && c.line.includes(line)){ const hit = c.line.find(i => (P.board[i].key || []).some(k => Array.isArray(k) && k[1] === kind)); if (hit != null) line = hit; }
    const k = line == null ? 'gen' : line; (S.marks[k] = S.marks[k] || []).push({kind, did});
    if (!store.get().settings.quiet) sfx.hiss && sfx.hiss();
    if (S.slips >= 3){ ruin(SL(kind)); return true; }
    speak(SL(kind));
    return false;
  }
  /* Korean for what the hands did (with the right particle after the ingredient's name) */
  const jo = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (c >= 0 && c < 11172 && c % 28 ? a : b); };
  const nm = id => (DATA.jars[id] || {ko: '그것'}).ko, unit = id => (DATA.jars[id] || {}).unit || '번';
  const lineOf = a => a && a.line ? a.line[a.line.length - 1] : P.board.length - 1;
  const HEAT = {high: '불을 세게 했다.', low: '불을 약하게 했다.', off: '솥을 불에서 내렸다.'};
  /* ids used as droppers in this potion (held over the cauldron, they drip) and the hair envelopes it offers */
  const droppers = () => new Set(P.do.filter(a => a.drops).map(a => a.drops));
  const envelopes = () => [...new Set(P.do.filter(a => a.hair).flatMap(a => a.from))];

  /* the colour (or smoke) the board waits for, shown beside it (2026-10-15, user: "그 색깔을 띄우는 쪽으로" — of a dot on the board line
     and a tag on the rim, the user chose the tag): a parchment tag tied to the cauldron's rim, there while the wait is on */
  const target = () => { const i = P.do.findIndex(a => a.wait); if (i < 0) return null; const a = P.do[i];
    return {i, line: a.line[0], kind: a.wait === 'smoke' ? 'smoke' : a.wait === 'clear' ? 'clear' : 'colour', c: a.wait === 'smoke' ? (P.colours.smoke || '#d9dee4') : mix(P.colours.done, '#ffffff', .1)}; };   /* as the water's lit middle shows it */
  const swatch = (tg, cls) => `<i class="${cls} ${tg.kind}" style="--c:${tg.c}" aria-hidden="true"></i>`;
  /* ---------- the board */
  function drawBoard(){
    const now = (cur() || {}).line || [], tg = target();   /* tg: the colour on the tag */
    tagEl.innerHTML = tg ? swatch(tg, 'po-tag-c') : '';
    lines.innerHTML = P.board.map((l, i) => `<li class="${now.includes(i) ? 'cur ' : ''}${level === 'low' && now.includes(i) ? 'now' : ''}${i < Math.min(...(now.length ? now : [99])) && level === 'low' ? ' done' : ''}" data-l="${i}"><span lang="en">${esc(l.en)}</span>${level === 'low' ? `<small hidden>${esc(l.ko)}</small>` : ''}${l.note ? `<em class="po-note" lang="en">${esc(l.note.en)}</em>${level === 'low' ? `<small hidden>${esc(l.note.ko)}</small>` : ''}` : ''}</li>`).join('');
    $('#poWords').innerHTML = P.words.map((w, i) => `<button type="button" data-w="${i}" lang="en">${esc(w.w)}</button>`).join('');
    sec.classList.toggle('folded', level === 'high' && S.started && !S.peek);
    fitBoard();
  }
  /* a screen too short for the board, the cauldron, the jars and the buttons together (a phone; 2026-10-16): once at the
     cauldron the board shows three lines and scrolls inside itself (user: "한 3번까지는 보여주고 칠판 안에 스크롤"),
     the line to do now kept at its top — two lines, or one, if three still do not fit. The high level keeps its own
     folding, with its cost. */
  function fitBoard(){
    sec.classList.remove('strip'); lines.style.maxHeight = '';
    if (!S || level === 'high' || !S.bench || sec.hidden) return;
    if (sec.scrollHeight <= sec.clientHeight + 2) return;
    sec.classList.add('strip');
    const lis = [...lines.children], c = Math.max(0, lis.findIndex(li => li.classList.contains('cur')));
    for (const k of [3, 2, 1]){
      const from = Math.min(c, Math.max(0, lis.length - k));
      lines.style.maxHeight = lis.slice(from, from + k).reduce((h, li) => h + li.offsetHeight, 0) + 'px';
      if (sec.scrollHeight <= sec.clientHeight + 2) break;
    }
    if (lis[c]) lines.scrollTop = lis[c].offsetTop;
    fitting = true; size(); fitting = false;   /* the stage has grown by what the board gave up: the cauldron fills it again */
  }
  let fitting = false;
  lines.addEventListener('click', e => { const li = e.target.closest('li'); if (!li) return; li.querySelectorAll('small').forEach(k => { k.hidden = !k.hidden; }); });
  $('#poWords').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b) return; const w = P.words[+b.dataset.w]; toast(`${w.w} · ${w.pos} · ${w.ko}`, 3200); });
  $('#poPeek').addEventListener('click', () => {
    if (!S || !S.started || level !== 'high' || S.over || S.paused) return;
    S.peek = !S.peek; drawBoard();
    if (S.peek && !S.peeked){ S.peeked = true; slip('peek'); }
  });

  /* ---------- the jars and what has been made, along the bottom */
  /* an envelope with a hair in it: a folded paper with a name written on it */
  const env = id => { const j = DATA.jars[id] || {en: id, ko: ''};
    return `<button type="button" class="po-jar po-env" data-jar="${id}" aria-label="${esc(j.en)}"><span class="glass"><span class="envp"><b lang="en">${esc(j.en)}</b></span></span><span class="cap"><b lang="en">${esc(j.en)}</b>${level === 'low' ? `<small>${esc(j.ko)}</small>` : ''}</span></button>`; };
  function drawTray(){
    const jar = id => { const j = DATA.jars[id], J = JARS[j.jar], [x, y, w, h] = J.label;
      /* the label on the jar is the jar's own (small, written by hand); the name under it is the one to read */
      return `<button type="button" class="po-jar po-${j.jar}" data-jar="${id}" aria-label="${esc(j.en)}"><span class="glass"><img src="${IMG(J.img)}" alt="" draggable="false">` +
        `<span class="lbl" style="left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%"><b lang="en">${esc(j.en)}</b></span></span>` +
        `<span class="cap"><b lang="en">${esc(j.en)}</b>${level === 'low' ? `<small>${esc(j.ko)}</small>` : ''}</span></button>`; };
    tray.innerHTML = S.tokens.map((t, i) => `<button type="button" class="po-token" data-tok="${i}"><span class="glass"><img src="${t.src}" alt="" draggable="false"></span><span class="cap"><b>${esc(t.name)}</b></span></button>`).join('') + P.jars.map(jar).join('') + envelopes().map(env).join('');
    for (const b of $$('.lbl b', tray)){ let f = 10; b.style.fontSize = ''; while (f > 6.5 && (b.scrollWidth > b.parentNode.clientWidth + 1 || b.parentNode.scrollHeight > b.parentNode.clientHeight + 1)){ f -= .5; b.style.fontSize = f + 'px'; } }
    const v = S.view;
    ctl.innerHTML = `<div class="po-views">${[['board', '도마'], ['mortar', '막자사발'], ['pot', '솥']].map(([k, n]) => `<button type="button" data-view="${k}" class="${(v === 'pot' ? 'pot' : S.tool) === k ? 'on' : ''}">${n}</button>`).join('')}</div>` +
      (v === 'pot'
        ? `<div class="po-acts"><button type="button" data-heat="high" class="${S.onFire && S.heat === 'high' ? 'on' : ''}">강 불</button><button type="button" data-heat="low" class="${S.onFire && S.heat === 'low' ? 'on' : ''}">약 불</button><button type="button" data-heat="off" class="${!S.onFire ? 'on' : ''}">불에서 내리기</button>${P.do.some(a => a.strain) ? '<button type="button" data-strain>천에 거르기</button>' : ''}<button type="button" data-done class="bottle">병에 담기</button></div>`
        : `<div class="po-acts">${S.tool === 'board' && P.do.some(a => a.prep === 'press') ? `<button type="button" data-knife class="${S.knife === 'dagger' ? 'on' : ''}">${S.knife === 'dagger' ? '은 단검' : '칼'}</button>` : ''}<button type="button" data-carry ${has() ? '' : 'disabled'}>솥으로 가져가기</button><button type="button" data-clear ${has() ? '' : 'disabled'}>도로 담기</button></div>`);
  }
  const has = () => S.tool === 'board' ? !!S.board : !!(S.mortar && S.mortar.items.length);
  ctl.addEventListener('click', e => {
    if (!S || S.over) return;
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.view){ setView(b.dataset.view); return; }
    if (b.dataset.heat){ begin(); act({k: 'heat', v: b.dataset.heat}); return; }
    if ('done' in b.dataset){ begin(); act({k: 'done'}); return; }
    if ('carry' in b.dataset){ carry(); return; }
    if ('knife' in b.dataset){ S.knife = S.knife === 'dagger' ? 'knife' : 'dagger'; drawTray(); return; }
    if ('strain' in b.dataset){ begin(); strain(); return; }
    if ('clear' in b.dataset){ if (S.tool === 'board') S.board = null; else S.mortar = null; drawTray(); }
  });
  /* straining through a cloth: the film and the bits are gone, the water a little brighter for a moment */
  function strain(){
    if (S.over || S.paused) return;
    S.film = 0; S.grains = []; S.flash = 0;
    /* the cloth laid over the mouth of the cauldron, held a moment, lifted away: a clean one, as the board says — and
       where the potion leaves its colour in it (P.stains: the dittany), it comes away stained (2026-10-15, user) */
    /* slower where it stains (user, 2026-10-15: "천 바뀌는 거 시간이 너무 빨라"): laid on, then the green comes through, then it is
       held up stained long enough to be seen, then lifted away */
    if (!reduced()){ const c = document.createElement('div'); c.className = 'po-cloth' + (P.stains ? ' stains' : '');
      c.innerHTML = `<img src="${IMG('cloth-clean')}" alt="">` + (P.stains ? `<img class="used" src="${IMG('cloth')}" alt="">` : '');
      potBox.querySelector('.po-cauldron').appendChild(c); setTimeout(() => c.remove(), P.stains ? 4600 : 1700); }
    S.ripples.push({x: mouthPx().cx, y: mouthPx().cy, t: performance.now()});
    if (!store.get().settings.quiet && sfx.slosh) sfx.slosh();
    act({k: 'strain'});
  }
  function setView(v){
    if (v === 'pot'){ S.view = 'pot'; } else { S.view = 'bench'; S.tool = v; }
    sec.dataset.view = S.view; drawTray(); size();
  }
  const begin = () => { if (!S.started){ S.started = true; drawBoard(); } };

  /* what was made on the bench becomes one handful in the tray, to be carried to the cauldron */
  function carry(){
    let t;
    if (S.tool === 'board' && S.board){ const b = S.board, along = b.along || 0, pressedN = b.things.filter(t => t.pressed).length, prep = pressedN ? 'press' : along >= 3 && along >= b.cuts - along ? 'shred' : 'chop';
      t = {left: 1, item: b.item, prep, cuts: b.cuts, n: b.things.length, partial: pressedN > 0 && pressedN < b.things.length, src: snap('board'), name: (prep === 'press' ? '눌러 짠 ' : prep === 'shred' ? '채 썬 ' : b.cuts ? '썬 ' : '') + DATA.jars[b.item].ko}; S.board = null; }
    else if (S.tool === 'mortar' && S.mortar && S.mortar.items.length){ const m = S.mortar, item = m.items[0].item, same = m.items.every(x => x.item === item);
      const what = same ? DATA.jars[item].ko : '여러 가지';
      t = {left: 1, item: same ? item : 'mixed', has: m.items.map(x => x.item), prep: 'grind', p: m.p, n: m.items.length, src: snap('mortar'), name: m.p >= 1 ? what + ' 가루' : '빻은 ' + what}; S.mortar = null; }
    if (!t) return;
    S.tokens.push(t); setView('pot');
  }

  /* ---------- dragging from a jar or a handful */
  let drag = null;
  tray.addEventListener('pointerdown', e => {
    if (!S || S.over) return;
    const b = e.target.closest('[data-jar],[data-tok]'); if (!b) return;
    e.preventDefault();
    const tok = b.dataset.tok != null ? S.tokens[+b.dataset.tok] : null, id = tok ? null : b.dataset.jar;
    const src = tok ? tok.src : DATA.jars[id].img;
    const g = document.createElement('img'); g.className = 'po-ghost'; g.src = src; g.alt = ''; document.body.appendChild(g);
    drag = {id, tok, ti: tok ? +b.dataset.tok : -1, g, x0: e.clientX, y0: e.clientY, moved: false, drip: !!(id && droppers().has(id)), drops: 0};
    if (drag.drip) g.classList.add('drip');
    /* over the board or the mortar the thing is shown at the size and the turn it will have there */
    if (id && S.view === 'bench'){
      const j = DATA.jars[id] || {}, small = (j.size || 1) < .6;
      if (S.tool === 'board'){ drag.rot = j.board ? (typeof j.board === 'number' ? j.board : -.72) : small ? Math.random() * 6.283 : 0; drag.side = boardBase() * (j.size || 1); }
      else { drag.rot = Math.random() * 6.283; drag.side = mortarPx().r * .78; }
      Object.assign(g.style, {width: drag.side + 'px', height: drag.side + 'px'}); g.classList.add('bench');
    }
    g.onerror = () => { g.style.visibility = 'hidden'; };
    moveGhost(e.clientX, e.clientY);
    cap(b, e);
  });
  tray.addEventListener('pointermove', e => {
    if (!drag) return; if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true; moveGhost(e.clientX, e.clientY);
    drag.pour = (drag.tok || drag.drip || (drag.id && (DATA.jars[drag.id] || {}).pour)) && S.view === 'pot' && overPot(e.clientX, e.clientY) ? {x: e.clientX, y: e.clientY} : null;
    drag.g.classList.toggle('pour', !!drag.pour);
  });
  const moveGhost = (x, y) => { drag.g.style.transform = drag.side ? `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${drag.rot}rad)` : `translate(${x}px, ${y}px) translate(-50%, -60%) rotate(var(--tilt, 0deg))`; };
  /* over the cauldron: above its mouth, or on it */
  function overPot(cx, cy){ const r = liq.getBoundingClientRect(), m = mouthPx(), x = cx - r.left, y = cy - r.top; return Math.abs(x - m.cx) < m.rx * 1.05 && y > m.cy - m.ry * 3.4 && y < m.cy + m.ry * 1.3; }
  /* one drop from the dropper (screen point), into the water */
  function drip(d, at){
    const sr = stage.getBoundingClientRect(), lr = liq.getBoundingClientRect(), oy = lr.top - sr.top;
    S.grains.push({x: at.x - sr.left, y: at.y - sr.top + 30, vx: 0, vy: 1.2, ty: POT.surf.cy * K + oy, s: 3.2, rot: 0, drop: true, c: P.colours[d.id] || '#c8d8e8'});
    if (!store.get().settings.quiet && sfx.plop) setTimeout(() => sfx.plop(), 260);
  }
  /* a dropper (2026-10-15, user chose this of four ways: "라"): let go over the cauldron, it stays there, over the water;
     each press of it lets one drop fall, and the drops so far stand on the water as small marks (as the turns of a stir
     do). They are counted as one go when it is put away — a press anywhere else, or the next thing done. Before, a
     dropper held over the cauldron dripped by itself every half second, and nobody could tell how many had fallen. */
  let parked = null;
  function park(id, x){
    unpark(false);
    const r = liq.getBoundingClientRect(), m = mouthPx();
    const g = document.createElement('img'); g.className = 'po-parked'; g.src = DATA.jars[id].img; g.alt = DATA.jars[id].en; document.body.appendChild(g);
    parked = {id, g, s: S, lx: m.cx + m.rx * .52, ly: m.cy - m.ry * .75};   /* over the right of the water: the drop marks stand in the middle, and higher it covered the board's last line */
    placeParked(); S.dpend = {item: id, n: 0};
    toast('누를 때마다 한 방울 · 다 넣었으면 다른 곳을 누른다', 2600);
    g.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      if (!parked || parked.s !== S || S.over || S.paused) return unpark(false);
      begin(); S.dpend.n++;
      const r2 = liq.getBoundingClientRect(); drip({id}, {x: r2.left + parked.lx, y: r2.top + parked.ly});
      tally(S.dpend.n, 0, false, 'drops');
      g.classList.add('press'); setTimeout(() => g.classList.remove('press'), 140);
    });
  }
  function placeParked(){ if (!parked) return; const r = liq.getBoundingClientRect(); Object.assign(parked.g.style, {left: r.left + parked.lx + 'px', top: r.top + parked.ly + 'px'}); }
  /* put the dropper away: the drops given are one go (count false: just take it away, as when the attempt is over) */
  function unpark(count){
    if (!parked) return; const p = parked; parked = null; p.g.remove();
    if (p.s !== S) return;
    const d = S.dpend; S.dpend = null;
    if (count !== false && d && d.n){ tally(d.n, 0, true, 'drops'); act({k: 'drops', item: d.item, n: d.n}); }
    else tallyEl.classList.remove('on');
  }
  document.addEventListener('pointerdown', e => { if (parked && e.target !== parked.g) unpark(parked.s === S && !sec.hidden); }, true);
  addEventListener('resize', placeParked);
  addEventListener('hashchange', () => unpark(false));
  function pourDone(d){
    d.g.remove(); if (drag === d) drag = null;
    const i = S.tokens.indexOf(d.tok); if (i >= 0) S.tokens.splice(i, 1); drawTray(); begin();
    if (d.tok.left > 0) pour(d.pour || {x: d.x0, y: d.y0}, d.tok, d.tok.left * 1.4);
    act({k: 'add', item: d.tok.item, prep: d.tok.prep, cuts: d.tok.cuts, p: d.tok.p, n: d.tok.n, partial: d.tok.partial, has: d.tok.has});
  }
  /* grains or flakes from the hand (screen point) into the water */
  function pour(at, tok, amount){
    const sr = stage.getBoundingClientRect(), lr = liq.getBoundingClientRect(), ox = lr.left - sr.left, oy = lr.top - sr.top;
    const sf = {cx: POT.surf.cx * K + ox, cy: POT.surf.cy * K + oy, rx: POT.surf.rx * K, ry: POT.surf.ry * K}, powder = tok.prep === 'grind';
    const n = Math.round(amount * (powder ? 26 : 5)), pc = powderOf(tok.item);
    for (let i = 0; i < n; i++){ const R = Math.random;
      S.grains.push({x: at.x - sr.left + (R() - .5) * (powder ? 14 : 30), y: at.y - sr.top + 26 + R() * 8, vx: (R() - .5) * (powder ? .5 : 1.2), vy: .6 + R() * 1.4,
        ty: sf.cy + (R() - .5) * sf.ry * .7, tx: [sf.cx - sf.rx * .8, sf.cx + sf.rx * .8], powder, s: powder ? .8 + R() * 1.6 : 2.5 + R() * 3.5, rot: R() * 6.3,
        c: powder ? (R() > .4 ? mix(pc, '#ffffff', .25) : mix(pc, '#000000', .2)) : (R() > .5 ? mix(pc, '#000000', .35) : mix(pc, '#000000', .55))}); }
  }
  const endDrag = e => {
    if (!drag) return; const d = drag; drag = null; d.g.remove();
    if (!d.moved){ if (d.id){ const j = DATA.jars[d.id]; toast(level === 'low' ? `${j.en} · ${j.ko}` : j.en, 1800); } return; }
    const r = (S.view === 'pot' ? liq : work).getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (S.view === 'pot'){
      if (d.drip){ if (overPot(e.clientX, e.clientY)){ begin(); park(d.id, e.clientX); } return; }
      if (!overPot(e.clientX, e.clientY)) return;
      if (d.tok){ d.pour = {x: e.clientX, y: e.clientY}; pourDone(d); return; }
      /* a jar or phial tipped out: its contents fall in, as a handful would */
      const jp = (DATA.jars[d.id] || {}).pour; if (jp) pour({x: e.clientX, y: e.clientY}, {item: d.id, prep: jp === 'powder' ? 'grind' : 'chop'}, 1.6);
      begin(); act({k: 'add', item: d.id});
      const m = mouthPx(); splash(Math.max(m.cx - m.rx * .6, Math.min(m.cx + m.rx * .6, x)), m.cy);
    } else if (d.id) place(d.id, x, y, d.rot);
  };
  tray.addEventListener('pointerup', endDrag); tray.addEventListener('pointercancel', e => { if (drag){ drag.g.remove(); drag = null; } });

  /* ---------- the rules: each move against the next thing the board asks */
  /* the end of a wait (the bottle pressed, or the next line begun): judged against the clock, the colour then kept;
     true when the slip spoiled the potion */
  function waited(a, here, what, stay){
    const t = S.waitAt ? (performance.now() - S.waitAt) / 1000 : 0, T = P.turn;
    const w = a.wait === 'colour' ? '' : '_' + a.wait;   /* the potion may have its own words for smoke or clearing */
    if (t < T.from){ if (slip('early' + w, '때가 되기 전에 ' + what, lineOf(a)) || stay) return true; }   /* pressed too soon: it keeps waiting */
    else if (t > T.to && slip('late' + w, '때를 지나친 뒤에 ' + what, lineOf(a))) return true;
    S.from = S.to = S.colour; S.ct = 0; S.waitAt = 0;
    next(); return false;
  }
  function act(ev){
    if (S.over || S.paused) return;
    if (ev.k !== 'drops' && S.dpend) unpark(true);   /* drops still being given are a go done before this */
    if (ev.k !== 'stir' && S.pend) flushStir();   /* turns still being counted are a stir done before this */
    if (S.over || S.paused) return;
    if (ev.k === 'add'){
      if ((P.fatal_jar || []).includes(ev.item)){ tint(ev.item, ev.has); const fl = P.board.findIndex(l => (l.key || []).some(k => Array.isArray(k) && k[1] === 'fatal')), L = fl >= 0 ? fl : P.board.length - 1; (S.marks[L] = S.marks[L] || []).push({kind: 'fatal', did: jo(nm(ev.item), '을', '를') + ' 넣었다.'}); return ruin(P.fatal, true); }
      const f = P.do.find(a => (a.add === ev.item || a.hair === ev.item) && a.fatal === 'fire');
      if (f && S.onFire && S.heat !== 'none'){ tint(ev.item, ev.has); (S.marks[lineOf(f)] = S.marks[lineOf(f)] || []).push({kind: 'fatal', did: '불 위에 둔 채로 ' + jo(nm(ev.item), '을', '를') + ' 넣었다.'}); return ruin(P.fatal, true); }
    }
    let a = cur();
    /* a counted ingredient left short when something else is done */
    if (a && a.add && !a.prep && S.count > 0 && !(ev.k === 'add' && ev.item === a.add)){
      if (S.count !== (a.n || 1) && slip('count', jo(nm(a.add), '을', '를') + ' ' + S.count + unit(a.add) + '만 넣었다.', lineOf(a))) return;
      next(); a = cur();
    }
    let here = lineOf(a);
    if (a && a.wait && ev.k !== 'done'){ if (waited(a, here, '다음 줄로 넘어갔다.')) return; a = cur(); here = lineOf(a); }
    if (ev.k === 'heat'){
      heat(ev.v);
      if (a && a.heat === ev.v){ next(); return; }
      slip('heat', HEAT[ev.v], here); return;
    }
    if (ev.k === 'add'){
      tint(ev.item, ev.has);
      const name = nm(ev.item);
      /* a hair from an envelope */
      if (a && a.hair){
        if (ev.item === a.hair){ next(); return; }
        if (a.from.includes(ev.item)){ if (slip((DATA.jars[ev.item] || {}).cat ? 'hair_cat' : 'hair', jo(name, '을', '를') + ' 넣었다.', here)) return; next(); return; }
      }
      if (a && a.add === ev.item){
        if (a.prep){
          let bad = null, did = '';
          if (a.alt && a.alt.prep && ev.prep === a.alt.prep){ bad = 'book'; did = '교과서에 인쇄된 대로 ' + (ev.prep === 'chop' ? '칼로 썰었다.' : '했다.'); }
          else if (!ev.prep){ bad = 'raw'; did = jo(name, '을', '를') + ' 손질하지 않고 통째로 넣었다.'; }
          else if (ev.prep !== a.prep){ bad = a.prep; did = jo(name, '을', '를') + ({chop: ' 썰어서', grind: ' 빻아서', shred: ' 채 썰어서', press: ' 눌러 짜서'})[ev.prep] + ' 넣었다.'; }
          else if (a.prep === 'chop' && ev.cuts < a.min){ bad = 'chop'; did = ev.cuts ? ev.cuts + '번만 썰었다.' : '썰지 않았다.'; }
          else if (a.prep === 'grind' && ev.p < 1){ bad = 'grind'; did = '덩어리가 남은 채 넣었다.'; }
          else if (a.prep === 'press' && ev.partial){ bad = 'press'; did = '몇 개는 누르지 않고 넣었다.'; }
          else if (a.n && ev.n !== a.n){ bad = 'count'; did = jo(name, '을', '를') + ' ' + ev.n + unit(ev.item) + (a.prep === 'grind' ? ' 빻아' : ' 손질해') + ' 넣었다.'; }
          if (bad && slip(bad, did, here)) return;
          next(); return;
        }
        S.count++;
        if (S.count === (a.n || 1)) next();
        return;
      }
      const prev = P.do[S.i - 1];
      if (prev && prev.add === ev.item && !prev.prep){ slip('count', jo(name, '을', '를') + ' 칠판보다 많이 넣었다.', lineOf(prev)); return; }
      if (P.do.slice(S.i).some(x => x.add === ev.item || x.hair === ev.item)){ slip('order', jo(name, '을', '를') + ' 먼저 넣었다.', here); return; }
      S.flash = 1; slip('wrong', jo(name, '을', '를') + ' 넣었다.', here); return;
    }
    if (ev.k === 'drops'){
      tint(ev.item, ev.has);
      const did = jo(nm(ev.item), '을', '를') + ' ' + ev.n + '방울 넣었다.';
      if (a && a.drops === ev.item){ if (ev.n !== a.n && slip('drops', did, here)) return; next(); return; }
      if (P.do.slice(S.i).some(x => x.drops === ev.item)){ slip('order', jo(nm(ev.item), '을', '를') + ' 먼저 넣었다.', here); return; }
      S.flash = 1; slip('wrong', did, here); return;
    }
    if (ev.k === 'strain'){
      if (a && a.strain){ next(); return; }
      slip('order', '거르기를 먼저 했다.', here); return;
    }
    if (ev.k === 'stir'){
      const way = (ev.dir > 0 ? '시계 방향으로 ' : '시계 반대 방향으로 ') + ev.turns + '번 저었다.';
      if (a && a.stir){
        /* the printed textbook's way, where the margin says otherwise: all the turns one way */
        const nx = P.do[S.i + 1];
        if (nx && nx.alt && nx.alt.stir === ev.dir && ev.dir === a.stir && ev.turns === a.n + (nx.alt.n || 1)){ if (slip('book', '교과서에 인쇄된 대로 ' + way, here)) return; next(); next(); return; }
        if (a.alt && a.alt.stir === ev.dir && ev.turns === (a.alt.n || 1)){ if (slip('book', '교과서에 인쇄된 대로 ' + way, here)) return; next(); return; }
        let bad = null; if (Math.sign(ev.dir) !== a.stir) bad = 'dir'; else if (ev.turns !== a.n) bad = 'turns'; if (bad && slip(bad, way, here)) return; next(); return;
      }
      slip('order', '젓기를 먼저 했다.', here); return;
    }
    if (ev.k === 'done'){
      if (a && a.wait){ if (waited(a, here, '담으려 했다.', true)) return; a = cur(); here = lineOf(a); }
      if (!a || a.bottle){ S.i = P.do.length; finish(); return; }
      slip('order', '약을 먼저 병에 담으려 했다.', here);
    }
  }

  /* ---------- the fire */
  function heat(v){
    if (v === 'off'){ S.onFire = false; }
    else { S.onFire = true; S.heat = v; }
    sec.classList.toggle('off-fire', !S.onFire);
    sec.dataset.heat = S.onFire ? S.heat : 'off';
    drawTray();
  }

  /* ---------- colour of the water: each ingredient moves it; after the quills, off the fire, it turns by itself */
  function tint(item, has){
    const c = P.colours[item] || P.colours.wrong;
    S.from = S.colour; S.to = c; S.ct = performance.now();
    if (!P.colours[item]) setTimeout(() => { if (!S.over){ S.from = S.colour; S.to = P.colours[lastGood()] || P.colours.water; S.ct = performance.now(); } }, 1400);
    if ((item === P.buy || (has || []).includes(P.buy)) && !S.usedKey){ S.usedKey = true; if (S.source === 'own') shops.take(P.buy); else if (S.source === 'lend') pots.borrowed(); pots.keep(P.n, S.source); }
  }
  const lastGood = () => { for (let k = S.i - 1; k >= 0; k--) if (P.do[k].add) return P.do[k].add; return 'water'; };

  /* ---------- the end */
  async function ruin(line, fatal){
    S.over = true; S.ruin = performance.now();
    speak(fatal ? line : (line || DATA.slips.wrong), 5200);
    if (!store.get().settings.quiet && sfx.hiss) sfx.hiss(true);
    S.from = S.colour; S.to = '#1d2418'; S.ct = performance.now();
    for (let k = 0; k < 40; k++) S.puffs.push(puff(true));
    const s0 = S; await wait(fatal ? 2600 : 2000); if (S !== s0) return;
    report('ruined');
  }
  function finish(){
    S.over = true;
    report((S.slips0 || 0) + S.slips === 0 ? 'perfect' : 'fair');
  }
  /* the end of the first sitting: what the cauldron holds is kept, and the lesson goes on in three days */
  const STEW = {en: 'Leave it. Three days. Do not touch it, and do not let anyone else touch it.', ko: '그대로 둬라. 사흘이다. 손대지 말고, 아무도 손대게 하지 마라.'};
  function stewing(){
    if (S.over || S.paused) return;
    S.paused = true;
    pots.stew(P.n, {d: srs.today(), t: Date.now(), i: S.i + 1, slips: (S.slips0 || 0) + S.slips, marks: JSON.parse(JSON.stringify(S.marks)), colour: S.colour, source: S.source, used: !!S.usedKey});
    speak(STEW, 6000);
    end.innerHTML = `<div class="po-end-in po-intro"><div class="paperbox parch"></div><p class="t" lang="en">${esc(STEW.en)}</p><p class="k">${esc(STEW.ko)}</p>` +
      `<p class="k">사흘 뒤, 스네이프 문고리의 약병으로 다시 온다.</p><div class="po-end-btns"><button type="button" data-leave>나간다</button></div></div>`;
    end.hidden = false;
  }
  /* what Snape says when one comes back to the cauldron after the three days (P.intro.back, 2026-10-16), before the board
     goes on: the same card as on first coming in */
  function back(){
    const t = P.intro.back; if (!t) return;
    end.innerHTML = `<div class="po-end-in po-intro"><div class="paperbox parch"></div><p class="t" lang="en">${esc(bond.fill(t.en))}</p><p class="k">${esc(bond.fill(t.ko))}</p><div class="po-end-btns"><button type="button" data-go>솥 앞에 선다</button></div></div>`;
    end.hidden = false;
  }
  /* coming back to a stewed cauldron: the board where it was left; vanished in this sitting, it begins here again */
  function resume(){
    const v = pots.stewOf(P.n); if (!v) return false;
    start();
    Object.assign(S, {i: v.i, slips: 0, slips0: v.slips || 0, marks: JSON.parse(JSON.stringify(v.marks || {})), colour: v.colour, from: v.colour, to: v.colour, started: false, source: v.source, usedKey: v.used || !!pots.kept(P.n)});   /* started: the board folds (high level) at the first move, not before it can be reread */
    drawBoard(); drawTray();
    if (cur() && cur().wait) S.waitAt = performance.now();
    return true;
  }

  /* Snape's marked board (2026-10-14 user: "붉은 잉크 첨삭"): the potion (or not) at the top with his word, then every
     line of the board — ticked in red where it was done right; where it went wrong its key words underlined in red,
     his remark in the margin, and what the board asked set against what was done. Lines never reached stay bare. */
  const made0 = r => r !== 'ruined';
  function report(r){
    const second = !made0(r) && !!pots.stewOf(P.n), R0 = P.result[r], who = bond.fill('{name}'), made = r !== 'ruined';
    const R = second ? {en: R0.en.replace('Again, from the first line.', 'Again, from where the three days left it.'), ko: R0.ko.replace('다시, 첫 줄부터.', '다시, 사흘을 둔 그 자리부터.')} : R0;
    if (made) pots.record(P.n, r);
    const reached = new Set(P.do.slice(0, S.i).flatMap(a => a.line));
    /* a key is a phrase, or [phrase, kind]: then it is underlined only when that kind of slip happened on the line */
    const under = (t, keys, kinds) => keys.filter(k => typeof k === 'string' || kinds.includes(k[1]) || !keys.some(q => typeof q !== 'string' && kinds.includes(q[1]))).map(k => typeof k === 'string' ? k : k[0]).reduce((h, k) => h.replace(esc(k), '<u>' + esc(k) + '</u>'), esc(t));
    const rows = P.board.map((l, i) => {
      const m = S.marks[i];
      if (m && m.length) return `<li class="bad"><span class="mk" aria-label="틀림">✗</span><span class="ln" lang="en">${under(l.en, l.key || [], m.map(x => x.kind))}</span>` +
        m.map(x => `<span class="red" lang="en">${esc((x.kind === 'fatal' ? P.fatal : SL(x.kind)).en)}</span><span class="why">칠판: ${esc(l.ko)}<br>한 것: ${esc(x.did)}</span>`).join('') + '</li>';
      if (reached.has(i)) return `<li class="ok"><span class="mk" aria-label="맞음">✓</span><span class="ln" lang="en">${esc(l.en)}</span></li>`;
      return `<li class="none"><span class="mk"></span><span class="ln" lang="en">${esc(l.en)}</span></li>`;
    }).join('');
    const gen = (S.marks.gen || []).map(x => `<p class="po-gen"><span class="red" lang="en">${esc(SL(x.kind).en)}</span> <span class="why">${esc(x.did)}</span></p>`).join('');
    end.innerHTML = `<div class="po-end-in po-report"><div class="paperbox parch"></div>` +
      (made ? `<figure class="po-vial">${pots.phial(P.vial, P.en, pots.brewer(), r === 'fair')}</figure><p class="po-label" lang="en">${esc(P.en)}<br><span>${esc(who)}. ${esc(R.label)}</span></p>`
            : `<p class="po-vanished" lang="en">Evanesco.</p>`) +
      `<p class="t" lang="en">${esc(R.en)}</p><p class="k">${esc(R.ko)}</p>` +
      /* the first potion, made with his quills: the stores will not open twice */
      (made && S.source === 'lend' && P.intro.after ? `<p class="t" lang="en">${esc(P.intro.after.en)}</p><p class="k">${esc(P.intro.after.ko)}</p>` : '') +
      /* the fatal mistake is not counted among the slips, but it is one: never "Not one slip." over a ruined cauldron */
      ((n => `<p class="po-grade" lang="en">${n ? n + (n > 1 ? ' slips' : ' slip') : 'Not one slip.'}</p>`)((S.slips0 || 0) + S.slips + (Object.values(S.marks).flat().some(x => x && x.kind === 'fatal') ? 1 : 0))) + gen +
      `<ol class="po-marked">${rows}</ol>` +
      `<div class="po-end-btns">${made ? '<button type="button" data-shelf>약장에 놓는다</button>' + (pots.best(P.n) === 'perfect' ? '' : '<button type="button" data-rebrew>다시 끓인다</button>') + '<button type="button" data-leave>나간다</button>' : `<button type="button" data-again>${second ? '이 자리부터 다시 한다' : '첫 줄부터 다시 한다'}</button>`}</div></div>`;
    end.hidden = false; end.scrollTop = 0;
  }
  end.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if ('go' in b.dataset){ end.hidden = true; S.bench = true; fitBoard(); return; }
    /* vanished (Evanesco): begin again at once, as the first time — nothing more to fetch or buy; quills already
       taken from the bag for this brewing are not taken a second time (2026-10-14 user decision) */
    if ('again' in b.dataset){ end.hidden = true; const src = S.source, used = S.usedKey; if (pots.stewOf(P.n)){ resume(); S.source = src; S.usedKey = S.usedKey || used; } else { start(); S.source = src; S.usedKey = used; } S.bench = true; fitBoard(); return; }
    if ('rebrew' in b.dataset){ start(); intro(true); return; }
    if ('shelf' in b.dataset){ cabinet(P.n); return; }
    if (b.dataset.vial){ const q = DATA.potions.find(x => x.n === +b.dataset.vial); if (q) closeUp(q); return; }
    if ('closeUp' in b.dataset){ const c = end.querySelector('.po-close'); if (c) c.remove(); return; }
    if (b.dataset.brew){ const n = +b.dataset.brew; if (n === P.n && location.hash === '#/potion/' + n){ $('#poTtl').textContent = P.en; start(); intro(true); } else location.hash = '#/potion/' + n; return; }
    if ('leave' in b.dataset) history.length > 1 ? history.back() : (location.hash = '#/');
  });

  /* ---------- the bench: putting things on the board or in the mortar */
  function place(id, x, y, rot){
    const W = work.clientWidth, H = work.clientHeight;
    if (S.tool === 'board'){
      const sz = (DATA.jars[id] || {}).size || 1, g = boardPx();
      if (S.board && (S.board.item !== id || sz >= .6 || S.board.things.length >= 8)){ toast(S.board.item !== id ? '도마에 다른 것이 있다 · 솥으로 가져가거나 도로 담기' : '도마가 찼다', 2200); return; }
      if (!S.board) S.board = {item: id, cuts: 0, along: 0, things: []};
      /* a big thing lies in the middle; small things where they are dropped, inside the board */
      const fx = sz >= .6 ? 0 : Math.max(-.36, Math.min(.36, (x - g.cx) / g.w)), fy = sz >= .6 ? 0 : Math.max(-.3, Math.min(.3, (y - g.cy) / g.h));
      /* small things fall as they please: each a little turned, a little off where it was dropped, not on top of another */
      let px = fx, py = fy; const R = Math.random, small = sz < .6;
      if (small){ px += (R() - .5) * .06; py += (R() - .5) * .06; for (let k = 0; k < 12 && S.board.things.some(t => Math.hypot(t.fx - px, (t.fy - py) * .77) < sz * .75); k++){ const an = R() * 6.283; px = Math.max(-.38, Math.min(.38, px + Math.cos(an) * sz * .6)); py = Math.max(-.32, Math.min(.32, py + Math.sin(an) * sz * .6)); } }
      if (small){ px = fx; py = fy; }   /* where the hand let go, nudged only if it would lie on another */
      for (let k = 0; small && k < 12 && S.board.things.some(t => Math.hypot(t.fx - px, (t.fy - py) * .77) < sz * .75); k++){ const an = R() * 6.283; px = Math.max(-.38, Math.min(.38, px + Math.cos(an) * sz * .6)); py = Math.max(-.32, Math.min(.32, py + Math.sin(an) * sz * .6)); }
      /* the outline is wider than the picture's square: a picture turned on the board (dittany, feathers, beans) must not be clipped at its corners */
      S.board.things.push({fx: px, fy: py, rot: small ? (rot != null ? rot : R() * 6.283) : 0, pieces: [{poly: [[-.72, -.72], [.72, -.72], [.72, .72], [-.72, .72]], dx: 0, dy: 0}], pressed: false});
      if (!store.get().settings.quiet && sfx.clink) sfx.clink();
      drawTray(); return;
    }
    const m = S.mortar || (S.mortar = {items: [], p: 0, work: 0, dust: null});
    if (m.items.length >= 8) return;
    const R = rnd(m.items.length * 7919 + 13), g = mortarPx(), a = R() * Math.PI * 2, rr = g.r * .42 * Math.sqrt(R());
    const inBowl = Math.hypot(x - g.cx, y - g.cy) < g.r * .6;
    m.items.push({item: id, x: (inBowl ? x - g.cx : Math.cos(a) * rr) / g.r, y: (inBowl ? y - g.cy : Math.sin(a) * rr) / g.r, rot: rot != null ? rot : R() * Math.PI * 2, seed: Math.floor(R() * 1e6)});
    m.p = Math.min(m.p, .999 * m.p);   // something whole is in it again
    if (!store.get().settings.quiet && sfx.clink) sfx.clink();
    drawTray();
  }
  /* the board: the things laid on it, each with its pieces as polygons in units of its own size around its own centre
     (so they survive the screen turning or the window changing size) */
  const boardBase = () => { const g = boardPx(); return Math.min(g.w * .78, g.h * 1.3); };
  function geo(t){
    const g = boardPx(), j = DATA.jars[S.board.item] || {};
    /* a thing that has just shot away from the knife slides to where it lands */
    let fx = t.fx, fy = t.fy, rot = j.board ? (typeof j.board === 'number' ? j.board : -.72) : t.rot || 0;
    if (t.skid){ const k = Math.min(1, (performance.now() - t.skid.at) / 260), e = 1 - (1 - k) * (1 - k); fx = t.skid.fx + (t.fx - t.skid.fx) * e; fy = t.skid.fy + (t.fy - t.skid.fy) * e; rot = t.skid.rot + (rot - t.skid.rot) * e; if (k >= 1) t.skid = null; }
    return {cx: g.cx + fx * g.w, cy: g.cy + fy * g.h, s: boardBase() * (j.size || 1), rot};
  }
  function layoutBoard(){}
  /* is there anything of the thing under the line? its picture's alpha, sampled along the line (in units, unrotated) */
  const masks = {};
  function through(item, rot, u, dd){
    const im = pic(DATA.jars[item].img), N = 96;
    const mk = item + '@' + rot.toFixed(2); let m = masks[mk];
    if (!m){ if (!im.complete || !im.naturalWidth) return true; const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
      x.translate(N / 2, N / 2); x.rotate(rot); fitIn(x, im, N); m = masks[mk] = x.getImageData(0, 0, N, N).data; }
    for (let t = -.7; t <= .7; t += .01){ const px = Math.round((u[0] + dd[0] * t + .5) * N), py = Math.round((u[1] + dd[1] * t + .5) * N);
      if (px >= 0 && py >= 0 && px < N && py < N && m[(py * N + px) * 4 + 3] > 90) return true; }
    return false;
  }
  /* a cut along the line through p (screen) in direction d: every piece it crosses falls in two, and the halves part */
  /* reach: how far along the line the blade actually goes, from p ([from, to] in px) — a tap cuts only what lies under
     the blade, a stroke only what it passes over; two beans side by side are not cut by one blow (user, 2026-10-15) */
  function cut(p, d, reach){
    const b = S.board; if (!b) return;
    const n = Math.hypot(...d), dd = [d[0] / n, d[1] / n], nrm = [-dd[1], dd[0]];
    let counted = false, slid = false;
    for (const t of b.things){
      const G = geo(t), u = [(p[0] - G.cx) / G.s, (p[1] - G.cy) / G.s], gap = 7 / G.s, min = 40 / (G.s * G.s), out = [];
      if (reach){ const along = (G.cx - p[0]) * dd[0] + (G.cy - p[1]) * dd[1], ext = G.s * .35; if (along < reach[0] - ext || along > reach[1] + ext) continue; }
      /* the bean: the blade slips on it and it shoots off across the board — mostly; now and then the knife bites, and
         never more than five slips in a row for one bean (user, 2026-10-15: not a fixed count one could foresee) */
      if ((DATA.jars[b.item] || {}).slippery && (t.skids || 0) < 5 && Math.random() < .7 && t.pieces.length === 1 && through(b.item, G.rot, u, dd)){
        const R = Math.random, an = Math.atan2(nrm[1], nrm[0]) + (R() < .5 ? 0 : Math.PI) + (R() - .5) * .8, far = .16 + R() * .1;
        t.skid = {fx: t.fx, fy: t.fy, rot: t.rot || 0, at: performance.now()};
        t.fx = Math.max(-.4, Math.min(.4, t.fx + Math.cos(an) * far)); t.fy = Math.max(-.34, Math.min(.34, t.fy + Math.sin(an) * far)); t.rot = (t.rot || 0) + (R() - .5) * 3;
        t.skids = (t.skids || 0) + 1; slid = true; continue;
      }
      let hit = false;
      for (const pc of t.pieces){
        const local = pc.poly.map(q => [q[0] + pc.dx, q[1] + pc.dy]), two = split(local, u, dd);
        if (!two || Math.min(areaOf(two[0]), areaOf(two[1])) < min){ out.push(pc); continue; }
        hit = true;
        two.forEach((poly, k) => { const sg = k ? 1 : -1; out.push({poly: poly.map(q => [q[0] - pc.dx, q[1] - pc.dy]), dx: pc.dx + nrm[0] * gap * sg, dy: pc.dy + nrm[1] * gap * sg}); });
      }
      t.pieces = out;
      /* only a cut through the thing itself counts — not one through the empty corners of its picture */
      if (hit && through(b.item, G.rot, u, dd)) counted = true;
    }
    if (counted){ b.cuts++; if (!store.get().settings.quiet && sfx.chop) sfx.chop(); }
    else if (slid && !store.get().settings.quiet && sfx.clink) sfx.clink();
  }

  /* bench pointer: the knife or the pestle */
  let hand = null;
  work.addEventListener('pointerdown', e => {
    if (!S || S.over || S.view !== 'bench') return;
    const r = work.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    hand = {x0: x, y0: y, x, y, t: performance.now(), path: 0}; cap(work, e); begin();
    if (S.tool === 'board' && S.board && S.knife === 'dagger'){ const h = hand, t = S.board.things.map(t => ({t, g: geo(t)})).filter(o => Math.hypot(o.g.cx - x, o.g.cy - y) < o.g.s * .5).sort((p, q) => Math.hypot(p.g.cx - x, p.g.cy - y) - Math.hypot(q.g.cx - x, q.g.cy - y))[0];
      if (t) setTimeout(() => { if (hand === h && h.path < 12 && !t.t.pressed){ t.t.pressed = true; t.t.pressAt = performance.now(); if (!store.get().settings.quiet && sfx.chop) sfx.chop(); } }, 650); }
    S.hand = {x, y, down: true};
  });
  work.addEventListener('pointermove', e => {
    const r = work.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    S && (S.hand = {x, y, down: !!hand});
    if (!hand) return;
    const dl = Math.hypot(x - hand.x, y - hand.y); hand.path += dl; hand.x = x; hand.y = y;
    if (S.tool === 'mortar' && S.mortar && S.mortar.items.length) grindAt(x, y, dl);
  });
  const up = () => {
    if (!hand) return; const h = hand; hand = null; if (S.hand) S.hand.down = false;
    if (S.tool !== 'board' || !S.board || S.knife === 'dagger') return;
    const dx = h.x - h.x0, dy = h.y - h.y0, len = Math.hypot(dx, dy);
    if (len > boardBase() * .25 && Math.abs(dy) < Math.abs(dx) * .6){ const c0 = S.board.cuts; cut([h.x0, h.y0], [dx, dy], [0, len]); if (S.board.cuts > c0) S.board.along = (S.board.along || 0) + 1; S.knifeAt = performance.now(); return; }
    if (len < 14) cut([h.x0, h.y0], [0, 1], [0, 0]);            // a tap: the knife comes straight down on what is under the hand
    else if (len > boardBase() * .25) cut([h.x0, h.y0], [dx, dy], [0, len]);
    S.knifeAt = performance.now();
  };
  work.addEventListener('pointerup', up); work.addEventListener('pointercancel', up);
  work.addEventListener('pointerleave', () => { if (S && !hand) S.hand = null; });

  function grindAt(x, y, dl){
    const m = S.mortar, g = mortarPx(), dx = x - g.cx, dy = y - g.cy;
    if (Math.hypot(dx, dy) > g.r * 1.05) return;
    const need = 26 * g.r * m.items.length;   // about a dozen good rounds of the bowl for each piece
    m.work += dl; m.p = Math.min(1, m.work / need);
    if (!store.get().settings.quiet && sfx.grit && performance.now() - (m.snd || 0) > 140){ m.snd = performance.now(); sfx.grit(); }
  }

  /* ---------- stirring: circles drawn in the water with the glass rod */
  liq.addEventListener('pointerdown', e => {
    if (!S || S.over || S.view !== 'pot') return;
    const r = liq.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, m = mouthPx();
    if (((x - m.cx) / m.rx) ** 2 + ((y - m.cy) / m.ry) ** 2 > 1.1) return;
    cap(liq, e); begin(); clearTimeout(S.stirT);
    S.stirring = {a: Math.atan2((y - m.cy) / m.ry, (x - m.cx) / m.rx), x, y};
  });
  /* stirring: circles drawn in the water. Each way round is counted on its own: turning back the other way for more than
     a quarter circle closes the turns so far and starts counting the other way — so "seven anti-clockwise, then one
     clockwise" can be drawn without lifting the finger. Movement close to the middle is not counted (the angle there
     jumps about). The turns so far stand over the cauldron as tally marks, a stroke for each full turn (2026-10-15,
     user: "저을 때마다 ///- 이걸로 카운트") — and they keep adding up when the finger is lifted between circles and comes
     back the same way: they are counted as one stir only when the hand rests (STIR_REST after it leaves the water),
     turns the other way, or does something else. Before, every lift counted on its own, and four circles drawn one at
     a time came out as "once". A turn counts from seven-eighths of a circle. */
  const STIR_REST = 1500, lapsOf = run => Math.floor((Math.abs(run) + Math.PI * .25) / (2 * Math.PI));
  const tagEl = document.createElement('div'); tagEl.className = 'po-tag'; liq.parentElement.appendChild(tagEl);
  const tallyEl = document.createElement('div'); tallyEl.className = 'po-tally'; tallyEl.setAttribute('aria-live', 'polite'); liq.parentElement.appendChild(tallyEl);
  function tally(n, dir, done, kind){
    const g = [];
    if (kind === 'drops'){
      for (let k = 0; k < n; k++){ const x = Math.floor(k / 5) * 64 + (k % 5) * 12 + 5; g.push(`<path class="dr" d="M${x} 7 C${x - 1.5} 11 ${x - 4.6} 14.5 ${x - 4.6} 18 A4.6 4.6 0 0 0 ${x + 4.6} 18 C${x + 4.6} 14.5 ${x + 1.5} 11 ${x} 7 Z"/>`); }
      const w = Math.max(10, Math.floor((n - 1) / 5) * 64 + ((n - 1) % 5) * 12 + 10);
      tallyEl.innerHTML = `<svg viewBox="0 0 ${w} 30" width="${w}" height="30" aria-hidden="true">${g.join('')}</svg><span class="sr">${n}방울</span>`;
    } else {
    for (let k = 0; k < n; k++){ const q = k % 5, x0 = Math.floor(k / 5) * 46; g.push(q < 4 ? `<line x1="${x0 + 4 + q * 8}" y1="3" x2="${x0 + 3 + q * 8}" y2="27"/>` : `<line x1="${x0}" y1="22" x2="${x0 + 34}" y2="8"/>`); }
    const w = Math.max(8, Math.ceil(n / 5) * 46);
    tallyEl.innerHTML = `<svg class="way" viewBox="0 0 26 26" width="26" height="26" aria-hidden="true"><g${dir > 0 ? '' : ' transform="translate(26 0) scale(-1 1)"'}><path d="M13 4 A9 9 0 1 1 4 13"/><path d="M4 13 L0.6 16.8 M4 13 L7.6 16.4"/></g></svg><svg viewBox="0 0 ${w} 30" width="${w}" height="30" aria-hidden="true">${g.join('')}</svg><span class="sr">${dir > 0 ? '시계 방향' : '시계 반대 방향'} ${n}번</span>`;
    }
    const m = mouthPx(); tallyEl.style.top = (m.cy - 16) + 'px';   /* on the water, where the rod is: above the rim the board's paper covers it */
    tallyEl.classList.add('on'); tallyEl.classList.toggle('done', !!done);
    clearTimeout(tallyEl.t); if (done) tallyEl.t = setTimeout(() => { if (!S || (!S.pend && !S.dpend)) tallyEl.classList.remove('on'); }, 1600);
  }
  function flushStir(){
    const p = S.pend; S.pend = null; clearTimeout(S.stirT); if (!p) return;
    const n = lapsOf(p.run), dir = p.run > 0 ? 1 : -1;
    if (n){ tally(n, dir, true); act({k: 'stir', dir, turns: n}); } else tallyEl.classList.remove('on');
  }
  liq.addEventListener('pointermove', e => {
    if (!S || !S.stirring) return;
    const r = liq.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, m = mouthPx(), st = S.stirring;
    const a = Math.atan2((y - m.cy) / m.ry, (x - m.cx) / m.rx); let d = a - st.a; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI;
    st.a = a; st.x = x; st.y = y;
    if (Math.hypot((x - m.cx) / m.rx, (y - m.cy) / m.ry) < .22) return;
    let p = S.pend || (S.pend = {run: 0, back: 0, laps: 0});
    if (!p.run || Math.sign(d) === Math.sign(p.run)){ p.run += d; p.back = 0; }   /* a small wobble back is forgotten */
    else { p.back += d; if (Math.abs(p.back) > Math.PI / 2){ const back = p.back; flushStir(); if (!S.stirring) return; p = S.pend = {run: back, back: 0, laps: 0}; } }
    S.swirlDir = Math.sign(p.run); S.swirl = Math.min(1, S.swirl + Math.abs(d) * .2);
    const laps = lapsOf(p.run);
    if (laps > p.laps){ p.laps = laps; tally(laps, Math.sign(p.run)); if (!store.get().settings.quiet && sfx.slosh) sfx.slosh(); }
  });
  const stirEnd = () => {
    if (!S || !S.stirring) return; S.stirring = null;
    const s0 = S; clearTimeout(S.stirT); if (S.pend) S.stirT = setTimeout(() => { if (S === s0 && !S.stirring) flushStir(); }, STIR_REST);
  };
  liq.addEventListener('pointerup', stirEnd); liq.addEventListener('pointercancel', stirEnd);

  /* ---------- geometry on screen */
  let K = 1, potRect = null;
  function size(){
    const dpr = Math.min(2, devicePixelRatio || 1);
    /* the cauldron and its fire, sized to the stage */
    const sw = stage.clientWidth, sh = stage.clientHeight;
    /* the cauldron with its fire pit below is about twice as tall as the cauldron is wide (see the CSS); the stage shows down to the coals */
    const w = Math.min(sw * .62, sh * .68, 300); K = w / POT.w;
    potBox.style.setProperty('--pw', w + 'px'); potBox.style.setProperty('--pt', Math.max(4, (sh - 1.5 * w) / 2) + 'px');   /* the lower stones of the pit may fall below the stage */
    for (const [c, el] of [[lx, liq], [wx, work]]){ el.width = el.clientWidth * dpr; el.height = el.clientHeight * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); }
    steam.width = steam.clientWidth * dpr; steam.height = steam.clientHeight * dpr; sx.setTransform(dpr, 0, 0, dpr, 0, 0);
    potRect = null;
    Object.assign(tagEl.style, {left: 118 * K + 'px', top: 392 * K + 'px'});   /* tied to the front left of the rim */
    if (S && S.board) layoutBoard();
    if (S && !fitting) fitBoard();
  }
  /* the water's ellipse, in the liquid canvas (which lies exactly over the cauldron photograph) */
  const mouthPx = () => ({cx: POT.mouth.cx * K, cy: POT.mouth.cy * K, rx: POT.mouth.rx * K, ry: POT.mouth.ry * K});
  const boardPx = () => { const W = work.clientWidth, H = work.clientHeight, bw = Math.min(W * .9, H * .9 * 1000 / 774), bh = bw * 774 / 1000; return {cx: W / 2, cy: H / 2, w: bw, h: bh}; };
  const mortarPx = () => { const W = work.clientWidth, H = work.clientHeight, mw = Math.min(W * .86, H * .86 * MORTAR.w / MORTAR.h), k = mw / MORTAR.w;
    return {x: W / 2 - mw / 2, y: H / 2 - MORTAR.h * k / 2, k, w: mw, h: MORTAR.h * k, cx: W / 2 - mw / 2 + MORTAR.cx * k, cy: H / 2 - MORTAR.h * k / 2 + MORTAR.cy * k, r: MORTAR.r * k}; };

  /* ---------- drawing, every frame */
  const puff = big => { const m = mouthPx(), R = Math.random; return {x: m.cx + (R() - .5) * m.rx * 1.4, y: m.cy, vx: (R() - .5) * (big ? 1.6 : .35), vy: -(big ? 1.2 + R() * 1.8 : .35 + R() * .45), r: (big ? 18 : 10) + R() * 16, life: 0, max: (big ? 70 : 160) + R() * 80}; };
  function splash(x, y){ const m = mouthPx(); S.ripples.push({x: Math.max(m.cx - m.rx * .6, Math.min(m.cx + m.rx * .6, x)), y: m.cy + (Math.random() - .3) * m.ry * .5, t: performance.now()}); if (!store.get().settings.quiet && sfx.plop) sfx.plop(); }

  function frame(now){
    raf = requestAnimationFrame(frame);
    if (!S) return;
    /* the colour, moving to where it should be */
    const k = Math.min(1, (now - S.ct) / 1200);
    S.colour = mix(S.from, S.to, k);
    if (S.waitAt && !S.over && cur() && cur().wait){
      const t = (now - S.waitAt) / 1000, T = P.turn, C = P.colours, base = S.waitFrom || (S.waitFrom = S.colour);
      const c = t < T.start ? base : t < T.from ? mix(base, C.turn || C.done, (t - T.start) / (T.from - T.start))
        : t < T.to ? mix(C.turn || C.done, C.done, Math.min(1, (t - T.from) / 1.6)) : mix(C.done, C.over || C.done, Math.min(1, (t - T.to) / 1.8));   /* past the moment it turns as plainly as it came (it crept over four seconds, and still looked right when it was already late) */
      S.colour = c; S.smoking = cur().wait === 'smoke' && t >= T.from && t <= T.to + 1;
      tagEl.classList.add('on');
    } else { S.waitFrom = null; S.smoking = false; tagEl.classList.remove('on'); }
    S.flash = Math.max(0, S.flash - .02); S.swirl = Math.max(0, S.swirl - .008);
    const hot = S.onFire ? (S.heat === 'high' ? 1 : S.heat === 'low' ? .35 : 0) : 0;
    S.boil += ((S.started || S.onFire && S.heat !== 'off' ? hot : 0) - S.boil) * .01;
    if (drag && drag.pour && drag.tok && !S.over){ const dt = Math.min(.05, (now - (drag.pt || now)) / 1000); drag.pt = now; drag.tok.left -= dt / 1.3; pour(drag.pour, drag.tok, dt / 1.3 * 2.2); if (drag.tok.left <= 0) pourDone(drag); }
    else if (drag) drag.pt = 0;
    S.film = Math.max(0, S.film - .0015);
    if (S.view === 'pot') drawPot(now); else drawBench(now);
  }

  function drawPot(now){
    const W = liq.clientWidth, H = liq.clientHeight, m = mouthPx(), s = {cx: POT.surf.cx * K, cy: POT.surf.cy * K, rx: POT.surf.rx * K, ry: POT.surf.ry * K};
    lx.clearRect(0, 0, W, H);
    lx.save();
    lx.beginPath(); lx.ellipse(m.cx, m.cy, m.rx * .985, m.ry * .97, 0, 0, Math.PI * 2); lx.clip();
    /* the surface: lit from the upper left, darker where it meets the metal */
    const col = S.colour, g = lx.createRadialGradient(s.cx + s.rx * .1, s.cy + s.ry * .15, s.rx * .05, s.cx, s.cy, s.rx);
    g.addColorStop(0, mix(col, '#ffffff', .1)); g.addColorStop(.6, col); g.addColorStop(1, mix(col, '#000000', .72));
    lx.fillStyle = g; lx.beginPath(); lx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2); lx.fill();
    /* the far wall's shadow lying across the back of the water */
    const sh = lx.createLinearGradient(0, s.cy - s.ry, 0, s.cy - s.ry * .1); sh.addColorStop(0, 'rgba(0,0,0,.75)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    lx.fillStyle = sh; lx.fillRect(s.cx - s.rx, s.cy - s.ry, s.rx * 2, s.ry * .9);
    /* the meniscus: a thin bright line where the water meets the metal, catching the candle on the left */
    lx.strokeStyle = rgba(mix(col, '#fff2d6', .6), .35); lx.lineWidth = 1.2;
    lx.beginPath(); lx.ellipse(s.cx, s.cy, s.rx * .995, s.ry * .99, 0, Math.PI * .95, Math.PI * 1.55); lx.stroke();
    lx.globalCompositeOperation = 'screen';
    /* the swirl while stirring: arcs turning the way the rod goes */
    if (S.swirl > .02){
      lx.strokeStyle = rgba('#fff8e8', .18 * S.swirl); lx.lineWidth = 1.4;
      for (let i = 1; i <= 4; i++){ const r = i / 4.6, a0 = now / 380 * (S.swirlDir || 1) + i; lx.beginPath(); lx.ellipse(s.cx, s.cy, s.rx * r, s.ry * r, 0, a0, a0 + 1.6); lx.stroke(); }
    }
    lx.globalCompositeOperation = 'source-over';
    /* bubbles: rising, swelling, bursting — as many as the fire is hot */
    if (Math.random() < S.boil * .9) S.bubbles.push({x: s.cx + (Math.random() - .5) * s.rx * 1.5, y: s.cy + (Math.random() - .5) * s.ry * 1.3, r: 0, max: 2 + Math.random() * 5 * (.4 + S.boil), t: now});
    S.bubbles = S.bubbles.filter(b => now - b.t < 700);
    for (const b of S.bubbles){
      const k = (now - b.t) / 700, r = b.max * Math.sin(Math.min(1, k * 1.2) * Math.PI / 2);
      if (((b.x - s.cx) / s.rx) ** 2 + ((b.y - s.cy) / s.ry) ** 2 > .85) continue;
      lx.fillStyle = rgba(mix(col, '#000000', .35), .5 * (1 - k)); lx.beginPath(); lx.ellipse(b.x, b.y, r, r * .62, 0, 0, Math.PI * 2); lx.fill();
      lx.strokeStyle = rgba(mix(col, '#ffffff', .55), .55 * (1 - k)); lx.lineWidth = .9; lx.beginPath(); lx.ellipse(b.x, b.y, r, r * .62, 0, Math.PI * 1.1, Math.PI * 1.8); lx.stroke();
    }
    /* ripples where something went in */
    S.ripples = S.ripples.filter(r => now - r.t < 1400);
    for (const r of S.ripples){ const k = (now - r.t) / 1400; for (let i = 0; i < 3; i++){ const kk = Math.max(0, k - i * .12); if (!kk) continue;
      lx.strokeStyle = rgba('#fffaf0', .35 * (1 - kk)); lx.lineWidth = 1.3; lx.beginPath(); lx.ellipse(r.x, r.y, s.rx * .5 * kk, s.ry * .5 * kk, 0, 0, Math.PI * 2); lx.stroke(); } }
    if (S.film > .01){ lx.fillStyle = rgba('#e9dfc4', S.film * .6); lx.beginPath(); lx.ellipse(s.cx, s.cy, s.rx * .85, s.ry * .8, 0, 0, Math.PI * 2); lx.fill(); }
    /* a wrong thing: the water clouds for a moment */
    if (S.flash > 0){ lx.fillStyle = rgba('#2c2a1a', .45 * S.flash); lx.fillRect(0, 0, W, H); }
    lx.restore();
    /* the glass rod in the hand while stirring */
    if (S.stirring){ const im = pic(IMG('rod')), k2 = .62 * K * 900 / POT.h * 1.6; lx.drawImage(im, S.stirring.x - ROD.tip[0] * k2, S.stirring.y - ROD.tip[1] * k2, ROD.w * k2, ROD.h * k2); }
    drawSteam(now);
  }
  function drawSteam(now){
    const W = steam.clientWidth, H = steam.clientHeight;
    sx.clearRect(0, 0, W, H);
    if (!potRect) potRect = {a: steam.getBoundingClientRect(), b: liq.getBoundingClientRect()};
    const ox = potRect.b.left - potRect.a.left, oy = potRect.b.top - potRect.a.top;
    const rate = .05 + S.boil * .5;
    if (!reduced() && Math.random() < rate) S.puffs.push(puff(false));
    S.puffs = S.puffs.filter(p => p.life < p.max);
    /* what is being poured: falling, then gone into the water (a ring now and then, a pale film that sinks) */
    S.grains = S.grains.filter(g => {
      g.vy += .22; g.x += g.vx; g.y += g.vy; g.rot += .1;
      if (g.y >= g.ty){ if (Math.random() < (g.drop ? 1 : g.powder ? .04 : .3)) S.ripples.push({x: g.x - ox, y: g.ty - oy, t: performance.now()}); S.film = Math.min(.5, S.film + (g.powder ? .004 : .002)); return false; }
      sx.save(); sx.translate(g.x, g.y); sx.rotate(g.rot); sx.fillStyle = g.c;
      if (g.drop){ sx.beginPath(); sx.ellipse(0, 0, g.s * .7, g.s, 0, 0, 6.283); sx.fill(); }
      else if (g.powder) sx.fillRect(-g.s / 2, -g.s / 2, g.s, g.s); else { sx.beginPath(); sx.ellipse(0, 0, g.s, g.s * .45, 0, 0, 6.283); sx.fill(); }
      sx.restore(); return true;
    });
    const tintC = S.smoking && P.colours.smoke ? P.colours.smoke : mix(S.colour, '#e8e4dc', .7);
    if (S.smoking && !reduced() && Math.random() < .5) S.puffs.push(puff(false));
    for (const p of S.puffs){
      p.life++; p.x += p.vx + Math.sin((p.life + p.r) / 30) * .25; p.y += p.vy; p.r += .22;
      const a = Math.sin(Math.PI * p.life / p.max) * .16;
      const g = sx.createRadialGradient(ox + p.x, oy + p.y, 0, ox + p.x, oy + p.y, p.r);
      g.addColorStop(0, rgba(tintC, a)); g.addColorStop(1, rgba(tintC, 0));
      sx.fillStyle = g; sx.beginPath(); sx.arc(ox + p.x, oy + p.y, p.r, 0, Math.PI * 2); sx.fill();
    }
  }

  function drawBench(now){
    const W = work.clientWidth, H = work.clientHeight;
    wx.clearRect(0, 0, W, H);
    if (S.tool === 'board'){
      const g = boardPx(); wx.drawImage(pic(IMG('board')), g.cx - g.w / 2, g.cy - g.h / 2, g.w, g.h);
      if (S.board) boardThing(wx);
      /* the knife, over the board where the hand is */
      if (S.hand && S.knife === 'dagger'){ const kn = pic(IMG('dagger')), ok = kn.complete && kn.naturalWidth, dg = ok ? kn : pic(IMG('knife')), kh = Math.min(H * .7, 300), kw = kh * (ok ? kn.naturalWidth / kn.naturalHeight : 90 / 560);
        wx.save(); wx.translate(S.hand.x, S.hand.y); wx.rotate(Math.PI / 2); wx.shadowColor = 'rgba(0,0,0,.6)'; wx.shadowBlur = S.hand.down ? 6 : 16; wx.shadowOffsetY = S.hand.down ? 2 : 10; wx.drawImage(dg, -kw / 2, -kh * .3, kw, kh); wx.restore(); }
      else if (S.hand){ const kn = pic(IMG('knife')), kh = Math.min(H * .7, 300), kw = kh * 90 / 560, down = Math.max(0, 1 - (now - (S.knifeAt || 0)) / 160);
        wx.save(); wx.shadowColor = 'rgba(0,0,0,.6)'; wx.shadowBlur = 14 - down * 8; wx.shadowOffsetX = 8 - down * 6; wx.shadowOffsetY = 10 - down * 8;
        wx.drawImage(kn, S.hand.x - kw / 2, S.hand.y - kh * .3, kw, kh); wx.restore(); }
    } else {
      const g = mortarPx(); wx.drawImage(pic(IMG('mortar')), g.x, g.y, g.w, g.h);
      if (S.mortar) mortarThing(wx, g);
      /* the pestle: its grinding end where the hand is, its handle towards the lower right */
      if (S.hand){ const ps = pic(IMG('pestle')), ph = g.r * 1.7, pw = ph * 162 / 560, t = S.hand.down ? 0 : 6;
        wx.save(); wx.translate(S.hand.x + t, S.hand.y + t); wx.rotate(Math.PI * .78); wx.shadowColor = 'rgba(0,0,0,.6)'; wx.shadowBlur = 16; wx.shadowOffsetX = 10; wx.shadowOffsetY = -6;
        wx.drawImage(ps, -pw / 2, -ph, pw, ph); wx.restore(); }
    }
  }
  /* what lies on the board: the thing, in its pieces, each a little apart from the next */
  function boardThing(x){
    const b = S.board, im = pic(DATA.jars[b.item].img);
    for (const t of b.things){
      const G = geo(t);
      /* a pressed thing: flattened, with its juice spreading on the board */
      if (t.pressed){ const k = Math.min(1, (performance.now() - (t.pressAt || 0)) / 500), j = x.createRadialGradient(G.cx, G.cy, 0, G.cx, G.cy, G.s * .6 * k);
        j.addColorStop(0, rgba(P.colours[b.item] || '#b7a0d2', .55)); j.addColorStop(1, rgba(P.colours[b.item] || '#b7a0d2', 0));
        x.fillStyle = j; x.beginPath(); x.ellipse(G.cx, G.cy, G.s * .6 * k, G.s * .42 * k, 0, 0, 6.283); x.fill();
        x.save(); x.translate(G.cx, G.cy); x.scale(1.12, .74); x.translate(-G.cx, -G.cy); }
      for (const pc of t.pieces){
        x.save(); x.translate(G.cx, G.cy); x.scale(G.s, G.s); x.translate(pc.dx, pc.dy);
        x.beginPath(); pc.poly.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.clip();
        x.rotate(G.rot); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 9; x.shadowOffsetY = 3;
        if (okImg(im)) fitIn(x, im); else { x.fillStyle = "#6b5a3a"; x.fillRect(-.3, -.08, .6, .16); } x.restore();
      }
      if (t.pressed) x.restore();
    }
  }

  const powders = {};
  function powderOf(id){
    if (powders[id]) return powders[id];
    const im = pic((DATA.jars[id] || {}).img || ''); if (!okImg(im)) return '#dcd0b2';
    const c = document.createElement('canvas'); c.width = c.height = 48; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 48, 48);
    const d = x.getImageData(0, 0, 48, 48).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 160){ r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    if (!n) return '#dcd0b2';
    const hex = '#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('');
    return (powders[id] = mix(hex, '#efe6d2', .3));
  }
  /* what is in the mortar: powder over the whole floor of the bowl, and what is still in pieces */
  function mortarThing(x, g){
    const m = S.mortar;
    if (m.p > .02){
      const dust = m.dust || (m.dust = Array.from({length: 1600}, (_, i) => { const R = rnd(i * 31 + 7), a = R() * 6.283, r = Math.sqrt(R()) * .8; return {a, r, s: .5 + R() * 1.3, l: R()}; }));
      const base = powderOf(m.items[0].item), lite = mix(base, '#ffffff', .35), dark = mix(base, '#000000', .3), heap = x.createRadialGradient(g.cx - g.r * .1, g.cy - g.r * .1, 0, g.cx, g.cy, g.r * .88);
      heap.addColorStop(0, rgba(base, .9 * m.p)); heap.addColorStop(.75, rgba(base, .7 * m.p)); heap.addColorStop(1, rgba(base, 0));
      x.fillStyle = heap; x.beginPath(); x.arc(g.cx, g.cy, g.r * .88, 0, 6.283); x.fill();
      const n = Math.floor(dust.length * m.p);
      for (let i = 0; i < n; i++){ const d = dust[i]; x.fillStyle = d.l > .5 ? rgba(lite, .8) : rgba(dark, .55); x.fillRect(g.cx + Math.cos(d.a) * d.r * g.r, g.cy + Math.sin(d.a) * d.r * g.r * .96, d.s, d.s); }
    }
    for (const it of m.items){
      const im = pic(DATA.jars[it.item].img), L = Math.min(5, Math.floor(m.p * 6)), keep = 1 - m.p;
      if (keep <= .02) continue;
      const R = rnd(it.seed), size = g.r * .78 * (1 - m.p * .55), parts = 1 << L;
      for (let q = 0; q < parts; q++){
        const ang = R() * 6.283, off = L ? g.r * .05 * L * R() : 0, sc = L ? .9 / Math.sqrt(parts) + .25 : 1;
        x.save(); x.globalAlpha = Math.min(1, keep * 1.4);
        x.translate(g.cx + it.x * g.r * (1 - m.p * .3) + Math.cos(ang) * off, g.cy + it.y * g.r * (1 - m.p * .3) + Math.sin(ang) * off);
        x.rotate(it.rot + q * 1.7); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 5; x.shadowOffsetY = 2;
        if (L){ x.beginPath(); const w = size * sc; x.rect(-w / 2 + (R() - .5) * w * .4, -w / 2 + (R() - .5) * w * .4, w * (.4 + R() * .3), w * (.4 + R() * .3)); x.clip(); }
        if (okImg(im)) fitIn(x, im, size); x.restore();
      }
    }
  }
  /* the handful carried back: only what was made, drawn alone on a clear sheet and cut to what is there —
     the pieces from the board as they lie, the powder as a small heap */
  function snap(which){
    const W = work.clientWidth, H = work.clientHeight, k = 2, big = document.createElement('canvas'); big.width = W * k; big.height = H * k;
    const x = big.getContext('2d'); x.scale(k, k);
    if (which === 'board') pile(x, W / 2, H / 2);
    else { const m = S.mortar;
      heap(x, W / 2, H / 2, Math.min(W, H) * (.16 + .03 * m.items.length) * Math.max(.35, m.p), powderOf(m.items[0].item));
    }
    /* the box of what is drawn (alpha), with a little air */
    const d = x.getImageData(0, 0, big.width, big.height).data; let x0 = big.width, y0 = big.height, x1 = 0, y1 = 0;
    for (let j = 0; j < big.height; j += 3) for (let i = 0; i < big.width; i += 3) if (d[(j * big.width + i) * 4 + 3] > 24){ if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    if (x1 <= x0){ x0 = 0; y0 = 0; x1 = big.width; y1 = big.height; }
    const pad = 6, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2, S2 = 220, sc = S2 / Math.max(w, h);
    const c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
    c.getContext('2d').drawImage(big, x0 - pad, y0 - pad, w, h, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }
  /* the cut pieces swept together into a little pile: each piece as it was cut, moved in and turned */
  function pile(x, cx, cy){
    const b = S.board, im = pic(DATA.jars[b.item].img), R = rnd(b.cuts * 13 + 5);
    const all = b.things.flatMap(t => { const G = geo(t); return t.pieces.map(pc => ({pc, G, pressed: t.pressed})); }), n = all.length, spread = .1 + Math.min(.12, n * .012);
    for (const {pc, G, pressed} of all.map(o => ({...o, k: R()})).sort((p, q) => p.k - q.k)){
      const c = pc.poly.reduce((m, q) => [m[0] + q[0] / pc.poly.length, m[1] + q[1] / pc.poly.length], [0, 0]);
      const a = R() * 6.283, d = Math.sqrt(R()) * spread, turn = (R() - .5) * 2.4, base = boardBase();
      x.save(); x.translate(cx, cy); x.scale(base, base); x.translate(Math.cos(a) * d, Math.sin(a) * d * .7); x.scale(G.s / base, G.s / base); if (pressed) x.scale(1.12, .74); x.rotate(turn); x.translate(-c[0], -c[1]);
      x.beginPath(); pc.poly.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.clip();
      x.rotate(G.rot); x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 6; x.shadowOffsetY = 2;
      if (okImg(im)) fitIn(x, im); x.restore();
    }
  }
  /* a small heap of powder: an uneven mound of fine grains, lighter on the side the candle is, with loose grains at its foot */
  function heap(x, cx, cy, r, hex = '#dcd0b2'){
    const R = rnd(91), base = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const blobs = Array.from({length: 7}, () => { const a = R() * 6.283, d = R() * r * .35; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d * .55, r * (.5 + R() * .3)]; });
    const inside = (px, py) => blobs.some(([bx, by, br]) => ((px - bx) / br) ** 2 + ((py - by) / (br * .62)) ** 2 < 1);
    x.save(); x.fillStyle = 'rgba(0,0,0,.35)'; x.filter = 'blur(' + Math.round(r * .12) + 'px)';
    x.beginPath(); x.ellipse(cx + r * .05, cy + r * .2, r * 1.05, r * .55, 0, 0, 6.283); x.fill(); x.restore();
    /* the body of the mound: the blobs filled, lit from the upper left */
    for (const [bx, by, br] of blobs){ const g = x.createRadialGradient(bx - br * .35, by - br * .45, 0, bx, by, br);
      g.addColorStop(0, mix(hex, '#ffffff', .4)); g.addColorStop(.7, hex); g.addColorStop(1, mix(hex, '#000000', .22));
      x.fillStyle = g; x.beginPath(); x.ellipse(bx, by, br, br * .62, 0, 0, 6.283); x.fill(); }
    for (let i = 0; i < 5200; i++){
      const px = cx + (R() * 2 - 1) * r * 1.15, py = cy + (R() * 2 - 1) * r * .8;
      if (!inside(px, py)){ if (R() > .02) continue; }
      /* height of the mound here: highest near the middle; light from the upper left */
      const h = Math.max(0, 1 - Math.hypot((px - cx) / r, (py - cy) / (r * .62))), lit = .78 + h * .25 - ((px - cx) + (py - cy)) / r * .14 + (R() - .5) * .22;
      const c = base.map(v => Math.max(0, Math.min(255, Math.round(v * lit))));
      x.fillStyle = 'rgb(' + c.join(',') + ')'; const q = .7 + R() * 1.1; x.fillRect(px, py - h * r * .18, q, q);
    }
  }


  /* ---------- opening */
  async function start(){
    fresh(); level = store.get().settings.level || 'mid';
    S.usedKey = !!pots.kept(P.n);   /* the key ingredient is already in a cauldron for this potion: not taken again */
    sec.dataset.view = 'pot'; sec.dataset.heat = 'off'; sec.classList.remove('off-fire');
    /* the cauldron stands on the trivet, the fire not yet lit: the board says when, and how high */
    S.onFire = true; S.heat = 'none'; sec.dataset.heat = 'none';
    end.hidden = true; say.classList.remove('on');
    drawBoard(); drawTray(); size();
  }
  /* where the key ingredient comes from (potions.source): Snape lends it once, for the first potion of one who has no
     shop yet; after that it is bought at Slug & Jiggers — brewing again for a better result needs one's own. It is
     used up when it goes into the cauldron. A potion already made opens as "again". */
  function intro(again){
    const src = pots.source(P), made = !!pots.best(P.n);
    /* from the second year on, one who has no shop to go to yet hears the potion's "lend" words — Snape will not lend
       again, and does not send them to a shop they cannot reach — and leaves */
    const noShop = src === 'none' && P.n > 1 && !shops.isOpen() && P.intro.lend;
    const k = src === 'own' ? 'own' : src === 'lend' || noShop ? 'lend' : again || made ? 'again' : 'none', t = P.intro[k] || P.intro.none;
    S.source = src;
    end.innerHTML = `<div class="po-end-in po-intro"><div class="paperbox parch"></div><p class="t" lang="en">${esc(bond.fill(t.en))}</p><p class="k">${esc(bond.fill(t.ko))}</p>` +
      `<div class="po-end-btns">${src === 'none' ? `<button type="button" data-leave>나간다</button>` : `<button type="button" data-go>솥 앞에 선다</button>`}</div></div>`;
    end.hidden = false;
  }

  const NICHE = [[.221, .456], [.404, .456], [.589, .456], [.774, .456], [.26, .856], [.493, .856], [.733, .856]];   // centre, floor (fractions of cabinet.webp)
  /* a phial taken down from the cabinet, held up close enough to read its tag (2026-10-15, user chose this: the tags are
     too small to read on the shelf); brewing it again for a better result goes from here */
  const labelOf = (q, r) => ((q.result[r] || {}).label || (r === 'perfect' ? 'Correct' : 'Usable')).replace(/\.$/, '');
  function closeUp(q){
    const r = pots.best(q.n), old = end.querySelector('.po-close'); if (old) old.remove();
    const box = document.createElement('div'); box.className = 'po-close';
    box.innerHTML = `<figure class="po-close-ph">${pots.phial(q.vial, q.en, pots.brewer(), r === 'fair')}</figure>` +
      `<p class="t" lang="en">${esc(q.en)}</p><p class="k">${esc(q.ko)} · <span lang="en">${esc(labelOf(q, r))}</span></p>` +
      `<div class="po-end-btns">${r !== 'perfect' ? `<button type="button" data-brew="${q.n}">다시 끓인다</button>` : ''}<button type="button" data-close-up>약장에 도로 놓는다</button></div>`;
    end.querySelector('.po-cab').appendChild(box); end.scrollTop = 0;   /* at the top of the card, where the close-up begins */
  }
  function cabinet(placed){
    const list = DATA.potions.map(q => ({q, r: pots.best(q.n)}));
    end.innerHTML = `<div class="po-end-in po-cab"><div class="paperbox parch"></div><p class="t" lang="en">The Potion Cabinet</p>` +
      `<figure class="po-cabinet"><img src="${IMG('cabinet')}" alt="">` +
      list.map(({q, r}, i) => r ? `<button type="button" class="po-in${q.n === placed ? ' new' : ''}" data-vial="${q.n}" style="left:${(NICHE[i][0] - .055) * 100}%;bottom:${(1 - NICHE[i][1]) * 100}%" aria-label="${esc(q.en)}">${pots.phial(q.vial, q.en, pots.brewer(), r === 'fair')}</button>` : '').join('') +
      `</figure><ul class="po-cab-list">${list.map(({q, r}) => `<li class="${r ? 'has' : ''}"><b lang="en">${esc(q.en)}</b><span>${r ? `<span lang="en">${esc(labelOf(q, r))}</span>` : pots.isOpen(q.n) ? '편지가 왔다 · 아직 끓이지 않았다' : q.n + '학년 대사를 다 배우면'}</span></li>`).join('')}</ul>` +
      `<div class="po-end-btns"><button type="button" data-leave>나간다</button></div></div>`;
    end.hidden = false; end.scrollTop = 0;
  }

  /* for testing on this PC (?practice): the state of the attempt */
  if (/[?&]practice/.test(location.search)) window.__potion = () => S;
  $('#poBack').addEventListener('click', () => history.length > 1 ? history.back() : (location.hash = '#/'));
  fitPaper($('#poBoardPaper'));
  addEventListener('resize', () => { if (!sec.hidden) size(); });

  return {
    async show(params){
      const d = await load(); await pots.load();
      if (params.id === 'shelf'){ P = d.potions[0]; $('#poTtl').textContent = 'The Potion Cabinet'; fresh(); sec.dataset.view = 'pot'; cabinet(0); return; }
      const n = +(params.id || 1);
      P = d.potions.find(p => p.n === n) || d.potions[0];
      $('#poTtl').textContent = P.en;
      [IMG('cauldron'), IMG('trivet'), IMG('board'), IMG('mortar'), IMG('knife'), IMG('pestle'), IMG('rod'), P.vial, ...P.jars.map(j => d.jars[j].img)].forEach(pic);
      /* a lesson whose letter has not come (an address typed by hand) */
      if (!pots.isOpen(n) && !/[?&](practice|potion=)/.test(location.search)){ await start(); S.paused = true;
        end.innerHTML = `<div class="po-end-in po-intro"><div class="paperbox parch"></div><p class="t" lang="en">You were not sent for.</p><p class="k">부른 적 없다.</p><div class="po-end-btns"><button type="button" data-leave>나간다</button></div></div>`;
        end.hidden = false; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); return; }
      const left = pots.stewLeft(n);
      if (pots.stewOf(n) && left){ await start(); S.paused = true;
        end.innerHTML = `<div class="po-end-in po-intro"><div class="paperbox parch"></div><p class="t" lang="en">Not yet. It needs ${left === 1 ? 'one more day' : left + ' more days'}.</p><p class="k">아직이다. ${['', '하루', '이틀', '사흘'][left] || left + '일'} 더 둬야 한다.</p><div class="po-end-btns"><button type="button" data-leave>나간다</button></div></div>`;
        end.hidden = false; }
      else if (pots.stewOf(n)){ resume();
        /* the key ingredient still to go in, and none in the bag: buy it first */
        if (!S.usedKey && P.do.slice(S.i).some(a => a.add === P.buy) && pots.source(P) !== 'own') intro(); else { S.source = S.usedKey ? S.source : 'own'; back(); } }
      else { await start(); intro(); }
      cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    },
    /* leaving: nothing of the attempt keeps running — a stir still being counted, a dropper standing over the cauldron */
    hide(){ cancelAnimationFrame(raf); raf = 0; unpark(false); if (S){ clearTimeout(S.stirT); S.pend = null; S.dpend = null; } tallyEl.classList.remove('on'); },
    resize(){ size(); }
  };
}
