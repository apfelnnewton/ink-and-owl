/* Example work at Malfoy Manor (2026-10-20 user decision): the example sentences of every expression learnt, from any
   teacher, as a second kind of work in each room — up to two rounds a day in each, ten sentences a round, one gap each,
   the right expression picked from four (as in the notebook's example book, notes.js).
     Lucius's study — "fair copy": his correspondence copied out. Wages: 2 Sickles for a round without a slip, 1 otherwise.
     The drawing room — Bellatrix reads the sentences out. No wages: ten right and she throws 1–3 Sickles on the floor;
     a slip and she only sneers. Her words follow what she calls the learner (bella.nameIndex, four stages).
   Both speak as the round goes: a word as it starts, on each answer, at the end, and once or twice on whose expression a
   sentence is built (src). Words: bond/copywork.json ← docs/newfaces-work/assemble-copy.cjs.
   Answers are kept with the example book's (state.exs[deck]: done, miss), so a sentence missed here is in "다시 볼 예문".
   state.manor's `copy` = {d: day, l: Lucius's rounds today, b: hers} */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as manor from './manor.js';
import * as bella from './bella.js';
import {DECKS, byId} from './decks.js';
import {$, esc, openSheet, toast, isSheetOpen} from './ui.js';

const SICKLE = 29, ROUNDS = 2, PER = 10;
let TEXT = null;
export const load = () => TEXT ? Promise.resolve(TEXT) : fetch('bond/copywork.json').then(r => r.ok ? r.json() : null).then(j => (TEXT = j)).catch(() => null);
const st = () => { const m = store.get().manor || (store.get().manor = {}), c = m.copy || (m.copy = {}), t = srs.today(); if (c.d !== t){ c.d = t; c.l = 0; c.b = 0; } return c; };
const slot = who => who === 'lucius' ? 'l' : 'b';
export const left = who => Math.max(0, ROUNDS - (st()[slot(who)] || 0));
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const X = id => { const s = store.get(), all = s.exs || (s.exs = {}), x = all[id] || (all[id] = {}); x.miss = x.miss || {}; x.done = x.done || {}; return x; };

/* what the speaker of the room says: Lucius's one set, or hers for the name she calls the learner now */
const words = who => !TEXT ? null : who === 'lucius' ? TEXT.lucius : (TEXT.her.stages[Math.min(3, bella.nameIndex())]);
const srcOf = who => TEXT && (who === 'lucius' ? TEXT.lucius.src : TEXT.her.src);
/* each list is dealt like a pack: every line once before any comes again (and never the same line twice running) */
const packs = new WeakMap();
let lastSaid = '';
function one(list){
  if (!list || !list.length) return null;
  let p = packs.get(list);
  if (!p || !p.length){ p = shuffle(list); if (p.length > 1 && p[0].en === lastSaid) p.push(p.shift()); packs.set(list, p); }
  const l = p.shift(); lastSaid = l.en; return l;
}
const say = l => l ? `<div class="tea-say cw-say"><p class="en" lang="en">${esc(bond.fill(l.en))}</p><p class="ko">${esc(bond.fill(l.ko))}</p></div>` : '';

/* every expression learnt, in every room open to the learner, with its examples (each deck's file once, cached by app) */
async function entries(app){
  const out = [];
  for (const d of DECKS){
    if (!d.examples || !Object.keys(store.deck(d.id).cards || {}).length) continue;
    let cards, ex;
    try { [cards, ex] = await Promise.all([app.loadDeck(d.id), app.loadExamples(d.id)]); } catch (e){ continue; }
    const learnt = store.deck(d.id).cards;
    for (const c of cards || []) if (learnt[c.id]) (c.bre || []).forEach((b, k) => {
      const key = `${c.id}#${k}`, items = ((ex[key] && ex[key].items) || []).map((it, i) => ({...it, tag: `${key}.${i}`, expr: b.expr, deck: d.id, key}));
      if (items.length) out.push({key, deck: d.id, expr: b.expr.toLowerCase(), items});
    });
  }
  return out;
}
export const any = () => DECKS.some(d => d.examples && Object.keys(store.deck(d.id).cards || {}).length);

