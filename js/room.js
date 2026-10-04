/* The classroom: parchment note (scene and the line before), the parchment board, and the bottom bar.
   Each card is shown at its rung of the study ladder: learn, fill the blank, arrange, or recall (see srs.js).
   About a third of reviews practise one of the line's expressions in a new example sentence instead.
   Recall is not "reproduce the whole line from nothing" (that is script memorising): each card gets one of four
   lighter tasks — first letters, dictation, the key expression only, or pick the line for the Korean meaning.
   Typed (or, if wanted, spoken: Web Speech, en-GB) answers are graded by the app. Side rounds made of the same four
   tasks: #/room/<deck>/extra (ten learned lines at random, after the day's lesson) and #/room/<deck>/wrong (the lines
   missed most often). */
import {shelf, tray} from './art.js';
import {cauldron, bell, eraser} from './art-plus.js';
import {byId, SPEAKERS, voiceOf} from './decks.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as store from './store.js';
import * as speech from './speech.js';
import {$, $$, esc, wait, toast, fitPaper, paintWall, openSheet, isSheetOpen, closeSheet, reduced} from './ui.js';
import {bakeLive, texturize} from './bake.js';
import {hint} from './hints.js';

/* Room art: every deck has a painted room, assets/rooms/<id>-portrait.webp (phones) and -wide.webp (wide screens).
   The drawn stone wall below is only the fallback while a painting is missing. */
const ROOMS = {snape: {wallSeed: 31, wallBase: '#1F2823', light: '#3FA66B'}};
const roomOf = id => ({...(ROOMS[id] || {wallSeed: 31, wallBase: '#1F2823', light: (byId(id) || {}).glow || '#3FA66B'}),
  photo: {portrait: `assets/rooms/${id}-portrait.webp`, wide: `assets/rooms/${id}-wide.webp`}});
const ROUND = {extra: '더 도전', wrong: '틀린 대사', req: '교수의 부탁'};

/* ---------- where each expression sits in the line (for the yellow underline).
   Expressions are written as patterns ("..., is it?", "kindly + 명령문", "Potter (성만으로 호칭)"); the literal
   English pieces are looked up in the line. Pieces that are not in the line are simply not underlined. */
