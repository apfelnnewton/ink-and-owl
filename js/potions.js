/* Snape's potions lessons: which are open and what has been made (2026-10-14 user decision). The lesson itself is
   potion.js (#/potion/<n>); the recipes and his words are potions/potions.json.
   A year of his lines is film n + book n (the deck is learnt in that order). When every line of a year has been
   learnt, Snape's letter PO-<n> comes (one a day, the earliest year first) and opens that year's potion; its button
   goes to the dungeon. The key ingredient is bought at Slug & Jiggers; the very first time only, Snape lends it
   ("this once"), and the next day Dumbledore writes (PD) how to come by it — if the shops are not open yet.
   The best result of each potion is kept and the phial stands in the potion cabinet on the wall of the guest room.
   state.potions = {sent: {n: date}, best: {n: 'perfect'|'fair'}, lent: date the stores were borrowed from,
                    dd: date of Dumbledore's letter, day: date of the last letter}   ?potion=<n> sends that letter now */
import * as store from './store.js';
import * as srs from './srs.js';
import * as bond from './bond.js';
import * as shops from './shops.js';

let DATA = null, CARDS = null;
export const load = () => DATA ? Promise.resolve(DATA) : fetch('potions/potions.json').then(r => r.ok ? r.json() : null).then(j => (DATA = j)).catch(() => null);
const cards = () => CARDS ? Promise.resolve(CARDS) : fetch('data/snape.json').then(r => r.ok ? r.json() : null).then(j => (CARDS = j)).catch(() => null);
export const st = () => { const s = store.get(), p = s.potions || (s.potions = {}); p.sent = p.sent || {}; p.best = p.best || {}; return p; };
export const potion = n => DATA ? DATA.potions.find(p => p.n === n) || null : null;
export const all = () => DATA ? DATA.potions : [];
const RANK = {fair: 1, perfect: 2};
export const best = n => st().best[n] || null;
export const isOpen = n => !!st().sent[n];

/* a year of Snape's lines, learnt to the last (cards with a record in the deck) */
function yearLearnt(n){
  if (!CARDS) return false;
  const ds = store.deck('snape').cards || {}, year = CARDS.filter(c => c.card !== false && c.film === n);
  return year.length > 0 && year.every(c => ds[c.id]);
}

/* called with the other daily letters (bond.daily) */
export async function daily(){
  if (!(await load()) || !(await cards())) return false;
  const p = st(), t = srs.today();
  /* the day after the stores were borrowed from: Dumbledore, if there is still no shop to buy from */
  if (p.lent && p.lent < t && !p.dd && !shops.isOpen() && bond.postItem('dumbledore', 'PD')){ p.dd = t; store.save(); }
  const force = +(new URLSearchParams(location.search).get('potion') || 0);
  if (p.day === t && !force) return false;
  for (const P of DATA.potions){
    if (p.sent[P.n] || P.ready === false) continue;   // a potion whose pictures are not drawn yet waits (potions.json, applypo.cjs)
    if (P.n !== force && !yearLearnt(P.n)) continue;
    if (!bond.postItem('snape', 'PO-' + P.n)) return false;
    p.sent[P.n] = t; p.day = t; store.save();
    return true;
  }
  return false;
}

/* the letters' words, for the post (bond.itemOf) */
export function textOf(id, key){
  if (!DATA) return null;
  if (key === 'PD') return id === 'dumbledore' && DATA.dumbledore ? {kind: '편지', ...DATA.dumbledore} : null;
  const P = potion(+key.slice(3)); if (!P || id !== 'snape') return null;
  return {kind: '조제 수업', en: P.letter.en, ko: P.letter.ko, go: '#/potion/' + P.n, btn: '지하 교실로 · 조제 수업'};
}

/* the line on Snape's door in the corridor: a lesson whose letter has come and that has not been brewed yet (or whose
   cauldron, left to stew, is ready to be finished) */
export function waiting(){
  const p = st(); if (!DATA) return null;
  return DATA.potions.find(P => p.sent[P.n] && !p.best[P.n] && !stewLeft(P.n)) || null;
}

/* where the key ingredient comes from now: 'own' (in the bag), 'lend' (the first potion, for one who has no shop to
   buy from yet: Snape's stores, once — used up when the quills go in), 'none' */
export function source(P){
  if (shops.have(P.buy)) return 'own';
  const p = st();
  return P.n === 1 && !p.lent && !shops.isOpen() ? 'lend' : 'none';
}
export function borrowed(){ const p = st(); if (!p.lent){ p.lent = srs.today(); store.save(); } }

/* a result: the better one is kept; the first potion of a kind brings Snape a little nearer (as a finished request) */
export function record(n, r){
  const p = st(), had = p.best[n];
  if (!had) bond.gain('snape', 20);
  unstew(n);
  if (!had || RANK[r] > RANK[had]) p.best[n] = r;
  store.save();
}

/* ---------- the potions brewed in two sittings (2026-10-15): the first ends with "leave it to stew for three days";
   what the cauldron holds is kept until then. stew[n] = {d: the day it was left, i: the next thing on the board,
   slips, marks, colour, used: whether the key ingredient has gone in} */
const STEW_DAYS = 3;
export const stewOf = n => (st().stew || {})[n] || null;
export function stew(n, v){ const p = st(); p.stew = p.stew || {}; p.stew[n] = v; store.save(); }
export function unstew(n){ const p = st(); if (p.stew && p.stew[n]){ delete p.stew[n]; store.save(); } }
/* days still to wait (0 = ready) */
export const stewLeft = n => { const s = stewOf(n); if (!s) return 0; let k = 0; while (k < STEW_DAYS && srs.addDays(s.d, k + 1) <= srs.today()) k++; return STEW_DAYS - k; };
