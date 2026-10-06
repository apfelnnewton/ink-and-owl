/* Spells (2026-10-06 user decision, plan docs/plan-spells.md): three per professor, 21 in all, each a family of formal
   English words grown from the incantation's Latin root. The words are in spells/spells.json (written from
   docs/spells-<prof>.md). This file decides when a professor calls the learner in, keeps what has been learnt and
   when it is next looked at again, and hands out questions for reviews and for the new-wand test (ollivander.js).
   A spell opens when: the learner has a wand, the professor's door is open, and — spell 1: ten of that professor's
   lines learnt / spell 2: stage '알아봄' / spell 3: stage '인정' (each after the one before). The professor's letter
   (S-<spell id>, in their post) brings the lesson; at most one such letter a day, the longest-open door first.
   Reviews live only in the spellbook (#/me/spells): 3 → 7 → 18 → 45 days, a mark when one is due, no reminders.
   state.spells = {sent:{id:date}, learnt:{id:{d, i, due}}, day: date of the last letter} */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as doors from './doors.js';
import * as wand from './wand.js';

let DATA = null;
export const load = () => DATA ? Promise.resolve(DATA) : fetch('spells/spells.json').then(r => r.ok ? r.json() : null).then(j => (DATA = j)).catch(() => null);
export const loaded = () => !!DATA;
export const all = () => DATA || [];
export const get = id => all().find(s => s.id === id);
export const ofProf = prof => all().filter(s => s.prof === prof).sort((a, b) => a.n - b.n);

function st(){ const s = store.get(); if (!s.spells) s.spells = {sent: {}, learnt: {}, day: ''}; return s.spells; }
export const isSent = id => !!st().sent[id];
export const isLearnt = id => !!st().learnt[id];
export const learntList = () => all().filter(s => isLearnt(s.id));

const LINES_FOR_FIRST = 10;
const learnedLines = prof => Object.keys(store.deck(prof).cards || {}).length;
/* what still stands between the learner and a spell, in words (the spellbook shows it on a locked page) */
export function condition(sp){
  if (sp.n === 1) return `대사 ${LINES_FOR_FIRST}개 배우기`;
  return `관계 '${bond.STAGES[sp.n - 1]}'`;
}
export function ready(sp){
  if (!wand.get() || !doors.isOpen(sp.prof)) return false;
  if (sp.n > 1){ const prev = ofProf(sp.prof).find(x => x.n === sp.n - 1); if (!prev || !isSent(prev.id)) return false; }
  return sp.n === 1 ? learnedLines(sp.prof) >= LINES_FOR_FIRST : bond.stage(sp.prof) >= sp.n - 1;
}
/* the next letter to send, if any today: the door opened earliest first, then the lowest spell */
export function due(){
  if (!DATA || !wand.get() || st().day === srs.today()) return null;
  const order = (store.get().doors || {}).open || [];
  const list = all().filter(s => !isSent(s.id) && ready(s))
    .sort((a, b) => (order.indexOf(a.prof) - order.indexOf(b.prof)) || a.n - b.n);
  return list[0] || null;
}
/* called with the other daily letters (bond.daily) */
export async function daily(){
  await load();
  const sp = due(); if (!sp) return false;
  if (!bond.postItem(sp.prof, 'S-' + sp.id)) return false;
  const s = st(); s.sent[sp.id] = srs.today(); s.day = srs.today();
  store.save();
  return true;
}
/* the letter's words, for the post (bond.itemOf) */
export function textOf(prof, key){
  const sp = get(key.slice(2)); if (!sp || sp.prof !== prof) return null;
  return {kind: '주문 수업', en: sp.letter.en, ko: sp.letter.ko, spell: sp.id};
}

/* ---------- learning and reviewing */
const LADDER = [3, 7, 18, 45];
export function learn(id){
  const s = st(); if (s.learnt[id]) return;
  s.learnt[id] = {d: srs.today(), i: LADDER[0], due: srs.addDays(srs.today(), LADDER[0])};
  if (!s.sent[id]) s.sent[id] = srs.today();
  store.save();
}
export const reviewDue = id => { const l = st().learnt[id]; return !!l && l.due <= srs.today(); };
export const dueCount = () => learntList().filter(s => reviewDue(s.id)).length;
/* a review passed moves up the ladder; one not passed comes back in three days (nothing is ever lost) */
export function reviewed(id, ok){
  const l = st().learnt[id]; if (!l) return;
  const k = LADDER.indexOf(l.i);
  /* past the last rung (45 days) the gap keeps doubling */
  l.i = !ok ? LADDER[0] : k >= 0 && k < LADDER.length - 1 ? LADDER[k + 1] : l.i * 2;
  l.due = srs.addDays(srs.today(), l.i);
  l.last = srs.today();
  store.save();
}

/* ---------- first-letter questions: the spell's own two, and one made from each word's example sentence */
const hash = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
export function writeQs(sp){
  const own = sp.qs.filter(q => q.t === 'write');
  const made = sp.words.map(w => {
    /* the word (or a form of it) in its own example: the longest stretch that starts like the word */
    const stem = w.w.toLowerCase().slice(0, Math.max(4, w.w.length - 3));
    const m = w.en.match(new RegExp(`\\b(${stem.replace(/[^a-z]/g, '')}[a-z]*)`, 'i'));
    if (!m) return null;
    const a = m[1];
    return {t: 'write', ko: w.eko, s: w.en.replace(a, a[0] + '_'.repeat(a.length - 1)), a};
  }).filter(Boolean);
  return [...own, ...made];
}
/* n questions picked for today (fixed for the day, so leaving and coming back gives the same ones) */
export function pick(pool, n, seed){
  const a = pool.map((q, i) => ({q, r: hash(seed + '|' + i)})).sort((x, y) => x.r - y.r);
  return a.slice(0, n).map(x => x.q);
}
export const reviewQs = sp => pick(writeQs(sp), 3, sp.id + srs.today());
/* the new-wand test (plan-wand.md): none if no spell is learnt yet, three for one to four spells, five for more */
export function wandTest(seed){
  const L = learntList(); if (!L.length) return [];
  const n = L.length >= 5 ? 5 : 3;
  const pool = L.flatMap(sp => writeQs(sp).map(q => ({...q, spell: sp.id})));
  /* spread over different spells first */
  const byS = pick(L, L.length, seed + 's');
  const out = [];
  for (let round = 0; out.length < n && round < 6; round++)
    for (const sp of byS){ if (out.length >= n) break; const qs = pick(pool.filter(q => q.spell === sp.id && !out.includes(q)), 1, seed + sp.id + round); if (qs[0]) out.push(qs[0]); }
  return out;
}
/* an answer to a first-letter question: letters only, any case */
export const same = (a, b) => a.trim().toLowerCase().replace(/[^a-z]/g, '') === b.toLowerCase().replace(/[^a-z]/g, '');