let run = null, ALL = [];
/* ten sentences, the least asked first, no two from the same expression (the same words learnt from two lines count once) */
function pickTen(){
  const done = it => X(it.deck).done[it.tag] || 0;
  const items = shuffle(ALL.flatMap(e => e.items)).sort((a, b) => done(a) - done(b)), seen = new Set(), out = [];
  for (const it of items){ const k = it.expr.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(it); if (out.length >= PER) break; }
  return shuffle(out);
}
/* the four choices: the answer, a near miss of its form, two other expressions learnt (any room), in the answer's case */
function choices(it){
  const low = s => s.toLowerCase().trim(), taken = new Set([low(it.blank)]);
  const near = shuffle(it.options || []).find(o => !taken.has(low(o))); if (near) taken.add(low(near));
  const out = [it.blank, ...(near ? [near] : [])];
  const cap = /^[A-Z]/.test(it.blank), fit = b => cap ? b[0].toUpperCase() + b.slice(1) : /^[A-Z]/.test(b) ? '' : b;
  for (const e of shuffle(ALL.filter(e => e.expr !== it.expr.toLowerCase()))){
    if (out.length >= 4) break;
    const f = shuffle(e.items).map(x => fit(x.blank)).find(b => b && !taken.has(low(b)));
    if (f){ out.push(f); taken.add(low(f)); }
  }
  for (const o of it.options || []) if (out.length < 4 && !taken.has(low(o))){ out.push(o); taken.add(low(o)); }
  return shuffle(out);
}
const HEAD = {lucius: ['편지 정서', '루시우스의 서재'], bella: ['불러 주는 문장', '응접실']};