const HOLES = /\.\.\.|…|~|\+|\/|\b(?:one's|oneself|someone|somebody|something|sb|sth|X's|X|A|B)\b/g;
function pieces(expr){
  return expr.replace(/\([^)]*\)/g, ' ... ').split(HOLES)
    .map(p => p.replace(/[^\x00-\x7F’‘]+/g, ' ').replace(/^[\s,.;:!?'"’‘-]+|[\s,.;:!?'"’‘-]+$/g, '').replace(/\s+/g, ' '))
    .filter(p => /[A-Za-z]{2,}/.test(p));
}
function findRanges(line, bre){
  const out = [], low = line.toLowerCase();
  const tryFind = p => {
    const words = p.split(' ');
    for (let drop = 0; drop < Math.max(1, words.length - 1); drop++){
      const q = words.slice(drop).join(' ');
      const re = new RegExp('(^|[^A-Za-z])(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['’]").replace(/\\\./g, '\\.?').replace(/e$/, 'e?') + (words.length - drop === 1 ? '[A-Za-z]*' : '') + ')(?![A-Za-z])', 'i');
      const m = re.exec(low);
      if (m){ const a = m.index + m[1].length; return [a, a + m[2].length]; }
      if (words.length - drop <= 2) break;
    }
    return null;
  };
  for (const b of bre) for (const p of pieces(b.expr)){ const r = tryFind(p); if (r) out.push(r); }
  return out;
}
export {findRanges};

/* words of `a` that do not appear in `b` (case and punctuation ignored): what makes the professor's line his */
const norm = w => w.toLowerCase().replace(/[^a-z']/g, '').replace(/’/g, "'");
function diffRanges(a, b){
  const seen = new Set(b.split(/\s+/).map(norm).filter(Boolean)), out = [];
  for (const m of a.matchAll(/\S+/g)){
    const w = norm(m[0]); if (!w || seen.has(w)) continue;
    const core = m[0].match(/[A-Za-z’'][A-Za-z’'-]*/);
    if (core) out.push([m.index + core.index, m.index + core.index + core[0].length]);
  }
  return out;
}
const shuffle = (arr, seed) => { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) | 0; const R = () => ((s = (s * 1103515245 + 12345) | 0) >>> 0) / 4294967296; const a = arr.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/* the line in tiles: single words for short lines, two or three words for long ones, never across punctuation */
function chunks(line){
  const words = line.trim().split(/\s+/), size = words.length <= 8 ? 1 : words.length <= 16 ? 2 : 3, out = [];
  let cur = [];
  words.forEach(w => { cur.push(w); if (cur.length >= size || /[,.;:!?]$|--$|—$/.test(w)){ out.push(cur.join(' ')); cur = []; } });
  if (cur.length) out.push(cur.join(' '));
  return out;
}

const STAGE_LABEL = {learn: '새 대사 · 배우기', cloze: '복습 · 빈칸', arrange: '복습 · 배열', example: '복습 · 예문'};
/* the line under the card only where the card itself does not already say what to do (cloze, arrange, pick have their own label) */
const HINT = {recall: '쓰거나 말하면 앱이 채점합니다'};
/* the four recall tasks */
const KIND = {
  hint: {label: '첫 글자', ask: '첫 글자를 보고 대사를 완성하세요'},
  dict: {label: '받아쓰기', ask: '듣고 그대로 쓰세요. 영국식 철자로.'},
  expr: {label: '표현 쓰기', ask: '빈칸의 표현을 쓰세요'},
  pick: {label: '대사 고르기', ask: ''}
};
/* each word shows its first letter; the rest are blanks of the same length (apostrophes and hyphens stay) */
function skeleton(line){
  return esc(line).replace(/[A-Za-z]+/g, (w, at, s) => {
    const start = at === 0 || !/[A-Za-z'’]/.test(s[at - 1]);
    const head = start ? w[0] : '', rest = w.slice(start ? 1 : 0);
    return head + (rest ? `<i>${'_'.repeat(rest.length)}</i>` : '');
  });
}
/* the expression's words in the line, as whole-word ranges, merged */
function exprRanges(line, bre){
  const rs = findRanges(line, bre).map(([a, b]) => {
    while (a > 0 && /[A-Za-z'’]/.test(line[a - 1])) a--;
    while (b < line.length && /[A-Za-z'’]/.test(line[b])) b++;
    return [a, b];
  }).sort((x, y) => x[0] - y[0]);
  const out = [];
  rs.forEach(([a, b]) => { const L = out[out.length - 1]; if (L && a <= L[1] + 1) L[1] = Math.max(L[1], b); else out.push([a, b]); });
  return out;
}

/* ---------- checking a spoken or typed line: words in order (longest common run of words), case and punctuation ignored.
   Contractions are not expanded on purpose: "That is" and "That's" are exactly the difference being learnt. */
const toks = s => [...s.matchAll(/[A-Za-z0-9’']+/g)].map(m => ({w: m[0].toLowerCase().replace(/’/g, "'"), a: m.index, b: m.index + m[0].length}));
function compare(said, line){
  const A = toks(said).map(t => t.w), B = toks(line), n = A.length, m = B.length;
  if (!m) return {ratio: 1, miss: [], words: 0};
  const dp = Array.from({length: n + 1}, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j].w ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(m).fill(false);
  for (let i = 0, j = 0; i < n && j < m;){ if (A[i] === B[j].w){ hit[j] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
  return {ratio: dp[0][0] / m, miss: B.filter((t, k) => !hit[k]).map(t => [t.a, t.b]), words: m, hit};
}
const hash = s => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function initRoom(app){
  const room = $('#room'), slate = $('#slate'), note = $('#note'), scroll = $('#roomScroll');
  const lineEl = $('#sLine'), bellBtn = $('#bell'), nextBtn = $('#nextBtn');
  let deck = null, cards = [], map = {}, practice = {}, examples = {}, day = null, card = null, mode = 'recall', stage = 'recall', answered = false, done = false, busy = false, writeAnim = null;
  let extra = '', quiz = null, missRanges = [], rec = null, kind = '', target = null;
  const sess = () => extra ? day[extra] : day;
  /* grading goes to the ladder, or — in a side round — only misses touch the schedule */
  const gradeAny = (g, st) => extra ? srs.gradeRound(deck.id, card.id, g, extra) : srs.grade(deck.id, card.id, g, st, card.minimal);
  let placed = [], tiles = [];

  $('#shelf').innerHTML = shelf();
  $('#tray').innerHTML = tray();
  $('#cauldron').innerHTML = cauldron();
  $('#bellSvg').innerHTML = bell();
  $('#eraser').innerHTML = eraser();
  fitPaper(note, 14, {bottom: true, fold: true, pin: true, id: 'note'});
  /* the board is a large sheet of parchment: ink on paper reads far better than chalk */
  fitPaper(slate, 33, {top: true, pin: true, id: 'slate'});
  $$('#gradeBar [data-grade]').forEach(b => texturize(b, 'grit', .5, .7));
  texturize(nextBtn, 'grit', .5, .7);
  /* shelf and cauldron: still parts baked with candle and fire light; bubbles, flames and steam stay live */
  function bakeProps(){
    if (room.classList.contains('has-photo')) return;
    bakeLive($('#shelfWrap'), {lights: [[48, 62, 230, '#F2B24C'], [106, 96, 60, '#3FA66B'], [200, 100, 50, '#7B5AA6']], ambient: '#6f6f6f', grit: .4}).catch(() => {});
    bakeLive($('#cauldronWrap'), {lights: [[150, 212, 190, '#F2A23C'], [150, 98, 130, '#3FA66B']], ambient: '#666666', grit: .5}).catch(() => {});
  }

  /* green spores drifting up through the dungeon air */
  const motes = $('#roomMotes');
  motes.innerHTML = Array.from({length: 16}, (_, i) => {
    const x = (i * 61 % 100), y = 30 + (i * 37 % 70), dl = (i * 1.3) % 9, du = 8 + (i % 5) * 1.6, dx = ((i % 7) - 3) * 9;
    return `<i style="left:${x}%;top:${y}%;animation-delay:-${dl.toFixed(1)}s;animation-duration:${du.toFixed(1)}s;--dx:${dx}px"></i>`;
  }).join('');

  function wall(){
    const R = roomOf(deck.id);
    room.style.setProperty('--glow', deck.glow);
    /* a painted classroom when there is one; otherwise the drawn stone wall, shelf and cauldron */
    room.classList.toggle('has-photo', !!R.photo);
    if (R.photo){
      const ph = $('#roomPhoto');
      /* absolute addresses: a relative url() inside a custom property would resolve against css/, not the page */
      ph.style.setProperty('--p', `url("${new URL(R.photo.portrait, location.href).href}")`);
      ph.style.setProperty('--w', `url("${new URL(R.photo.wide, location.href).href}")`);
      return;
    }
    paintWall($('#roomWall'), R.wallSeed, R.wallBase,
      `<radialGradient id="rw1" cx=".14" cy=".1" r=".6"><stop offset="0" stop-color="#F2B24C" stop-opacity=".22"/><stop offset="1" stop-color="#F2B24C" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="rw2" cx=".5" cy=".12" r=".5"><stop offset="0" stop-color="${R.light}" stop-opacity=".16"/><stop offset="1" stop-color="${R.light}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="rw3" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>` +
      `<radialGradient id="rw4" cx=".2" cy=".85" r=".45"><stop offset="0" stop-color="${R.light}" stop-opacity=".12"/><stop offset="1" stop-color="${R.light}" stop-opacity="0"/></radialGradient>` +
      `<rect width="100%" height="100%" fill="url(#rw1)"/><rect width="100%" height="100%" fill="url(#rw2)"/><rect class="glow" width="100%" height="100%" fill="url(#rw4)"/><rect width="100%" height="100%" fill="url(#rw3)"/>`);
  }

  /* about a third of reviews practise one of the line's expressions in a fresh example sentence instead */
  function exampleFor(c){
    if (extra || !c.bre.length) return null;
    const keys = c.bre.map((b, k) => `${c.id}#${k}`).filter(k => examples[k] && examples[k].items && examples[k].items.length);
    if (!keys.length) return null;
    const h = hash(srs.today() + c.id);
    if (h % 3) return null;
    const key = keys[(h >> 2) % keys.length], items = examples[key].items, it = items[(h >> 5) % items.length];
    return {...it, expr: examples[key].expr};
  }

  /* which recall task this card gets today: varied by day and card, limited to what the card allows */
  function kindFor(c){
    const ks = ['hint', 'pick'];
    if (speech.gbVoices().length) ks.push('dict');
    if (exprRanges(c.line, c.bre).length) ks.push('expr');
    /* high bits of a differently-built key: the low bits of hash(today + id) already decide the example swap */
    return ks[(hash((extra ? 'x' : 'r') + c.id + '|' + srs.today()) >>> 7) % ks.length];
  }
  /* three other lines from the deck, close in length, as the wrong choices */
  function pickOptions(c){
    const len = c.line.length;
    const pool = cards.filter(x => x.card !== false && x.id !== c.id && x.line !== c.line && x.speech !== c.speech)
      .sort((a, b) => Math.abs(a.line.length - len) - Math.abs(b.line.length - len)).slice(0, 12);
    return shuffle(pool, srs.today() + c.id).slice(0, 3).map(x => x.line);
  }

  /* ---------- one card, in the mode its stage calls for */
  function render(){
    const S = sess();
    card = map[S.queue[S.pos]];
    stage = extra ? 'recall' : srs.stageOf(deck.id, card, practice);
    mode = stage; quiz = null; missRanges = []; kind = ''; target = null;
    if (stage === 'cloze') quiz = {...practice[card.id], text: card.line};
    if (stage === 'recall'){
      kind = kindFor(card);
      if (kind === 'pick'){ mode = 'pick'; quiz = {blank: card.line, options: pickOptions(card), text: card.ko}; }
    }
    if (!extra && stage !== 'learn'){ const ex = exampleFor(card); if (ex){ mode = 'example'; kind = ''; quiz = {blank: ex.blank, options: ex.options, text: ex.en, ko: ex.ko, expr: ex.expr}; } }
    answered = false; done = false;
    room.dataset.mode = mode;
    room.dataset.kind = kind;
    room.classList.remove('answered', 'done');
    slate.classList.remove('back', 'writing', 'wiping', 'noline');
    if (writeAnim){ writeAnim.cancel(); writeAnim = null; }
    $('#rCount').textContent = extra ? `${ROUND[extra]} ${S.pos + 1} / ${S.queue.length}` : `${S.pos + 1} / ${S.queue.length}`;
    $('#sStage').textContent = kind ? `${extra ? ROUND[extra] : '복습'} · ${KIND[kind].label}` : STAGE_LABEL[mode];
    $('#hint').textContent = HINT[mode] || '';

    $('#noteFilm').textContent = `${card.film}편 · ${card.film_ko}`;
    $('#noteFan').hidden = card.source !== 'fan_script';
    $('#noteScene').textContent = card.scene_ko;
    const cue = $('#noteCue');
    if (card.prev_line){ cue.hidden = false; $('#noteCueWho').textContent = `이어서 (${card.part} / ${card.of})`; $('#noteCueText').textContent = card.prev_line; }
    else if (card.cue){ cue.hidden = false; $('#noteCueWho').textContent = SPEAKERS[card.cue_speaker] || card.cue_speaker; $('#noteCueText').textContent = card.cue; }
    else cue.hidden = true;

    /* the plain American line; on the learn page the words the professor drops are greyed */
    const gone = mode === 'learn' ? diffRanges(card.plain, card.line) : [];
    $('#sPlain').innerHTML = paint(card.plain, gone.map(r => [...r, 'gone']));
    const kf = $('#sKoFront');
    kf.hidden = !(store.get().settings.koFront && (mode === 'recall' || mode === 'arrange'));
    kf.textContent = card.ko;
    lineEl.innerHTML = ''; $('#sKo').textContent = ''; $('#sBre').innerHTML = '';
    $('#sParts').hidden = true;
    $('#czWhy').textContent = ''; $('#czKo').hidden = true; $('#verdict').hidden = true;
    resetRecall();
    scroll.scrollTop = 0;

    if (mode === 'learn'){ showAnswer(true); finish(); }
    else if (mode === 'cloze' || mode === 'example' || mode === 'pick') setupQuiz();
    else if (mode === 'recall') setupRecall();
    else if (mode === 'arrange') setupArrange();
  }
  /* text with marked character ranges wrapped in spans */
  function paint(text, ranges){
    const cls = new Array(text.length).fill('');
    ranges.forEach(([a, b, c]) => { for (let i = a; i < b; i++) cls[i] = c; });
    let html = '', i = 0;
    while (i < text.length){ let j = i; while (j < text.length && cls[j] === cls[i]) j++; const s = esc(text.slice(i, j)); html += cls[i] ? `<span class="${cls[i]}">${s}</span>` : s; i = j; }
    return html;
  }

  /* ---------- chalk: the line is set word by word, measured, regrouped into its real lines, then written line by line.
     flags per character: 1 = key expression (yellow underline), 2 = differs from the plain line (bright chalk) */
  function writeLine(text, ranges, animate, diff = [], miss = []){
    const mark = new Uint8Array(text.length);
    ranges.forEach(([a, b]) => { for (let i = a; i < b; i++) mark[i] |= 1; });
    diff.forEach(([a, b]) => { for (let i = a; i < b; i++) mark[i] |= 2; });
    miss.forEach(([a, b]) => { for (let i = a; i < b; i++) mark[i] |= 4; });
    for (let i = 1; i < text.length; i++) if (/\s/.test(text[i]) && (mark[i - 1] & 1)){ let j = i; while (j < text.length && /\s/.test(text[j])) j++; if (j < text.length && (mark[j] & 1)) for (let k = i; k < j; k++) mark[k] |= 1; }
    const toks = [...text.matchAll(/\S+\s*/g)].map(m => ({s: m.index, t: m[0]}));
    lineEl.innerHTML = toks.map(t => `<span class="tk">${esc(t.t)}</span>`).join('');
    const groups = [];
    let top = null;
    [...lineEl.children].forEach((sp, k) => { const y = sp.offsetTop; if (top === null || Math.abs(y - top) > 4){ groups.push([]); top = y; } groups[groups.length - 1].push(k); });
    let acc = 0;
    const lines = groups.map(g => {
      const a = toks[g[0]].s, last = toks[g[g.length - 1]], b = last.s + last.t.trimEnd().length;
      const n = b - a, t = Math.min(1.7, Math.max(.5, n * .045)), L = {a, b, n, t, d: acc, steps: Math.max(6, Math.round(n / 1.4))};
      acc += t + .12;
      return L;
    });
    const wrap = (v, s) => { if (v & 4) s = `<i class="miss">${s}</i>`; if (v & 2) s = `<b class="df">${s}</b>`; if (v & 1) s = `<u>${s}</u>`; return s; };
    lineEl.innerHTML = lines.map(L => {
      let html = '', i = L.a;
      while (i < L.b){ let j = i; while (j < L.b && mark[j] === mark[i]) j++; html += wrap(mark[i], esc(text.slice(i, j))); i = j; }
      return `<span class="w" style="--d:${L.d.toFixed(2)}s;--t:${L.t.toFixed(2)}s;--n:${L.steps};--ud:${(L.d + L.t).toFixed(2)}s">${html}</span>`;
    }).join('<br>');
    slate.style.setProperty('--after', acc.toFixed(2) + 's');
    if (!animate) return;

    /* a stick of chalk travels along each line; dust falls from it */
    const ws = $$('.w', lineEl), stick = document.createElement('i');
    stick.className = 'stick';
    lineEl.appendChild(stick);
    const total = acc, frames = [];
    lines.forEach((L, k) => {
      const w = ws[k], y = w.offsetTop + w.offsetHeight * .66, x0 = w.offsetLeft, x1 = x0 + w.offsetWidth;
      frames.push({offset: L.d / total, transform: `translate(${x0}px, ${y}px) rotate(-34deg)`, opacity: 1, easing: `steps(${L.steps}, end)`});
      frames.push({offset: (L.d + L.t) / total, transform: `translate(${x1}px, ${y}px) rotate(-28deg)`, opacity: 1, easing: 'ease-in-out'});
      [.2, .5, .8].forEach((f, q) => {
        const dot = document.createElement('i');
        dot.className = 'dust';
        dot.style.cssText = `left:${(x0 + f * (x1 - x0)).toFixed(0)}px;top:${(y + 4).toFixed(0)}px;animation-delay:${(L.d + f * L.t).toFixed(2)}s;animation-duration:${(1.2 + q * .3).toFixed(1)}s`;
        lineEl.appendChild(dot);
      });
    });
    if (frames[0].offset > 0) frames.unshift({...frames[0], offset: 0, opacity: 0});
    const end = frames[frames.length - 1];
    frames.push({offset: 1, transform: end.transform.replace(/translate\(([-\d.]+)px/, (m, x) => `translate(${+x + 30}px`), opacity: 0});
    writeAnim = stick.animate(frames, {duration: total * 1000 + 350, fill: 'both'});
  }

  /* the answer side: line (chalk), meaning, expressions, whole speech */
  function showAnswer(writeIt){
    slate.classList.add('back');
    $('#sLineLab').textContent = mode === 'learn' ? `${deck.ko}는 이렇게 말한다` : (mode === 'recall' || mode === 'pick') ? '실제 대사' : '';
    $('#sKo').textContent = card.ko;
    $('#sBre').innerHTML = card.bre.map((b, i) => `<button type="button" data-bre="${i}"><b>${esc(b.expr)}</b><span class="k">${esc(b.kind)}</span><span class="go" aria-hidden="true">›</span></button>`).join('');
    const parts = $('#sParts');
    parts.hidden = !(card.of > 1);
    parts.textContent = `발화 전체 보기 (${card.part} / ${card.of})`;
    const anim = !reduced();
    if (writeIt) writeLine(card.line, findRanges(card.line, card.bre), anim, mode === 'learn' ? diffRanges(card.line, card.plain) : [], missRanges);
    else { slate.classList.add('noline'); slate.style.setProperty('--after', '0s'); }
    if (anim){ slate.classList.remove('writing'); void slate.offsetWidth; slate.classList.add('writing'); }
    if (store.get().settings.autoRead) say();
  }
  function finish(){
    done = true;
    nextBtn.innerHTML = '<span lang="en">Next</span><i aria-hidden="true">→</i>';
    room.classList.add('done');
  }

  /* ---------- recall: first letters, dictation or the expression only. Typed by default; speaking is optional */
  function resetRecall(){
    if (rec){ try { rec.abort(); } catch (e){} rec = null; }
    $('#heard').hidden = true; $('#heard').textContent = '';
    $('#typedIn').value = '';
    $('#micBtn').hidden = !SR; $('#micBtn').classList.remove('on');
    $('#askCue').hidden = true; $('#askKo').hidden = true; $('#askPlay').hidden = true;
  }
  function setupRecall(){
    $('#sAsk').textContent = KIND[kind].ask;
    const cue = $('#askCue'), ti = $('#typedIn');
    ti.rows = 3; ti.placeholder = '대사를 영어로 입력하세요';
    if (kind === 'hint'){ cue.hidden = false; cue.className = 'cue skel'; cue.innerHTML = skeleton(card.line); target = card.line; }
    else if (kind === 'dict'){ $('#askPlay').hidden = false; target = card.line; }
    else if (kind === 'expr'){
      const rs = exprRanges(card.line, card.bre);
      let html = '', at = 0;
      rs.forEach(([a, b]) => { html += esc(card.line.slice(at, a)) + `<span class="blank">${'\u00a0'.repeat(Math.max(5, Math.round((b - a) * 1.1)))}</span>`; at = b; });
      cue.hidden = false; cue.className = 'cue gaps'; cue.innerHTML = html + esc(card.line.slice(at));
      $('#askKo').hidden = false; $('#askKo').textContent = card.ko;
      target = {ranges: rs, text: rs.map(([a, b]) => card.line.slice(a, b)).join(' ')};
      ti.rows = 1; ti.placeholder = rs.length > 1 ? `빈칸 ${rs.length}개, 순서대로` : '빈칸에 들어갈 말';
    }
  }
  function typeMode(){ $('#typedIn').focus({preventScroll: true}); }
  function play(slow){ say(slow ? .62 : .92); }
  function listen(){
    if (mode !== 'recall' || answered || busy) return;
    if (!SR){ typeMode(); return; }
    if (rec){ rec.stop(); return; }
    let text = '';
    const h = $('#heard');
    rec = new SR();
    rec.lang = 'en-GB'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    h.hidden = false; h.textContent = '듣고 있습니다… 다 말하면 잠시 기다리세요';
    $('#micBtn').classList.add('on');
    rec.onresult = e => { text = [...e.results].map(x => x[0].transcript).join(' ').trim(); if (text) h.textContent = '“' + text + '”'; };
    rec.onerror = e => {
      if (['not-allowed', 'service-not-allowed', 'network', 'audio-capture'].includes(e.error)){
        toast(e.error === 'network' ? '음성 인식은 인터넷이 필요합니다. 입력으로 답하세요.' : '마이크를 쓸 수 없습니다. 입력으로 답하세요.');
        typeMode();
      }
    };
    rec.onend = () => {
      $('#micBtn').classList.remove('on'); rec = null;
      if (text) checkRecall(text);
      else h.textContent = '들리지 않았습니다. 다시 눌러 말하거나 입력하세요.';
    };
    try { rec.start(); } catch (e){ rec = null; typeMode(); }
  }
  function checkRecall(said){
    if (mode !== 'recall' || answered || busy) return;
    resetRecall();
    answered = true;
    room.classList.add('answered');
    /* the expression task checks only the missing words; the others check the whole line */
    const exprTask = kind === 'expr';
    const c = compare(said, exprTask ? target.text : card.line);
    const g = !said ? 'again' : c.words <= 2 ? (c.ratio === 1 ? 'good' : 'again') : c.ratio >= .9 ? 'good' : c.ratio >= .6 ? 'hard' : 'again';
    gradeAny(g, 'recall');
    const v = $('#verdict');
    v.hidden = false; v.className = 'verdict ' + g;
    v.innerHTML = react(g, said ? `${{good: '맞음', hard: '비슷', again: '틀림'}[g]} · ${Math.round(c.ratio * 100)}%` : '정답 보기') +
      (said ? `<div class="said" lang="en">${esc(said)}</div>` : '');
    if (!said) missRanges = [];
    else if (exprTask){
      /* map the missed words of the typed expression back onto the line */
      const inGap = toks(card.line).filter(t => target.ranges.some(([a, b]) => t.a >= a && t.b <= b));
      missRanges = inGap.filter((t, k) => !c.hit[k]).map(t => [t.a, t.b]);
    }
    else missRanges = c.miss;
    showAnswer(true);
    finish();
    const ans = $('.ans', slate), r = ans.getBoundingClientRect();
    if (r.top > innerHeight * .55) scroll.scrollBy({top: r.top - innerHeight * .25, behavior: reduced() ? 'auto' : 'smooth'});
  }

  /* ---------- the professor's reaction to an answer, in their own voice; the plain result stays as a small tag */
  function react(g, tag){
    const list = voiceOf(deck.id).react[g], l = list[hash(card.id + srs.today() + g) % list.length];
    return `<div class="react ${g}"><span class="tag">${esc(tag)}</span><p class="q" lang="en">“${esc(l.en)}”</p><p class="k">${esc(l.ko)}</p></div>`;
  }

  /* ---------- fill the blank: in the line itself, or in a new example sentence for one of its expressions */
  function setupQuiz(){
    const at = quiz.text.indexOf(quiz.blank);
    const pad = '\u00a0'.repeat(Math.max(6, Math.round(quiz.blank.length * 1.3)));
    $('#czLab').textContent = mode === 'pick' ? '이 뜻의 대사는?' : mode === 'example' ? '예문 · 빈칸에 알맞은 표현은?' : '빈칸에 들어갈 말은?';
    if (mode === 'pick') $('#czLine').textContent = quiz.text;
    else $('#czLine').innerHTML = esc(quiz.text.slice(0, at)) + `<span class="blank" id="czBlank">${pad}</span>` + esc(quiz.text.slice(at + quiz.blank.length));
    $('#czLine').lang = mode === 'pick' ? 'ko' : 'en';
    $('#czOpts').innerHTML = shuffle([quiz.blank, ...quiz.options], card.id + mode).map((o, k) => `<button type="button" data-opt="${esc(o)}"><i>${k + 1}</i>${esc(o)}</button>`).join('');
  }
  function choose(opt){
    if (!(mode === 'cloze' || mode === 'example' || mode === 'pick') || answered || busy) return;
    answered = true;
    const ok = opt === quiz.blank;
    $$('#czOpts button').forEach(b => { b.disabled = true; if (b.dataset.opt === quiz.blank) b.classList.add('right'); else if (b.dataset.opt === opt) b.classList.add('wrong'); });
    gradeAny(ok ? 'good' : 'again', stage);
    const r = react(ok ? 'good' : 'again', ok ? '맞음' : '틀림');
    if (mode === 'pick'){
      $('#czWhy').innerHTML = r;
      room.classList.add('answered');
      showAnswer(true);
      finish();
      return;
    }
    const blank = $('#czBlank'); blank.textContent = quiz.blank; blank.classList.add(ok ? 'right' : 'wrong', 'filled');
    if (mode === 'example'){
      $('#czKo').hidden = false; $('#czKo').textContent = quiz.ko;
      $('#czWhy').innerHTML = r + `<p>표현 <em lang="en">${esc(quiz.expr)}</em> — 이 대사에서 배운 것: <span class="src" lang="en">${esc(card.line)}</span></p>`;
    } else {
      $('#czWhy').innerHTML = r + (quiz.why ? `<p>${esc(quiz.why)}</p>` : '');
      showAnswer(false);
    }
    finish();
  }

  /* ---------- arrange the tiles */
  function setupArrange(){
    tiles = chunks(card.line);
    let order = shuffle(tiles.map((t, i) => i), card.id + 'a');
    if (order.every((v, i) => v === i)) order = order.reverse();
    placed = [];
    $('#arrPool').innerHTML = order.map(i => `<button type="button" data-t="${i}">${esc(tiles[i])}</button>`).join('');
    drawPlaced();
  }
  function drawPlaced(){
    $('#arrLine').innerHTML = placed.length ? placed.map((i, k) => `<button type="button" data-p="${k}">${esc(tiles[i])}</button>`).join('') : '<span class="ph">여기에 쌓입니다</span>';
  }
  function pick(i){
    if (mode !== 'arrange' || answered || busy) return;
    placed.push(i);
    $(`#arrPool [data-t="${i}"]`).hidden = true;
    drawPlaced();
    if (placed.length === tiles.length) checkArrange(false);
  }
  function unpick(k){
    if (mode !== 'arrange' || answered || busy) return;
    const i = placed.splice(k, 1)[0];
    $(`#arrPool [data-t="${i}"]`).hidden = false;
    drawPlaced();
  }
  function checkArrange(gaveUp){
    answered = true;
    const ok = !gaveUp && placed.map(i => tiles[i]).join(' ') === tiles.join(' ');
    $('#arrLine').innerHTML = tiles.map((t, k) => `<span class="${!gaveUp && placed[k] !== undefined && tiles[placed[k]] === t ? 'right' : 'fix'}">${esc(t)}</span>`).join(' ');
    $('#arrPool').innerHTML = '';
    $('#arrLine').classList.toggle('solved', ok);
    gradeAny(ok ? 'good' : 'again', 'arrange');
    showAnswer(false);
    finish();
  }

  function say(rate){
    if (!card) return;
    const ok = speech.speak(card.line, store.get().settings.voice, null, typeof rate === 'number' ? rate : .92);
    if (!ok){ bellBtn.classList.add('muted'); toast('이 기기에서 영국 영어(en-GB) 목소리를 찾지 못했습니다.'); return; }
    bellBtn.classList.remove('ring'); void bellBtn.offsetWidth; bellBtn.classList.add('ring');
  }

  async function wipe(){
    if (reduced()) return;
    /* the sheet lifts away and a fresh one settles in its place */
    const a = slate.animate([{opacity: 1, transform: 'none'}, {opacity: 0, transform: 'translateY(-14px) rotate(-.6deg)'}], {duration: 380, easing: 'ease-in'});
    await a.finished.catch(() => {});
    slate.style.opacity = 0;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      slate.style.opacity = '';
      slate.animate([{opacity: 0, transform: 'translateY(18px) rotate(.5deg)'}, {opacity: 1, transform: 'none'}], {duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)'});
    }));
  }
  async function advance(){
    speech.stop();
    await wipe();
    const S = sess();
    if (S.pos >= S.queue.length){ busy = false; app.go(`#/report/${deck.id}`); return; }
    render();
    if (!reduced()){ note.classList.remove('swap'); void note.offsetWidth; note.classList.add('swap'); }
    busy = false;
  }

  /* learn, or after an automatic check */
  async function next(){
    if (!done || busy) return;
    busy = true;
    if (mode === 'learn') gradeAny('learn', 'learn');
    await advance();
  }

  /* ---------- slips */
  function breSheet(i){
    const b = card.bre[i];
    openSheet(`<div class="sh-kind"><span>${esc(b.kind)}</span>${b.shared ? '<span class="sh-common">영미 공통</span>' : ''}</div>` +
      `<h2 class="sh-expr" id="shTitle" lang="en">${esc(b.expr)}</h2><p class="sh-note">${esc(b.note)}</p>` +
      `<ul class="sh-ex">${(b.examples || []).map(e => `<li><span class="en" lang="en">${esc(e.en)}</span><span class="kr">${esc(e.ko)}</span></li>`).join('')}</ul>`);
  }
  function partsSheet(){
    const all = cards.filter(c => c.speech === card.speech).sort((a, b) => a.part - b.part);
    openSheet(`<div class="sh-kind"><span>${card.film}편 · ${esc(card.film_ko)}</span></div><h2 class="sh-expr" id="shTitle">발화 전체 (${card.of}조각)</h2>` +
      `<ol class="sh-parts">${all.map(c => `<li class="${c.id === card.id ? 'now' : ''}"><span class="no">${c.part}</span><div><div class="en" lang="en">${esc(c.line)}</div><div class="kr">${esc(c.ko)}</div></div></li>`).join('')}</ol>`);
  }

  /* ---------- events */
  $('#micBtn').addEventListener('click', listen);
  $('#playBtn').addEventListener('click', () => play(false));
  $('#slowBtn').addEventListener('click', () => play(true));
  $('#dunnoBtn').addEventListener('click', () => checkRecall(''));
  $('#typedIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing){ e.preventDefault(); $('#typedForm').requestSubmit(); } });
  $('#typedForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#typedIn').value.trim(); if (v) checkRecall(v); });
  nextBtn.addEventListener('click', next);
  $('#czOpts').addEventListener('click', e => { const b = e.target.closest('[data-opt]'); if (b) choose(b.dataset.opt); });
  $('#arrPool').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) pick(+b.dataset.t); });
  $('#arrLine').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (b) unpick(+b.dataset.p); });
  $('#arrGive').addEventListener('click', () => { if (mode === 'arrange' && !answered && !busy) checkArrange(true); });
  $('#sBre').addEventListener('click', e => { const b = e.target.closest('[data-bre]'); if (b) breSheet(+b.dataset.bre); });
  $('#sParts').addEventListener('click', partsSheet);
  bellBtn.addEventListener('click', say);
  $('#backBtn').addEventListener('click', () => { speech.stop(); app.leftRoom = deck && deck.id; app.go('#/'); });
  document.addEventListener('keydown', e => {
    if (room.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape'){ if (isSheetOpen()) closeSheet(); else $('#backBtn').click(); return; }
    if (isSheetOpen()) return;
    const onField = e.target.closest && e.target.closest('button, input, select, textarea');
    if ((e.key === ' ' || e.key === 'Enter') && !onField){
      if (done){ e.preventDefault(); next(); }
      else if (mode === 'recall' && !answered){ e.preventDefault(); if (kind === 'dict') play(false); else typeMode(); }
    }
    else if (onField) return;
    else if ((mode === 'cloze' || mode === 'example' || mode === 'pick') && !answered && ['1', '2', '3', '4'].includes(e.key)){ const b = $$('#czOpts button')[+e.key - 1]; if (b) choose(b.dataset.opt); }
    else if (e.key === 'r' || e.key === 'R'){ if (slate.classList.contains('back')) say(); }
  });

  async function show({id, sub}){
    const d = byId(id);
    if (!d || !d.file){ toast('아직 준비 중인 교실입니다.'); app.go('#/', true); return; }
    deck = d;
    $('#rTitle').textContent = d.room;
    room.setAttribute('aria-label', `${d.ko}의 교실`);
    wall();
    try { [cards, practice, examples] = await Promise.all([app.loadDeck(d.id), app.loadPractice(d.id), app.loadExamples(d.id)]); }
    catch (e){ toast('대본을 불러오지 못했습니다. 인터넷 연결을 확인하세요.'); app.go('#/', true); return; }
    map = Object.fromEntries(cards.map(c => [c.id, c]));
    day = srs.session(d.id, cards);
    extra = ROUND[sub] ? sub : '';
    if (extra){
      if (extra === 'extra' && !srs.learnedCount(d.id, cards)){ toast('아직 배운 대사가 없습니다.'); app.go('#/', true); return; }
      if (extra === 'wrong' && !srs.wrongLines(d.id, cards).length){ toast('다시 볼 대사가 없습니다. 틀린 적이 없군요.'); app.go('#/', true); return; }
      if (extra === 'req'){
        const a = bond.activeRequest(d.id);
        if (!a || !a.cards.length){ toast('지금 맡은 부탁이 없습니다.'); app.go('#/', true); return; }
        srs.roundSession(d.id, cards, 'req', 10, a.cards);
      }
      else srs.roundSession(d.id, cards, extra);
      day = store.deck(d.id).day;
    }
    else if (day.pos >= day.queue.length){ app.go(`#/report/${d.id}`, true); return; }
    await app.fontsReady;
    render();
    bakeProps();
    bellBtn.classList.toggle('muted', !speech.gbVoices().length);
    if (!extra) hint('lesson');   // the first lesson ever: Dumbledore's note on new lines and reviews
  }
  function resize(){
    if (!deck) return;
    wall();
    bakeProps();
    if (slate.classList.contains('back') && !slate.classList.contains('noline'))
      writeLine(card.line, findRanges(card.line, card.bre), false, mode === 'learn' ? diffRanges(card.line, card.plain) : [], missRanges);
  }
  return {show, resize, hide: () => { speech.stop(); resetRecall(); }};
}