/* the way in, from the room's card (manor.js): a round, or — the day's rounds done — the word that says so */
export async function open(who, app, onDone){
  await load();
  if (!TEXT){ toast('글을 불러오지 못했습니다.'); return; }
  const w = words(who);
  if (!left(who)){ openSheet(`<div class="sh-kind"><span>${HEAD[who][1]} · ${HEAD[who][0]}</span><span>오늘 ${ROUNDS}번 다 했다</span></div>` + say(one(w.done)) + '<p class="purse-note">내일 다시 할 수 있다.</p>'); return; }
  ALL = await entries(app);
  if (!ALL.length){ toast('아직 배운 표현이 없습니다.'); return; }
  const items = pickTen();
  /* once or twice a round, on whose expression the sentence is built (not on the first: that one has the opening word) */
  const at = shuffle(items.map((_, i) => i).slice(1)).slice(0, items.length > 5 ? 2 : 1);
  run = {who, items, k: 0, right: 0, wrong: [], src: new Set(at), onDone};
  ask();
}
function ask(){
  const it = run.items[run.k], at = it.en.indexOf(it.blank), w = words(run.who), sr = srcOf(run.who);
  const opts = it.opts || (it.opts = choices(it));
  const line = run.k === 0 ? one(w.open) : run.src.has(run.k) && sr ? one(sr[it.deck]) : null;
  openSheet(`<div class="sh-kind"><span>${HEAD[run.who][0]} ${run.k + 1} / ${run.items.length}</span><span>${run.right}개 맞음</span></div>` +
    `<div class="cw-top">${say(line)}</div>` +
    `<p class="dr-line" lang="en">${esc(it.en.slice(0, at))}<span class="dr-blank">${' '.repeat(Math.max(6, it.blank.length))}</span>${esc(it.en.slice(at + it.blank.length))}</p>` +
    `<div class="dr-opts">${opts.map((o, i) => `<button type="button" data-cwpick="${esc(o)}"><i>${i + 1}</i>${esc(o)}</button>`).join('')}</div>` +
    `<p class="dr-ko" hidden>${esc(it.ko)}</p><p class="dr-expr" hidden><span lang="en">${esc(it.expr)}</span> · ${esc(byId(it.deck).ko)}의 표현</p>` +
    `<button type="button" class="sh-drill dr-next" data-cwnext="1" hidden>${run.k + 1 < run.items.length ? '다음 →' : '끝내기'}</button>`);
}
function pick(opt){
  const it = run.items[run.k], body = $('#sheetBody');
  if (body.querySelector('.dr-opts button:disabled')) return;
  const ok = opt === it.blank, x = X(it.deck), w = words(run.who);
  if (ok) run.right++; else run.wrong.push(it);
  x.done[it.tag] = (x.done[it.tag] || 0) + 1; if (ok) delete x.miss[it.tag]; else x.miss[it.tag] = srs.today();
  store.save();
  body.querySelectorAll('.dr-opts button').forEach(b => { b.disabled = true; if (b.dataset.cwpick === it.blank) b.classList.add('right'); else if (b.dataset.cwpick === opt) b.classList.add('wrong'); });
  const blank = body.querySelector('.dr-blank'); blank.textContent = it.blank; blank.classList.add(ok ? 'right' : 'wrong');
  body.querySelector('.cw-top').innerHTML = say(one(ok ? w.right : w.wrong));
  body.querySelector('.dr-ko').hidden = false; body.querySelector('.dr-expr').hidden = false; body.querySelector('.dr-next').hidden = false;
}
const filled = it => { const at = it.en.indexOf(it.blank); return at < 0 ? esc(it.en) : esc(it.en.slice(0, at)) + `<b>${esc(it.blank)}</b>` + esc(it.en.slice(at + it.blank.length)); };
function finish(){
  const c = st(), w = words(run.who), n = run.items.length, miss = n - run.right;
  c[slot(run.who)] = (c[slot(run.who)] || 0) + 1;
  const tier = miss === 0 ? 'all' : miss <= 3 ? 'some' : 'many';
  /* Lucius pays for the work; she only throws something when there was no slip */
  const s = run.who === 'lucius' ? (miss ? 1 : 2) : (miss ? 0 : 1 + Math.floor(Math.random() * 3));
  if (s) manor.earn(s * SICKLE);
  store.save();
  const coin = run.who === 'lucius' ? `시클 ${s}닢을 받았다` : s ? `시클 ${s}닢이 바닥을 구른다` : '바닥에 떨어진 것은 없다';
  const more = left(run.who);
  openSheet(`<div class="sh-kind"><span>${HEAD[run.who][1]} · ${HEAD[run.who][0]}</span><span>오늘 ${ROUNDS - more} / ${ROUNDS}번</span></div>` +
    `<h2 class="sh-expr" id="shTitle">${run.right} / ${n}</h2>` + say(one(w.end[tier])) +
    `<p class="mn-paid"><img src="assets/money/sickle.webp" alt=""><b>${coin}</b><span>주머니 · ${esc(manor.money(manor.purse()))}</span></p>` +
    (run.wrong.length ? `<h3 class="ex-wh">틀린 문제 ${run.wrong.length}개 · 표현 노트의 "다시 볼 예문"에 모아 둠</h3><ul class="sh-ex">${run.wrong.map(it => `<li><span class="en" lang="en">${filled(it)}</span><span class="kr">${esc(it.ko)}</span></li>`).join('')}</ul>` : '') +
    (more ? `<button type="button" class="sh-drill" data-cwagain="${run.who}">한 번 더 · 오늘 ${more}번 남음</button>` : `<p class="purse-note">오늘 ${HEAD[run.who][0]}은 끝났다. 내일 다시 할 수 있다.</p>`));
  run.done = true;
  if (run.onDone) run.onDone();
}

export function initCopywork(app){
  $('#sheetBody').addEventListener('click', e => {
    if (!run && !e.target.closest('[data-cwagain]')) return;
    const p = e.target.closest('[data-cwpick]'); if (p && run && !run.done){ pick(p.dataset.cwpick); return; }
    if (e.target.closest('[data-cwnext]') && run && !run.done){ run.k++; if (run.k < run.items.length) ask(); else finish(); return; }
    const a = e.target.closest('[data-cwagain]'); if (a){ const cb = run && run.onDone; run = null; open(a.dataset.cwagain, app, cb); }
  });
  document.addEventListener('keydown', e => {
    if (!run || run.done || !isSheetOpen() || !['1', '2', '3', '4'].includes(e.key) || e.target.closest('input, textarea')) return;
    const b = $('#sheetBody').querySelectorAll('.dr-opts button')[+e.key - 1]; if (b && b.dataset.cwpick !== undefined) pick(b.dataset.cwpick);
  });
}
